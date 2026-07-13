import { test, expect } from './fixtures';
import { startRealServer, type RealServer } from './real-server';

let server: RealServer | null = null;

test.beforeAll(async () => {
    server = await startRealServer();
});

test.afterAll(async () => {
    await server?.stop();
});

test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
        await server?.attachDiagnostics(testInfo);
    }
});

test.beforeEach(() => {
    test.skip(
        !server,
        'set MIRRORD_BIN (spawn) or MIRRORD_UI_URL + MIRRORD_UI_TOKEN (attach)'
    );
});

test('auth cookie exchange grants API access', async ({ context }) => {
    if (!server) return;
    const page = await context.newPage();
    await page.goto(server.authUrl);
    await expect(page).toHaveURL(`${server.baseUrl}/`);

    const sessions = await page.evaluate(async () => {
        const resp = await fetch('/api/v2/local/sessions', {
            credentials: 'include',
        });
        return {
            status: resp.status,
            contentType: resp.headers.get('content-type'),
        };
    });
    expect(sessions.status).toBe(200);
    expect(sessions.contentType).toContain('application/json');
});

test('an invalid token does not authenticate', async ({ context }) => {
    if (!server) return;
    const page = await context.newPage();
    const authResp = await page.request.get(
        `${server.baseUrl}/auth?token=deadbeef&redirect=/`,
        { maxRedirects: 0, failOnStatusCode: false }
    );
    expect(authResp.status()).toBeGreaterThanOrEqual(400);

    const apiResp = await page.request.get(
        `${server.baseUrl}/api/v2/local/sessions`,
        { failOnStatusCode: false }
    );
    expect(apiResp.status()).not.toBe(200);
});

test('the monitor auto-configures the extension', async ({
    context,
    extensionId,
}) => {
    if (!server) return;
    const monitor = await context.newPage();
    await monitor.goto(server.authUrl);
    await expect(monitor).toHaveURL(`${server.baseUrl}/`);

    const extension = await context.newPage();
    await extension.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    await expect
        .poll(
            async () =>
                extension.evaluate(async () => {
                    const stored = await chrome.storage.local.get([
                        'mirrord_ui_backend',
                        'mirrord_ui_token',
                    ]);
                    return {
                        hasBackend:
                            typeof stored.mirrord_ui_backend === 'string',
                        hasToken: typeof stored.mirrord_ui_token === 'string',
                    };
                }),
            { timeout: 15_000 }
        )
        .toEqual({ hasBackend: true, hasToken: true });
});

test('join and leave through the real bridge install and remove the DNR rule', async ({
    context,
    extensionId,
}) => {
    if (!server) return;
    const monitor = await context.newPage();
    await monitor.goto(server.authUrl);
    await expect(monitor).toHaveURL(`${server.baseUrl}/`);

    const probe = await context.newPage();
    await probe.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    await expect
        .poll(
            async () =>
                probe.evaluate(async () => {
                    const stored = await chrome.storage.local.get([
                        'mirrord_ui_backend',
                        'mirrord_ui_token',
                    ]);
                    return (
                        typeof stored.mirrord_ui_backend === 'string' &&
                        typeof stored.mirrord_ui_token === 'string'
                    );
                }),
            { timeout: 15_000 }
        )
        .toBe(true);
    await probe.close();

    const joinResult = await monitor.evaluate(
        ([extId]) =>
            new Promise((resolve) => {
                chrome.runtime.sendMessage(
                    extId,
                    { type: 'join', key: 'e2e-fixture-key' },
                    (response: unknown) => resolve(response)
                );
            }),
        [extensionId]
    );
    expect(joinResult).toMatchObject({
        type: 'join_result',
        ok: true,
        joinedKey: 'e2e-fixture-key',
    });

    const extension = await context.newPage();
    await extension.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    const rules = await extension.evaluate(
        () =>
            new Promise<string[]>((resolve) => {
                chrome.declarativeNetRequest.getDynamicRules((r) =>
                    resolve(
                        r.flatMap(
                            (rule) =>
                                rule.action.requestHeaders?.map(
                                    (h) => `${h.header}=${h.value ?? ''}`
                                ) ?? []
                        )
                    )
                );
            })
    );
    expect(rules).toContain('baggage=mirrord-session=e2e-fixture-key');

    const leaveResult = await monitor.evaluate(
        ([extId]) =>
            new Promise((resolve) => {
                chrome.runtime.sendMessage(
                    extId,
                    { type: 'leave' },
                    (response: unknown) => resolve(response)
                );
            }),
        [extensionId]
    );
    expect(leaveResult).toMatchObject({ type: 'leave_result', ok: true });

    const rulesAfter = await extension.evaluate(
        () =>
            new Promise<number>((resolve) => {
                chrome.declarativeNetRequest.getDynamicRules((r) =>
                    resolve(r.length)
                );
            })
    );
    expect(rulesAfter).toBe(0);
});
