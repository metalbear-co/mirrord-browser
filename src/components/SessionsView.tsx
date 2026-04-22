import { Card, CardContent } from '@metalbear/ui';
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
        ? sessions.find((s) => s.name === joinState.joinedSessionName)
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

    return (
        <div className="flex flex-col gap-2">
            {joinState.joinedKey && (
                <ConnectedBanner
                    joinedKey={joinState.joinedKey}
                    session={joinedSession}
                    sessionEnded={joinState.sessionEnded}
                    onLeave={onClear}
                />
            )}

            <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                    Live sessions
                </span>
                {status && (
                    <span className="text-[10px] text-muted-foreground">
                        {status.status}
                    </span>
                )}
            </div>

            <Card className="p-0 overflow-hidden">
                <CardContent className="p-0">
                    <NamespaceFilter
                        namespaces={namespaces}
                        value={namespace}
                        onChange={setNamespace}
                    />
                </CardContent>
            </Card>

            {orderedKeys.length === 0 ? (
                <Card className="p-0">
                    <CardContent className="px-3 py-4">
                        <p className="text-xs text-muted-foreground">
                            No sessions visible with current credentials.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="flex flex-col gap-2">
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
