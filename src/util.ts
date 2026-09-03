import RandExp from 'randexp';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type {
    ClusterSession,
    Config,
    ExecSession,
    HeaderRule,
    OperatorPreviewSession,
    OperatorSessionHttpFilter,
    OperatorSessionSummary,
    PreviewPhase,
    PreviewSession,
} from './types';
import { ALL_RESOURCE_TYPES, isPreviewSession } from './types';
import {
    STRINGS,
    METALBEAR_EXTENSION_URL,
    CONFIG_HASH_PARAM,
} from './constants';

dayjs.extend(relativeTime);

export function refreshIconIndicator(num: number) {
    void chrome.action.setBadgeTextColor({ color: '#ADD8E6' });
    if (num > 0) {
        void chrome.action.setBadgeText({ text: '✓' });
    } else {
        void chrome.action.setBadgeText({ text: '' });
    }
}

export function parseRules(
    rules: chrome.declarativeNetRequest.Rule[]
): HeaderRule[] {
    const groups = new Map<
        string,
        { id: number; header: string; value: string; scopes: string[] }
    >();
    for (const rule of rules) {
        if (
            rule.action.type !==
                chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS ||
            !rule.action.requestHeaders
        ) {
            continue;
        }
        const requestHeader = rule.action.requestHeaders[0];
        if (!requestHeader) {
            continue;
        }
        const header = requestHeader.header;
        const value = requestHeader.value ?? '';
        const urlFilter = rule.condition.urlFilter;
        const isWildcard = !urlFilter || urlFilter === '|';
        const key = `${header}\n${value}`;
        const group = groups.get(key);
        if (group) {
            if (!isWildcard) {
                group.scopes.push(urlFilter);
            }
            if (rule.id < group.id) {
                group.id = rule.id;
            }
        } else {
            groups.set(key, {
                id: rule.id,
                header,
                value,
                scopes: isWildcard ? [] : [urlFilter],
            });
        }
    }
    return Array.from(groups.values()).map((g) => ({
        id: g.id,
        header: g.header,
        value: g.value,
        scope:
            g.scopes.length === 0 ? STRINGS.MSG_ALL_URLS : g.scopes.join(', '),
    }));
}

export const MATCH_ALL_URL_FILTER = '|';

export function buildDnrRule(
    header: string,
    value: string,
    scope?: string | string[]
): chrome.declarativeNetRequest.Rule[] {
    const patterns = Array.isArray(scope)
        ? scope.filter((p) => p.trim().length > 0)
        : scope && scope.trim().length > 0
          ? [scope]
          : [];
    const filters = patterns.length > 0 ? patterns : [MATCH_ALL_URL_FILTER];
    return filters.map((urlFilter, idx) => ({
        id: idx + 1,
        priority: 1,
        action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
                {
                    header,
                    operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                    value,
                },
            ],
        },
        condition: {
            urlFilter,
            resourceTypes: ALL_RESOURCE_TYPES,
        },
    }));
}

export function getDynamicRules(): Promise<
    chrome.declarativeNetRequest.Rule[]
> {
    return new Promise((resolve) => {
        chrome.declarativeNetRequest.getDynamicRules((rules) => {
            resolve(rules);
        });
    });
}

export function updateDynamicRules(
    opts: chrome.declarativeNetRequest.UpdateRuleOptions
): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.declarativeNetRequest.updateDynamicRules(opts, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

export function storageGet(keys: string[]): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => {
            resolve(result);
        });
    });
}

export function storageSet(data: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(data, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

export function storageRemove(keys: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.storage.local.remove(keys, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

export function formatRelativeTime(iso: string | null | undefined): string {
    if (!iso) {
        return '';
    }
    const parsed = dayjs(iso);
    if (!parsed.isValid()) {
        return '';
    }
    return parsed.fromNow();
}

const PREVIEW_OWNER_USERNAME = 'preview-env';

const PREVIEW_PHASES: readonly PreviewPhase[] = [
    'initializing',
    'waiting',
    'ready',
    'failed',
    'idle',
    'paused',
    'unknown',
];

export function normalizePreviewPhase(raw: unknown): PreviewPhase {
    return PREVIEW_PHASES.includes(raw as PreviewPhase)
        ? (raw as PreviewPhase)
        : 'unknown';
}

// Check both markers set by mirrord CLI when folding a preview into the session list.
function isFoldedPreview(session: OperatorSessionSummary): boolean {
    return (
        session.owner?.username === PREVIEW_OWNER_USERNAME &&
        session.owner.k8sUsername === PREVIEW_OWNER_USERNAME
    );
}

/**
 * Builds the session list the popup renders out of the two lists the operator publishes.
 *
 * A preview environment can reach us twice: folded into `sessions` with owner username as
 * `preview-env`, and again in dedicated `previewSessions`. The dedicated list wins - a folded
 * preview is promoted on its own only when the dedicated list does not account for it, which is the
 * backward-compatible path for the v1 API and for operators predating `previewSessions`.
 */
export function toClusterSessions(
    sessions: OperatorSessionSummary[],
    previews: OperatorPreviewSession[] | undefined
): ClusterSession[] {
    const reported = previews ?? [];
    // Matched on id — both projections use the preview's k8s uid — and, defensively, on key, so an
    // operator that ever changes how it stamps the folded entry's id cannot resurrect a duplicate.
    const reportedIds = new Set(reported.map((p) => p.id));
    const reportedKeys = new Set(reported.map((p) => p.key));

    const folded = sessions.filter(isFoldedPreview);

    return [
        ...sessions.filter((s) => !isFoldedPreview(s)).map(asExecSession),
        ...reported.map(asPreviewSession),
        // Fallback only: previews the dedicated list never mentioned.
        ...folded
            .filter((s) => !reportedIds.has(s.id) && !reportedKeys.has(s.key))
            .map(foldedAsPreviewSession),
    ];
}

function asExecSession(session: OperatorSessionSummary): ExecSession {
    return {
        kind: 'exec',
        id: session.id,
        key: session.key,
        namespace: session.namespace,
        owner: session.owner,
        target: session.target,
        createdAt: session.createdAt,
        ...(session.httpFilter ? { httpFilter: session.httpFilter } : {}),
    };
}

function asPreviewSession(preview: OperatorPreviewSession): PreviewSession {
    const phase = normalizePreviewPhase(preview.phase);
    return {
        kind: 'preview',
        id: preview.id,
        key: preview.key,
        namespace: preview.namespace,
        target: preview.target,
        createdAt: preview.createdAt,
        phase,
        ...(phase === 'idle' && preview.idleSecs !== undefined
            ? { idleSecs: preview.idleSecs }
            : {}),
    };
}

function foldedAsPreviewSession(
    session: OperatorSessionSummary
): PreviewSession {
    return {
        kind: 'preview',
        id: session.id,
        key: session.key,
        namespace: session.namespace,
        target: session.target,
        createdAt: session.createdAt,
        phase: 'unknown',
    };
}

export type PreviewTone = 'live' | 'pending' | 'idle' | 'paused' | 'failed';

export function previewPhaseTone(preview: PreviewSession): PreviewTone | null {
    switch (preview.phase) {
        case 'ready':
            return 'live';
        case 'initializing':
        case 'waiting':
            return 'pending';
        case 'failed':
            return 'failed';
        case 'idle':
            return 'idle';
        case 'paused':
            return 'paused';
        case 'unknown':
            return null;
    }
}

export function previewPhaseLabel(preview: PreviewSession): string | null {
    switch (preview.phase) {
        case 'idle':
            return preview.idleSecs === undefined
                ? STRINGS.PREVIEW_PHASE_LABEL.idle
                : `${STRINGS.PREVIEW_PHASE_LABEL.idle} ${formatDurationSecs(preview.idleSecs)}`;
        case 'initializing':
        case 'waiting':
        case 'failed':
        case 'paused':
            return STRINGS.PREVIEW_PHASE_LABEL[preview.phase];
        case 'ready':
        case 'unknown':
            return null;
    }
}

// Whether a preview environment is currently serving, or would on the next request. `idle` counts:
// its pods are scaled to zero but traffic wakes them. `paused` does not — nothing wakes it.
export function isPreviewLive(preview: PreviewSession): boolean {
    switch (preview.phase) {
        // `unknown` means the operator never told us, so assume up, as before phases existed.
        case 'ready':
        case 'idle':
        case 'unknown':
            return true;
        case 'initializing':
        case 'waiting':
        case 'paused':
        case 'failed':
            return false;
    }
}

// A key's group is live unless it is a preview environment that is not currently serving.
export function groupTone(sessions: ClusterSession[]): PreviewTone {
    const preview = sessions.find(isPreviewSession);
    return (preview && previewPhaseTone(preview)) ?? 'live';
}

export function isGroupLive(sessions: ClusterSession[]): boolean {
    const preview = sessions.find(isPreviewSession);
    return preview ? isPreviewLive(preview) : true;
}

export function previewStatusLine(preview: PreviewSession): string {
    switch (preview.phase) {
        case 'initializing':
        case 'waiting':
            return STRINGS.MSG_PREVIEW_STARTING;
        case 'ready':
            return STRINGS.MSG_PREVIEW_READY;
        case 'idle':
            return STRINGS.MSG_PREVIEW_IDLE(
                preview.idleSecs === undefined
                    ? null
                    : formatDurationSecs(preview.idleSecs)
            );
        case 'paused':
            return STRINGS.MSG_PREVIEW_PAUSED;
        case 'failed':
            return STRINGS.MSG_PREVIEW_FAILED;
        case 'unknown':
            return STRINGS.MSG_AVAILABLE;
    }
}

const SECS_PER_MIN = 60;
const MINS_PER_HOUR = 60;

export function formatDurationSecs(secs: number): string {
    const seconds = Math.max(0, Math.floor(secs));
    const minutes = Math.floor(seconds / SECS_PER_MIN);
    const hours = Math.floor(minutes / MINS_PER_HOUR);
    if (hours > 0) {
        return `${hours}h ${minutes % MINS_PER_HOUR}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % SECS_PER_MIN}s`;
    }
    return `${seconds}s`;
}

export interface SessionGroupAggregate {
    targets: string[];
    owners: string[];
    namespaces: string[];
    earliestCreatedAt: string | null;
    // The preview environment behind this key, or `null` for a group of ordinary exec sessions. A
    // key maps to at most one preview environment.
    preview: PreviewSession | null;
}

export function aggregateSessions(
    sessions: ClusterSession[]
): SessionGroupAggregate {
    const targets = new Set<string>();
    const owners = new Set<string>();
    const namespaces = new Set<string>();
    let earliest: string | null = null;
    let preview: PreviewSession | null = null;

    for (const s of sessions) {
        const targetLabel = s.target
            ? `${s.target.kind}/${s.target.name}`
            : 'targetless';
        targets.add(targetLabel);
        if (s.kind === 'preview') {
            preview ??= s;
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
        preview,
    };
}

// Targets are stored as `kind/name`; the UI shows just the name.
export function targetDisplayName(target: string): string {
    const slashIdx = target.indexOf('/');
    return slashIdx >= 0 ? target.slice(slashIdx + 1) : target;
}

export function encodeConfig(config: Config): string {
    return btoa(JSON.stringify(config));
}

export function buildShareUrl(config: Config): string {
    const encoded = encodeConfig(config);
    // Land on metalbear.com so the link works for recipients who don't have the extension yet;
    // the content script there forwards the payload to the result page. Carried in the hash
    // (not the query) so the base64 payload survives verbatim and never hits the server.
    return `${METALBEAR_EXTENSION_URL}#${CONFIG_HASH_PARAM}=${encoded}`;
}

export interface InjectionHint {
    header: string;
    value: string;
}

const HEADER_LINE_PATTERN = /^([A-Za-z0-9_-]+):\s?(.+)$/;

function generateLowestMatch(pattern: string): string | null {
    try {
        const re = new RandExp(pattern);
        re.max = 0;
        re.randInt = (from) => from;
        return re.gen();
    } catch {
        return null;
    }
}

function parseHeaderLine(line: string): InjectionHint | null {
    const m = HEADER_LINE_PATTERN.exec(line);
    if (!m) {
        return null;
    }
    const header = m[1];
    const value = m[2];
    if (header === undefined || value === undefined) {
        return null;
    }
    return { header, value };
}

export function deriveInjectionHint(
    headerFilter: string | null | undefined
): InjectionHint | null {
    if (!headerFilter) {
        return null;
    }
    const trimmed = headerFilter.trim();
    if (!trimmed) {
        return null;
    }
    const generated = generateLowestMatch(trimmed);
    if (!generated) {
        return null;
    }
    return parseHeaderLine(generated);
}

const BAGGAGE_HEADER_NAME = 'baggage';
const BAGGAGE_VALUE_PREFIX = 'mirrord-session=';

export function sessionInjectionPair(session: {
    key: string;
    httpFilter?: OperatorSessionHttpFilter | null;
}): InjectionHint {
    return (
        deriveInjectionHint(session.httpFilter?.headerFilter) ?? {
            header: BAGGAGE_HEADER_NAME,
            value: `${BAGGAGE_VALUE_PREFIX}${session.key}`,
        }
    );
}
