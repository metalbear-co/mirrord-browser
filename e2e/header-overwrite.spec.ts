import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const TEST_SERVER = 'http://localhost:3456';

async function addHeader(popupPage: Page, name: string, value: string) {
    await popupPage.locator('#headerName').fill(name);
    await popupPage.locator('#headerValue').fill(value);
    await popupPage.getByRole('button', { name: 'Save' }).click();
    await expect(popupPage.getByText('Saved!')).toBeVisible();
    await expect(popupPage.getByText('Active', { exact: true })).toBeVisible();
}

async function readOverwrites(popupPage: Page): Promise<number> {
    return popupPage.evaluate(
        () =>
            new Promise<number>((resolve) => {
                chrome.storage.session.get('header_observation', (stored) => {
                    const obs = stored['header_observation'] as
                        | { overwrites?: number }
                        | undefined;
                    resolve(obs?.overwrites ?? 0);
                });
            })
    );
}

test.describe('injected header overwrites the page value', () => {
    test('a page-set value is replaced, and the replacement is counted', async ({
        context,
        popupPage,
    }) => {
        await addHeader(popupPage, 'baggage', 'mirrord-session=abc123');

        const page = await context.newPage();
        await page.goto(`${TEST_SERVER}/asset-page`);

        const echoed = await page.evaluate(async () => {
            const r = await fetch('http://localhost:3456/b/headers', {
                headers: { baggage: 'trace=pagevalue' },
            });
            return (await r.json()) as Record<string, string>;
        });

        expect(echoed['baggage']).toBe('mirrord-session=abc123');

        await expect
            .poll(() => readOverwrites(popupPage), { timeout: 5_000 })
            .toBeGreaterThan(0);
    });

    test('a request the page does not touch is not counted as a replacement', async ({
        context,
        popupPage,
    }) => {
        await addHeader(popupPage, 'baggage', 'mirrord-session=abc123');

        const page = await context.newPage();
        await page.goto(`${TEST_SERVER}/asset-page`);

        const echoed = await page.evaluate(async () => {
            const r = await fetch('http://localhost:3456/a/headers');
            return (await r.json()) as Record<string, string>;
        });

        expect(echoed['baggage']).toBe('mirrord-session=abc123');
        await page.waitForTimeout(1_000);
        expect(await readOverwrites(popupPage)).toBe(0);
    });
});
