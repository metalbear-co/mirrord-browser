import { Box, Key as KeyIcon, Share2 } from 'lucide-react';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardFooter,
    Separator,
} from '@metalbear/ui';
import type { OperatorSessionSummary } from '../types';
import { formatRelativeTime } from '../util';
import { STRINGS } from '../constants';
import { COLORS } from '../colors';
import { StatusDot } from './StatusDot';

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

type GroupAggregate = {
    targets: string[];
    owners: string[];
    namespaces: string[];
    earliestCreatedAt: string | null;
    isPreview: boolean;
};

const PREVIEW_OWNER_USERNAME = 'preview-env';

function aggregate(sessions: OperatorSessionSummary[]): GroupAggregate {
    const targets = new Set<string>();
    const owners = new Set<string>();
    const namespaces = new Set<string>();
    let earliest: string | null = null;
    let isPreview = false;

    for (const s of sessions) {
        const targetLabel = s.target
            ? `${s.target.kind}/${s.target.name}`
            : 'targetless';
        targets.add(targetLabel);
        if (s.owner?.username === PREVIEW_OWNER_USERNAME) {
            isPreview = true;
        } else if (s.owner?.username) {
            owners.add(s.owner.username);
        }
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
        isPreview,
    };
}

function GroupHeader({
    groupKey,
    joined,
    isPreview,
}: {
    groupKey: string;
    joined: boolean;
    isPreview: boolean;
}) {
    return (
        <div
            className="flex items-center gap-2 border-b border-border"
            style={{
                padding: '10px 14px',
                background: joined ? COLORS.primary.band : COLORS.muted.band,
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
            {isPreview && (
                <Badge
                    variant="outline"
                    className="shrink-0 font-mono"
                    style={{
                        fontSize: 9.5,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                    }}
                >
                    preview
                </Badge>
            )}
            {joined && (
                <Badge
                    variant="outline"
                    className="shrink-0 font-mono text-foreground border-foreground/30 bg-foreground/10"
                    style={{
                        gap: 5,
                        fontSize: 9.5,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                    }}
                >
                    <StatusDot tone="active" size={5} />
                    {STRINGS.MSG_JOINED_TAG}
                </Badge>
            )}
        </div>
    );
}

function TargetRow({ target }: { target: string }) {
    const slashIdx = target.indexOf('/');
    const name = slashIdx >= 0 ? target.slice(slashIdx + 1) : target;
    return (
        <div className="flex items-center gap-2 min-w-0">
            <Box
                className="shrink-0 text-muted-foreground"
                style={{ height: 13, width: 13 }}
            />
            <div
                className="min-w-0 font-mono font-bold"
                style={{
                    fontSize: 12,
                    lineHeight: 1.45,
                    color: COLORS.brand.lilac,
                    ...TRUNCATE_STYLE,
                }}
            >
                {name}
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

    if (agg.owners.length === 1) {
        parts.push(agg.owners[0]);
    } else if (agg.owners.length > 1) {
        parts.push(`${agg.owners.length} owners`);
    }

    if (agg.namespaces.length > 1) {
        parts.push(`${agg.namespaces.length} namespaces`);
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
                <StatusDot tone={joined ? 'active' : 'muted'} glow={joined} />
                {joined ? STRINGS.MSG_ROUTING_TRAFFIC : STRINGS.MSG_AVAILABLE}
            </div>
            <div className="flex items-center gap-1">
                {!joined && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
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
                          borderColor: COLORS.primary.border,
                          boxShadow: `0 0 0 1px ${COLORS.primary.tint}`,
                      }
                    : undefined
            }
        >
            <GroupHeader
                groupKey={groupKey}
                joined={joined}
                isPreview={agg.isPreview}
            />

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
