import { test, expect } from './fixtures';

const REAL_BACKEND =
    process.env['MIRRORD_UI_BACKEND'] ?? 'http://localhost:59281';
const TOKEN = process.env['MIRRORD_UI_TOKEN'] ?? '';

interface LiveOperatorSessions {
    status: string;
    sessions: unknown[];
}

test('session monitor authenticates and auto-configures the extension', async ({
    context,
    extensionId,
}) => {
    test.skip(!TOKEN, 'MIRRORD_UI_TOKEN env var required');

    const monitor = await context.newPage();
    const authUrl = `${REAL_BACKEND}/auth?token=${encodeURIComponent(TOKEN)}`;
    await monitor.goto(authUrl);
    await expect(monitor).toHaveURL(`${REAL_BACKEND}/`);

    const extension = await context.newPage();
    await extension.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    await expect
        .poll(async () =>
            extension.evaluate(async () => {
                const stored = await chrome.storage.local.get([
                    'mirrord_ui_backend',
                    'mirrord_ui_token',
                ]);
                const backend: unknown = stored['mirrord_ui_backend'];
                const token: unknown = stored['mirrord_ui_token'];
                return {
                    backend: typeof backend === 'string' ? backend : null,
                    hasToken: typeof token === 'string',
                };
            })
        )
        .toEqual({ backend: REAL_BACKEND, hasToken: true });

    await extension.getByRole('tab', { name: /sessions/i }).click();
    const operatorResponse = await fetch(
        `${REAL_BACKEND}/api/v2/operator/sessions`,
        {
            headers: { 'x-auth-token': TOKEN },
        }
    );
    const operatorAvailable =
        operatorResponse.ok &&
        ((await operatorResponse.json()) as LiveOperatorSessions).status ===
            'available';
    const localOnlyBanner = extension.getByText('Showing local sessions only.');
    if (operatorAvailable) {
        await expect(localOnlyBanner).not.toBeVisible();
    } else {
        await expect(localOnlyBanner).toBeVisible({ timeout: 10_000 });
    }
    await expect(
        extension.getByText('mirrord ui token rejected')
    ).not.toBeVisible();
});

test('monitor Join reaches the extension through the bridge', async ({
    context,
    extensionId,
}) => {
    test.skip(!TOKEN, 'MIRRORD_UI_TOKEN env var required');

    const monitor = await context.newPage();
    await monitor.goto(
        `${REAL_BACKEND}/auth?token=${encodeURIComponent(TOKEN)}&redirect=/`
    );
    await expect(monitor).toHaveURL(`${REAL_BACKEND}/`);

    const joinButton = monitor.getByRole('button', { name: /join/i }).first();
    const hasSession = await joinButton
        .waitFor({ state: 'visible', timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
    test.skip(!hasSession, 'a visible session with a Join bar is required');

    await joinButton.click();

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    await expect
        .poll(
            async () =>
                popup.evaluate(
                    () =>
                        new Promise<string[]>((resolve) => {
                            chrome.declarativeNetRequest.getDynamicRules(
                                (rules) =>
                                    resolve(
                                        rules.flatMap(
                                            (r) =>
                                                r.action.requestHeaders?.map(
                                                    (h) =>
                                                        `${h.header}=${h.value ?? ''}`
                                                ) ?? []
                                        )
                                    )
                            );
                        })
                ),
            { timeout: 15_000 }
        )
        .toEqual(
            expect.arrayContaining([
                expect.stringContaining('mirrord-session='),
            ])
        );
});

test('live join against a visible operator session', async ({
    context,
    extensionId,
}) => {
    test.skip(!TOKEN, 'MIRRORD_UI_TOKEN env var required');

    const operatorResponse = await fetch(
        `${REAL_BACKEND}/api/v2/operator/sessions`,
        {
            headers: { 'x-auth-token': TOKEN },
        }
    );
    const operatorData = operatorResponse.ok
        ? ((await operatorResponse.json()) as LiveOperatorSessions)
        : null;
    test.skip(
        operatorData?.status !== 'available' ||
            operatorData.sessions.length === 0,
        'a visible operator session is required for live join'
    );

    const configurePage = await context.newPage();
    const configureUrl = `chrome-extension://${extensionId}/pages/configure.html?backend=${encodeURIComponent(REAL_BACKEND)}&token=${TOKEN}`;
    await configurePage.goto(configureUrl);
    await expect(configurePage.getByText(/mirrord ui connected/i)).toBeVisible({
        timeout: 10_000,
    });

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    await popup.getByRole('tab', { name: /sessions/i }).click();

    const anyJoinButton = popup
        .getByRole('button', { name: /^join /i })
        .first();
    await expect(anyJoinButton).toBeVisible({ timeout: 15_000 });

    const buttonText = await anyJoinButton.textContent();
    console.log('Join button found:', buttonText);

    await anyJoinButton.click();
    await expect(popup.getByText(/joined|session live/i).first()).toBeVisible({
        timeout: 10_000,
    });

    const dnrRules = await popup.evaluate(async () => {
        return await new Promise<chrome.declarativeNetRequest.Rule[]>(
            (resolve) => {
                chrome.declarativeNetRequest.getDynamicRules(resolve);
            }
        );
    });
    console.log('DNR rules after Join:', JSON.stringify(dnrRules, null, 2));

    expect(dnrRules.length).toBeGreaterThan(0);
    const rule = dnrRules[0];
    expect(rule).toBeDefined();
    const headerOp = rule?.action.requestHeaders?.[0];
    expect(headerOp).toBeDefined();
    expect(headerOp?.header.toLowerCase()).toMatch(
        /baggage|x-mirrord-user|mirrord/i
    );
    console.log(`Injected: ${headerOp?.header} = ${headerOp?.value}`);
});
