import type { OperatorSessionsResponse } from './types';

/**
 * Fetch the current operator-sessions snapshot from a running mirrord ui.
 * Accepts an optional fetch impl for testing.
 */
export async function fetchOperatorSessions(
    backend: string,
    token: string,
    fetchImpl: typeof fetch = fetch
): Promise<OperatorSessionsResponse> {
    const url = `${backend}/api/operator-sessions?token=${encodeURIComponent(token)}`;
    const resp = await fetchImpl(url);
    if (!resp.ok) {
        throw new Error(
            `mirrord ui responded ${resp.status} ${resp.statusText}: ${await resp.text()}`
        );
    }
    return (await resp.json()) as OperatorSessionsResponse;
}

/**
 * Build the WebSocket URL for /ws from an http(s) backend base.
 */
export function buildWsUrl(backend: string, token: string): string {
    let scheme: string;
    if (backend.startsWith('https://')) scheme = 'wss';
    else if (backend.startsWith('http://')) scheme = 'ws';
    else
        throw new Error(
            `mirrord ui backend must be http:// or https://, got ${backend}`
        );
    const hostAndRest = backend.replace(/^https?:\/\//, '');
    return `${scheme}://${hostAndRest}/ws?token=${encodeURIComponent(token)}`;
}

/**
 * Simple health probe against the unauthenticated /health endpoint.
 * Returns true iff the server responded 200 within the given timeout.
 */
export async function pingHealth(
    backend: string,
    timeoutMs = 1500,
    fetchImpl: typeof fetch = fetch
): Promise<boolean> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const r = await fetchImpl(`${backend}/health`, { signal: ctrl.signal });
        return r.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}
