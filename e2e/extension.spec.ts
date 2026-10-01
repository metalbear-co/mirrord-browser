import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const TEST_SERVER = 'http://localhost:3456';

type HeadersMap = Record<string, string>;

async function addHeader(
    popupPage: Page,
    headerName: string,
    headerValue: string,
    scope?: string
) {
    await popupPage.locator('#headerName').fill(headerName);
    await popupPage.locator('#headerValue').fill(headerValue);
    if (scope) {
        await popupPage.locator('#scope').fill(scope);
    }
    await popupPage.getByRole('button', { name: 'Save' }).click();
    await expect(popupPage.getByText('Saved!')).toBeVisible();
    await expect(popupPage.getByText('Active', { exact: true })).toBeVisible();
}

test.describe('mirrord browser extension', () => {
    test('popup shows inactive state on fresh install', async ({
        popupPage,
    }) => {
        await expect(popupPage.getByText('Inactive')).toBeVisible();
    });

    test('add a header and verify it appears in popup', async ({
        popupPage,
    }) => {
        await addHeader(popupPage, 'X-Mirrord-Test', 'test-value-123');

        await expect(
            popupPage.getByText('Active', { exact: true })
        ).toBeVisible();
        await expect(
            popupPage.getByText('X-Mirrord-Test: test-value-123')
        ).toBeVisible();
        await expect(popupPage.getByText('All URLs')).toBeVisible();
    });

    test('baggage merge mode keeps the page baggage in fetch and XHR', async ({
        context,
        popupPage,
    }) => {
        await addHeader(popupPage, 'baggage', 'mirrord-session=k1');
        const page = await context.newPage();

        const pageRequests = () =>
            page.evaluate(async () => {
                const viaFetch = (headers?: HeadersInit) =>
                    fetch('/headers', headers ? { headers } : undefined)
                        .then((r) => r.json() as Promise<HeadersMap>)
                        .then((h) => h['baggage']);
                const viaXhr = new Promise<string | undefined>((resolve) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', '/headers');
                    xhr.setRequestHeader('baggage', 'sentry-trace_id=def');
                    xhr.onload = () =>
                        resolve(
                            (JSON.parse(xhr.responseText) as HeadersMap)[
                                'baggage'
                            ]
                        );
                    xhr.send();
                });
                return {
                    fetch: await viaFetch({ baggage: 'sentry-trace_id=abc' }),
                    plain: await viaFetch(),
                    xhr: await viaXhr,
                };
            });

        await page.goto(`${TEST_SERVER}/asset-page`);
        expect(await pageRequests()).toEqual({
            fetch: 'mirrord-session=k1',
            plain: 'mirrord-session=k1',
            xhr: 'mirrord-session=k1',
        });

        await popupPage.evaluate(() =>
            chrome.storage.local.set({ baggage_merge: true })
        );
        await expect
            .poll(() =>
                popupPage.evaluate(
                    async () =>
                        (await chrome.scripting.getRegisteredContentScripts())
                            .length
                )
            )
            .toBe(2);

        await page.reload();
        expect(await pageRequests()).toEqual({
            fetch: 'sentry-trace_id=abc,mirrord-session=k1',
            plain: 'mirrord-session=k1',
            xhr: 'sentry-trace_id=def,mirrord-session=k1',
        });

        const reentrant = await page.evaluate(
            () =>
                new Promise<string | undefined>((resolve) => {
                    const xhr = new XMLHttpRequest();
                    xhr.onreadystatechange = () => {
                        if (xhr.readyState === XMLHttpRequest.OPENED) {
                            xhr.setRequestHeader('baggage', 'early=1');
                        }
                    };
                    xhr.onload = () =>
                        resolve(
                            (JSON.parse(xhr.responseText) as HeadersMap)[
                                'baggage'
                            ]
                        );
                    xhr.open('GET', '/headers');
                    xhr.send();
                })
        );
        expect(reentrant).toBe('early=1,mirrord-session=k1');

        await popupPage.getByLabel('Toggle header injection').click();
        await expect(popupPage.getByText('Inactive')).toBeVisible();
        await expect
            .poll(async () => (await pageRequests()).fetch)
            .toBe('sentry-trace_id=abc');

        await popupPage.getByLabel('Toggle header injection').click();
        await expect(
            popupPage.getByText('Active', { exact: true })
        ).toBeVisible();
        await expect
            .poll(async () => (await pageRequests()).fetch)
            .toBe('sentry-trace_id=abc,mirrord-session=k1');

        await page.goto(`${TEST_SERVER}/headers`);
        const navigation = JSON.parse(
            await page.locator('body').innerText()
        ) as HeadersMap;
        expect(navigation['baggage']).toBe('mirrord-session=k1');
    });

    test('header is injected into real HTTP requests', async ({
        context,
        popupPage,
    }) => {
        await addHeader(popupPage, 'X-Mirrord-Test', 'test-value-123');

        // Navigate to test server in a new tab
        const page = await context.newPage();
        await page.goto(`${TEST_SERVER}/headers`);

        const body = await page.locator('body').innerText();
        const headers = JSON.parse(body) as HeadersMap;

        expect(headers['x-mirrord-test']).toBe('test-value-123');
    });

    test('scoped header only injected on matching URLs', async ({
        context,
        popupPage,
    }) => {
        await addHeader(
            popupPage,
            'X-Scoped-Header',
            'scoped-value',
            '*://localhost:3456/scoped/*'
        );

        // Header should be present on matching URL
        const matchingPage = await context.newPage();
        await matchingPage.goto(`${TEST_SERVER}/scoped/headers`);

        const matchBody = await matchingPage.locator('body').innerText();
        const matchHeaders = JSON.parse(matchBody) as HeadersMap;
        expect(matchHeaders['x-scoped-header']).toBe('scoped-value');

        // Header should NOT be present on non-matching URL
        const nonMatchingPage = await context.newPage();
        await nonMatchingPage.goto(`${TEST_SERVER}/headers`);

        const noMatchBody = await nonMatchingPage.locator('body').innerText();
        const noMatchHeaders = JSON.parse(noMatchBody) as HeadersMap;
        expect(noMatchHeaders['x-scoped-header']).toBeUndefined();
    });

    test('remove header', async ({ context, popupPage }) => {
        await addHeader(popupPage, 'X-Remove-Me', 'remove-value');
        await expect(
            popupPage.getByText('Active', { exact: true })
        ).toBeVisible();

        // Toggle off to remove
        await popupPage.getByLabel('Toggle header injection').click();

        await expect(popupPage.getByText('Inactive')).toBeVisible();

        // Verify header is no longer injected
        const page = await context.newPage();
        await page.goto(`${TEST_SERVER}/headers`);

        const body = await page.locator('body').innerText();
        const headers = JSON.parse(body) as HeadersMap;
        expect(headers['x-remove-me']).toBeUndefined();
    });

    test('header is injected into asset requests (scripts, stylesheets, images)', async ({
        context,
        popupPage,
    }) => {
        await addHeader(popupPage, 'X-Mirrord-Test', 'asset-injection');

        // Reset recorded headers on the test server
        const resetPage = await context.newPage();
        await resetPage.goto(`${TEST_SERVER}/asset-headers/reset`);
        await resetPage.close();

        // Navigate to a page that loads script, stylesheet, and image assets
        const page = await context.newPage();
        await page.goto(`${TEST_SERVER}/asset-page`);

        // Wait for the page and its assets to load
        await page.locator('#status').waitFor();
        // Give assets time to complete loading
        await page.waitForTimeout(1000);

        // Fetch the recorded asset headers from the test server
        const resultsPage = await context.newPage();
        await resultsPage.goto(`${TEST_SERVER}/asset-headers`);
        const body = await resultsPage.locator('body').innerText();
        const assetHeaders = JSON.parse(body) as Record<
            string,
            HeadersMap | undefined
        >;

        // Verify header was injected into script requests
        expect(assetHeaders['script.js']?.['x-mirrord-test']).toBe(
            'asset-injection'
        );

        // Verify header was injected into stylesheet requests
        expect(assetHeaders['style.css']?.['x-mirrord-test']).toBe(
            'asset-injection'
        );

        // Verify header was injected into image requests
        expect(assetHeaders['logo.png']?.['x-mirrord-test']).toBe(
            'asset-injection'
        );
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
        await addHeader(popupPage, 'X-Override', 'override-val');

        // Reload popup to pick up defaults flag
        await popupPage.reload();

        // Verify the override header is active before resetting
        await expect(
            popupPage.getByText('X-Override: override-val')
        ).toBeVisible();

        const overridePage = await context.newPage();
        await overridePage.goto(`${TEST_SERVER}/headers`);
        const overrideBody = await overridePage.locator('body').innerText();
        const overrideHeaders = JSON.parse(overrideBody) as HeadersMap;
        expect(overrideHeaders['x-override']).toBe('override-val');
        await overridePage.close();

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
        const headers = JSON.parse(body) as HeadersMap;
        expect(headers['x-default-header']).toBe('default-val');
    });
});
