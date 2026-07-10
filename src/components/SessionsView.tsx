import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import groupBy from 'lodash.groupby';
import { Input } from '@metalbear/ui';
import { SessionKeyGroup } from './SessionKeyGroup';
import { ConnectedBanner } from './ConnectedBanner';
import { NamespaceFilter } from './NamespaceFilter';
import { ContextFilter } from './ContextFilter';
import { StatusDot } from './StatusDot';
import { NotConfiguredPrompt } from './NotConfiguredPrompt';
import { MirrordUiDetectedPrompt } from './MirrordUiDetectedPrompt';
import { MirrordUiAuthError } from './MirrordUiAuthError';
import { OperatorUnavailableNote } from './OperatorUnavailableNote';
import type { JoinState } from '../hooks/useMirrordUi';
import { useJoinLiveness } from '../hooks/useJoinLiveness';
import type {
    KubeContext,
    OperatorSessionSummary,
    OperatorWatchStatus,
} from '../types';
import { JOIN_GRACE_MS, STRINGS } from '../constants';

interface Props {
    sessions: OperatorSessionSummary[];
    sessionsLoaded: boolean;
    authFailed: boolean;
    uiDetectedNoToken: boolean;
    backend: string | null;
    namespaces: string[];
    namespace: string;
    setNamespace: (ns: string) => void;
    contexts: KubeContext[];
    currentContext: string | null;
    selectedContext: string | null;
    onSelectContext: (context: string) => void;
    joinState: JoinState;
    status: OperatorWatchStatus | null;
    onJoin: (key: string) => void;
    onClear: () => void;
    onShare: (key: string) => void;
    scopePatterns: string[];
    onAddScopePattern: (pattern: string) => void | Promise<void>;
    onRemoveScopePattern: (pattern: string) => void | Promise<void>;
    joinedHeader: string | null;
    joinedValue: string | null;
}

function matchesQuery(s: OperatorSessionSummary, q: string): boolean {
    if (!q) return true;
    const haystack = [
        s.key,
        s.namespace,
        s.owner.username,
        s.owner.k8sUsername,
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
    authFailed,
    uiDetectedNoToken,
    backend,
    namespaces,
    namespace,
    setNamespace,
    contexts,
    currentContext,
    selectedContext,
    onSelectContext,
    joinState,
    status,
    onJoin,
    onClear,
    onShare,
    scopePatterns,
    onAddScopePattern,
    onRemoveScopePattern,
    joinedHeader,
    joinedValue,
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

    // Liveness is keyed on the session *key*, not the joined session's id: a local
    // stop → start swaps the id but keeps the key, so this rides through reconnects.
    const joinedKey = joinState.joinedKey;
    const joinedLive =
        joinedKey !== null && sessions.some((s) => s.key === joinedKey);
    const liveness = useJoinLiveness(
        joinedKey !== null,
        joinedLive,
        JOIN_GRACE_MS
    );

    if (authFailed) {
        return <MirrordUiAuthError backend={backend} />;
    }

    if (!sessionsLoaded) {
        return uiDetectedNoToken ? (
            <MirrordUiDetectedPrompt />
        ) : (
            <NotConfiguredPrompt />
        );
    }

    const groups = groupBy(filtered, (s) => s.key);

    // The joined session is represented by the ConnectedBanner above, so drop its
    // card from the list to avoid showing the same session twice.
    const orderedKeys = Object.keys(groups)
        .filter((k) => k !== joinedKey)
        .sort((a, b) => a.localeCompare(b));
    // Source the joined group from the full session list (not `filtered`) so the
    // banner's meta survives search/namespace filtering.
    const joinedSessions = joinedKey
        ? sessions.filter((s) => s.key === joinedKey)
        : [];

    const watching = status?.status === 'watching';
    const operatorUnavailable = status?.status === 'unavailable';
    const hasGroups = orderedKeys.length > 0;
    const totalSessionsBeforeQuery = sessions.filter(
        (s) => (!namespace || s.namespace === namespace) && s.key !== joinedKey
    ).length;
    const showSearch = totalSessionsBeforeQuery > 0;

    const VISIBLE_CAP = 5;
    const visibleKeys =
        showAll || normalizedQuery
            ? orderedKeys
            : orderedKeys.slice(0, VISIBLE_CAP);
    const hiddenCount = orderedKeys.length - visibleKeys.length;

    return (
        <div className="flex flex-col" style={{ gap: 10 }}>
            {joinedKey && (
                <ConnectedBanner
                    joinedKey={joinedKey}
                    sessions={joinedSessions}
                    liveness={liveness}
                    onLeave={onClear}
                    onShare={() => onShare(joinedKey)}
                    scopePatterns={scopePatterns}
                    onAddScopePattern={onAddScopePattern}
                    onRemoveScopePattern={onRemoveScopePattern}
                    joinedHeader={joinedHeader}
                    joinedValue={joinedValue}
                />
            )}

            {operatorUnavailable && <OperatorUnavailableNote />}

            {(contexts.length > 1 ||
                namespaces.filter((ns) => ns !== '').length > 1) && (
                <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                    <ContextFilter
                        contexts={contexts}
                        currentContext={currentContext}
                        value={selectedContext}
                        onChange={onSelectContext}
                    />
                    <NamespaceFilter
                        namespaces={namespaces}
                        value={namespace}
                        onChange={setNamespace}
                    />
                </div>
            )}

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
                </div>
            )}

            {hasGroups && (
                <>
                    <div
                        className="flex items-center justify-between text-muted-foreground font-semibold"
                        style={{
                            padding: '0 2px',
                            fontSize: 10.5,
                            letterSpacing: 'normal',
                            textTransform: 'none',
                        }}
                    >
                        <span>
                            {orderedKeys.length} {STRINGS.MSG_LIVE_SESSIONS}
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
