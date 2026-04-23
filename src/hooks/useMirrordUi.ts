import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STORAGE_KEYS } from '../types';
import type {
    OperatorSessionSummary,
    OperatorSessionsResponse,
    OperatorWatchStatus,
    SessionNotification,
} from '../types';
import {
    fetchOperatorSessions,
    buildWsUrl,
    pingHealth,
} from '../mirrordUiClient';
import {
    storageGet,
    storageSet,
    storageRemove,
    getDynamicRules,
    updateDynamicRules,
    deriveInjectionHint,
    buildDnrRule,
} from '../util';

const BAGGAGE_HEADER_NAME = 'baggage';
const BAGGAGE_VALUE_PREFIX = 'mirrord-session=';

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

    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const stored = await storageGet([
                STORAGE_KEYS.MIRRORD_UI_BACKEND,
                STORAGE_KEYS.MIRRORD_UI_TOKEN,
                STORAGE_KEYS.JOINED_KEY,
                STORAGE_KEYS.JOINED_SESSION_NAME,
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
        })();
        return () => {
            cancelled = true;
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
            try {
                const msg = JSON.parse(ev.data) as SessionNotification;
                setSessions((current) => {
                    if (!current) return current;
                    return applyNotification(current, msg);
                });
                if (msg.type === 'operator_session_removed') {
                    setJoinState((js) =>
                        js.joinedSessionName === msg.name
                            ? { ...js, sessionEnded: true }
                            : js
                    );
                }
            } catch {}
        };
        ws.onerror = () => setError('websocket error');
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
        const out: Record<string, OperatorSessionSummary[]> = {};
        for (const s of sessions.sessions) {
            if (namespace && s.namespace !== namespace) continue;
            const k = s.key ?? '';
            (out[k] ??= []).push(s);
        }
        return out;
    }, [sessions, namespace]);

    const join = useCallback(
        async (key: string) => {
            const target = sessions?.sessions.find((s) => s.key === key);
            if (!target) {
                setError(`Key "${key}" not visible in current session list`);
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
                addRules: buildDnrRule(header, value),
            });
            await storageSet({
                [STORAGE_KEYS.JOINED_KEY]: key,
                [STORAGE_KEYS.JOINED_SESSION_NAME]: target.name,
            });
            setJoinState({
                joinedKey: key,
                joinedSessionName: target.name,
                sessionEnded: false,
            });
        },
        [sessions]
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
        ]);
        setJoinState({
            joinedKey: null,
            joinedSessionName: null,
            sessionEnded: false,
        });
    }, []);

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
    };
}

function applyNotification(
    current: OperatorSessionsResponse,
    msg: SessionNotification
): OperatorSessionsResponse {
    if (
        msg.type === 'operator_session_added' ||
        msg.type === 'operator_session_updated'
    ) {
        const others = current.sessions.filter(
            (s) => s.name !== msg.session.name
        );
        const next = [...others, msg.session];
        return rebuild(next, current.watch_status);
    }
    if (msg.type === 'operator_session_removed') {
        const next = current.sessions.filter((s) => s.name !== msg.name);
        return rebuild(next, current.watch_status);
    }
    return current;
}

function rebuild(
    sessions: OperatorSessionSummary[],
    watch_status: OperatorWatchStatus
): OperatorSessionsResponse {
    const by_key: Record<string, OperatorSessionSummary[]> = {};
    for (const s of sessions) {
        const k = s.key ?? '';
        (by_key[k] ??= []).push(s);
    }
    return { sessions, by_key, watch_status };
}
