import type { OperatorSessionSummary } from '../types';
import { formatRelativeTime } from '../util';

type Props = {
    groupKey: string;
    sessions: OperatorSessionSummary[];
    joinedKey: string | null;
    onJoin: (key: string) => void;
    onShare: (key: string) => void;
};

export default function SessionGroup({
    groupKey,
    sessions,
    joinedKey,
    onJoin,
    onShare,
}: Props) {
    const displayKey = groupKey === '' ? '(ungrouped)' : groupKey;
    const isJoined =
        joinedKey !== null && groupKey !== '' && groupKey === joinedKey;

    return (
        <div
            className={`border-b last:border-b-0 border-border px-3 py-2 ${
                isJoined ? 'bg-primary/10 border-l-2 border-l-primary' : ''
            }`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-semibold truncate">
                        {displayKey}
                    </span>
                    {isJoined && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-semibold uppercase tracking-wider shrink-0">
                            joined
                        </span>
                    )}
                    <span className="text-[10px] text-muted-foreground shrink-0">
                        {sessions.length} session
                        {sessions.length === 1 ? '' : 's'}
                    </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {groupKey !== '' && !isJoined && (
                        <button
                            type="button"
                            className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80"
                            aria-label={`Join ${groupKey}`}
                            onClick={() => onJoin(groupKey)}
                        >
                            Join
                        </button>
                    )}
                    {groupKey !== '' && (
                        <button
                            type="button"
                            className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80"
                            aria-label={`Share ${groupKey}`}
                            onClick={() => onShare(groupKey)}
                        >
                            Share
                        </button>
                    )}
                </div>
            </div>
            <ul className="mt-1 flex flex-col gap-0.5">
                {sessions.map((sess) => {
                    const age = formatRelativeTime(sess.createdAt);
                    return (
                        <li
                            key={sess.name}
                            className="text-[11px] text-muted-foreground flex items-center gap-1"
                        >
                            <span className="font-mono truncate">
                                {sess.namespace}
                                {sess.target && (
                                    <>
                                        {' / '}
                                        {sess.target.kind}/{sess.target.name}
                                    </>
                                )}
                            </span>
                            {sess.owner && (
                                <span className="shrink-0">
                                    · {sess.owner.username}
                                </span>
                            )}
                            {age && (
                                <span className="shrink-0 ml-auto pl-2 text-[10px] text-muted-foreground/80">
                                    {age}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
