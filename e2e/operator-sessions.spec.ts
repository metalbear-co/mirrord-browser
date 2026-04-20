import { test, expect } from './fixtures';

const FAKE_BACKEND = 'http://127.0.0.1:3457';
const FAKE_TOKEN = 'test-token';
const TEST_SERVER = 'http://localhost:3456';

test.describe('operator-sessions flow', () => {
    test('extension lists operator sessions after configure.html visit', async ({
        context,
        extensionId,
    }) => {
        const page = await context.newPage();
        await page.goto(
            `chrome-extension://${extensionId}/pages/configure.html?backend=${encodeURIComponent(
                FAKE_BACKEND
            )}&token=${FAKE_TOKEN}`
        );
        await expect(page.getByText(/mirrord ui connected/i)).toBeVisible();

        const popup = await context.newPage();
        await popup.goto(`chrome-extension://${extensionId}/pages/popup.html`);
        await expect(
            popup.getByText('Sessions', { exact: true })
        ).toBeVisible();
        await expect(popup.getByText('k1')).toBeVisible();
        await expect(popup.getByText('k2')).toBeVisible();
    });

    test('clicking Join for a key writes a baggage DNR rule', async ({
        context,
        extensionId,
    }) => {
        const page = await context.newPage();
        await page.goto(
            `chrome-extension://${extensionId}/pages/configure.html?backend=${encodeURIComponent(
                FAKE_BACKEND
            )}&token=${FAKE_TOKEN}`
        );
        await expect(page.getByText(/mirrord ui connected/i)).toBeVisible();

        const popup = await context.newPage();
        await popup.goto(`chrome-extension://${extensionId}/pages/popup.html`);
        // Wait for session data to load (button only renders when sessions exist).
        const joinK1 = popup.getByRole('button', { name: /join k1/i });
        await expect(joinK1).toBeVisible();
        await joinK1.click();

        // After join, the button becomes "Rejoin" (same aria-label).
        await expect(joinK1).toHaveText(/rejoin/i);

        const target = await context.newPage();
        await target.goto(`${TEST_SERVER}/headers`);
        const body = await target.locator('body').innerText();
        const headers = JSON.parse(body);
        expect(headers['baggage']).toContain('mirrord-session=k1');
    });

    test('session-ended banner appears when operator_session_removed received', async ({
        context,
        extensionId,
    }) => {
        const page = await context.newPage();
        await page.goto(
            `chrome-extension://${extensionId}/pages/configure.html?backend=${encodeURIComponent(
                FAKE_BACKEND
            )}&token=${FAKE_TOKEN}`
        );
        await expect(page.getByText(/mirrord ui connected/i)).toBeVisible();

        const popup = await context.newPage();
        await popup.goto(`chrome-extension://${extensionId}/pages/popup.html`);
        const joinK1 = popup.getByRole('button', { name: /join k1/i });
        await expect(joinK1).toBeVisible();
        await joinK1.click();
        await expect(joinK1).toHaveText(/rejoin/i);

        // Trigger removal of session "a" (first session under k1, which is the
        // session name recorded by the join hook). This flips sessionEnded.
        await page.request.post(`${FAKE_BACKEND}/__inject/remove`, {
            data: { name: 'a' },
        });

        await expect(popup.getByText(/session ended/i)).toBeVisible({
            timeout: 10_000,
        });
    });
});
