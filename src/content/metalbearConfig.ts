// Content script for metalbear.com/mirrord/extension. Links of the form
//   https://metalbear.com/mirrord/extension#config=<payload>
// carry the same base64 config payload that the in-extension config page accepts. When a
// payload is present we redirect the tab to our own web-accessible result page
// (pages/applied.html), which decodes it, installs the rule, and shows the outcome — so the
// user lands on an extension page instead of staying on the website. A bare visit (no
// `#config=`) just gets a small in-page note and is otherwise left alone.
import { CONFIG_HASH_PARAM } from '../constants';

/**
 * Extract the config payload from a `#config=PAYLOAD` hash. Expects the raw
 * `window.location.hash`, which is always either empty or `#`-prefixed; anything else returns
 * null. The value is taken verbatim (not via URLSearchParams) so a base64 payload keeps its
 * `+`/`/`/`=` characters intact; it is re-encoded with encodeURIComponent when building the
 * result-page URL.
 */
export function parseConfigPayload(hash: string): string | null {
    if (!hash.startsWith('#')) return null;
    const raw = hash.slice(1);
    if (!raw) return null;
    for (const part of raw.split('&')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        if (part.slice(0, eq) !== CONFIG_HASH_PARAM) continue;
        const value = part.slice(eq + 1);
        return value.trim().length > 0 ? value : null;
    }
    return null;
}

const MESSAGE_BOX_ID = 'mirrord-config-message';

/** Render a small fixed note in the page (used only for the "no config" case). */
function showMessage(title: string, detail: string): void {
    const parent = document.body ?? document.documentElement;
    if (!parent || document.getElementById(MESSAGE_BOX_ID)) return;

    const box = document.createElement('div');
    box.id = MESSAGE_BOX_ID;
    Object.assign(box.style, {
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: '2147483647',
        maxWidth: '320px',
        padding: '12px 14px',
        borderRadius: '8px',
        background: '#ffffff',
        color: '#111827',
        boxShadow: '0 6px 24px rgba(0, 0, 0, 0.18)',
        borderLeft: '4px solid #756df3',
        font: '13px/1.4 system-ui, -apple-system, sans-serif',
    });

    const titleEl = document.createElement('div');
    titleEl.style.fontWeight = '600';
    titleEl.textContent = `mirrord — ${title}`;
    box.appendChild(titleEl);

    const detailEl = document.createElement('div');
    Object.assign(detailEl.style, { marginTop: '4px', color: '#4b5563' });
    detailEl.textContent = detail;
    box.appendChild(detailEl);

    parent.appendChild(box);
}

// Sentinel distinct from `null` (= "no config") so the first run still notes an empty link,
// while repeated hashchange events with the same value don't redirect twice.
let lastPayload: string | null | undefined = undefined;

function handleHash(): void {
    const payload = parseConfigPayload(window.location.hash);
    if (payload === lastPayload) return;
    lastPayload = payload;

    if (!payload) {
        showMessage(
            'No config found',
            'This link has no “#config=…” payload to apply.'
        );
        return;
    }

    const params = new URLSearchParams({ payload });
    const url = `${chrome.runtime.getURL('pages/applied.html')}?${params.toString()}`;
    window.location.replace(url);
}

handleHash();
window.addEventListener('hashchange', handleHash);
