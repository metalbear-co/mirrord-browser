import { STORAGE_KEYS } from './types';
import { mirrordUiCredentials, refreshIconIndicator, storageGet } from './util';
import {
    ACTIVITY_SESSION_KEY,
    applyOperatorEvent,
    emptyActivity,
    imageVersion,
    type ActivityMember,
    hitsWithin,
    parseSse,
    type ActivityHit,
    type ActivityState,
    type ActivityStatus,
    type SseMessage,
} from './activity';

const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 30_000;
const KEEPALIVE_MS = 20_000;
const HTTP_NOT_FOUND = 404;
const STATUS_EVENT = 'status';
const BADGE_REFRESH_MS = 5_000;
const MEMBERS_REFRESH_MS = 30_000;
const BADGE_MAX = 99;
const BADGE_BACKGROUND = '#16a34a';
const BADGE_TEXT = '#ffffff';

export const ACTIVITY_STORAGE_KEYS: readonly string[] = [
    STORAGE_KEYS.MIRRORD_UI_BACKEND,
    STORAGE_KEYS.MIRRORD_UI_TOKEN,
    STORAGE_KEYS.MIRRORD_UI_DISCOVERED,
    STORAGE_KEYS.JOINED_KEY,
    STORAGE_KEYS.SELECTED_CONTEXT,
];

interface StreamConfig {
    backend: string;
    token: string;
    key: string;
    context: string | null;
}

interface StatusPayload {
    available?: unknown;
    supported?: unknown;
    reason?: unknown;
}

let state: ActivityState = emptyActivity();
let activeConfig: string | null = null;
let controller: AbortController | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
let retryDelay = RETRY_MIN_MS;
let badgeTimer: ReturnType<typeof setInterval> | null = null;
let membersTimer: ReturnType<typeof setInterval> | null = null;
const previewImages = new Map<string, string | null>();

function sessionArea(): chrome.storage.StorageArea | undefined {
    return (
        chrome.storage as unknown as { session?: chrome.storage.StorageArea }
    ).session;
}

function persist(): void {
    sessionArea()
        ?.set({ [ACTIVITY_SESSION_KEY]: state })
        .catch(() => undefined);
    void updateBadge();
}

const BADGE_ORIGINAL_KEY = 'activity_badge_original';

let badgeQueue: Promise<void> = Promise.resolve();

// Updates run one at a time so two of them can't both record the original color.
function updateBadge(): Promise<void> {
    badgeQueue = badgeQueue.then(drawBadge, drawBadge);
    return badgeQueue;
}

// The original color lives in session storage so a restarted worker can still restore it.
async function drawBadge(): Promise<void> {
    const action = (chrome as unknown as { action?: typeof chrome.action })
        .action;
    const area = sessionArea();
    if (!action || !area) {
        return;
    }
    const count = hitsWithin(state.hits, Date.now());
    try {
        const stored = await area.get(BADGE_ORIGINAL_KEY);
        const original = stored[BADGE_ORIGINAL_KEY] as
            | chrome.action.ColorArray
            | undefined;
        if (count > 0) {
            if (!original) {
                await area.set({
                    [BADGE_ORIGINAL_KEY]: await action.getBadgeBackgroundColor(
                        {}
                    ),
                });
            }
            await action.setBadgeBackgroundColor({ color: BADGE_BACKGROUND });
            await action.setBadgeTextColor({ color: BADGE_TEXT });
            await action.setBadgeText({
                text: count > BADGE_MAX ? `${BADGE_MAX}+` : String(count),
            });
            badgeTimer ??= setInterval(
                () => void updateBadge(),
                BADGE_REFRESH_MS
            );
            return;
        }
        if (badgeTimer !== null) {
            clearInterval(badgeTimer);
            badgeTimer = null;
        }
        if (original) {
            await area.remove(BADGE_ORIGINAL_KEY);
            await action.setBadgeBackgroundColor({ color: original });
            const rules = await chrome.declarativeNetRequest.getDynamicRules();
            refreshIconIndicator(rules.length);
        }
    } catch {
        // A failed badge update must not stop the event stream.
    }
}

function setStatus(status: ActivityStatus, reason: string | null = null) {
    if (state.status === status && state.reason === reason) {
        return;
    }
    state = { ...state, status, reason };
    persist();
}

async function restoreHits(key: string): Promise<ActivityHit[]> {
    const area = sessionArea();
    if (!area) {
        return [];
    }
    try {
        const stored = await area.get(ACTIVITY_SESSION_KEY);
        const previous = stored[ACTIVITY_SESSION_KEY] as
            | ActivityState
            | undefined;
        return previous?.key === key && Array.isArray(previous.hits)
            ? previous.hits
            : [];
    } catch {
        return [];
    }
}

function readConfig(stored: Record<string, unknown>): StreamConfig | null {
    const { backend, token } = mirrordUiCredentials(stored);
    const key = stored[STORAGE_KEYS.JOINED_KEY];
    const context = stored[STORAGE_KEYS.SELECTED_CONTEXT];
    if (!backend || !token || typeof key !== 'string') {
        return null;
    }
    return {
        backend,
        token,
        key,
        context: typeof context === 'string' ? context : null,
    };
}

export async function syncActivityStream(): Promise<void> {
    const config = readConfig(await storageGet([...ACTIVITY_STORAGE_KEYS]));
    const serialized = config ? JSON.stringify(config) : null;
    if (serialized === activeConfig) {
        return;
    }
    stop();
    activeConfig = serialized;
    if (!config || !serialized) {
        state = emptyActivity();
        persist();
        return;
    }
    const hits = await restoreHits(config.key);
    if (activeConfig !== serialized) {
        return;
    }
    state = { key: config.key, status: 'connecting', reason: null, hits };
    persist();
    startKeepalive();
    void connect(config, serialized);
    void refreshMembers(config, serialized);
    membersTimer = setInterval(
        () => void refreshMembers(config, serialized),
        MEMBERS_REFRESH_MS
    );
}

function stop(): void {
    controller?.abort();
    controller = null;
    if (membersTimer !== null) {
        clearInterval(membersTimer);
        membersTimer = null;
    }
    previewImages.clear();
    if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
    if (keepaliveTimer !== null) {
        clearInterval(keepaliveTimer);
        keepaliveTimer = null;
    }
    retryDelay = RETRY_MIN_MS;
}

// Any extension API call resets the service worker's idle timer, which keeps the stream open.
function startKeepalive(): void {
    if (keepaliveTimer !== null) {
        return;
    }
    keepaliveTimer = setInterval(() => {
        chrome.runtime.getPlatformInfo().catch(() => undefined);
    }, KEEPALIVE_MS);
}

interface SessionSummary {
    id?: unknown;
    key?: unknown;
    target?: { name?: unknown } | null;
}

function summaries(value: unknown): SessionSummary[] {
    return Array.isArray(value) ? (value as SessionSummary[]) : [];
}

function targetName(session: SessionSummary): string | null {
    const name = session.target?.name;
    return typeof name === 'string' && name ? name : null;
}

async function previewImage(
    config: StreamConfig,
    id: string,
    query: string
): Promise<string | null> {
    if (previewImages.has(id)) {
        return previewImages.get(id) ?? null;
    }
    try {
        const resp = await fetch(
            `${config.backend}/api/v2/operator/previews/${encodeURIComponent(id)}${query}`,
            { headers: { 'x-auth-token': config.token } }
        );
        const body = resp.ok
            ? ((await resp.json()) as { image?: unknown })
            : {};
        const image = typeof body.image === 'string' ? body.image : null;
        previewImages.set(id, image);
        return image;
    } catch {
        previewImages.set(id, null);
        return null;
    }
}

// Lists every workload running a session with the joined key, so Activity can show the ones a
// flow never reached instead of leaving them out.
async function refreshMembers(
    config: StreamConfig,
    serialized: string
): Promise<void> {
    const query = config.context
        ? `?context=${encodeURIComponent(config.context)}`
        : '';
    let body: { sessions?: unknown; previewSessions?: unknown };
    try {
        const resp = await fetch(
            `${config.backend}/api/v2/operator/sessions${query}`,
            { headers: { 'x-auth-token': config.token } }
        );
        if (!resp.ok) {
            return;
        }
        body = (await resp.json()) as typeof body;
    } catch {
        return;
    }
    const ours = (s: SessionSummary) => s.key === config.key;
    const previews = summaries(body.previewSessions).filter(ours);
    const previewIds = new Set(previews.map((p) => p.id));
    const members = new Map<string, ActivityMember>();
    for (const preview of previews) {
        const service = targetName(preview);
        if (!service || typeof preview.id !== 'string') {
            continue;
        }
        const image = await previewImage(config, preview.id, query);
        members.set(service, {
            service,
            kind: 'preview',
            version: image ? imageVersion(image) : null,
        });
    }
    for (const session of summaries(body.sessions).filter(ours)) {
        const service = targetName(session);
        if (!service || previewIds.has(session.id) || members.has(service)) {
            continue;
        }
        members.set(service, { service, kind: 'local', version: null });
    }
    if (activeConfig !== serialized) {
        return;
    }
    state = { ...state, members: [...members.values()] };
    persist();
}

async function connect(config: StreamConfig, serialized: string) {
    const ctrl = new AbortController();
    controller = ctrl;
    const params = new URLSearchParams();
    if (config.context) {
        params.set('context', config.context);
    }
    try {
        const resp = await fetch(
            `${config.backend}/api/v2/operator/events?${params.toString()}`,
            {
                headers: {
                    'x-auth-token': config.token,
                    accept: 'text/event-stream',
                },
                signal: ctrl.signal,
            }
        );
        if (resp.status === HTTP_NOT_FOUND) {
            setStatus('outdated_ui');
            return;
        }
        if (!resp.ok || !resp.body) {
            throw new Error(`mirrord ui responded ${resp.status}`);
        }
        await readStream(resp.body);
        throw new Error('mirrord ui closed the event stream');
    } catch (err) {
        if (ctrl.signal.aborted || activeConfig !== serialized) {
            return;
        }
        setStatus(
            'disconnected',
            err instanceof Error ? err.message : String(err)
        );
        scheduleRetry(config, serialized);
    }
}

async function readStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
        const { value, done } = await reader.read();
        if (done) {
            return;
        }
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSse(buffer);
        buffer = parsed.rest;
        parsed.messages.forEach(handleMessage);
    }
}

function scheduleRetry(config: StreamConfig, serialized: string): void {
    retryTimer = setTimeout(() => {
        retryTimer = null;
        if (activeConfig === serialized) {
            void connect(config, serialized);
        }
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
}

function handleMessage(message: SseMessage): void {
    if (message.event === STATUS_EVENT) {
        applyStatus(message.data);
        return;
    }
    const next = applyOperatorEvent(state, message.data, Date.now());
    if (next === state) {
        return;
    }
    state = next;
    persist();
}

function applyStatus(data: string): void {
    let payload: StatusPayload;
    try {
        payload = JSON.parse(data) as StatusPayload;
    } catch {
        return;
    }
    if (payload.available !== true) {
        setStatus(
            'unavailable',
            typeof payload.reason === 'string' ? payload.reason : null
        );
    } else if (payload.supported !== true) {
        setStatus('outdated_operator');
    } else {
        retryDelay = RETRY_MIN_MS;
        setStatus('live');
    }
}
