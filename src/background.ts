import { STORAGE_KEYS } from './types';
import { refreshIconIndicator } from './util';
import {
    HEADER_OBSERVATION_PORT,
    emptyObservation,
    recordRequest,
    rotateBuckets,
    setHeaderName,
    type HeaderObservation,
} from './headerObservation';

const MIRRORD_UI_CONFIGURE_TYPE = 'mirrord-ui-configure';
const TRUSTED_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const OBSERVATION_SESSION_KEY = 'header_observation';

type ConfigureMessage = {
    type: typeof MIRRORD_UI_CONFIGURE_TYPE;
    backend: string;
    token: string;
};

let observation: HeaderObservation = emptyObservation('');
const subscribers = new Set<chrome.runtime.Port>();
let rotationTimer: ReturnType<typeof setInterval> | null = null;
let observationLoaded = false;

restrictStorageAccess();
configureSidePanel();
chrome.runtime.onStartup.addListener(restrictStorageAccess);
chrome.runtime.onInstalled.addListener(restrictStorageAccess);
chrome.runtime.onStartup.addListener(configureSidePanel);
chrome.runtime.onInstalled.addListener(configureSidePanel);
chrome.runtime.onStartup.addListener(refreshIcon);
chrome.runtime.onInstalled.addListener(refreshIcon);

restoreObservation().then(loadHeaderName);
chrome.runtime.onStartup.addListener(() => {
    restoreObservation().then(loadHeaderName);
});
chrome.runtime.onInstalled.addListener(() => {
    restoreObservation().then(loadHeaderName);
});

const RULE_TRIGGERING_KEYS: readonly string[] = [
    STORAGE_KEYS.OVERRIDE,
    STORAGE_KEYS.DEFAULTS,
    STORAGE_KEYS.JOINED_KEY,
    STORAGE_KEYS.JOINED_SESSION_NAME,
];

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (RULE_TRIGGERING_KEYS.some((key) => key in changes)) {
        loadHeaderName();
    }
});

chrome.webRequest.onSendHeaders.addListener(
    (details) => {
        if (!observation.headerName) return;
        const target = observation.headerName.toLowerCase();
        const headers = details.requestHeaders ?? [];
        if (!headers.some((h) => h.name.toLowerCase() === target)) return;
        observation = recordRequest(
            observation,
            details.url,
            details.method,
            Date.now()
        );
        persistObservation();
        broadcast();
    },
    { urls: ['<all_urls>'] },
    ['requestHeaders', 'extraHeaders']
);

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== HEADER_OBSERVATION_PORT) return;
    subscribers.add(port);
    ensureRotation();
    pushTo(port);
    port.onDisconnect.addListener(() => {
        subscribers.delete(port);
        if (subscribers.size === 0) stopRotation();
    });
});

function restrictStorageAccess() {
    const setAccessLevel = (
        chrome.storage.local as unknown as {
            setAccessLevel?: (opts: { accessLevel: string }) => Promise<void>;
        }
    ).setAccessLevel;
    if (typeof setAccessLevel !== 'function') return;
    setAccessLevel
        .call(chrome.storage.local, { accessLevel: 'TRUSTED_CONTEXTS' })
        .catch(() => {});
}

chrome.runtime.onMessageExternal.addListener(
    (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: { ok: boolean; error?: string }) => void
    ) => {
        if (!isTrustedSender(sender)) {
            sendResponse({ ok: false, error: 'untrusted sender' });
            return;
        }
        if (!isConfigureMessage(message)) {
            sendResponse({ ok: false, error: 'unknown message' });
            return;
        }
        chrome.storage.local.set(
            {
                [STORAGE_KEYS.MIRRORD_UI_BACKEND]: message.backend,
                [STORAGE_KEYS.MIRRORD_UI_TOKEN]: message.token,
            },
            () => {
                if (chrome.runtime.lastError) {
                    sendResponse({
                        ok: false,
                        error: chrome.runtime.lastError.message,
                    });
                } else {
                    sendResponse({ ok: true });
                }
            }
        );
        return true;
    }
);

function isTrustedSender(sender: chrome.runtime.MessageSender): boolean {
    if (!sender.url) return false;
    try {
        const origin = new URL(sender.url).origin;
        return TRUSTED_ORIGIN.test(origin);
    } catch {
        return false;
    }
}

function isConfigureMessage(value: unknown): value is ConfigureMessage {
    if (typeof value !== 'object' || value === null) return false;
    const m = value as Record<string, unknown>;
    return (
        m.type === MIRRORD_UI_CONFIGURE_TYPE &&
        typeof m.backend === 'string' &&
        typeof m.token === 'string'
    );
}

function configureSidePanel() {
    const sidePanel = (
        chrome as unknown as {
            sidePanel?: {
                setPanelBehavior?: (opts: {
                    openPanelOnActionClick: boolean;
                }) => Promise<void>;
            };
        }
    ).sidePanel;
    sidePanel
        ?.setPanelBehavior?.({ openPanelOnActionClick: true })
        ?.catch(() => {});
}

function refreshIcon() {
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
        refreshIconIndicator(rules.length);
    });
}

function loadHeaderName() {
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
        let headerName = '';
        for (const rule of rules) {
            if (
                rule.action.type ===
                chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS
            ) {
                const h = rule.action.requestHeaders?.[0]?.header;
                if (h) {
                    headerName = h;
                    break;
                }
            }
        }
        const next = setHeaderName(observation, headerName);
        if (next !== observation) {
            observation = next;
            persistObservation();
        }
        broadcast();
    });
}

async function restoreObservation(): Promise<void> {
    if (observationLoaded) return;
    observationLoaded = true;
    const session = (
        chrome.storage as unknown as { session?: chrome.storage.StorageArea }
    ).session;
    if (!session) return;
    try {
        const stored = await session.get(OBSERVATION_SESSION_KEY);
        const value = stored[OBSERVATION_SESSION_KEY] as
            | HeaderObservation
            | undefined;
        if (value && Array.isArray(value.buckets)) {
            observation = rotateBuckets(value, Date.now());
        }
    } catch {}
}

function persistObservation() {
    const session = (
        chrome.storage as unknown as { session?: chrome.storage.StorageArea }
    ).session;
    if (!session) return;
    session.set({ [OBSERVATION_SESSION_KEY]: observation }).catch(() => {});
}

function ensureRotation() {
    if (rotationTimer !== null) return;
    rotationTimer = setInterval(() => {
        observation = rotateBuckets(observation, Date.now());
        broadcast();
    }, 1000);
}

function stopRotation() {
    if (rotationTimer === null) return;
    clearInterval(rotationTimer);
    rotationTimer = null;
}

function broadcast() {
    for (const port of subscribers) pushTo(port);
}

function pushTo(port: chrome.runtime.Port) {
    try {
        port.postMessage(observation);
    } catch {
        subscribers.delete(port);
    }
}
