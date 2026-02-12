import { test, expect } from './fixtures';
import { addHeader } from './helpers';
import type { BrowserContext, Page } from '@playwright/test';

/**
 * Instrument a page to capture PostHog events by wrapping posthog.capture().
 *
 * The analytics module sets window.__posthog = posthog. We use
 * Object.defineProperty in addInitScript to intercept that assignment
 * and wrap capture() before any React component code runs.
 *
 * This approach works in chrome-extension:// contexts where Playwright's
 * route() interception and PostHog's network flush don't operate reliably.
 */
async function setupPostHogSpy(page: Page): Promise<void> {
    await page.addInitScript(() => {
        (window as any).__posthog_captured_events__ = [];
        const captured: Array<{ event: string; properties: any }> = (
            window as any
        ).__posthog_captured_events__;

        let instance: any = undefined;

        Object.defineProperty(window, '__posthog', {
            configurable: true,
            get() {
                return instance;
            },
            set(val: any) {
                instance = val;
                if (
                    val &&
                    typeof val.capture === 'function' &&
                    !val.__capture_wrapped__
                ) {
                    const origCapture = val.capture.bind(val);
                    val.capture = (eventName: string, properties?: any) => {
                        captured.push({
                            event: eventName,
                            properties: properties || {},
                        });
                        return origCapture(eventName, properties);
                    };
                    val.__capture_wrapped__ = true;
                }
            },
        });
    });
}

async function getCapturedEvents(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const events: Array<{ event: string }> =
            (window as any).__posthog_captured_events__ || [];
        return events.map((e) => e.event);
    });
}

async function openPopupWithSpy(
    context: BrowserContext,
    extensionId: string
): Promise<Page> {
    const page = await context.newPage();
    await setupPostHogSpy(page);
    await page.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    return page;
}

test.describe('PostHog analytics events', () => {
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
