import type { OperatorSessionSummary } from '../types';

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
        <div className="border-b last:border-b-0 border-border px-3 py-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold">
                        {displayKey}
                    </span>
                    {isJoined && (
                        <span className="text-[10px] text-primary font-semibold">
                            joined
                        </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                        {sessions.length} session
                        {sessions.length === 1 ? '' : 's'}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {groupKey !== '' && (
                        <>
                            <button
                                type="button"
                                className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80"
                                aria-label={`Join ${groupKey}`}
                                onClick={() => onJoin(groupKey)}
                            >
                                {isJoined ? 'Rejoin' : 'Join'}
                            </button>
                            <button
                                type="button"
                                className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80"
                                aria-label={`Share ${groupKey}`}
                                onClick={() => onShare(groupKey)}
                            >
                                Share
                            </button>
                        </>
                    )}
                </div>
            </div>
            <ul className="mt-1 flex flex-col gap-0.5">
                {sessions.map((sess) => (
                    <li
                        key={sess.name}
                        className="text-[11px] text-muted-foreground"
                    >
                        <span className="font-mono">{sess.namespace}</span>
                        {sess.target && (
                            <>
                                {' / '}
                                <span className="font-mono">
                                    {sess.target.kind}/{sess.target.name}
                                </span>
                            </>
                        )}
                        {sess.owner && (
                            <>
                                {' · '}
                                <span>{sess.owner.username}</span>
                            </>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
