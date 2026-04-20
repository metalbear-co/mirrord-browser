import type { OperatorSessionSummary } from '../types';
import { formatRelativeTime } from '../util';

type Props = {
    joinedKey: string;
    session: OperatorSessionSummary | undefined;
    sessionEnded: boolean;
    onLeave: () => void;
};

export default function ConnectedBanner({
    joinedKey,
    session,
    sessionEnded,
    onLeave,
}: Props) {
    const targetLabel = session?.target
        ? `${session.target.kind}/${session.target.name}`
        : '—';
    const age = session ? formatRelativeTime(session.createdAt) : '';

    return (
        <div
            className={`px-3 py-2 rounded-md border ${
                sessionEnded
                    ? 'bg-destructive/10 border-destructive/40'
                    : 'bg-primary/10 border-primary/30'
            }`}
        >
            <div className="flex items-center justify-between gap-2">
                <span
                    className={`text-[10px] uppercase tracking-wider font-semibold ${
                        sessionEnded
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                    }`}
                >
                    Currently connected
                </span>
                <button
                    type="button"
                    className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80"
                    onClick={onLeave}
                >
                    {sessionEnded ? 'Dismiss' : 'Leave'}
                </button>
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
                <div className="flex flex-col min-w-0">
                    <span className="font-mono text-xs font-semibold truncate">
                        {targetLabel}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                        {joinedKey}
                    </span>
                </div>
                <span
                    className={`text-[10px] shrink-0 ${
                        sessionEnded
                            ? 'text-destructive font-semibold'
                            : 'text-muted-foreground'
                    }`}
                >
                    {sessionEnded
                        ? 'Session ended'
                        : age
                          ? `Session live · ${age}`
                          : 'Session live'}
                </span>
            </div>
        </div>
    );
}
