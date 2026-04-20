import { STORAGE_KEYS } from './types';
import { capture } from './analytics';
import { fetchOperatorSessions } from './mirrordUiClient';
import {
    buildDnrRule,
    getDynamicRules,
    updateDynamicRules,
    storageGet,
    storageSet,
} from './util';

async function storeBackendAndToken(
    backend: string,
    token: string
): Promise<void> {
    await storageSet({
        [STORAGE_KEYS.MIRRORD_UI_BACKEND]: backend,
        [STORAGE_KEYS.MIRRORD_UI_TOKEN]: token,
    });
}

function render(html: string): void {
    const el = document.getElementById('content');
    if (el) el.innerHTML = html;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function joinKey(
    key: string,
    backend: string,
    token: string
): Promise<void> {
    const resp = await fetchOperatorSessions(backend, token);
    const target = resp.sessions.find((s) => s.key === key);
    if (!target) {
        render(
            `<h2>Key not visible</h2><p>Key <code>${escapeHtml(key)}</code> isn't listed by your mirrord ui. It may have ended, or your credentials can't see it.</p>`
        );
        return;
    }
    const existing = await getDynamicRules();
    const rules = buildDnrRule('baggage', `mirrord-session=${key}`);
    await updateDynamicRules({
        removeRuleIds: existing.map((r) => r.id),
        addRules: rules,
    });
    await storageSet({
        [STORAGE_KEYS.JOINED_KEY]: key,
        [STORAGE_KEYS.JOINED_SESSION_NAME]: target.name,
    });
    render(
        `<h2>Joined session</h2><p>Injecting <code>baggage: mirrord-session=${escapeHtml(
            key
        )}</code> on all requests. You can close this tab.</p>`
    );
}

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(location.search);
    const backendParam = params.get('backend');
    const tokenParam = params.get('token');
    const joinParam = params.get('join');

    if (backendParam && tokenParam) {
        await storeBackendAndToken(backendParam, tokenParam);
        capture('extension_configured', { hasJoinParam: !!joinParam });
        if (!joinParam) {
            render(
                '<h2>mirrord ui connected</h2><p>You can close this tab and open the extension popup.</p>'
            );
            return;
        }
        await joinKey(joinParam, backendParam, tokenParam);
        return;
    }

    if (joinParam) {
        const stored = await storageGet([
            STORAGE_KEYS.MIRRORD_UI_BACKEND,
            STORAGE_KEYS.MIRRORD_UI_TOKEN,
        ]);
        const backend = stored[STORAGE_KEYS.MIRRORD_UI_BACKEND] as
            | string
            | undefined;
        const token = stored[STORAGE_KEYS.MIRRORD_UI_TOKEN] as
            | string
            | undefined;
        if (!backend || !token) {
            render(
                '<h2>mirrord ui not configured</h2><p>Run <code>mirrord ui</code> first and open the configure URL it prints.</p>'
            );
            return;
        }
        await joinKey(joinParam, backend, token);
        return;
    }

    render(
        '<h2>Missing configuration</h2><p>Expected <code>backend</code>+<code>token</code>, or <code>join</code>.</p>'
    );
});
