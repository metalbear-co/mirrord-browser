import groupBy from 'lodash.groupby';
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
};

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
}: Props) {
    if (!sessionsLoaded) {
        return <NotConfiguredPrompt />;
    }

    const joinedSession = joinState.joinedSessionName
        ? sessions.find((s) => s.id === joinState.joinedSessionName)
        : undefined;
    const joinedVanished = joinState.joinedKey !== null && !joinedSession;
    const effectiveSessionEnded = joinState.sessionEnded || joinedVanished;

    const filtered = namespace
        ? sessions.filter((s) => s.namespace === namespace)
        : sessions;
    const groups = groupBy(filtered, (s) => s.key);

    const joinedKey = joinState.joinedKey;
    const otherKeys = Object.keys(groups)
        .filter((k) => k !== joinedKey)
        .sort((a, b) => a.localeCompare(b));
    const orderedKeys =
        joinedKey && groups[joinedKey] ? [joinedKey, ...otherKeys] : otherKeys;

    const showNamespaceFilter = namespaces.filter((ns) => ns !== '').length > 1;
    const watching = status?.status === 'watching';
    const operatorUnavailable = status?.status === 'unavailable';
    const hasGroups = orderedKeys.length > 0;

    return (
        <div className="flex flex-col" style={{ gap: 10 }}>
            {joinState.joinedKey && (
                <ConnectedBanner
                    joinedKey={joinState.joinedKey}
                    session={joinedSession}
                    sessionEnded={effectiveSessionEnded}
                    onLeave={onClear}
                />
            )}

            {operatorUnavailable && <OperatorUnavailableNote />}

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
                        <span>{STRINGS.MSG_LIVE_SESSIONS}</span>
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

                    {showNamespaceFilter && (
                        <NamespaceFilter
                            namespaces={namespaces}
                            value={namespace}
                            onChange={setNamespace}
                        />
                    )}

                    <div className="flex flex-col" style={{ gap: 10 }}>
                        {orderedKeys.map((k) => (
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
                    {STRINGS.MSG_NO_ACTIVE_SESSIONS}
                </p>
            )}
        </div>
    );
}
