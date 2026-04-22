import { Share2 } from 'lucide-react';
import { Badge, Button } from '@metalbear/ui';
import type { OperatorSessionSummary } from '../types';
import { formatRelativeTime } from '../util';

type Props = {
    groupKey: string;
    sessions: OperatorSessionSummary[];
    joined: boolean;
    onJoin: (key: string) => void;
    onShare: (key: string) => void;
};

export default function SessionKeyGroup({
    groupKey,
    sessions,
    joined,
    onJoin,
    onShare,
}: Props) {
    const targets = sessions
        .map((s) =>
            s.target
                ? `${s.target.kind}/${s.target.name}`
                : `targetless (${s.namespace})`
        )
        .filter((v, i, a) => a.indexOf(v) === i);

    const owners = sessions
        .map((s) => s.owner?.username)
        .filter((v, i, a): v is string => !!v && a.indexOf(v) === i);

    const namespaces = sessions
        .map((s) => s.namespace)
        .filter((v, i, a) => a.indexOf(v) === i);

    const createdAt = sessions
        .map((s) => s.createdAt)
        .filter((v): v is string => !!v)
        .sort()[0];
    const age = formatRelativeTime(createdAt);

    return (
        <div className="flex items-start gap-2 px-3 py-2 border-b last:border-b-0 border-border">
            <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                <span className="font-mono text-xs font-semibold truncate">
                    {groupKey}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                    {targets.join(', ')}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                    {namespaces.join(', ')}
                    {owners.length > 0 && ` · ${owners.join(', ')}`}
                    {sessions.length > 1 && ` · ${sessions.length} sessions`}
                    {age && ` · ${age}`}
                </span>
            </div>
            {joined && (
                <Badge
                    variant="default"
                    className="text-[9px] uppercase tracking-wider shrink-0"
                >
                    joined
                </Badge>
            )}
            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                {!joined && (
                    <Button
                        type="button"
                        size="sm"
                        className="h-6 text-xs px-2"
                        aria-label={`Join ${groupKey}`}
                        onClick={() => onJoin(groupKey)}
                    >
                        Join
                    </Button>
                )}
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    aria-label={`Share ${groupKey}`}
                    onClick={() => onShare(groupKey)}
                >
                    <Share2 size={12} />
                </Button>
            </div>
        </div>
    );
}
