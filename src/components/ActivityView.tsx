import { useState } from 'react';
import { Card, CardContent } from '@metalbear/ui';
import { Activity as ActivityIcon, Check, ChevronRight } from 'lucide-react';
import { StatusDot } from './StatusDot';
import { COLORS } from '../colors';
import { STRINGS } from '../constants';
import { formatRelativeTime } from '../util';
import { RING_SECONDS } from '../headerObservation';
import {
    groupByService,
    hitsWithin,
    type ActivityMember,
    type ActivityState,
    type ActivityStatus,
    type ServiceActivity,
    type ServiceRequest,
} from '../activity';

const MAX_SERVICES = 20;
const CHIP_MAX_WIDTH = 96;
const MISSING_OPACITY = 0.6;
const OCCURRENCE_OPACITY = 0.8;
const CHEVRON_SIZE = 14;
const HTTP_CLIENT_ERROR = 400;
const HTTP_SERVER_ERROR = 500;
const CHECK_BADGE_SIZE = 16;
const CHECK_ICON_SIZE = 10;

interface Props {
    joinedKey: string | null;
    activity: ActivityState;
    now: number;
}

type LineTone = 'active' | 'muted' | 'warning';

const truncate = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
} as const;

function statusLine(
    status: ActivityStatus,
    key: string,
    reached: number
): { tone: LineTone; text: string } {
    switch (status) {
        case 'live':
            return {
                tone: 'active',
                text: STRINGS.ACTIVITY_LIVE(key, reached),
            };
        case 'unavailable':
            return { tone: 'warning', text: STRINGS.ACTIVITY_UNAVAILABLE };
        case 'outdated_ui':
            return { tone: 'warning', text: STRINGS.ACTIVITY_OUTDATED_UI };
        case 'outdated_operator':
            return {
                tone: 'warning',
                text: STRINGS.ACTIVITY_OUTDATED_OPERATOR,
            };
        case 'disconnected':
            return { tone: 'warning', text: STRINGS.ACTIVITY_DISCONNECTED };
        case 'idle':
        case 'connecting':
            return { tone: 'muted', text: STRINGS.ACTIVITY_CONNECTING };
    }
}

function statusColor(status: number | null): string {
    if (status === null) {
        return 'hsl(var(--muted-foreground))';
    }
    if (status >= HTTP_SERVER_ERROR) {
        return COLORS.destructive.solid;
    }
    if (status >= HTTP_CLIENT_ERROR) {
        return COLORS.warning.solid;
    }
    return COLORS.success.dot;
}

function LiveLine({
    joinedKey,
    reached,
}: {
    joinedKey: string;
    reached: number;
}) {
    const color = reached > 0 ? COLORS.success.dot : COLORS.muted.dot;
    return (
        <div
            className="flex min-w-0 flex-1 items-center"
            style={{ gap: 6, fontSize: 10.5 }}
        >
            <ActivityIcon
                className="shrink-0"
                style={{ height: 12, width: 12, color: COLORS.success.dot }}
            />
            <span
                className="text-muted-foreground min-w-0 font-semibold"
                style={truncate}
            >
                {STRINGS.ACTIVITY_REACHED_LABEL(joinedKey)}
            </span>
            <span
                className="shrink-0 font-mono"
                style={{ color, fontWeight: 600 }}
            >
                {reached} {STRINGS.LABEL_REQ_LAST} {RING_SECONDS}
                {STRINGS.LABEL_SECONDS_SUFFIX}
            </span>
        </div>
    );
}

const COPIED_MS = 1200;
const wrap = { overflowWrap: 'anywhere', wordBreak: 'break-all' } as const;

function CopyText({
    text,
    copy,
    className,
}: {
    text: string;
    copy: string;
    className?: string;
}) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            className={`bg-transparent p-0 text-left font-mono hover:underline ${className ?? ''}`}
            style={{ ...wrap, cursor: 'copy' }}
            title={copied ? STRINGS.ACTIVITY_COPIED : STRINGS.ACTIVITY_COPY}
            onClick={(event) => {
                event.stopPropagation();
                void navigator.clipboard.writeText(copy).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), COPIED_MS);
                });
            }}
        >
            {copied ? STRINGS.ACTIVITY_COPIED : text}
        </button>
    );
}

function clockTime(at: number): string {
    return new Date(at).toLocaleTimeString([], { hour12: false });
}

function RequestRow({ request }: { request: ServiceRequest }) {
    const label = requestLabel(request);
    return (
        <li className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-start gap-2">
                <CopyText
                    text={label}
                    copy={request.path}
                    className="text-meta text-muted-foreground min-w-0 flex-1"
                />
                {request.count > 1 && (
                    <span className="text-meta text-muted-foreground shrink-0 font-mono">
                        ×{request.count}
                    </span>
                )}
                {request.status !== null && (
                    <span
                        className="text-meta shrink-0 font-mono"
                        style={{ color: statusColor(request.status) }}
                    >
                        {request.status}
                    </span>
                )}
            </div>
            {request.occurrences.length > 0 && (
                <ul className="m-0 flex list-none flex-col p-0 pl-3">
                    {request.occurrences.map((occurrence) => (
                        <li
                            key={`${occurrence.at}-${occurrence.trace ?? ''}`}
                            className="text-meta text-muted-foreground flex gap-3 font-mono"
                            style={{ opacity: OCCURRENCE_OPACITY }}
                        >
                            <span className="shrink-0">
                                {clockTime(occurrence.at)}
                            </span>
                            {occurrence.trace ? (
                                <CopyText
                                    text={STRINGS.ACTIVITY_TRACE(
                                        occurrence.trace
                                    )}
                                    copy={occurrence.trace}
                                    className="min-w-0"
                                />
                            ) : (
                                <span>{STRINGS.ACTIVITY_NO_TRACE}</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}

interface CardModel {
    service: string;
    member: ActivityMember | null;
    group: ServiceActivity | null;
}

function cardModels(
    groups: ServiceActivity[],
    members: ActivityMember[]
): CardModel[] {
    const byService = new Map(members.map((m) => [m.service, m]));
    const reached = groups.map((group) => ({
        service: group.service,
        member: byService.get(group.service) ?? null,
        group,
    }));
    const seen = new Set(groups.map((g) => g.service));
    const missing = members
        .filter((m) => !seen.has(m.service))
        .map((member) => ({ service: member.service, member, group: null }));
    return [...reached, ...missing];
}

function requestLabel(request: ServiceRequest): string {
    return request.kind === 'queue'
        ? `${request.method} · ${request.path}`
        : `${request.method} ${request.path}`;
}

function VersionChip({ member }: { member: ActivityMember }) {
    const text =
        member.kind === 'local'
            ? STRINGS.ACTIVITY_LOCAL
            : (member.version ?? STRINGS.ACTIVITY_PREVIEW);
    return (
        <span
            className="shrink-0 font-mono"
            title={
                member.kind === 'local'
                    ? STRINGS.ACTIVITY_LOCAL_HINT
                    : STRINGS.ACTIVITY_PREVIEW_HINT
            }
            style={{
                ...truncate,
                maxWidth: CHIP_MAX_WIDTH,
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 999,
                background: COLORS.primary.bgSoft,
                border: `1px solid ${COLORS.primary.borderSubtle}`,
            }}
        >
            {text}
        </span>
    );
}

function ServiceCard({ model, now }: { model: CardModel; now: number }) {
    const [expanded, setExpanded] = useState(false);
    const { group, member, service } = model;
    const reached = group !== null;
    const latest = group?.requests[0] ?? null;
    return (
        <li>
            <Card
                className="overflow-hidden"
                style={reached ? undefined : { opacity: MISSING_OPACITY }}
            >
                <CardContent className="flex flex-col gap-1 px-3 py-2">
                    <button
                        type="button"
                        className="flex w-full min-w-0 flex-wrap items-center bg-transparent p-0 text-left"
                        onClick={() => reached && setExpanded((v) => !v)}
                        style={{
                            cursor: reached ? 'pointer' : 'default',
                            columnGap: 8,
                            rowGap: 2,
                        }}
                        aria-expanded={reached ? expanded : undefined}
                        disabled={!reached}
                    >
                        <span
                            className="flex min-w-0 items-center"
                            style={{ gap: 8 }}
                        >
                            <span
                                className="inline-flex shrink-0 items-center justify-center rounded-full"
                                style={{
                                    height: CHECK_BADGE_SIZE,
                                    width: CHECK_BADGE_SIZE,
                                    background: reached
                                        ? COLORS.success.dot
                                        : 'transparent',
                                    border: reached
                                        ? undefined
                                        : `1.5px dashed ${COLORS.muted.dot}`,
                                }}
                                aria-hidden="true"
                            >
                                {reached && (
                                    <Check
                                        style={{
                                            height: CHECK_ICON_SIZE,
                                            width: CHECK_ICON_SIZE,
                                            color: 'hsl(var(--background))',
                                        }}
                                    />
                                )}
                            </span>
                            <span
                                className="text-body min-w-0 font-mono font-semibold"
                                style={{ overflowWrap: 'anywhere' }}
                            >
                                {service}
                            </span>
                            {member && <VersionChip member={member} />}
                        </span>
                        <span
                            className="flex shrink-0 items-center"
                            style={{ gap: 4, marginLeft: 'auto' }}
                        >
                            <span className="text-meta text-muted-foreground">
                                {group
                                    ? `${STRINGS.ACTIVITY_REQUEST_COUNT(group.count, group.messages)} · ${formatRelativeTime(new Date(Math.min(group.at, now)).toISOString())}`
                                    : STRINGS.ACTIVITY_NOT_REACHED}
                            </span>
                            {reached && (
                                <ChevronRight
                                    className="text-muted-foreground shrink-0"
                                    aria-hidden="true"
                                    style={{
                                        height: CHEVRON_SIZE,
                                        width: CHEVRON_SIZE,
                                        transform: expanded
                                            ? 'rotate(90deg)'
                                            : undefined,
                                        transition: 'transform 120ms ease',
                                    }}
                                />
                            )}
                        </span>
                    </button>
                    {group && latest && !expanded && (
                        <div className="pl-6">
                            <CopyText
                                text={requestLabel(latest)}
                                copy={latest.path}
                                className="text-meta text-muted-foreground"
                            />
                        </div>
                    )}
                    {group && expanded && (
                        <ul className="m-0 flex list-none flex-col gap-0.5 p-0 pl-6">
                            {group.requests.map((request) => (
                                <RequestRow
                                    key={`${request.method} ${request.path}`}
                                    request={request}
                                />
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </li>
    );
}

export function ActivityView({ joinedKey, activity, now }: Props) {
    if (!joinedKey) {
        return (
            <Card>
                <CardContent className="flex flex-col gap-1 px-3 py-3">
                    <span className="text-title">
                        {STRINGS.ACTIVITY_NOT_JOINED}
                    </span>
                    <span className="text-body text-muted-foreground">
                        {STRINGS.ACTIVITY_NOT_JOINED_HINT}
                    </span>
                </CardContent>
            </Card>
        );
    }

    const reached = hitsWithin(activity.hits, now);
    const line = statusLine(activity.status, joinedKey, reached);
    const cards = cardModels(
        groupByService(activity.hits),
        activity.members ?? []
    ).slice(0, MAX_SERVICES);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5 px-1">
                <div className="flex items-center gap-2">
                    {activity.status === 'live' ? (
                        <LiveLine joinedKey={joinedKey} reached={reached} />
                    ) : (
                        <>
                            <StatusDot
                                tone={line.tone}
                                glow={line.tone === 'active'}
                            />
                            <span
                                className="text-body min-w-0 flex-1"
                                style={{ overflowWrap: 'anywhere' }}
                            >
                                {line.text}
                            </span>
                        </>
                    )}
                </div>
                {line.tone === 'warning' && activity.reason && (
                    <span
                        className="text-meta text-muted-foreground"
                        style={{ overflowWrap: 'anywhere', paddingLeft: 16 }}
                    >
                        {activity.reason}
                    </span>
                )}
            </div>

            {cards.length === 0 ? (
                <p className="text-body text-muted-foreground m-0 px-1">
                    {STRINGS.ACTIVITY_EMPTY(joinedKey)}
                </p>
            ) : (
                <ol
                    className="m-0 flex list-none flex-col gap-2 p-0"
                    aria-label={STRINGS.TAB_ACTIVITY}
                >
                    {cards.map((model) => (
                        <ServiceCard
                            key={model.service}
                            model={model}
                            now={now}
                        />
                    ))}
                </ol>
            )}
        </div>
    );
}
