import { test, expect } from './fixtures';

const TARGET = 'https://example.com/';

function payload(config: Record<string, string>): string {
    return encodeURIComponent(
        Buffer.from(JSON.stringify(config)).toString('base64')
    );
}

test.describe('config link open_url', () => {
    test('opens the target once the header is applied', async ({
        context,
        extensionId,
    }) => {
        await context.route(`${TARGET}**`, (route) =>
            route.fulfill({ body: 'preview', contentType: 'text/html' })
        );
        const page = await context.newPage();
        const query = payload({
            header_filter: 'X-E2E: v',
            inject_scope: '*://example.com/*',
            open_url: TARGET,
        });
        await page.goto(
            `chrome-extension://${extensionId}/pages/applied.html?payload=${query}`
        );

        await expect(page.getByText(`Opening ${TARGET}`)).toBeVisible();
        await page.waitForURL(TARGET);
        await expect(page.getByText('preview')).toBeVisible();
    });
});
