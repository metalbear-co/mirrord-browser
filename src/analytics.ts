import { STORAGE_KEYS } from './types';

const POSTHOG_KEY = 'phc_wIZh92nyk4vu6HidiLFUzjW6piZlZszuWZZFBS7yHHe';
const POSTHOG_HOST = 'https://hog.metalbear.com';

let distinctId: string | null = null;
let optedOut = false;

function getDistinctId(): string {
    if (distinctId) return distinctId;
    const stored = localStorage.getItem('posthog_distinct_id');
    if (stored) {
        distinctId = stored;
        return distinctId;
    }
    distinctId = crypto.randomUUID();
    localStorage.setItem('posthog_distinct_id', distinctId);
    return distinctId;
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
    if (optedOut) return;
    try {
        fetch(`${POSTHOG_HOST}/capture/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: POSTHOG_KEY,
                event,
                distinct_id: getDistinctId(),
                properties: {
                    ...properties,
                    $lib: 'mirrord-browser-extension',
                },
                timestamp: new Date().toISOString(),
            }),
        }).catch(() => {});
    } catch {
        // Analytics should never break the extension
    }
}

/**
 * Send an event using navigator.sendBeacon (for popup close where fetch gets cancelled).
 */
export function captureBeacon(
    event: string,
    properties?: Record<string, unknown>
): void {
    if (optedOut) return;
    try {
        const payload = JSON.stringify({
            api_key: POSTHOG_KEY,
            event,
            distinct_id: getDistinctId(),
            properties: {
                ...properties,
                $lib: 'mirrord-browser-extension',
            },
            timestamp: new Date().toISOString(),
        });
        navigator.sendBeacon(`${POSTHOG_HOST}/capture/`, payload);
    } catch {
        // Analytics should never break the extension
    }
}
