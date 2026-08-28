import { Box, Key as KeyIcon, Share2 } from 'lucide-react';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardFooter,
    Separator,
} from '@metalbear/ui';
import type { ClusterSession, PreviewSession } from '../types';
import {
    aggregateSessions,
    formatRelativeTime,
    previewPhaseLabel,
    previewPhaseTone,
    previewStatusLine,
    targetDisplayName,
    type PreviewTone,
    type SessionGroupAggregate,
} from '../util';
import { STRINGS } from '../constants';
import { COLORS } from '../colors';
import { StatusDot } from './StatusDot';

interface Props {
    groupKey: string;
    sessions: ClusterSession[];
    joined: boolean;
    onJoin: (key: string) => void;
    onShare: (key: string) => void;
}

const MAX_TARGETS = 4;

const PREVIEW_DOT_TONE: Record<
    PreviewTone,
    'active' | 'warning' | 'inactive' | 'destructive'
> = {
    live: 'active',
    pending: 'warning',
    idle: 'inactive',
    failed: 'destructive',
};

const TRUNCATE_STYLE: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

function GroupHeader({
    groupKey,
    joined,
    preview,
}: {
    groupKey: string;
    joined: boolean;
    preview: PreviewSession | null;
}) {
    const phaseTone = preview && previewPhaseTone(preview);
    const phaseLabel = preview && previewPhaseLabel(preview);
    return (
        <div
            className="border-border flex items-center gap-2 border-b"
            style={{
                padding: '10px 14px',
                background: joined ? COLORS.primary.band : COLORS.muted.band,
            }}
        >
            <KeyIcon
                className="text-muted-foreground shrink-0"
                style={{ height: 13, width: 13 }}
            />
            <span
                className="text-foreground min-w-0 font-mono"
                style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: 500,
                    ...TRUNCATE_STYLE,
                }}
            >
                {groupKey}
            </span>
            {preview && (
                <Badge
                    variant="outline"
                    className="shrink-0 font-mono"
                    style={{
                        gap: 5,
                        fontSize: 9.5,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                    }}
                >
                    {phaseTone && (
                        <StatusDot
                            tone={PREVIEW_DOT_TONE[phaseTone]}
                            size={5}
                        />
                    )}
                    {STRINGS.LABEL_PREVIEW}
                    {phaseLabel && (
                        <span className="text-muted-foreground">
                            {phaseLabel}
                        </span>
                    )}
                </Badge>
            )}
            {joined && (
                <Badge
                    variant="outline"
                    className="text-foreground border-foreground/30 bg-foreground/10 shrink-0 font-mono"
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
    const name = targetDisplayName(target);
    return (
        <div className="flex min-w-0 items-center gap-2">
            <Box
                className="text-muted-foreground shrink-0"
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
    agg: SessionGroupAggregate;
    sessionCount: number;
}) {
    const age = formatRelativeTime(agg.earliestCreatedAt);
    const parts: string[] = [];

    const singleOwner = agg.owners[0];
    if (agg.owners.length === 1 && singleOwner !== undefined) {
        parts.push(singleOwner);
    } else if (agg.owners.length > 1) {
        parts.push(`${agg.owners.length} owners`);
    }

    if (agg.namespaces.length > 1) {
        parts.push(`${agg.namespaces.length} namespaces`);
    }

    if (sessionCount > 1) {
        parts.push(`${sessionCount} sessions`);
    }
    if (age) {
        parts.push(age);
    }

    if (parts.length === 0) {
        return null;
    }

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
    preview,
    onJoin,
    onShare,
}: {
    groupKey: string;
    joined: boolean;
    preview: PreviewSession | null;
    onJoin: (key: string) => void;
    onShare: (key: string) => void;
}) {
    // Once joined, the preview's own phase gives way.
    const phaseTone = !joined && preview ? previewPhaseTone(preview) : null;
    const tone = joined
        ? 'active'
        : phaseTone
          ? PREVIEW_DOT_TONE[phaseTone]
          : 'muted';
    const label = joined
        ? STRINGS.MSG_ROUTING_TRAFFIC
        : preview
          ? previewStatusLine(preview)
          : STRINGS.MSG_AVAILABLE;

    return (
        <CardFooter
            className="flex items-center justify-between gap-2"
            style={{ padding: '6px 14px' }}
        >
            <div
                className="text-muted-foreground inline-flex items-center"
                style={{
                    gap: 6,
                    fontSize: 11,
                    ...(phaseTone === 'failed' && {
                        color: COLORS.destructive.solid,
                        fontWeight: 500,
                    }),
                }}
            >
                <StatusDot tone={tone} glow={joined} />
                {label}
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
                    aria-label={`Copy override link for ${groupKey}`}
                    title="Copy override link"
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
    const agg = aggregateSessions(sessions);
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
                preview={agg.preview}
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
                            {STRINGS.PUNCT_PLUS} {overflow}{' '}
                            {STRINGS.LABEL_MORE_TARGET}
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
                preview={agg.preview}
                onJoin={onJoin}
                onShare={onShare}
            />
        </Card>
    );
}
