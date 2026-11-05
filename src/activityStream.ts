import { STORAGE_KEYS } from './types';
import { STRINGS } from './constants';
import { mirrordUiCredentials, refreshIconIndicator, storageGet } from './util';
import {
    ACTIVITY_SESSION_KEY,
    applyOperatorEvent,
    emptyActivity,
    imageVersion,
    type ActivityMember,
    recentCount,
    parseSse,
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
// Bumped on every config change; work started under an older value stops.
let generation = 0;
let controller: AbortController | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
let retryDelay = RETRY_MIN_MS;
let badgeTimer: ReturnType<typeof setInterval> | null = null;
let membersTimer: ReturnType<typeof setInterval> | null = null;
const previewImages = new Map<string, string>();

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
    const count = recentCount(state, Date.now());
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

// Pins "the kubeconfig's current context" to a name, so switching contexts later can't mix
// another cluster's events into this session's history.
async function withCurrentContext(
    config: StreamConfig
): Promise<StreamConfig | null> {
    if (config.context) {
        return config;
    }
    try {
        const resp = await fetch(`${config.backend}/api/v2/kube/contexts`, {
            headers: { 'x-auth-token': config.token },
        });
        const body = resp.ok
            ? ((await resp.json()) as { current?: unknown })
            : {};
        return typeof body.current === 'string' && body.current
            ? { ...config, context: body.current }
            : null;
    } catch {
        return null;
    }
}

function scopeOf(config: StreamConfig): string {
    return JSON.stringify([config.backend, config.context, config.key]);
}

async function savedActivity(): Promise<ActivityState | null> {
    try {
        const stored = await sessionArea()?.get(ACTIVITY_SESSION_KEY);
        return (
            (stored?.[ACTIVITY_SESSION_KEY] as ActivityState | undefined) ??
            null
        );
    } catch {
        return null;
    }
}

function restoreHits(
    saved: ActivityState | null,
    scope: string
): Pick<ActivityState, 'hits' | 'arrivals'> {
    return saved?.scope === scope && Array.isArray(saved.hits)
        ? { hits: saved.hits, arrivals: saved.arrivals ?? [] }
        : { hits: [] };
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
    const stored = await storageGet([...ACTIVITY_STORAGE_KEYS]);
    const config = readConfig(stored);
    const serialized = config ? JSON.stringify(config) : null;
    if (serialized === activeConfig) {
        return;
    }
    stop();
    activeConfig = serialized;
    const gen = ++generation;
    const saved = await savedActivity();
    if (gen !== generation) {
        return;
    }
    if (!config) {
        // Still joined but waiting for mirrord ui credentials: keep the history for when they return.
        const stillJoined =
            typeof stored[STORAGE_KEYS.JOINED_KEY] === 'string' &&
            saved?.key === stored[STORAGE_KEYS.JOINED_KEY];
        state =
            stillJoined && saved
                ? { ...saved, status: 'connecting', reason: null }
                : emptyActivity();
        persist();
        return;
    }
    const sameKey = saved?.key === config.key;
    state = {
        ...emptyActivity(config.key),
        status: 'connecting',
        hits: sameKey ? saved.hits : [],
        arrivals: sameKey ? (saved.arrivals ?? []) : [],
    };
    persist();
    startKeepalive();
    await start(config, gen, saved);
}

async function start(
    config: StreamConfig,
    gen: number,
    saved: ActivityState | null
): Promise<void> {
    const effective = await withCurrentContext(config);
    if (gen !== generation) {
        return;
    }
    if (!effective) {
        setStatus('disconnected', STRINGS.ACTIVITY_NO_CONTEXT);
        retryTimer = setTimeout(() => {
            retryTimer = null;
            if (gen === generation) {
                void start(config, gen, saved);
            }
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
        return;
    }
    const scope = scopeOf(effective);
    const restored = restoreHits(saved, scope);
    state = {
        key: config.key,
        scope,
        status: 'connecting',
        reason: null,
        ...restored,
    };
    persist();
    void connect(effective, gen);
    void refreshMembers(effective, gen);
    membersTimer = setInterval(
        () => void refreshMembers(effective, gen),
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
    namespace?: unknown;
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
    namespace: string | null
): Promise<string | null> {
    const cached = previewImages.get(id);
    if (cached) {
        return cached;
    }
    try {
        const params = new URLSearchParams();
        if (config.context) {
            params.set('context', config.context);
        }
        if (namespace) {
            params.set('namespace', namespace);
        }
        const resp = await fetch(
            `${config.backend}/api/v2/operator/previews/${encodeURIComponent(id)}?${params.toString()}`,
            { headers: { 'x-auth-token': config.token } }
        );
        const body = resp.ok
            ? ((await resp.json()) as { image?: unknown })
            : {};
        const image = typeof body.image === 'string' ? body.image : null;
        if (image) {
            previewImages.set(id, image);
        }
        return image;
    } catch {
        return null;
    }
}

// Lists every workload running a session with the joined key, so Activity can show the ones a
// flow never reached instead of leaving them out.
async function refreshMembers(
    config: StreamConfig,
    gen: number
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
        const image = await previewImage(
            config,
            preview.id,
            typeof preview.namespace === 'string' ? preview.namespace : null
        );
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
    if (gen !== generation) {
        return;
    }
    state = { ...state, members: [...members.values()] };
    persist();
}

async function connect(config: StreamConfig, gen: number) {
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
            retryDelay = RETRY_MAX_MS;
            scheduleRetry(config, gen);
            return;
        }
        if (!resp.ok || !resp.body) {
            throw new Error(`mirrord ui responded ${resp.status}`);
        }
        await readStream(resp.body);
        throw new Error('mirrord ui closed the event stream');
    } catch (err) {
        if (ctrl.signal.aborted || gen !== generation) {
            return;
        }
        setStatus(
            'disconnected',
            err instanceof Error ? err.message : String(err)
        );
        scheduleRetry(config, gen);
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

function scheduleRetry(config: StreamConfig, gen: number): void {
    retryTimer = setTimeout(() => {
        retryTimer = null;
        if (gen === generation) {
            void connect(config, gen);
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
