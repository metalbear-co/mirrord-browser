import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STORAGE_KEYS } from '../types';
import type {
    OperatorSessionSummary,
    OperatorSessionsResponse,
    OperatorWatchStatus,
    SessionNotification,
} from '../types';
import { SESSION_NOTIFICATION_TYPE, STRINGS } from '../constants';
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

const WATCHED_STORAGE_KEYS: readonly string[] = [
    STORAGE_KEYS.JOINED_KEY,
    STORAGE_KEYS.JOINED_SESSION_NAME,
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
    const by_key: Record<string, OperatorSessionSummary[]> = {};
    for (const s of sessions) {
        const bucket = by_key[s.key];
        if (bucket) {
            bucket.push(s);
        } else {
            by_key[s.key] = [s];
        }
    }
    return by_key;
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

    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        let cancelled = false;
        const loadFromStorage = async () => {
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
                addRules: buildDnrRule(header, value),
            });
            await storageSet({
                [STORAGE_KEYS.JOINED_KEY]: key,
                [STORAGE_KEYS.JOINED_SESSION_NAME]: target.id,
            });
            setJoinState({
                joinedKey: key,
                joinedSessionName: target.id,
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
