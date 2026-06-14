// Content script for metalbear.com/mirrord/extension. Links of the form
//   https://metalbear.com/mirrord/extension#config=<payload>
// carry the same base64 config payload that the in-extension config page accepts. We decode
// and validate it here so we can report status in-page (a small message box), then hand the
// resolved header to the background to actually install the DNR rule — content scripts can't
// call declarativeNetRequest themselves.
import { browser } from '../browser';
import {
    decodeConfig,
    isRegex,
    parseHeader,
    promptForValidHeader,
} from '../configCore';
import { APPLY_CONFIG_MESSAGE, CONFIG_HASH_PARAM } from '../constants';

type ApplyResult =
    | { ok: true; header: string; value: string }
    | { ok: false; error: string };

/**
 * Extract the config payload from a URL hash like `#config=PAYLOAD`. The value is taken
 * verbatim (not via URLSearchParams) so a base64 payload keeps its `+`/`/`/`=` characters
 * intact; the background re-encodes it when building the config URL.
 */
export function parseConfigPayload(hash: string): string | null {
    const raw = hash.startsWith('#') ? hash.slice(1) : hash;
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
const ACCENT: Record<'info' | 'success' | 'error', string> = {
    info: '#756df3',
    success: '#16a34a',
    error: '#dc2626',
};

/** Render (or update) a small fixed message box in the page. */
function showMessage(
    kind: 'info' | 'success' | 'error',
    title: string,
    detail?: string
): void {
    const parent = document.body ?? document.documentElement;
    if (!parent) return;

    let box = document.getElementById(MESSAGE_BOX_ID);
    if (!box) {
        box = document.createElement('div');
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
            font: '13px/1.4 system-ui, -apple-system, sans-serif',
        });
        parent.appendChild(box);
    }
    box.style.borderLeft = `4px solid ${ACCENT[kind]}`;

    box.textContent = '';
    const titleEl = document.createElement('div');
    titleEl.style.fontWeight = '600';
    titleEl.textContent = `mirrord — ${title}`;
    box.appendChild(titleEl);
    if (detail) {
        const detailEl = document.createElement('div');
        Object.assign(detailEl.style, {
            marginTop: '4px',
            color: '#4b5563',
            wordBreak: 'break-word',
        });
        detailEl.textContent = detail;
        box.appendChild(detailEl);
    }
}

// Sentinel distinct from `null` (= "no config") so the very first run still reports an empty
// link, while repeated hashchange events with the same value don't re-apply.
let lastPayload: string | null | undefined = undefined;

async function handleHash(): Promise<void> {
    const payload = parseConfigPayload(window.location.hash);
    if (payload === lastPayload) return;
    lastPayload = payload;

    if (!payload) {
        showMessage(
            'info',
            'No config found',
            'This link has no “#config=…” payload to apply.'
        );
        return;
    }

    let header: string;
    let value: string;
    let scope: string | undefined;
    try {
        const config = decodeConfig(payload);
        if (!config.header_filter) {
            throw new Error('Config is missing a header filter.');
        }
        const headerLine = isRegex(config.header_filter)
            ? promptForValidHeader(config.header_filter)
            : config.header_filter;
        ({ key: header, value } = parseHeader(headerLine));
        scope = config.inject_scope || undefined;
    } catch (err) {
        showMessage(
            'error',
            'Invalid config',
            err instanceof Error ? err.message : 'The config link is malformed.'
        );
        return;
    }

    showMessage('info', 'Applying config…', `${header}: ${value}`);
    const result = (await browser.runtime.sendMessage({
        type: APPLY_CONFIG_MESSAGE,
        header,
        value,
        scope,
    })) as ApplyResult | undefined;

    if (result?.ok) {
        showMessage(
            'success',
            'Config applied',
            `Injecting ${result.header}: ${result.value}` +
                (scope ? ` (scope: ${scope})` : ' on all URLs')
        );
    } else {
        showMessage(
            'error',
            'Failed to apply config',
            result?.error ?? 'Unknown error.'
        );
    }
}

void handleHash();
window.addEventListener('hashchange', () => void handleHash());
