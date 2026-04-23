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

type Props = {
    groupKey: string;
    sessions: OperatorSessionSummary[];
    joined: boolean;
    onJoin: (key: string) => void;
    onShare: (key: string) => void;
};

const MAX_TARGETS = 4;

const COLOR_LILAC = '#E4E3FD';
const COLOR_EMERALD = '#34D399';
const COLOR_PRIMARY_TINT = 'rgba(117, 109, 243, 0.22)';
const COLOR_PRIMARY_BAND = 'rgba(117, 109, 243, 0.14)';
const COLOR_PRIMARY_BORDER = 'rgba(117, 109, 243, 0.45)';
const COLOR_MUTED_BAND = 'rgba(255, 255, 255, 0.035)';
const COLOR_MUTED_DOT = 'rgba(148, 163, 184, 0.55)';

const TRUNCATE_STYLE: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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

    const earliestCreatedAt = sessions
        .map((s) => s.createdAt)
        .filter((v): v is string => !!v)
        .sort()[0];
    const age = formatRelativeTime(earliestCreatedAt);

    const shownTargets = targets.slice(0, MAX_TARGETS);
    const overflow = targets.length - shownTargets.length;

    const metaParts = [
        namespaces.length === 1
            ? namespaces[0]
            : `${namespaces.length} namespaces`,
        owners.length === 0
            ? null
            : owners.length === 1
              ? owners[0]
              : `${owners.length} owners`,
        sessions.length > 1 ? `${sessions.length} sessions` : null,
        age || null,
    ].filter((v): v is string => !!v);

    return (
        <Card
            className="overflow-hidden"
            style={
                joined
                    ? {
                          borderColor: COLOR_PRIMARY_BORDER,
                          boxShadow: `0 0 0 1px ${COLOR_PRIMARY_TINT}`,
                      }
                    : undefined
            }
        >
            <div
                className="flex items-center gap-2 border-b border-border"
                style={{
                    padding: '10px 14px',
                    background: joined ? COLOR_PRIMARY_BAND : COLOR_MUTED_BAND,
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
                {joined && (
                    <span
                        className="inline-flex items-center font-mono font-bold rounded-full shrink-0"
                        style={{
                            gap: 5,
                            padding: '0 8px',
                            height: 18,
                            fontSize: 9.5,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            backgroundColor: COLOR_PRIMARY_TINT,
                            color: COLOR_LILAC,
                        }}
                    >
                        <span
                            className="inline-block rounded-full"
                            style={{
                                height: 5,
                                width: 5,
                                backgroundColor: COLOR_EMERALD,
                            }}
                        />
                        Joined
                    </span>
                )}
            </div>

            <CardContent style={{ padding: '10px 14px 8px' }}>
                <div className="flex flex-col" style={{ gap: 4 }}>
                    {shownTargets.map((t) => {
                        const slashIdx = t.indexOf('/');
                        const hasSlash = slashIdx >= 0;
                        const kind = hasSlash ? t.slice(0, slashIdx) : t;
                        const name = hasSlash ? t.slice(slashIdx + 1) : '';
                        return (
                            <div
                                key={t}
                                className="flex items-center gap-2 min-w-0"
                            >
                                <Box
                                    className="shrink-0 text-muted-foreground"
                                    style={{ height: 13, width: 13 }}
                                />
                                <div
                                    className="min-w-0 font-mono"
                                    style={{
                                        fontSize: 12,
                                        lineHeight: 1.45,
                                        ...TRUNCATE_STYLE,
                                    }}
                                >
                                    <span className="text-muted-foreground">
                                        {kind}
                                        {hasSlash ? '/ ' : ''}
                                    </span>
                                    {hasSlash && (
                                        <span
                                            className="font-bold"
                                            style={{ color: COLOR_LILAC }}
                                        >
                                            {name}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
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

                {metaParts.length > 0 && (
                    <div
                        className="text-muted-foreground"
                        style={{
                            marginTop: 8,
                            fontSize: 11,
                            ...TRUNCATE_STYLE,
                        }}
                    >
                        {metaParts.join(' · ')}
                    </div>
                )}
            </CardContent>

            <Separator />

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
                            backgroundColor: joined
                                ? COLOR_EMERALD
                                : COLOR_MUTED_DOT,
                            boxShadow: joined
                                ? '0 0 0 3px rgba(52, 211, 153, 0.22)'
                                : undefined,
                        }}
                    />
                    {joined ? 'Routing your traffic' : 'Available'}
                </div>
                <div className="flex items-center gap-1">
                    {!joined && (
                        <Button
                            type="button"
                            size="sm"
                            aria-label={`Join ${groupKey}`}
                            onClick={() => onJoin(groupKey)}
                            style={{ height: 28, padding: '0 12px' }}
                        >
                            Join
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
        </Card>
    );
}
