import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import groupBy from 'lodash.groupby';
import { STORAGE_KEYS } from '../types';
import type {
    Config,
    ContextsResponse,
    KubeContext,
    OperatorSessionSummary,
    OperatorSessionsResponse,
    OperatorSessionsV2Response,
    OperatorWatchStatus,
    SessionNotification,
} from '../types';
import {
    MIRRORD_UI_DEFAULT_BACKEND,
    SESSION_NOTIFICATION_TYPE,
    STRINGS,
} from '../constants';
import {
    storageGet,
    storageSet,
    storageRemove,
    getDynamicRules,
    updateDynamicRules,
    sessionInjectionPair,
    buildDnrRule,
    buildShareUrl as buildConfigShareUrl,
} from '../util';
import { emitUserBlocked, emitUserSucceeded } from '../analytics';

let bridgeHealthy = true;

const HTTP_NOT_FOUND = 404;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

async function isLegacyServer(
    backend: string,
    token: string,
    fetchImpl: typeof fetch
): Promise<boolean> {
    const probe = await fetchImpl(`${backend}/api/v2/kube/contexts`, {
        headers: { 'x-auth-token': token },
    });
    if (isAuthFailureStatus(probe.status)) return false;
    if (probe.status === HTTP_NOT_FOUND) return true;
    const contentType = probe.headers.get('content-type') ?? '';
    return contentType.includes('text/html');
}

export async function fetchOperatorSessions(
    backend: string,
    token: string,
    fetchImpl: typeof fetch = fetch
): Promise<OperatorSessionsResponse> {
    const url = `${backend}/api/operator-sessions`;
    let resp = await fetchImpl(url, {
        headers: { 'x-auth-token': token },
    });
    if (
        isAuthFailureStatus(resp.status) &&
        (await isLegacyServer(backend, token, fetchImpl))
    ) {
        resp = await fetchImpl(`${url}?token=${encodeURIComponent(token)}`);
    }
    if (!resp.ok) {
        const e = new Error(
            `mirrord ui responded ${resp.status} ${resp.statusText}: ${await resp.text()}`
        );
        (e as Error & { status?: number }).status = resp.status;
        throw e;
    }
    return (await resp.json()) as OperatorSessionsResponse;
}

/**
 * Fetches the kube contexts from the v2 API, which doubles as a probe for whether the `mirrord ui`
 * server supports `/api/v2` at all. Returns `null` on 404 (an older server without v2), the context
 * list on success, and throws on other errors (e.g. auth failures).
 */
export async function fetchContexts(
    backend: string,
    token: string,
    fetchImpl: typeof fetch = fetch
): Promise<ContextsResponse | null> {
    const url = `${backend}/api/v2/kube/contexts`;
    const resp = await fetchImpl(url, {
        headers: { 'x-auth-token': token },
    });
    if (resp.status === HTTP_NOT_FOUND) return null;
    if (!resp.ok) {
        const e = new Error(
            `mirrord ui responded ${resp.status} ${resp.statusText}`
        );
        (e as Error & { status?: number }).status = resp.status;
        throw e;
    }
    return (await resp.json()) as ContextsResponse;
}

function mapV2ToInternal(
    v2: OperatorSessionsV2Response
): OperatorSessionsResponse {
    const watch_status: OperatorWatchStatus =
        v2.status === 'available'
            ? { status: 'watching' }
            : { status: 'unavailable', reason: v2.reason ?? '' };
    return {
        sessions: v2.sessions,
        by_key: groupByKey(v2.sessions),
        watch_status,
    };
}

/**
 * Fetches operator sessions for a specific kube context via the v2 API. Namespace filtering stays
 * client-side (the response carries every namespace's sessions), so no namespace param is sent.
 */
export async function fetchOperatorSessionsV2(
    backend: string,
    token: string,
    context: string | null,
    fetchImpl: typeof fetch = fetch
): Promise<OperatorSessionsResponse> {
    const params = new URLSearchParams();
    if (context) params.set('context', context);
    const url = `${backend}/api/v2/operator/sessions?${params.toString()}`;
    const resp = await fetchImpl(url, {
        headers: { 'x-auth-token': token },
    });
    if (!resp.ok) {
        const e = new Error(
            `mirrord ui responded ${resp.status} ${resp.statusText}: ${await resp.text()}`
        );
        (e as Error & { status?: number }).status = resp.status;
        throw e;
    }
    return mapV2ToInternal((await resp.json()) as OperatorSessionsV2Response);
}

export type PollResult =
    | { ok: true; data: OperatorSessionsResponse }
    | { ok: false; status?: number; error: string };

export async function runPoll(
    backend: string,
    token: string,
    v2 = false,
    context: string | null = null
): Promise<PollResult> {
    try {
        const resp = v2
            ? await fetchOperatorSessionsV2(backend, token, context)
            : await fetchOperatorSessions(backend, token);
        if (!bridgeHealthy) {
            bridgeHealthy = true;
            emitUserSucceeded('bridge_recovered', 'health');
        }
        return { ok: true, data: resp };
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        const status =
            err instanceof Error &&
            typeof (err as Error & { status?: unknown }).status === 'number'
                ? (err as Error & { status: number }).status
                : undefined;
        if (bridgeHealthy) {
            bridgeHealthy = false;
            emitUserBlocked('bridge_unhealthy', 'health', {
                error,
                ...(status !== undefined && { status }),
            });
        }
        return { ok: false, error, ...(status !== undefined && { status }) };
    }
}

/** True for HTTP responses that indicate the mirrord ui token is wrong / rejected. */
export function isAuthFailureStatus(status: number | undefined): boolean {
    return status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN;
}

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

const OPERATOR_SESSIONS_POLL_MS = 5000;

const WATCHED_STORAGE_KEYS: readonly string[] = [
    STORAGE_KEYS.JOINED_KEY,
    STORAGE_KEYS.JOINED_SESSION_NAME,
    STORAGE_KEYS.JOINED_HEADER,
    STORAGE_KEYS.JOINED_VALUE,
    STORAGE_KEYS.SCOPE_PATTERNS,
    STORAGE_KEYS.MIRRORD_UI_BACKEND,
    STORAGE_KEYS.MIRRORD_UI_TOKEN,
    STORAGE_KEYS.SELECTED_CONTEXT,
];

function hasWatchedChange(
    changes: Record<string, chrome.storage.StorageChange>
): boolean {
    return WATCHED_STORAGE_KEYS.some((key) => key in changes);
}

function groupByKey(
    sessions: OperatorSessionSummary[]
): Record<string, OperatorSessionSummary[]> {
    return groupBy(sessions, (s) => s.key);
}

export interface JoinState {
    joinedKey: string | null;
    joinedSessionName: string | null;
}

export function useMirrordUi() {
    const [backend, setBackend] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [configLoaded, setConfigLoaded] = useState(false);
    const [healthy, setHealthy] = useState<boolean | null>(null);
    // True when we have no token but a `mirrord ui` server is answering on the default port.
    // Lets the popup tell the user it's running and point them at the page to get configured.
    const [uiDetectedNoToken, setUiDetectedNoToken] = useState(false);
    const [sessions, setSessions] = useState<OperatorSessionsResponse | null>(
        null
    );
    const [status, setStatus] = useState<OperatorWatchStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    // The poller is reachable but rejected our token (401/403) — likely a stale token or
    // another process on the port. Surfaced separately so the UI can tell the user to re-auth.
    const [authFailed, setAuthFailed] = useState(false);
    const [namespace, setNamespace] = useState<string>('');
    // `null` while probing; `true`/`false` once we know if the server has `/api/v2`. Determines
    // whether context selection is available and whether we poll v2 or fall back to v1.
    const [v2Available, setV2Available] = useState<boolean | null>(null);
    const [contexts, setContexts] = useState<KubeContext[]>([]);
    const [currentContext, setCurrentContext] = useState<string | null>(null);
    const [selectedContext, setSelectedContextState] = useState<string | null>(
        null
    );
    const [joinState, setJoinState] = useState<JoinState>({
        joinedKey: null,
        joinedSessionName: null,
    });
    const [scopePatterns, setScopePatternsState] = useState<string[]>([]);
    const [joinedHeader, setJoinedHeader] = useState<string | null>(null);
    const [joinedValue, setJoinedValue] = useState<string | null>(null);
    const joinedHeaderRef = useRef<string | null>(null);
    const joinedValueRef = useRef<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);

    // The context whose sessions we show: the user's pick, else the kubeconfig's current context.
    const effectiveContext = selectedContext ?? currentContext;

    useEffect(() => {
        let cancelled = false;
        const loadFromStorage = async () => {
            const stored = await storageGet([
                STORAGE_KEYS.MIRRORD_UI_BACKEND,
                STORAGE_KEYS.MIRRORD_UI_TOKEN,
                STORAGE_KEYS.JOINED_KEY,
                STORAGE_KEYS.JOINED_SESSION_NAME,
                STORAGE_KEYS.JOINED_HEADER,
                STORAGE_KEYS.JOINED_VALUE,
                STORAGE_KEYS.SCOPE_PATTERNS,
                STORAGE_KEYS.SELECTED_CONTEXT,
            ]);
            if (cancelled) return;
            setBackend(
                (stored[STORAGE_KEYS.MIRRORD_UI_BACKEND] as
                    | string
                    | undefined) ?? null
            );
            setToken(
                (stored[STORAGE_KEYS.MIRRORD_UI_TOKEN] as string | undefined) ??
                    null
            );
            setJoinState({
                joinedKey:
                    (stored[STORAGE_KEYS.JOINED_KEY] as string | undefined) ??
                    null,
                joinedSessionName:
                    (stored[STORAGE_KEYS.JOINED_SESSION_NAME] as
                        | string
                        | undefined) ?? null,
            });
            const header =
                (stored[STORAGE_KEYS.JOINED_HEADER] as string | undefined) ??
                null;
            const value =
                (stored[STORAGE_KEYS.JOINED_VALUE] as string | undefined) ??
                null;
            joinedHeaderRef.current = header;
            joinedValueRef.current = value;
            setJoinedHeader(header);
            setJoinedValue(value);
            const persisted = stored[STORAGE_KEYS.SCOPE_PATTERNS];
            setScopePatternsState(
                Array.isArray(persisted)
                    ? (persisted as string[]).filter(
                          (p) => typeof p === 'string'
                      )
                    : []
            );
            setSelectedContextState(
                (stored[STORAGE_KEYS.SELECTED_CONTEXT] as string | undefined) ??
                    null
            );
            setConfigLoaded(true);
        };

        void loadFromStorage();

        const listener = (
            changes: Record<string, chrome.storage.StorageChange>
        ) => {
            if (hasWatchedChange(changes)) void loadFromStorage();
        };
        chrome.storage.onChanged.addListener(listener);
        return () => {
            cancelled = true;
            chrome.storage.onChanged.removeListener(listener);
        };
    }, []);

    useEffect(() => {
        if (!backend) return;
        pingHealth(backend)
            .then(setHealthy)
            .catch(() => setHealthy(false));
    }, [backend]);

    // When the extension has no token, poll the default `mirrord ui` port so we can tell the
    // user it's already running and just needs configuring (instead of the generic "run mirrord
    // ui" prompt). Stops as soon as a token arrives.
    useEffect(() => {
        if (!configLoaded || token) {
            setUiDetectedNoToken(false);
            return;
        }
        let cancelled = false;
        const probe = () => {
            pingHealth(MIRRORD_UI_DEFAULT_BACKEND)
                .then((ok) => {
                    if (!cancelled) setUiDetectedNoToken(ok);
                })
                .catch(() => {
                    if (!cancelled) setUiDetectedNoToken(false);
                });
        };
        probe();
        const interval = setInterval(probe, OPERATOR_SESSIONS_POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [configLoaded, token]);

    // Probe for `/api/v2`: its presence enables context selection, its absence falls back to v1.
    useEffect(() => {
        if (!backend || !token || healthy !== true) {
            setV2Available(null);
            return;
        }
        let cancelled = false;
        fetchContexts(backend, token)
            .then((resp) => {
                if (cancelled) return;
                if (resp === null) {
                    setV2Available(false);
                    setContexts([]);
                    return;
                }
                setV2Available(true);
                setContexts(resp.contexts);
                setCurrentContext(resp.current);
            })
            .catch(() => {
                // A non-404 failure (e.g. bad token) — fall back to v1, whose poll surfaces the
                // auth error. Re-probes when backend/token/health change.
                if (!cancelled) {
                    setV2Available(false);
                    setContexts([]);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [backend, token, healthy]);

    useEffect(() => {
        if (!backend || !token || healthy !== true || v2Available === null)
            return;
        let cancelled = false;
        const refresh = () => {
            void runPoll(backend, token, v2Available, effectiveContext).then(
                (result) => {
                    if (cancelled) return;
                    if (result.ok) {
                        setSessions(result.data);
                        setStatus(result.data.watch_status);
                        setError(null);
                        setAuthFailed(false);
                    } else {
                        setAuthFailed(isAuthFailureStatus(result.status));
                    }
                }
            );
        };
        refresh();
        const interval = setInterval(refresh, OPERATOR_SESSIONS_POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [backend, token, healthy, v2Available, effectiveContext]);

    // The live-updates WebSocket is a v1-only feature; v2 is poll-only (its `/api/v2/operator/
    // sessions` is per-context and has no push channel), so only open it on the v1 fallback path.
    useEffect(() => {
        if (!backend || !token || healthy !== true || v2Available !== false)
            return;
        const url = buildWsUrl(backend, token);
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onmessage = (ev) => {
            const data: unknown = ev.data;
            if (typeof data !== 'string') {
                setError(STRINGS.ERR_WS_PARSE);
                return;
            }
            let msg: SessionNotification;
            try {
                msg = JSON.parse(data) as SessionNotification;
            } catch {
                setError(STRINGS.ERR_WS_PARSE);
                return;
            }
            setSessions((current) =>
                current ? applyNotification(current, msg) : current
            );
        };
        ws.onerror = () => setError(STRINGS.ERR_WS_CONNECTION);
        ws.onclose = () => {
            wsRef.current = null;
        };

        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, [backend, token, healthy, v2Available]);

    const namespaces = useMemo(() => {
        const set = new Set<string>();
        sessions?.sessions.forEach((s) => {
            if (s.namespace) set.add(s.namespace);
        });
        return ['', ...Array.from(set).sort()];
    }, [sessions]);

    const groupedFiltered = useMemo<
        Record<string, OperatorSessionSummary[]>
    >(() => {
        if (!sessions) return {};
        const filtered = namespace
            ? sessions.sessions.filter((s) => s.namespace === namespace)
            : sessions.sessions;
        return groupByKey(filtered);
    }, [sessions, namespace]);

    const join = useCallback(
        async (key: string) => {
            const target = sessions?.sessions.find((s) => s.key === key);
            if (!target) {
                setError(STRINGS.ERR_KEY_NOT_VISIBLE(key));
                return;
            }
            const { header, value } = sessionInjectionPair(target);
            const existing = await getDynamicRules();
            await updateDynamicRules({
                removeRuleIds: existing.map((r) => r.id),
                addRules: buildDnrRule(header, value, scopePatterns),
            });
            await storageSet({
                [STORAGE_KEYS.JOINED_KEY]: key,
                [STORAGE_KEYS.JOINED_SESSION_NAME]: target.id,
                [STORAGE_KEYS.JOINED_HEADER]: header,
                [STORAGE_KEYS.JOINED_VALUE]: value,
            });
            joinedHeaderRef.current = header;
            joinedValueRef.current = value;
            setJoinedHeader(header);
            setJoinedValue(value);
            setJoinState({
                joinedKey: key,
                joinedSessionName: target.id,
            });
        },
        [sessions, scopePatterns]
    );

    const clearJoin = useCallback(async () => {
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
        joinedHeaderRef.current = null;
        joinedValueRef.current = null;
        setJoinedHeader(null);
        setJoinedValue(null);
        setScopePatternsState([]);
        setJoinState({
            joinedKey: null,
            joinedSessionName: null,
        });
    }, []);

    const applyScopePatterns = useCallback(async (next: string[]) => {
        const cleaned = next.map((p) => p.trim()).filter((p) => p.length > 0);
        const dedup = Array.from(new Set(cleaned));
        await storageSet({ [STORAGE_KEYS.SCOPE_PATTERNS]: dedup });
        setScopePatternsState(dedup);
        const header = joinedHeaderRef.current;
        const value = joinedValueRef.current;
        if (header && value) {
            const existing = await getDynamicRules();
            await updateDynamicRules({
                removeRuleIds: existing.map((r) => r.id),
                addRules: buildDnrRule(header, value, dedup),
            });
        }
    }, []);

    const addScopePattern = useCallback(
        (pattern: string) => applyScopePatterns([...scopePatterns, pattern]),
        [scopePatterns, applyScopePatterns]
    );

    const removeScopePattern = useCallback(
        (pattern: string) =>
            applyScopePatterns(scopePatterns.filter((p) => p !== pattern)),
        [scopePatterns, applyScopePatterns]
    );

    const buildShareUrl = useCallback(
        (key: string): string => {
            const target = sessions?.sessions.find((s) => s.key === key);
            const { header, value } = sessionInjectionPair({
                key,
                httpFilter: target?.httpFilter ?? null,
            });
            const config: Config = {
                header_filter: `${header}: ${value}`,
            };
            return buildConfigShareUrl(config);
        },
        [sessions]
    );

    const setSelectedContext = useCallback(async (context: string) => {
        await storageSet({ [STORAGE_KEYS.SELECTED_CONTEXT]: context });
        setSelectedContextState(context);
    }, []);

    return {
        backend,
        healthy,
        uiDetectedNoToken,
        sessions,
        status,
        error,
        authFailed,
        namespaces,
        namespace,
        setNamespace,
        v2Available,
        contexts,
        currentContext,
        selectedContext,
        setSelectedContext,
        groupedFiltered,
        joinState,
        joinedHeader,
        joinedValue,
        join,
        clearJoin,
        buildShareUrl,
        scopePatterns,
        addScopePattern,
        removeScopePattern,
    };
}

function applyNotification(
    current: OperatorSessionsResponse,
    msg: SessionNotification
): OperatorSessionsResponse {
    if (
        msg.type === SESSION_NOTIFICATION_TYPE.OPERATOR_SESSION_ADDED ||
        msg.type === SESSION_NOTIFICATION_TYPE.OPERATOR_SESSION_UPDATED
    ) {
        const idx = current.sessions.findIndex((s) => s.id === msg.session.id);
        const next =
            idx === -1
                ? [...current.sessions, msg.session]
                : current.sessions.map((s, i) => (i === idx ? msg.session : s));
        return rebuild(next, current.watch_status);
    }
    if (msg.type === SESSION_NOTIFICATION_TYPE.OPERATOR_SESSION_REMOVED) {
        const next = current.sessions.filter((s) => s.id !== msg.id);
        return rebuild(next, current.watch_status);
    }
    return current;
}

function rebuild(
    sessions: OperatorSessionSummary[],
    watch_status: OperatorWatchStatus
): OperatorSessionsResponse {
    return { sessions, by_key: groupByKey(sessions), watch_status };
}
