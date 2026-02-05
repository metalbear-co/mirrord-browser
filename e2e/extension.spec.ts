import { test, expect } from './fixtures';

const TEST_SERVER = 'http://localhost:3456';

test.describe('mirrord browser extension', () => {
    test('popup shows inactive state on fresh install', async ({
        popupPage,
    }) => {
        await expect(popupPage.getByText('Inactive')).toBeVisible();
        await expect(popupPage.getByText('No active headers')).toBeVisible();
    });

    test('add a header and verify it appears in popup', async ({
        popupPage,
    }) => {
        await popupPage.locator('#headerName').fill('X-Mirrord-Test');
        await popupPage.locator('#headerValue').fill('test-value-123');
        await popupPage.getByRole('button', { name: 'Save' }).click();

        await expect(popupPage.getByText('Saved!')).toBeVisible();
        await expect(
            popupPage.getByText('Active', { exact: true })
        ).toBeVisible();
        await expect(
            popupPage.getByText('X-Mirrord-Test: test-value-123')
        ).toBeVisible();
        await expect(popupPage.getByText('All URLs')).toBeVisible();
    });

    test('header is injected into real HTTP requests', async ({
        context,
        popupPage,
    }) => {
        // Add a header via popup
        await popupPage.locator('#headerName').fill('X-Mirrord-Test');
        await popupPage.locator('#headerValue').fill('test-value-123');
        await popupPage.getByRole('button', { name: 'Save' }).click();
        await expect(popupPage.getByText('Saved!')).toBeVisible();

        // Navigate to test server in a new tab
        const page = await context.newPage();
        await page.goto(`${TEST_SERVER}/headers`);

        const body = await page.locator('body').innerText();
        const headers = JSON.parse(body);

        expect(headers['x-mirrord-test']).toBe('test-value-123');
    });

    test('scoped header only injected on matching URLs', async ({
        context,
        popupPage,
    }) => {
        // Add a header scoped to /scoped/* path only
        await popupPage.locator('#headerName').fill('X-Scoped-Header');
        await popupPage.locator('#headerValue').fill('scoped-value');
        await popupPage.locator('#scope').fill('*://localhost:3456/scoped/*');
        await popupPage.getByRole('button', { name: 'Save' }).click();
        await expect(popupPage.getByText('Saved!')).toBeVisible();

        // Header should be present on matching URL
        const matchingPage = await context.newPage();
        await matchingPage.goto(`${TEST_SERVER}/scoped/headers`);

        const matchBody = await matchingPage.locator('body').innerText();
        const matchHeaders = JSON.parse(matchBody);
        expect(matchHeaders['x-scoped-header']).toBe('scoped-value');

        // Header should NOT be present on non-matching URL
        const nonMatchingPage = await context.newPage();
        await nonMatchingPage.goto(`${TEST_SERVER}/headers`);

        const noMatchBody = await nonMatchingPage.locator('body').innerText();
        const noMatchHeaders = JSON.parse(noMatchBody);
        expect(noMatchHeaders['x-scoped-header']).toBeUndefined();
    });

    test('remove header', async ({ context, popupPage }) => {
        // Add a header first
        await popupPage.locator('#headerName').fill('X-Remove-Me');
        await popupPage.locator('#headerValue').fill('remove-value');
        await popupPage.getByRole('button', { name: 'Save' }).click();
        await expect(popupPage.getByText('Saved!')).toBeVisible();
        await expect(
            popupPage.getByText('Active', { exact: true })
        ).toBeVisible();

        // Remove it
        await popupPage.getByRole('button', { name: 'Remove' }).click();

        await expect(popupPage.getByText('Inactive')).toBeVisible();
        await expect(popupPage.getByText('No active headers')).toBeVisible();

        // Verify header is no longer injected
        const page = await context.newPage();
        await page.goto(`${TEST_SERVER}/headers`);

        const body = await page.locator('body').innerText();
        const headers = JSON.parse(body);
        expect(headers['x-remove-me']).toBeUndefined();
    });

    test('reset to defaults restores CLI-provided config', async ({
        context,
        extensionId,
        popupPage,
    }) => {
        // Simulate CLI defaults in storage
        const bgPage = await context.newPage();
        await bgPage.goto(`chrome-extension://${extensionId}/pages/popup.html`);

        await bgPage.evaluate(() => {
            return new Promise<void>((resolve) => {
                chrome.storage.local.set(
                    {
                        defaults: {
                            headerName: 'X-Default-Header',
                            headerValue: 'default-val',
                        },
                    },
                    resolve
                );
            });
        });
        await bgPage.close();

        // Override with a different header
        await popupPage.locator('#headerName').fill('X-Override');
        await popupPage.locator('#headerValue').fill('override-val');
        await popupPage.getByRole('button', { name: 'Save' }).click();
        await expect(popupPage.getByText('Saved!')).toBeVisible();

        // Reload popup to pick up defaults flag
        await popupPage.reload();

        // Reset to defaults
        await expect(
            popupPage.getByRole('button', { name: 'Reset to Default' })
        ).toBeVisible();
        await popupPage
            .getByRole('button', { name: 'Reset to Default' })
            .click();
        await expect(popupPage.getByText('Reset!')).toBeVisible();

        // Verify default header is now active
        await expect(
            popupPage.getByText('X-Default-Header: default-val')
        ).toBeVisible();

        // Verify the default header is injected
        const page = await context.newPage();
        await page.goto(`${TEST_SERVER}/headers`);
        const body = await page.locator('body').innerText();
        const headers = JSON.parse(body);
        expect(headers['x-default-header']).toBe('default-val');
    });
});
