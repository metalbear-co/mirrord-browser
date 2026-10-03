import { STORAGE_KEYS } from './types';

const POSTHOG_KEY = 'phc_wIZh92nyk4vu6HidiLFUzjW6piZlZszuWZZFBS7yHHe';
const POSTHOG_HOST = 'https://hog.metalbear.com';

const APP_VERSION = (() => {
    try {
        return chrome.runtime.getManifest().version;
    } catch {
        return 'unknown';
    }
})();

const DISTINCT_ID_KEY = 'posthog_distinct_id';

let distinctId: string | null = null;
let distinctIdLoad: Promise<string> | null = null;
let optedOut = false;

// The service worker has no `localStorage`, so pages mirror their id into chrome.storage.local
// and the worker reads it from there.
function pageDistinctId(): string | null {
    try {
        const stored = localStorage.getItem(DISTINCT_ID_KEY);
        if (stored) {
            return stored;
        }
        const id = crypto.randomUUID();
        localStorage.setItem(DISTINCT_ID_KEY, id);
        return id;
    } catch {
        return null;
    }
}

async function loadDistinctId(): Promise<string> {
    let stored: unknown;
    try {
        const result: Record<string, unknown> =
            await chrome.storage.local.get(DISTINCT_ID_KEY);
        stored = result[DISTINCT_ID_KEY];
    } catch {
        stored = undefined;
    }
    const id =
        pageDistinctId() ??
        (typeof stored === 'string' && stored ? stored : crypto.randomUUID());
    if (id !== stored) {
        try {
            await chrome.storage.local.set({ [DISTINCT_ID_KEY]: id });
        } catch {
            // Storage access can fail in certain contexts
        }
    }
    distinctId = id;
    return id;
}

function withDistinctId(send: (id: string) => void): void {
    distinctIdLoad ??= loadDistinctId();
    const known = distinctId ?? pageDistinctId();
    if (known) {
        send(known);
        return;
    }
    void distinctIdLoad.then(send).catch(() => undefined);
}

/**
 * Load opt-out state from chrome.storage.local into the module-level variable.
 * Kicks off eagerly at module init so it resolves before most capture calls.
 */
export async function loadOptOutState(): Promise<void> {
    try {
        const result = await chrome.storage.local.get(
            STORAGE_KEYS.ANALYTICS_OPT_OUT
        );
        optedOut = result[STORAGE_KEYS.ANALYTICS_OPT_OUT] === true;
    } catch {
        // Storage access can fail in certain contexts; default to not opted out
    }
}

/** Resolves once the opt-out preference has been read from storage. */
export const optOutReady = loadOptOutState();

/**
 * Update opt-out state in memory and persist to storage.
 */
export async function setOptOut(value: boolean): Promise<void> {
    optedOut = value;
    try {
        if (value) {
            await chrome.storage.local.set({
                [STORAGE_KEYS.ANALYTICS_OPT_OUT]: true,
            });
        } else {
            await chrome.storage.local.remove(STORAGE_KEYS.ANALYTICS_OPT_OUT);
        }
    } catch {
        // Storage access can fail in certain contexts
    }
}

export function capture(
    event: string,
    properties?: Record<string, unknown>
): void {
    if (optedOut) {
        return;
    }
    const timestamp = new Date().toISOString();
    withDistinctId((id) => {
        try {
            fetch(`${POSTHOG_HOST}/capture/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_key: POSTHOG_KEY,
                    event,
                    distinct_id: id,
                    properties: {
                        ...properties,
                        $lib: 'mirrord-browser-extension',
                        $app_version: APP_VERSION,
                    },
                    timestamp,
                }),
            }).catch(() => undefined);
        } catch {
            // Analytics should never break the extension
        }
    });
}

/**
 * Send an event using navigator.sendBeacon (for popup close where fetch gets cancelled).
 */
export function captureBeacon(
    event: string,
    properties?: Record<string, unknown>
): void {
    if (optedOut) {
        return;
    }
    const timestamp = new Date().toISOString();
    withDistinctId((id) => {
        try {
            const payload = JSON.stringify({
                api_key: POSTHOG_KEY,
                event,
                distinct_id: id,
                properties: {
                    ...properties,
                    $lib: 'mirrord-browser-extension',
                    $app_version: APP_VERSION,
                },
                timestamp,
            });
            navigator.sendBeacon(`${POSTHOG_HOST}/capture/`, payload);
        } catch {
            // Analytics should never break the extension
        }
    });
}

export function captureException(
    error: unknown,
    properties: Record<string, unknown> = {},
    handled = true
): void {
    const err = error instanceof Error ? error : new Error(String(error));
    capture('$exception', {
        $exception_list: [
            {
                type: err.name,
                value: err.message,
                mechanism: { handled, synthetic: false },
            },
        ],
        $exception_stack_trace_raw: err.stack,
        surface: 'extension',
        ...properties,
    });
}

export function initErrorTracking(page: string): void {
    window.addEventListener('error', (event) => {
        captureException(event.error ?? event.message, { page }, false);
    });
    window.addEventListener('unhandledrejection', (event) => {
        captureException(event.reason, { page }, false);
    });
}

export type EventKind = 'user_action' | 'health';

export function emitUserBlocked(
    reason: string,
    kind: EventKind,
    properties: Record<string, unknown> = {}
): void {
    capture('extension_user_blocked', {
        reason,
        kind,
        surface: 'extension',
        ...properties,
    });
}

export function emitUserSucceeded(
    reason: string,
    kind: EventKind,
    properties: Record<string, unknown> = {}
): void {
    capture('extension_user_succeeded', {
        reason,
        kind,
        surface: 'extension',
        ...properties,
    });
}
