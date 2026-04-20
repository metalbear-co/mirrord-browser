import { Share2 } from 'lucide-react';
import type { OperatorSessionSummary } from '../types';
import { formatRelativeTime } from '../util';

type Tag = 'joined' | 'local' | null;

type Props = {
    session: OperatorSessionSummary;
    tag: Tag;
    onJoin: (key: string) => void;
    onShare: (key: string) => void;
};

export default function SessionRow({ session, tag, onJoin, onShare }: Props) {
    const key = session.key;
    const age = formatRelativeTime(session.createdAt);
    const targetLabel = session.target
        ? `${session.target.kind}/${session.target.name}`
        : session.namespace;

    return (
        <div className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 border-border">
            <div className="flex flex-col min-w-0 flex-1">
                <span className="font-mono text-xs font-medium truncate">
                    {targetLabel}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                    {key ?? '(no key)'} · {session.namespace}
                    {session.owner && ` · ${session.owner.username}`}
                    {age && ` · ${age}`}
                </span>
            </div>
            {tag && (
                <span
                    className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold shrink-0 ${
                        tag === 'joined'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                    }`}
                >
                    {tag === 'joined' ? 'my own session' : 'local session'}
                </span>
            )}
            <div className="flex items-center gap-1 shrink-0">
                {key && tag !== 'joined' && (
                    <button
                        type="button"
                        className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground hover:opacity-90"
                        aria-label={`Join ${key}`}
                        onClick={() => onJoin(key)}
                    >
                        Join
                    </button>
                )}
                {key && (
                    <button
                        type="button"
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                        aria-label={`Share ${key}`}
                        onClick={() => onShare(key)}
                    >
                        <Share2 size={12} />
                    </button>
                )}
            </div>
        </div>
    );
}
