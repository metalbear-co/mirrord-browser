import { Share2 } from 'lucide-react';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Separator,
} from '@metalbear/ui';
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

    const metaLine = [
        namespaces.join(', '),
        owners.length ? owners.join(', ') : null,
        sessions.length > 1 ? `${sessions.length} sessions` : null,
        age || null,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <Card className="p-0 overflow-hidden">
            <CardHeader className="px-3 py-2.5 flex flex-row items-start justify-between gap-2 space-y-0">
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Key
                    </span>
                    <div className="flex items-center gap-2 min-w-0">
                        <CardTitle className="text-sm font-mono font-semibold truncate">
                            {groupKey}
                        </CardTitle>
                        {joined && (
                            <Badge
                                variant="default"
                                className="h-4 px-1.5 py-0 text-[9px] uppercase tracking-wider font-medium"
                            >
                                joined
                            </Badge>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {!joined && (
                        <Button
                            type="button"
                            size="sm"
                            className="h-7 text-xs px-3"
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
                        className="h-7 w-7"
                        aria-label={`Share ${groupKey}`}
                        onClick={() => onShare(groupKey)}
                    >
                        <Share2 size={14} />
                    </Button>
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-3 py-2 flex flex-col gap-1">
                <div className="flex flex-col gap-0.5">
                    {targets.map((t) => (
                        <span
                            key={t}
                            className="font-mono text-xs text-foreground/90 truncate"
                        >
                            {t}
                        </span>
                    ))}
                </div>
                {metaLine && (
                    <span className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {metaLine}
                    </span>
                )}
            </CardContent>
        </Card>
    );
}
