import path from 'node:path';
import fs from 'node:fs';
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const OUT_DIR = '/tmp/extension-flows';
const FAKE_BACKEND = 'http://127.0.0.1:3457';
const FAKE_TOKEN = 'test-token';

fs.mkdirSync(OUT_DIR, { recursive: true });

async function snap(page: Page, name: string) {
    await page.waitForTimeout(400);
    // Two-pass: shrink viewport height, measure document height at the
    // current width, then set viewport height to match before full-page
    // screenshot. Keeps body bg and avoids the empty-space problem.
    const width = page.viewportSize()?.width ?? 460;
    await page.setViewportSize({ width, height: 100 });
    await page.waitForTimeout(150);
    const h = await page.evaluate(() =>
        Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight
        )
    );
    await page.setViewportSize({ width, height: Math.ceil(h) });
    await page.waitForTimeout(150);
    await page.screenshot({
        path: path.join(OUT_DIR, `${name}.png`),
        fullPage: false,
    });
}

async function resetStorage(page: Page) {
    await page.evaluate(() => chrome.storage.local.clear());
    const rules = await page.evaluate(() =>
        chrome.declarativeNetRequest.getDynamicRules()
    );
    if (rules.length > 0) {
        await page.evaluate(
            (ids) =>
                chrome.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: ids,
                    addRules: [],
                }),
            rules.map((r) => r.id)
        );
    }
}

async function setManualConfig(
    page: Page,
    headerName: string,
    headerValue: string,
    scope?: string
) {
    await page.evaluate(
        ({ headerName, headerValue, scope }) => {
            return chrome.storage.local.set({
                defaults: { headerName, headerValue, scope },
            });
        },
        { headerName, headerValue, scope }
    );
}

async function openPopup(page: Page, extensionId: string): Promise<Page> {
    const popup = await page.context().newPage();
    popup.on('pageerror', (err) => console.log('[popup pageerror]', err));
    popup.on('console', (msg) => {
        if (msg.type() === 'error')
            console.log('[popup console error]', msg.text());
    });
    await popup.setViewportSize({ width: 420, height: 700 });
    await popup.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    return popup;
}

test('capture all extension flows', async ({ context, extensionId }) => {
    test.setTimeout(180_000);
    const control = await context.newPage();
    await control.goto(`chrome-extension://${extensionId}/pages/popup.html`);

    // =========================================================================
    // 01 — Onboarding (no backend, no manual config)
    // =========================================================================
    await resetStorage(control);
    {
        const p = await openPopup(control, extensionId);
        await expect(p.getByText(/Choose how to set up/i)).toBeVisible();
        await snap(p, '01-onboarding');
        await p.close();
    }

    // =========================================================================
    // 02 — Manual Setup (inactive, empty form)
    // Storage has an empty config so hasStoredConfig=true and onboarding is
    // dismissed, but the form inputs render blank.
    // =========================================================================
    await resetStorage(control);
    await setManualConfig(control, '', '', '');
    {
        const p = await openPopup(control, extensionId);
        await expect(p.getByText('Inactive', { exact: true })).toBeVisible();
        await snap(p, '02-manual-empty');
        await p.close();
    }

    // =========================================================================
    // 03 — Manual Setup (inactive, form filled — pre-save)
    // =========================================================================
    await resetStorage(control);
    await setManualConfig(control, '', '', '');
    {
        const p = await openPopup(control, extensionId);
        await p.locator('#headerName').fill('x-user-id');
        await p.locator('#headerValue').fill('hank@metalbear.com');
        await p.locator('#scope').fill('https://*.example.com/*');
        await snap(p, '03-manual-filled');
        await p.close();
    }

    // =========================================================================
    // 04 — Manual Setup (inactive, saved config — Inactive, switch enabled)
    // =========================================================================
    await resetStorage(control);
    await setManualConfig(
        control,
        'x-user-id',
        'hank@metalbear.com',
        'https://*.example.com/*'
    );
    {
        const p = await openPopup(control, extensionId);
        await expect(p.getByText('Inactive', { exact: true })).toBeVisible();
        await snap(p, '04-manual-saved-inactive');
        await p.close();
    }

    // =========================================================================
    // 05 — Manual Setup (active)
    // =========================================================================
    await resetStorage(control);
    await setManualConfig(
        control,
        'x-user-id',
        'hank@metalbear.com',
        'https://*.example.com/*'
    );
    {
        const p = await openPopup(control, extensionId);
        await p.getByLabel('Toggle header injection').click();
        await expect(p.getByText('Active', { exact: true })).toBeVisible();
        await snap(p, '05-manual-active');
        await p.close();
    }

    // =========================================================================
    // 06 — Manual Setup (active, share copied)
    // =========================================================================
    {
        const p = await openPopup(control, extensionId);
        await expect(p.getByText('Active', { exact: true })).toBeVisible();
        await p.getByLabel('Share configuration').click();
        await expect(p.getByLabel('Share configuration')).toHaveAttribute(
            'title',
            /Copied/
        );
        await snap(p, '06-manual-share-copied');
        await p.close();
    }

    // =========================================================================
    // 07 — Sessions (connected backend, tabs visible, Sessions tab)
    // =========================================================================
    await resetStorage(control);
    await control.goto(
        `chrome-extension://${extensionId}/pages/configure.html?backend=${encodeURIComponent(
            FAKE_BACKEND
        )}&token=${FAKE_TOKEN}`
    );
    await expect(control.getByText(/mirrord ui connected/i)).toBeVisible();
    {
        const p = await openPopup(control, extensionId);
        await p.waitForTimeout(2000);
        // Dump storage state + DNR rules for diagnostics
        const diag = await p.evaluate(async () => {
            const s = await chrome.storage.local.get(null);
            const r = await chrome.declarativeNetRequest.getDynamicRules();
            return { storage: s, rules: r };
        });
        console.log('[07 diag]', JSON.stringify(diag));
        await snap(p, '07-sessions-tab-debug');
        // Click Sessions tab explicitly — even if default landed on Manual.
        const sessionsTab = p.getByRole('tab', { name: /sessions/i });
        if (await sessionsTab.isVisible()) {
            await sessionsTab.click();
        }
        await expect(p.getByText('Live sessions')).toBeVisible({
            timeout: 15_000,
        });
        await expect(p.getByText('k1', { exact: false }).first()).toBeVisible();
        await snap(p, '07-sessions-tab');
        await p.close();
    }

    // =========================================================================
    // 08 — Sessions filtered by namespace
    // =========================================================================
    {
        const p = await openPopup(control, extensionId);
        await p.waitForTimeout(1500);
        const sessionsTab = p.getByRole('tab', { name: /sessions/i });
        if (await sessionsTab.isVisible()) await sessionsTab.click();
        await expect(p.getByText('Live sessions')).toBeVisible({
            timeout: 15_000,
        });
        // Radix Select — click the trigger by id, then an option.
        await p.locator('#ns-select').click();
        await p.getByRole('option', { name: 'ns-a' }).click();
        await p.waitForTimeout(400);
        await snap(p, '08-sessions-filtered');
        await p.close();
    }

    // =========================================================================
    // 09 — Sessions joined (joined badge + banner)
    // =========================================================================
    {
        const p = await openPopup(control, extensionId);
        await p.waitForTimeout(1500);
        const sessionsTab = p.getByRole('tab', { name: /sessions/i });
        if (await sessionsTab.isVisible()) await sessionsTab.click();
        const joinK1 = p.getByRole('button', { name: /join k1/i }).first();
        await expect(joinK1).toBeVisible({ timeout: 15_000 });
        await joinK1.click();
        // Wait for joined state — a "my own session" badge appears on the row.
        await expect(p.getByText(/my own session/i)).toBeVisible({
            timeout: 10_000,
        });
        await snap(p, '09-sessions-joined');
        await p.close();
    }

    // =========================================================================
    // 10 — Manual tab WITH backend connected (both tabs visible)
    // =========================================================================
    await setManualConfig(
        control,
        'x-user-id',
        'hank@metalbear.com',
        'https://*.example.com/*'
    );
    {
        const p = await openPopup(control, extensionId);
        await p.getByRole('tab', { name: /manual/i }).click();
        await expect(p.getByText(/Inactive|Active/)).toBeVisible();
        await snap(p, '10-manual-tab-with-backend');
        await p.close();
    }

    // =========================================================================
    // 11 — Session-ended banner (red alert)
    // =========================================================================
    await resetStorage(control);
    await control.goto(
        `chrome-extension://${extensionId}/pages/configure.html?backend=${encodeURIComponent(
            FAKE_BACKEND
        )}&token=${FAKE_TOKEN}`
    );
    await expect(control.getByText(/mirrord ui connected/i)).toBeVisible();
    {
        const p = await openPopup(control, extensionId);
        await p.waitForTimeout(1500);
        const sessionsTab = p.getByRole('tab', { name: /sessions/i });
        if (await sessionsTab.isVisible()) await sessionsTab.click();
        const joinK1 = p.getByRole('button', { name: /join k1/i }).first();
        await expect(joinK1).toBeVisible({ timeout: 15_000 });
        await joinK1.click();
        await expect(p.getByText(/my own session/i)).toBeVisible({
            timeout: 10_000,
        });
        // Trigger server to remove session 'a' so the banner appears.
        await control.request.post(`${FAKE_BACKEND}/__inject/remove`, {
            data: { name: 'a' },
        });
        await expect(p.getByText(/Session ended/i)).toBeVisible({
            timeout: 10_000,
        });
        await snap(p, '11-session-ended-banner');
        await p.close();
    }

    // =========================================================================
    // 12 — Configure page (success, mirrord ui connected)
    // =========================================================================
    {
        const p = await context.newPage();
        await p.setViewportSize({ width: 600, height: 200 });
        await p.goto(
            `chrome-extension://${extensionId}/pages/configure.html?backend=${encodeURIComponent(
                FAKE_BACKEND
            )}&token=${FAKE_TOKEN}`
        );
        await expect(p.getByText(/mirrord ui connected/i)).toBeVisible();
        await snap(p, '12-configure-connected');
        await p.close();
    }

    // =========================================================================
    // 13 — Configure page (missing params)
    // =========================================================================
    {
        const p = await context.newPage();
        await p.setViewportSize({ width: 600, height: 200 });
        await p.goto(`chrome-extension://${extensionId}/pages/configure.html`);
        await expect(p.getByText(/Missing configuration/i)).toBeVisible();
        await snap(p, '13-configure-missing');
        await p.close();
    }

    // =========================================================================
    // 14 — Configure page (share-link join flow)
    // =========================================================================
    await resetStorage(control);
    await control.goto(
        `chrome-extension://${extensionId}/pages/configure.html?backend=${encodeURIComponent(
            FAKE_BACKEND
        )}&token=${FAKE_TOKEN}`
    );
    await expect(control.getByText(/mirrord ui connected/i)).toBeVisible();
    {
        const p = await context.newPage();
        await p.setViewportSize({ width: 600, height: 200 });
        await p.goto(
            `chrome-extension://${extensionId}/pages/configure.html?join=k1`
        );
        await expect(p.getByText(/Joined session/i)).toBeVisible();
        await snap(p, '14-configure-joined-share');
        await p.close();
    }

    // =========================================================================
    // 15 — Options / Settings page
    // =========================================================================
    {
        const p = await context.newPage();
        await p.setViewportSize({ width: 500, height: 200 });
        await p.goto(`chrome-extension://${extensionId}/pages/options.html`);
        await expect(p.getByText(/Settings/i)).toBeVisible();
        await snap(p, '15-options');
        await p.close();
    }

    await control.close();
});
