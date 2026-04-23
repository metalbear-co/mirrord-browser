import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const FAKE_BACKEND = 'http://127.0.0.1:3457';
const FAKE_TOKEN = 'test-token';
const TEST_SERVER = 'http://localhost:3456';

async function configureBackend(
    context: import('@playwright/test').BrowserContext,
    extensionId: string
) {
    const page = await context.newPage();
    await page.goto(
        `chrome-extension://${extensionId}/pages/configure.html?backend=${encodeURIComponent(
            FAKE_BACKEND
        )}&token=${FAKE_TOKEN}`
    );
    await expect(page.getByText(/mirrord ui connected/i)).toBeVisible();
    return page;
}

async function openSessionsTab(popup: Page) {
    await popup.waitForTimeout(1500);
    const sessionsTab = popup.getByRole('tab', { name: /sessions/i });
    if (await sessionsTab.isVisible()) {
        await sessionsTab.click();
    }
    await expect(popup.getByText('Live sessions', { exact: true })).toBeVisible(
        { timeout: 15_000 }
    );
}

test.describe('operator-sessions flow', () => {
    test('extension lists operator sessions after configure.html visit', async ({
        context,
        extensionId,
    }) => {
        await configureBackend(context, extensionId);
        const popup = await context.newPage();
        await popup.goto(`chrome-extension://${extensionId}/pages/popup.html`);
        await openSessionsTab(popup);
        await expect(
            popup.getByText('k1', { exact: false }).first()
        ).toBeVisible();
        await expect(
            popup.getByText('k2', { exact: false }).first()
        ).toBeVisible();
    });

    test('clicking Join for a key writes the expected DNR rule', async ({
        context,
        extensionId,
    }) => {
        await configureBackend(context, extensionId);
        const popup = await context.newPage();
        await popup.goto(`chrome-extension://${extensionId}/pages/popup.html`);
        await openSessionsTab(popup);

        const joinK1 = popup.getByRole('button', { name: /join k1/i }).first();
        await expect(joinK1).toBeVisible({ timeout: 15_000 });
        await joinK1.click();

        await expect(popup.getByText(/joined/i).first()).toBeVisible({
            timeout: 10_000,
        });

        const target = await context.newPage();
        await target.goto(`${TEST_SERVER}/headers`);
        const body = await target.locator('body').innerText();
        const headers = JSON.parse(body);
        expect(headers['baggage']).toContain('mirrord-session=k1');
    });

    test('saving a manual rule after joining clears the session-live banner', async ({
        context,
        extensionId,
    }) => {
        await configureBackend(context, extensionId);
        const popup = await context.newPage();
        await popup.goto(`chrome-extension://${extensionId}/pages/popup.html`);
        await openSessionsTab(popup);

        const joinK1 = popup.getByRole('button', { name: /join k1/i }).first();
        await expect(joinK1).toBeVisible({ timeout: 15_000 });
        await joinK1.click();
        await expect(popup.getByText(/session live/i)).toBeVisible({
            timeout: 10_000,
        });

        await popup.getByRole('tab', { name: /manual/i }).click();
        await popup.getByLabel(/header name/i).fill('x-override');
        await popup.getByLabel(/header value/i).fill('manual-rule');
        await popup.getByRole('button', { name: /^save$/i }).click();

        await popup.getByRole('tab', { name: /sessions/i }).click();
        await expect(popup.getByText(/session live/i)).toBeHidden({
            timeout: 5_000,
        });
    });

    test('session-ended banner appears when operator_session_removed received', async ({
        context,
        extensionId,
    }) => {
        const configPage = await configureBackend(context, extensionId);
        const popup = await context.newPage();
        await popup.goto(`chrome-extension://${extensionId}/pages/popup.html`);
        await openSessionsTab(popup);

        const joinK1 = popup.getByRole('button', { name: /join k1/i }).first();
        await expect(joinK1).toBeVisible({ timeout: 15_000 });
        await joinK1.click();
        await expect(popup.getByText(/joined/i).first()).toBeVisible({
            timeout: 10_000,
        });

        await configPage.request.post(`${FAKE_BACKEND}/__inject/remove`, {
            data: { name: 'a' },
        });

        await expect(popup.getByText(/session ended/i)).toBeVisible({
            timeout: 10_000,
        });
    });
});
