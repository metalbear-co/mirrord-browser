import { Card, CardContent } from '@metalbear/ui';
import SessionRow from './SessionRow';
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

    const ordered = [...filtered].sort((a, b) => {
        const aJoined = a.name === joinState.joinedSessionName ? 0 : 1;
        const bJoined = b.name === joinState.joinedSessionName ? 0 : 1;
        if (aJoined !== bJoined) return aJoined - bJoined;
        return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
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

            <Card className="overflow-hidden p-0">
                <div className="px-3 py-2 bg-card/50 border-b border-border flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">
                        Live sessions
                    </span>
                    {status && (
                        <span className="text-[10px] text-muted-foreground">
                            {status.status}
                        </span>
                    )}
                </div>
                <NamespaceFilter
                    namespaces={namespaces}
                    value={namespace}
                    onChange={setNamespace}
                />
                <CardContent className="p-0">
                    {ordered.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-3 py-4">
                            No sessions visible with current credentials.
                        </p>
                    ) : (
                        ordered.map((sess) => {
                            const tag =
                                sess.name === joinState.joinedSessionName
                                    ? 'joined'
                                    : null;
                            return (
                                <SessionRow
                                    key={sess.name}
                                    session={sess}
                                    tag={tag}
                                    onJoin={onJoin}
                                    onShare={onShare}
                                />
                            );
                        })
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
