import { Share2 } from 'lucide-react';
import { Badge, Button } from '@metalbear/ui';
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
                <Badge
                    variant={tag === 'joined' ? 'default' : 'secondary'}
                    className="text-[9px] uppercase tracking-wider shrink-0"
                >
                    {tag === 'joined' ? 'joined' : 'local session'}
                </Badge>
            )}
            <div className="flex items-center gap-1 shrink-0">
                {key && tag !== 'joined' && (
                    <Button
                        type="button"
                        size="sm"
                        className="h-6 text-xs px-2"
                        aria-label={`Join ${key}`}
                        onClick={() => onJoin(key)}
                    >
                        Join
                    </Button>
                )}
                {key && (
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        aria-label={`Share ${key}`}
                        onClick={() => onShare(key)}
                    >
                        <Share2 size={12} />
                    </Button>
                )}
            </div>
        </div>
    );
}
