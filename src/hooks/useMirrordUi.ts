import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import groupBy from 'lodash.groupby';
import { STORAGE_KEYS } from '../types';
import type {
    OperatorSessionSummary,
    OperatorSessionsResponse,
    OperatorWatchStatus,
    SessionNotification,
} from '../types';
import { SESSION_NOTIFICATION_TYPE, STRINGS } from '../constants';
import {
    storageGet,
    storageSet,
    storageRemove,
    getDynamicRules,
    updateDynamicRules,
    deriveInjectionHint,
    buildDnrRule,
} from '../util';

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

const BAGGAGE_HEADER_NAME = 'baggage';
const BAGGAGE_VALUE_PREFIX = 'mirrord-session=';

const WATCHED_STORAGE_KEYS: readonly string[] = [
    STORAGE_KEYS.JOINED_KEY,
    STORAGE_KEYS.JOINED_SESSION_NAME,
    STORAGE_KEYS.JOINED_HEADER,
    STORAGE_KEYS.JOINED_VALUE,
    STORAGE_KEYS.SCOPE_PATTERNS,
    STORAGE_KEYS.MIRRORD_UI_BACKEND,
    STORAGE_KEYS.MIRRORD_UI_TOKEN,
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

export type JoinState = {
    joinedKey: string | null;
    joinedSessionName: string | null;
    sessionEnded: boolean;
};

export function useMirrordUi() {
    const [backend, setBackend] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [healthy, setHealthy] = useState<boolean | null>(null);
    const [sessions, setSessions] = useState<OperatorSessionsResponse | null>(
        null
    );
    const [status, setStatus] = useState<OperatorWatchStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [namespace, setNamespace] = useState<string>('');
    const [joinState, setJoinState] = useState<JoinState>({
        joinedKey: null,
        joinedSessionName: null,
        sessionEnded: false,
    });
    const [scopePatterns, setScopePatternsState] = useState<string[]>([]);
    const joinedHeaderRef = useRef<string | null>(null);
    const joinedValueRef = useRef<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);

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
            ]);
            if (cancelled) return;
            setBackend(
                (stored[STORAGE_KEYS.MIRRORD_UI_BACKEND] as string) ?? null
            );
            setToken((stored[STORAGE_KEYS.MIRRORD_UI_TOKEN] as string) ?? null);
            setJoinState({
                joinedKey: (stored[STORAGE_KEYS.JOINED_KEY] as string) ?? null,
                joinedSessionName:
                    (stored[STORAGE_KEYS.JOINED_SESSION_NAME] as string) ??
                    null,
                sessionEnded: false,
            });
            joinedHeaderRef.current =
                (stored[STORAGE_KEYS.JOINED_HEADER] as string) ?? null;
            joinedValueRef.current =
                (stored[STORAGE_KEYS.JOINED_VALUE] as string) ?? null;
            const persisted = stored[STORAGE_KEYS.SCOPE_PATTERNS];
            setScopePatternsState(
                Array.isArray(persisted)
                    ? (persisted as string[]).filter(
                          (p) => typeof p === 'string'
                      )
                    : []
            );
        };

        loadFromStorage();

        const listener = (
            changes: Record<string, chrome.storage.StorageChange>
        ) => {
            if (hasWatchedChange(changes)) loadFromStorage();
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

    useEffect(() => {
        if (!backend || !token || healthy !== true) return;
        let cancelled = false;
        fetchOperatorSessions(backend, token)
            .then((resp) => {
                if (cancelled) return;
                setSessions(resp);
                setStatus(resp.watch_status);
                setError(null);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(String(err));
            });
        return () => {
            cancelled = true;
        };
    }, [backend, token, healthy]);

    useEffect(() => {
        if (!backend || !token || healthy !== true) return;
        const url = buildWsUrl(backend, token);
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onmessage = (ev) => {
            let msg: SessionNotification;
            try {
                msg = JSON.parse(ev.data) as SessionNotification;
            } catch {
                setError(STRINGS.ERR_WS_PARSE);
                return;
            }
            setSessions((current) =>
                current ? applyNotification(current, msg) : current
            );
            if (
                msg.type === SESSION_NOTIFICATION_TYPE.OPERATOR_SESSION_REMOVED
            ) {
                setJoinState((js) =>
                    js.joinedSessionName === msg.id
                        ? { ...js, sessionEnded: true }
                        : js
                );
            }
        };
        ws.onerror = () => setError(STRINGS.ERR_WS_CONNECTION);
        ws.onclose = () => {
            wsRef.current = null;
        };

        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, [backend, token, healthy]);

    const namespaces = useMemo(() => {
        const set = new Set<string>();
        sessions?.sessions.forEach((s) => set.add(s.namespace));
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
            const filterHint = deriveInjectionHint(
                target.httpFilter?.headerFilter
            );
            const header = filterHint?.header ?? BAGGAGE_HEADER_NAME;
            const value = filterHint?.value ?? `${BAGGAGE_VALUE_PREFIX}${key}`;
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
            setJoinState({
                joinedKey: key,
                joinedSessionName: target.id,
                sessionEnded: false,
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
        setScopePatternsState([]);
        setJoinState({
            joinedKey: null,
            joinedSessionName: null,
            sessionEnded: false,
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
            const extUrl = chrome.runtime.getURL('pages/configure.html');
            const u = new URL(extUrl);
            u.searchParams.set('join', key);
            if (backend) u.searchParams.set('backend', backend);
            return u.toString();
        },
        [backend]
    );

    return {
        backend,
        healthy,
        sessions,
        status,
        error,
        namespaces,
        namespace,
        setNamespace,
        groupedFiltered,
        joinState,
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
        const others = current.sessions.filter((s) => s.id !== msg.session.id);
        const next = [...others, msg.session];
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
