import { test, expect } from './fixtures';
import { addHeader } from './helpers';
import type { Worker } from '@playwright/test';

interface CapturedEvent {
    event: string;
    properties: Record<string, unknown>;
}

const TEST_URL = 'http://localhost:3456/';

async function spyOnWorkerAnalytics(worker: Worker): Promise<void> {
    await worker.evaluate(() => {
        const scope = self as unknown as {
            __captured__?: unknown[];
            fetch: typeof fetch;
        };
        if (scope.__captured__) {
            return;
        }
        const captured: unknown[] = [];
        scope.__captured__ = captured;
        const orig = scope.fetch.bind(self);
        scope.fetch = async (
            input: RequestInfo | URL,
            init?: RequestInit
        ): Promise<Response> => {
            try {
                const url =
                    typeof input === 'string'
                        ? input
                        : input instanceof URL
                          ? input.href
                          : input.url;
                const body = init?.body;
                if (url.includes('/capture/') && typeof body === 'string') {
                    captured.push(JSON.parse(body));
                }
            } catch {
                // never break the request path
            }
            return orig(input, init);
        };
    });
}

async function capturedEvents(worker: Worker): Promise<CapturedEvent[]> {
    return worker.evaluate(
        () =>
            (self as unknown as { __captured__?: CapturedEvent[] })
                .__captured__ ?? []
    );
}

test('observing the injected header resolves the canary in the service worker', async ({
    context,
    popupPage,
}) => {
    const worker =
        context.serviceWorkers()[0] ??
        (await context.waitForEvent('serviceworker'));
    await spyOnWorkerAnalytics(worker);

    await addHeader(popupPage, 'x-mirrord-user', 'canary-e2e');

    const page = await context.newPage();
    await page.goto(TEST_URL);
    await page.goto(`${TEST_URL}?second=1`);

    await expect
        .poll(
            async () => {
                const events = await capturedEvents(worker);
                return events.some(
                    (e) =>
                        e.event === 'extension_user_succeeded' &&
                        e.properties['reason'] === 'header_observed'
                );
            },
            { timeout: 15_000 }
        )
        .toBe(true);

    const events = await capturedEvents(worker);
    const blocked = events.filter(
        (e) =>
            e.event === 'extension_user_blocked' &&
            e.properties['reason'] === 'no_header_observed'
    );
    expect(blocked).toHaveLength(0);
});
