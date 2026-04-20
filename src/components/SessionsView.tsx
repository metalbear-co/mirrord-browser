import { Card, CardContent, CardHeader, Separator } from '@metalbear/ui';
import NamespaceFilter from './NamespaceFilter';
import SessionGroup from './SessionGroup';
import SessionEndedBanner from './SessionEndedBanner';
import type { JoinState } from '../hooks/useMirrordUi';
import type { OperatorSessionSummary, OperatorWatchStatus } from '../types';

type Props = {
    grouped: Record<string, OperatorSessionSummary[]>;
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
    grouped,
    namespaces,
    namespace,
    setNamespace,
    joinState,
    status,
    onJoin,
    onClear,
    onShare,
}: Props) {
    const entries = Object.entries(grouped).sort(([a], [b]) =>
        a.localeCompare(b)
    );

    return (
        <Card className="overflow-hidden p-0">
            <CardHeader className="px-3 py-2 bg-card/50 border-b border-border">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">
                        Sessions
                    </span>
                    {status && (
                        <span className="text-[10px] text-muted-foreground">
                            {status.status}
                        </span>
                    )}
                </div>
            </CardHeader>
            {joinState.sessionEnded && joinState.joinedKey && (
                <SessionEndedBanner
                    joinedKey={joinState.joinedKey}
                    onAcknowledge={onClear}
                />
            )}
            {joinState.joinedKey && !joinState.sessionEnded && (
                <div className="px-3 py-2 bg-primary/5 border-b border-primary/20 flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Injecting header
                        </span>
                        <code
                            className="text-xs font-mono"
                            style={{ color: 'hsl(var(--brand-yellow))' }}
                        >
                            baggage: mirrord-session={joinState.joinedKey}
                        </code>
                    </div>
                    <button
                        type="button"
                        className="text-xs px-2 py-1 rounded bg-destructive/20 text-destructive hover:bg-destructive/30 shrink-0"
                        onClick={onClear}
                        aria-label="Leave joined session"
                    >
                        Leave
                    </button>
                </div>
            )}
            <NamespaceFilter
                namespaces={namespaces}
                value={namespace}
                onChange={setNamespace}
            />
            <Separator />
            <CardContent className="p-0">
                {entries.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-4">
                        No sessions visible with current credentials.
                    </p>
                ) : (
                    entries.map(([groupKey, sessions]) => (
                        <SessionGroup
                            key={groupKey || '__ungrouped'}
                            groupKey={groupKey}
                            sessions={sessions}
                            joinedKey={joinState.joinedKey}
                            onJoin={onJoin}
                            onShare={onShare}
                            onLeave={onClear}
                        />
                    ))
                )}
            </CardContent>
        </Card>
    );
}
