import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import groupBy from 'lodash.groupby';
import { Input } from '@metalbear/ui';
import { SessionKeyGroup } from './SessionKeyGroup';
import { ConnectedBanner } from './ConnectedBanner';
import { NamespaceFilter } from './NamespaceFilter';
import { StatusDot } from './StatusDot';
import { NotConfiguredPrompt } from './NotConfiguredPrompt';
import { OperatorUnavailableNote } from './OperatorUnavailableNote';
import type { JoinState } from '../hooks/useMirrordUi';
import type { OperatorSessionSummary, OperatorWatchStatus } from '../types';
import { STRINGS } from '../constants';

type Props = {
    sessions: OperatorSessionSummary[];
    sessionsLoaded: boolean;
    namespaces: string[];
    namespace: string;
    setNamespace: (ns: string) => void;
    joinState: JoinState;
    status: OperatorWatchStatus | null;
    onJoin: (key: string) => void;
    onClear: () => void;
    onShare: (key: string) => void;
    scopePatterns: string[];
    onAddScopePattern: (pattern: string) => void | Promise<void>;
    onRemoveScopePattern: (pattern: string) => void | Promise<void>;
};

function matchesQuery(s: OperatorSessionSummary, q: string): boolean {
    if (!q) return true;
    const haystack = [
        s.key,
        s.namespace,
        s.owner?.username,
        s.owner?.k8sUsername,
        s.target ? `${s.target.kind}/${s.target.name}` : '',
        s.target?.name,
        s.target?.container,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return haystack.includes(q);
}

export function SessionsView({
    sessions,
    sessionsLoaded,
    namespaces,
    namespace,
    setNamespace,
    joinState,
    status,
    onJoin,
    onClear,
    onShare,
    scopePatterns,
    onAddScopePattern,
    onRemoveScopePattern,
}: Props) {
    const [query, setQuery] = useState('');
    const [showAll, setShowAll] = useState(false);

    const normalizedQuery = query.trim().toLowerCase();
    const filtered = useMemo(() => {
        return sessions.filter(
            (s) =>
                (!namespace || s.namespace === namespace) &&
                matchesQuery(s, normalizedQuery)
        );
    }, [sessions, namespace, normalizedQuery]);

    if (!sessionsLoaded) {
        return <NotConfiguredPrompt />;
    }

    const joinedSession = joinState.joinedSessionName
        ? sessions.find((s) => s.id === joinState.joinedSessionName)
        : undefined;
    const joinedVanished = joinState.joinedKey !== null && !joinedSession;
    const effectiveSessionEnded = joinState.sessionEnded || joinedVanished;
    const groups = groupBy(filtered, (s) => s.key);

    const joinedKey = joinState.joinedKey;
    const otherKeys = Object.keys(groups)
        .filter((k) => k !== joinedKey)
        .sort((a, b) => a.localeCompare(b));
    const orderedKeys =
        joinedKey && groups[joinedKey] ? [joinedKey, ...otherKeys] : otherKeys;

    const hasNamespaces = namespaces.filter((ns) => ns !== '').length > 0;
    const watching = status?.status === 'watching';
    const operatorUnavailable = status?.status === 'unavailable';
    const hasGroups = orderedKeys.length > 0;
    const totalSessionsBeforeQuery = namespace
        ? sessions.filter((s) => s.namespace === namespace).length
        : sessions.length;
    const showSearch = totalSessionsBeforeQuery > 0;

    const VISIBLE_CAP = 5;
    const visibleKeys =
        showAll || normalizedQuery
            ? orderedKeys
            : orderedKeys.slice(0, VISIBLE_CAP);
    const hiddenCount = orderedKeys.length - visibleKeys.length;

    return (
        <div className="flex flex-col" style={{ gap: 10 }}>
            {joinState.joinedKey && (
                <ConnectedBanner
                    joinedKey={joinState.joinedKey}
                    session={joinedSession}
                    sessionEnded={effectiveSessionEnded}
                    onLeave={onClear}
                    scopePatterns={scopePatterns}
                    onAddScopePattern={onAddScopePattern}
                    onRemoveScopePattern={onRemoveScopePattern}
                />
            )}

            {operatorUnavailable && <OperatorUnavailableNote />}

            {showSearch && (
                <div className="flex items-center" style={{ gap: 8 }}>
                    <div
                        className="flex items-center"
                        style={{
                            flex: 1,
                            position: 'relative',
                        }}
                    >
                        <Search
                            className="text-muted-foreground"
                            style={{
                                position: 'absolute',
                                left: 10,
                                height: 13,
                                width: 13,
                                pointerEvents: 'none',
                            }}
                        />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={STRINGS.PLACEHOLDER_SEARCH_SESSIONS}
                            aria-label={STRINGS.LABEL_SEARCH_SESSIONS}
                            spellCheck={false}
                            autoComplete="off"
                            className="font-mono"
                            style={{
                                width: '100%',
                                height: 32,
                                paddingLeft: 30,
                                fontSize: 11,
                            }}
                        />
                    </div>
                    {hasNamespaces && (
                        <NamespaceFilter
                            namespaces={namespaces}
                            value={namespace}
                            onChange={setNamespace}
                        />
                    )}
                </div>
            )}

            {hasGroups && (
                <>
                    <div
                        className="flex items-center justify-between text-muted-foreground font-semibold"
                        style={{
                            padding: '0 2px',
                            fontSize: 10.5,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                        }}
                    >
                        <span>
                            {filtered.length} {STRINGS.MSG_LIVE_SESSIONS}
                        </span>
                        {status && (
                            <span
                                className="inline-flex items-center"
                                style={{ gap: 5 }}
                            >
                                {watching && (
                                    <StatusDot tone="active" size={5} />
                                )}
                                {status.status}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col" style={{ gap: 10 }}>
                        {visibleKeys.map((k) => (
                            <SessionKeyGroup
                                key={k}
                                groupKey={k}
                                sessions={groups[k] ?? []}
                                joined={k === joinedKey}
                                onJoin={onJoin}
                                onShare={onShare}
                            />
                        ))}
                    </div>

                    {(hiddenCount > 0 ||
                        (showAll && orderedKeys.length > VISIBLE_CAP)) &&
                        !normalizedQuery && (
                            <button
                                type="button"
                                onClick={() => setShowAll((v) => !v)}
                                className="text-muted-foreground hover:text-foreground"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '6px 2px',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {showAll
                                    ? STRINGS.MSG_SHOW_LESS
                                    : STRINGS.MSG_SHOW_MORE(hiddenCount)}
                            </button>
                        )}
                </>
            )}

            {!hasGroups && (
                <p
                    className="text-muted-foreground"
                    style={{
                        padding: '8px 2px',
                        fontSize: 11,
                        textAlign: 'center',
                        margin: 0,
                    }}
                >
                    {totalSessionsBeforeQuery > 0
                        ? STRINGS.MSG_NO_SESSIONS_MATCH_QUERY
                        : STRINGS.MSG_NO_ACTIVE_SESSIONS}
                </p>
            )}
        </div>
    );
}
