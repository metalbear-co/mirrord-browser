import { SessionKeyGroup } from './SessionKeyGroup';
import { ConnectedBanner } from './ConnectedBanner';
import { NamespaceFilter } from './NamespaceFilter';
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

const WATCHING_DOT = 'hsl(var(--brand-green, 142 71% 45%))';

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
    const joinedSession = joinState.joinedSessionName
        ? sessions.find((s) => s.id === joinState.joinedSessionName)
        : undefined;

    const joinedVanished =
        sessionsLoaded && joinState.joinedKey !== null && !joinedSession;
    const effectiveSessionEnded = joinState.sessionEnded || joinedVanished;

    const filtered = namespace
        ? sessions.filter((s) => s.namespace === namespace)
        : sessions;

    const groups = new Map<string, OperatorSessionSummary[]>();
    for (const s of filtered) {
        const arr = groups.get(s.key) ?? [];
        arr.push(s);
        groups.set(s.key, arr);
    }

    const orderedKeys = Array.from(groups.keys()).sort((a, b) => {
        const aJoined = a === joinState.joinedKey ? 0 : 1;
        const bJoined = b === joinState.joinedKey ? 0 : 1;
        if (aJoined !== bJoined) return aJoined - bJoined;
        return a.localeCompare(b);
    });

    const showNamespaceFilter = namespaces.filter((ns) => ns !== '').length > 1;
    const watching = status?.status === 'watching';

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
                            <span
                                className="inline-block rounded-full"
                                style={{
                                    height: 5,
                                    width: 5,
                                    backgroundColor: WATCHING_DOT,
                                }}
                            />
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

            {orderedKeys.length === 0 ? (
                <div
                    className="text-muted-foreground"
                    style={{
                        padding: '16px 12px',
                        fontSize: 11,
                        textAlign: 'center',
                    }}
                >
                    {STRINGS.MSG_NO_SESSIONS_VISIBLE}
                </div>
            ) : (
                <div className="flex flex-col" style={{ gap: 10 }}>
                    {orderedKeys.map((k) => (
                        <SessionKeyGroup
                            key={k}
                            groupKey={k}
                            sessions={groups.get(k) ?? []}
                            joined={k === joinState.joinedKey}
                            onJoin={onJoin}
                            onShare={onShare}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
