import { test, expect } from './fixtures';
import { addHeader } from './helpers';
import type { BrowserContext, Page } from '@playwright/test';

/**
 * Instrument a page to capture analytics events by wrapping fetch().
 *
 * The analytics module sends events via fetch() to hog.metalbear.com/capture/.
 * We intercept those calls with addInitScript to record the event payloads
 * before they hit the network.
 */
async function setupAnalyticsSpy(page: Page): Promise<void> {
    await page.addInitScript(() => {
        (window as any).__captured_analytics__ = [];
        const captured: Array<{ event: string; properties: any }> = (
            window as any
        ).__captured_analytics__;

        const origFetch = window.fetch.bind(window);
        window.fetch = async (input: any, init?: any) => {
            try {
                const url =
                    typeof input === 'string' ? input : input?.url || '';
                if (url.includes('/capture/') && init?.body) {
                    const body = JSON.parse(init.body as string);
                    captured.push({
                        event: body.event,
                        properties: body.properties || {},
                    });
                }
            } catch {
                // Don't break anything
            }
            return origFetch(input, init);
        };

        const origBeacon = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = (url: string, data?: any) => {
            try {
                if (url.includes('/capture/') && data) {
                    const body = JSON.parse(data as string);
                    captured.push({
                        event: body.event,
                        properties: body.properties || {},
                    });
                }
            } catch {
                // Don't break anything
            }
            return origBeacon(url, data);
        };
    });
}

async function getCapturedEvents(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const events: Array<{ event: string }> =
            (window as any).__captured_analytics__ || [];
        return events.map((e) => e.event);
    });
}

async function openPopupWithSpy(
    context: BrowserContext,
    extensionId: string
): Promise<Page> {
    const page = await context.newPage();
    await setupAnalyticsSpy(page);
    await page.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    return page;
}

test.describe('Analytics events', () => {
    test('popup open sends extension_popup_opened event', async ({
        context,
        extensionId,
    }) => {
        const page = await openPopupWithSpy(context, extensionId);
        await expect(page.getByText('mirrord')).toBeVisible();

        const events = await getCapturedEvents(page);
        expect(events).toContain('extension_popup_opened');
    });

    test('saving a header rule sends extension_header_rule_saved event', async ({
        context,
        extensionId,
    }) => {
        const page = await openPopupWithSpy(context, extensionId);
        await expect(page.getByText('Inactive')).toBeVisible();

        await addHeader(page, 'X-Analytics-Test', 'analytics-value');

        const events = await getCapturedEvents(page);
        expect(events).toContain('extension_header_rule_saved');
    });

    test('removing a header rule sends extension_header_rule_removed event', async ({
        context,
        extensionId,
    }) => {
        const page = await openPopupWithSpy(context, extensionId);
        await expect(page.getByText('Inactive')).toBeVisible();

        await addHeader(page, 'X-Remove-Analytics', 'remove-me');
        await page.getByRole('button', { name: 'Remove' }).click();
        await expect(page.getByText('Inactive')).toBeVisible();

        const events = await getCapturedEvents(page);
        expect(events).toContain('extension_header_rule_removed');
    });
});
