import { test, expect } from './fixtures.ts';

const REAL_BACKEND = 'http://localhost:8080';
const TOKEN = process.env.MIRRORD_UI_TOKEN ?? '';

test('live e2e against real mirrord ui + han-dev operator', async ({
    context,
    extensionId,
}) => {
    test.skip(!TOKEN, 'MIRRORD_UI_TOKEN env var required');

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
    const headerOp = rule.action.requestHeaders?.[0];
    expect(headerOp).toBeDefined();
    expect(headerOp?.header.toLowerCase()).toMatch(
        /baggage|x-mirrord-user|mirrord/i
    );
    console.log(`Injected: ${headerOp?.header} = ${headerOp?.value}`);
});
