import {
    STORAGE_KEYS,
    type RuntimePort,
    type RuntimeMessageSender,
} from './types';
import { browser } from './browser';
import {
    buildDnrRule,
    deriveInjectionHint,
    getDynamicRules,
    refreshIconIndicator,
    storageGet,
    storageRemove,
    storageSet,
    updateDynamicRules,
} from './util';
import {
    BAGGAGE_HEADER_NAME,
    BAGGAGE_VALUE_PREFIX,
    fetchOperatorSessions,
} from './hooks/useMirrordUi';
import {
    HEADER_OBSERVATION_PORT,
    armCanary,
    cancelCanary,
    emptyObservation,
    notifyHeaderObserved,
    recordRequest,
    rotateBuckets,
    setHeaderName,
    type HeaderObservation,
} from './headerObservation';
import { emitUserBlocked, emitUserSucceeded } from './analytics';

const MIRRORD_UI_CONFIGURE_TYPE = 'mirrord-ui-configure';
const PONG_TYPE = 'pong';
const JOIN_RESULT_TYPE = 'join_result';
const LEAVE_RESULT_TYPE = 'leave_result';
const TRUSTED_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const OBSERVATION_SESSION_KEY = 'header_observation';
const EXTENSION_VERSION = browser.runtime.getManifest().version;

type ConfigureMessage = {
    type: typeof MIRRORD_UI_CONFIGURE_TYPE;
    backend: string;
    token: string;
};

type PingMessage = { type: 'ping' };
type JoinMessage = { type: 'join'; key: string };
type LeaveMessage = { type: 'leave' };
type BridgeMessage =
    | ConfigureMessage
    | PingMessage
    | JoinMessage
    | LeaveMessage;

let observation: HeaderObservation = emptyObservation('');
const subscribers = new Set<RuntimePort>();
let rotationTimer: ReturnType<typeof setInterval> | null = null;
let observationLoaded = false;

self.addEventListener('error', (event: ErrorEvent) => {
    emitUserBlocked('unhandled_error', 'health', {
        error: event.message ?? 'unknown',
        source: 'error',
    });
});

self.addEventListener('unhandledrejection', (event: Event) => {
    const reason = (event as Event & { reason?: unknown }).reason;
    const error =
        reason instanceof Error
            ? reason.message
            : typeof reason === 'string'
              ? reason
              : 'unknown rejection';
    emitUserBlocked('unhandled_error', 'health', {
        error,
        source: 'unhandledrejection',
    });
});

restrictStorageAccess();
configureSidePanel();
browser.runtime.onStartup.addListener(restrictStorageAccess);
browser.runtime.onInstalled.addListener(restrictStorageAccess);
browser.runtime.onStartup.addListener(configureSidePanel);
browser.runtime.onInstalled.addListener(configureSidePanel);
browser.runtime.onStartup.addListener(refreshIcon);
browser.runtime.onInstalled.addListener(refreshIcon);

restoreObservation().then(loadHeaderName);
browser.runtime.onStartup.addListener(() => {
    restoreObservation().then(loadHeaderName);
});
browser.runtime.onInstalled.addListener(() => {
    restoreObservation().then(loadHeaderName);
});

const RULE_TRIGGERING_KEYS: readonly string[] = [
    STORAGE_KEYS.OVERRIDE,
    STORAGE_KEYS.DEFAULTS,
    STORAGE_KEYS.JOINED_KEY,
    STORAGE_KEYS.JOINED_SESSION_NAME,
];

browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (RULE_TRIGGERING_KEYS.some((key) => key in changes)) {
        loadHeaderName();
    }
});

browser.webRequest.onSendHeaders.addListener(
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
        const matchedHeader = headers.find(
            (h) => h.name.toLowerCase() === target
        );
        if (matchedHeader) notifyHeaderObserved(matchedHeader.name);
        persistObservation();
        broadcast();
    },
    { urls: ['<all_urls>'] },
    ['requestHeaders', 'extraHeaders']
);

browser.runtime.onConnect.addListener((port) => {
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
        browser.storage.local as unknown as {
            setAccessLevel?: (opts: { accessLevel: string }) => Promise<void>;
        }
    ).setAccessLevel;
    if (typeof setAccessLevel !== 'function') return;
    setAccessLevel
        .call(browser.storage.local, { accessLevel: 'TRUSTED_CONTEXTS' })
        .catch(() => {});
}

function handleExternalMessage(
    message: unknown,
    sender: RuntimeMessageSender,
    sendResponse: (response: unknown) => void
): boolean | void {
    if (!isTrustedSender(sender)) {
        sendResponse({ ok: false, error: 'untrusted sender' });
        return;
    }
    const m = message as Partial<BridgeMessage> | null;
    if (m && m.type === 'ping') {
        handlePing().then(sendResponse);
        return true;
    }
    if (m && m.type === 'join' && typeof m.key === 'string') {
        handleJoin(m.key).then(sendResponse);
        return true;
    }
    if (m && m.type === 'leave') {
        handleLeave().then(sendResponse);
        return true;
    }
    if (!isConfigureMessage(message)) {
        sendResponse({ ok: false, error: 'unknown message' });
        return;
    }
    storageSet({
        [STORAGE_KEYS.MIRRORD_UI_BACKEND]: message.backend,
        [STORAGE_KEYS.MIRRORD_UI_TOKEN]: message.token,
    })
        .then(() => sendResponse({ ok: true }))
        .catch((err) =>
            sendResponse({
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            })
        );
    return true;
}

// `onMessageExternal` + `externally_connectable` are Chrome-only: they let the localhost
// mirrord CLI message the extension directly. Firefox has no equivalent, so this listener
// simply never registers there and the CLI handoff falls back to the config-link URL flow.
// Use the raw `chrome` global (not the polyfill) to keep Chrome's `sendResponse`/`return
// true` async-response semantics intact.
const chromeRuntime = (
    globalThis as unknown as {
        chrome?: {
            runtime?: {
                onMessageExternal?: {
                    addListener: (
                        cb: (
                            message: unknown,
                            sender: RuntimeMessageSender,
                            sendResponse: (response: unknown) => void
                        ) => boolean | void
                    ) => void;
                };
            };
        };
    }
).chrome?.runtime;

chromeRuntime?.onMessageExternal?.addListener(handleExternalMessage);

async function handlePing() {
    const stored = await storageGet([
        STORAGE_KEYS.JOINED_KEY,
        STORAGE_KEYS.MIRRORD_UI_BACKEND,
        STORAGE_KEYS.MIRRORD_UI_TOKEN,
    ]);
    return {
        type: PONG_TYPE,
        version: EXTENSION_VERSION,
        joinedKey:
            (stored[STORAGE_KEYS.JOINED_KEY] as string | undefined) ?? null,
        hasBackend: !!stored[STORAGE_KEYS.MIRRORD_UI_BACKEND],
        watching: !!stored[STORAGE_KEYS.MIRRORD_UI_TOKEN],
    };
}

export async function handleJoin(key: string) {
    try {
        const stored = await storageGet([
            STORAGE_KEYS.MIRRORD_UI_BACKEND,
            STORAGE_KEYS.MIRRORD_UI_TOKEN,
            STORAGE_KEYS.SCOPE_PATTERNS,
        ]);
        const backend = stored[STORAGE_KEYS.MIRRORD_UI_BACKEND] as
            | string
            | undefined;
        const token = stored[STORAGE_KEYS.MIRRORD_UI_TOKEN] as
            | string
            | undefined;
        if (!backend || !token) {
            const error = 'mirrord ui not configured in extension';
            emitUserBlocked('join_misconfigured', 'user_action', { error });
            return {
                type: JOIN_RESULT_TYPE,
                ok: false,
                error,
            };
        }
        const sessionsResp = await fetchOperatorSessions(backend, token);
        const target = sessionsResp.sessions.find((s) => s.key === key);
        if (!target) {
            const error = `key ${key} not visible from extension`;
            emitUserBlocked('join_key_not_visible', 'user_action', {
                error,
                key,
            });
            return { type: JOIN_RESULT_TYPE, ok: false, error };
        }
        const filterHint = deriveInjectionHint(target.httpFilter?.headerFilter);
        const header = filterHint?.header ?? BAGGAGE_HEADER_NAME;
        const value = filterHint?.value ?? `${BAGGAGE_VALUE_PREFIX}${key}`;
        const scope =
            (stored[STORAGE_KEYS.SCOPE_PATTERNS] as string[] | undefined) ?? [];
        const existing = await getDynamicRules();
        await updateDynamicRules({
            removeRuleIds: existing.map((r) => r.id),
            addRules: buildDnrRule(header, value, scope),
        });
        await storageSet({
            [STORAGE_KEYS.JOINED_KEY]: key,
            [STORAGE_KEYS.JOINED_SESSION_NAME]: target.id,
            [STORAGE_KEYS.JOINED_HEADER]: header,
            [STORAGE_KEYS.JOINED_VALUE]: value,
        });
        armCanary({ headerName: header, flow: 'session_monitor' });
        emitUserSucceeded('joined', 'user_action', { key });
        return { type: JOIN_RESULT_TYPE, ok: true, joinedKey: key };
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        emitUserBlocked('join_failed', 'user_action', { error });
        return {
            type: JOIN_RESULT_TYPE,
            ok: false,
            error,
        };
    }
}

export async function handleLeave() {
    try {
        const existing = await getDynamicRules();
        await updateDynamicRules({
            removeRuleIds: existing.map((r) => r.id),
            addRules: [],
        });
        await storageRemove([
            STORAGE_KEYS.JOINED_KEY,
            STORAGE_KEYS.JOINED_SESSION_NAME,
            STORAGE_KEYS.JOINED_HEADER,
            STORAGE_KEYS.JOINED_VALUE,
            STORAGE_KEYS.SCOPE_PATTERNS,
        ]);
        cancelCanary();
        emitUserSucceeded('left', 'user_action');
        return { type: LEAVE_RESULT_TYPE, ok: true };
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        emitUserBlocked('leave_failed', 'user_action', { error });
        return {
            type: LEAVE_RESULT_TYPE,
            ok: false,
            error,
        };
    }
}

function isTrustedSender(sender: RuntimeMessageSender): boolean {
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

// Side panel is Chrome-only and not part of the polyfill surface; reach it through the raw
// `chrome` global, guarded so it's a no-op on Firefox (which uses the action popup instead).
function configureSidePanel() {
    const sidePanel = (
        globalThis as unknown as {
            chrome?: {
                sidePanel?: {
                    setPanelBehavior?: (opts: {
                        openPanelOnActionClick: boolean;
                    }) => Promise<void>;
                };
            };
        }
    ).chrome?.sidePanel;
    sidePanel
        ?.setPanelBehavior?.({ openPanelOnActionClick: true })
        ?.catch(() => {});
}

function refreshIcon() {
    getDynamicRules().then((rules) => {
        refreshIconIndicator(rules.length);
    });
}

function loadHeaderName() {
    getDynamicRules().then((rules) => {
        let headerName = '';
        for (const rule of rules) {
            if (rule.action.type === 'modifyHeaders') {
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

// `storage.session` (MV3) exists on both engines but isn't in the polyfill's typed surface;
// access it structurally and treat it as optional for older runtimes.
type SessionStorage = {
    get: (key: string) => Promise<Record<string, unknown>>;
    set: (items: Record<string, unknown>) => Promise<void>;
};

function sessionStorage(): SessionStorage | undefined {
    return (browser.storage as unknown as { session?: SessionStorage }).session;
}

async function restoreObservation(): Promise<void> {
    if (observationLoaded) return;
    observationLoaded = true;
    const session = sessionStorage();
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
    const session = sessionStorage();
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

function pushTo(port: RuntimePort) {
    try {
        port.postMessage(observation);
    } catch {
        subscribers.delete(port);
    }
}
