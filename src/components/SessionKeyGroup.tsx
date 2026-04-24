import { Box, Key as KeyIcon, Share2 } from 'lucide-react';
import {
    Button,
    Card,
    CardContent,
    CardFooter,
    Separator,
} from '@metalbear/ui';
import type { OperatorSessionSummary } from '../types';
import { formatRelativeTime } from '../util';
import { STRINGS } from '../constants';

type Props = {
    groupKey: string;
    sessions: OperatorSessionSummary[];
    joined: boolean;
    onJoin: (key: string) => void;
    onShare: (key: string) => void;
};

const MAX_TARGETS = 4;

const TRUNCATE_STYLE: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

const JOINED_BORDER = 'hsl(var(--primary) / 0.45)';
const JOINED_TINT = 'hsl(var(--primary) / 0.22)';
const JOINED_BAND = 'hsl(var(--primary) / 0.14)';
const MUTED_BAND = 'hsl(var(--foreground) / 0.035)';
const MUTED_DOT = 'hsl(var(--muted-foreground) / 0.55)';
const ACTIVE_DOT = 'hsl(var(--brand-green, 142 71% 45%))';
const ACTIVE_DOT_GLOW = 'hsl(var(--brand-green, 142 71% 45%) / 0.22)';

type GroupAggregate = {
    targets: string[];
    owners: string[];
    namespaces: string[];
    earliestCreatedAt: string | null;
};

function aggregate(sessions: OperatorSessionSummary[]): GroupAggregate {
    const targets = new Set<string>();
    const owners = new Set<string>();
    const namespaces = new Set<string>();
    let earliest: string | null = null;

    for (const s of sessions) {
        const targetLabel = s.target
            ? `${s.target.kind}/${s.target.name}`
            : `targetless (${s.namespace})`;
        targets.add(targetLabel);
        if (s.owner?.username) owners.add(s.owner.username);
        namespaces.add(s.namespace);
        if (s.createdAt && (!earliest || s.createdAt < earliest)) {
            earliest = s.createdAt;
        }
    }

    return {
        targets: Array.from(targets),
        owners: Array.from(owners),
        namespaces: Array.from(namespaces),
        earliestCreatedAt: earliest,
    };
}

function GroupHeader({
    groupKey,
    joined,
}: {
    groupKey: string;
    joined: boolean;
}) {
    return (
        <div
            className="flex items-center gap-2 border-b border-border"
            style={{
                padding: '10px 14px',
                background: joined ? JOINED_BAND : MUTED_BAND,
            }}
        >
            <KeyIcon
                className="shrink-0 text-muted-foreground"
                style={{ height: 13, width: 13 }}
            />
            <span
                className="min-w-0 font-mono text-foreground"
                style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: 500,
                    ...TRUNCATE_STYLE,
                }}
            >
                {groupKey}
            </span>
            {joined && <JoinedPill />}
        </div>
    );
}

function JoinedPill() {
    return (
        <span
            className="inline-flex items-center font-mono font-bold rounded-full shrink-0"
            style={{
                gap: 5,
                padding: '0 8px',
                height: 18,
                fontSize: 9.5,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                backgroundColor: JOINED_TINT,
                color: 'hsl(var(--brand-purple-medium))',
            }}
        >
            <span
                className="inline-block rounded-full"
                style={{
                    height: 5,
                    width: 5,
                    backgroundColor: ACTIVE_DOT,
                }}
            />
            {STRINGS.MSG_JOINED_TAG}
        </span>
    );
}

function TargetRow({ target }: { target: string }) {
    const slashIdx = target.indexOf('/');
    const hasSlash = slashIdx >= 0;
    const kind = hasSlash ? target.slice(0, slashIdx) : target;
    const name = hasSlash ? target.slice(slashIdx + 1) : '';
    return (
        <div className="flex items-center gap-2 min-w-0">
            <Box
                className="shrink-0 text-muted-foreground"
                style={{ height: 13, width: 13 }}
            />
            <div
                className="min-w-0 font-mono"
                style={{ fontSize: 12, lineHeight: 1.45, ...TRUNCATE_STYLE }}
            >
                <span className="text-muted-foreground">
                    {kind}
                    {hasSlash ? '/ ' : ''}
                </span>
                {hasSlash && (
                    <span
                        className="font-bold"
                        style={{ color: 'hsl(var(--brand-purple-medium))' }}
                    >
                        {name}
                    </span>
                )}
            </div>
        </div>
    );
}

function GroupMeta({
    agg,
    sessionCount,
}: {
    agg: GroupAggregate;
    sessionCount: number;
}) {
    const age = formatRelativeTime(agg.earliestCreatedAt);
    const parts: string[] = [];

    if (agg.namespaces.length === 1) {
        parts.push(agg.namespaces[0]);
    } else {
        parts.push(`${agg.namespaces.length} namespaces`);
    }

    if (agg.owners.length === 1) {
        parts.push(agg.owners[0]);
    } else if (agg.owners.length > 1) {
        parts.push(`${agg.owners.length} owners`);
    }

    if (sessionCount > 1) parts.push(`${sessionCount} sessions`);
    if (age) parts.push(age);

    if (parts.length === 0) return null;

    return (
        <div
            className="text-muted-foreground"
            style={{ marginTop: 8, fontSize: 11, ...TRUNCATE_STYLE }}
        >
            {parts.join(' · ')}
        </div>
    );
}

function GroupFooter({
    groupKey,
    joined,
    onJoin,
    onShare,
}: {
    groupKey: string;
    joined: boolean;
    onJoin: (key: string) => void;
    onShare: (key: string) => void;
}) {
    return (
        <CardFooter
            className="flex items-center justify-between gap-2"
            style={{ padding: '6px 14px' }}
        >
            <div
                className="inline-flex items-center text-muted-foreground"
                style={{ gap: 6, fontSize: 11 }}
            >
                <span
                    className="inline-block shrink-0 rounded-full"
                    style={{
                        height: 8,
                        width: 8,
                        backgroundColor: joined ? ACTIVE_DOT : MUTED_DOT,
                        boxShadow: joined
                            ? `0 0 0 3px ${ACTIVE_DOT_GLOW}`
                            : undefined,
                    }}
                />
                {joined ? STRINGS.MSG_ROUTING_TRAFFIC : STRINGS.MSG_AVAILABLE}
            </div>
            <div className="flex items-center gap-1">
                {!joined && (
                    <Button
                        type="button"
                        size="sm"
                        aria-label={`${STRINGS.BTN_JOIN} ${groupKey}`}
                        onClick={() => onJoin(groupKey)}
                        style={{ height: 28, padding: '0 12px' }}
                    >
                        {STRINGS.BTN_JOIN}
                    </Button>
                )}
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Copy join link for ${groupKey}`}
                    title="Copy join link"
                    onClick={() => onShare(groupKey)}
                    style={{ height: 28, width: 28 }}
                >
                    <Share2 style={{ height: 14, width: 14 }} />
                </Button>
            </div>
        </CardFooter>
    );
}

export function SessionKeyGroup({
    groupKey,
    sessions,
    joined,
    onJoin,
    onShare,
}: Props) {
    const agg = aggregate(sessions);
    const shownTargets = agg.targets.slice(0, MAX_TARGETS);
    const overflow = agg.targets.length - shownTargets.length;

    return (
        <Card
            className="overflow-hidden"
            style={
                joined
                    ? {
                          borderColor: JOINED_BORDER,
                          boxShadow: `0 0 0 1px ${JOINED_TINT}`,
                      }
                    : undefined
            }
        >
            <GroupHeader groupKey={groupKey} joined={joined} />

            <CardContent style={{ padding: '10px 14px 8px' }}>
                <div className="flex flex-col" style={{ gap: 4 }}>
                    {shownTargets.map((t) => (
                        <TargetRow key={t} target={t} />
                    ))}
                    {overflow > 0 && (
                        <div
                            className="text-muted-foreground"
                            style={{ paddingLeft: 21, fontSize: 11 }}
                        >
                            + {overflow} more target
                            {overflow === 1 ? '' : 's'}
                        </div>
                    )}
                </div>

                <GroupMeta agg={agg} sessionCount={sessions.length} />
            </CardContent>

            <Separator />

            <GroupFooter
                groupKey={groupKey}
                joined={joined}
                onJoin={onJoin}
                onShare={onShare}
            />
        </Card>
    );
}
