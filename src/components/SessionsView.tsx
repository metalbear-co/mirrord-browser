import SessionKeyGroup from './SessionKeyGroup';
import ConnectedBanner from './ConnectedBanner';
import NamespaceFilter from './NamespaceFilter';
import type { JoinState } from '../hooks/useMirrordUi';
import type { OperatorSessionSummary, OperatorWatchStatus } from '../types';

type Props = {
    sessions: OperatorSessionSummary[];
    namespaces: string[];
    namespace: string;
    setNamespace: (ns: string) => void;
    joinState: JoinState;
    status: OperatorWatchStatus | null;
    onJoin: (key: string) => void;
    onClear: () => void;
    onShare: (key: string) => void;
};

const COLOR_EMERALD = '#34D399';

export default function SessionsView({
    sessions,
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

    const filtered = namespace
        ? sessions.filter((s) => s.namespace === namespace)
        : sessions;

    const keyed = filtered.filter(
        (s): s is OperatorSessionSummary & { key: string } => !!s.key
    );

    const groups = new Map<string, OperatorSessionSummary[]>();
    for (const s of keyed) {
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
                    sessionEnded={joinState.sessionEnded}
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
                <span>Live sessions</span>
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
                                    backgroundColor: COLOR_EMERALD,
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
                    No sessions visible with current credentials.
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
