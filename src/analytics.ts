const POSTHOG_KEY = 'phc_wIZh92nyk4vu6HidiLFUzjW6piZlZszuWZZFBS7yHHe';
const POSTHOG_HOST = 'https://hog.metalbear.com';

let distinctId: string | null = null;

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

export function capture(
    event: string,
    properties?: Record<string, unknown>
): void {
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
