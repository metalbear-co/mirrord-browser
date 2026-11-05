export const ACTIVITY_SESSION_KEY = 'activity';
export const ACTIVITY_WINDOW_MS = 60_000;

const MAX_HITS = 200;
const REPEAT_WINDOW_MS = 10_000;

export type ActivityStatus =
    | 'idle'
    | 'connecting'
    | 'live'
    | 'outdated_ui'
    | 'outdated_operator'
    | 'unavailable'
    | 'disconnected';

export interface ActivityHit {
    id: string;
    at: number;
    service: string;
    method: string;
    path: string;
    status: number | null;
    // Absent on hits stored before repeats were merged.
    count?: number;
    kind?: 'http' | 'queue';
}

export interface ActivityMember {
    service: string;
    kind: 'preview' | 'local';
    version: string | null;
}

export interface ActivityState {
    key: string | null;
    // Backend, context and key the hits belong to.
    scope?: string;
    // Arrival times inside the activity window, kept apart from the capped display rows.
    arrivals?: number[];
    status: ActivityStatus;
    reason: string | null;
    hits: ActivityHit[];
    // Workloads running a session with this key; absent until mirrord ui answers.
    members?: ActivityMember[];
}

export interface SseMessage {
    event: string;
    data: string;
}

export function emptyActivity(key: string | null = null): ActivityState {
    return { key, status: 'idle', reason: null, hits: [] };
}

const SHORT_DIGEST = 7;
const LONG_HEX = /^[0-9a-f]{12,}$/i;

export function imageVersion(image: string): string {
    const name = image.split('@')[0] ?? image;
    const last = name.slice(name.lastIndexOf('/') + 1);
    const colon = last.lastIndexOf(':');
    const tag = colon === -1 ? 'latest' : last.slice(colon + 1);
    return LONG_HEX.test(tag) ? tag.slice(0, SHORT_DIGEST) : tag;
}

export function parseSse(buffer: string): {
    messages: SseMessage[];
    rest: string;
} {
    const blocks = buffer.replace(/\r\n/g, '\n').split('\n\n');
    const rest = blocks.pop() ?? '';
    const messages: SseMessage[] = [];
    for (const block of blocks) {
        let event = 'message';
        const data: string[] = [];
        for (const line of block.split('\n')) {
            if (line.startsWith(':')) {
                continue;
            }
            const colon = line.indexOf(':');
            const field = colon === -1 ? line : line.slice(0, colon);
            const raw = colon === -1 ? '' : line.slice(colon + 1);
            const value = raw.startsWith(' ') ? raw.slice(1) : raw;
            if (field === 'event') {
                event = value;
            } else if (field === 'data') {
                data.push(value);
            }
        }
        if (data.length > 0) {
            messages.push({ event, data: data.join('\n') });
        }
    }
    return { messages, rest };
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function correlationId(
    origin: string,
    payload: Record<string, unknown>
): string | null {
    const connection = payload['connection_id'];
    const request = payload['request_id'];
    return typeof connection === 'number' && typeof request === 'number'
        ? `${origin}/${connection}:${request}`
        : null;
}

const STATIC_PATH =
    /(^|\/)_next\/(static|image)\/|\.(js|mjs|css|map|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|otf)$/i;
const NOISE_PARAMS = ['_rsc'];

const QUEUE_LABELS: Record<string, string> = {
    sqs: 'SQS',
    rmq: 'RabbitMQ',
    gcppubsub: 'Pub/Sub',
    bullmq: 'BullMQ',
    nats: 'NATS',
    natspubsub: 'NATS',
    azure_service_bus: 'Service Bus',
};

function queueMessage(data: Record<string, unknown> | null): {
    broker: string;
    name: string;
    mode: unknown;
} | null {
    const queue = asRecord(data?.['queue_message']);
    if (queue) {
        const type = asString(queue['queue_type']);
        return {
            broker: QUEUE_LABELS[type] ?? type,
            name: asString(queue['queue_name']),
            mode: queue['mode'],
        };
    }
    const kafka = asRecord(data?.['kafka_message']);
    if (kafka) {
        return {
            broker: 'Kafka',
            name: asString(kafka['topic']),
            mode: kafka['mode'],
        };
    }
    const redis = asRecord(data?.['redis_message']);
    if (redis) {
        return {
            broker: 'Redis',
            name: asString(redis['channel']),
            mode: redis['mode'],
        };
    }
    return null;
}

function mergeHit(state: ActivityState, hit: ActivityHit): ActivityState {
    const repeat = state.hits.find(
        (h) =>
            h.service === hit.service &&
            h.method === hit.method &&
            h.path === hit.path &&
            hit.at - h.at <= REPEAT_WINDOW_MS
    );
    const merged: ActivityHit = {
        ...hit,
        count: (repeat?.count ?? 0) + 1,
    };
    return {
        ...state,
        hits: [
            merged,
            ...state.hits.filter((h) => h.id !== hit.id && h !== repeat),
        ].slice(0, MAX_HITS),
        arrivals: [
            hit.at,
            ...(state.arrivals ?? []).filter(
                (t) => hit.at - t <= ACTIVITY_WINDOW_MS
            ),
        ],
    };
}

export function normalizePath(uri: string): string {
    try {
        const url = new URL(uri, 'http://x');
        for (const param of NOISE_PARAMS) {
            url.searchParams.delete(param);
        }
        const search = url.searchParams.toString();
        return search ? `${url.pathname}?${search}` : url.pathname;
    } catch {
        return uri;
    }
}

function isStatic(path: string): boolean {
    return STATIC_PATH.test(path.split('?')[0] ?? path);
}

export function applyOperatorEvent(
    state: ActivityState,
    raw: string,
    now: number
): ActivityState {
    if (!state.key || !raw.includes(state.key)) {
        return state;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return state;
    }
    const event = asRecord(parsed);
    if (event?.['session_key'] !== state.key) {
        return state;
    }
    const data = asRecord(event['data']);
    const service = asString(event['service_name']);
    const origin = `${asString(event['cluster'])}/${service}`;
    const request = asRecord(data?.['http_request']);
    if (request) {
        if (request['mode'] === 'filtered') {
            return state;
        }
        const method = asString(request['method']);
        const path = normalizePath(asString(request['uri']));
        if (isStatic(path)) {
            return state;
        }
        const id = correlationId(origin, request) ?? `${origin}/${now}`;
        return mergeHit(state, {
            id,
            at: now,
            service,
            method,
            path,
            status: null,
            kind: 'http',
        });
    }
    const queue = queueMessage(data);
    if (queue) {
        if (queue.mode === 'filtered') {
            return state;
        }
        return mergeHit(state, {
            id: `${origin}/${queue.broker}/${queue.name}/${now}`,
            at: now,
            service,
            method: queue.broker,
            path: queue.name,
            status: null,
            kind: 'queue',
        });
    }
    const response = asRecord(data?.['http_response']);
    const status = response?.['status'];
    const id = response ? correlationId(origin, response) : null;
    if (!id || typeof status !== 'number') {
        return state;
    }
    const awaiting = (h: ActivityHit) => h.id === id && h.status === null;
    if (!state.hits.some(awaiting)) {
        return state;
    }
    return {
        ...state,
        hits: state.hits.map((h) => (awaiting(h) ? { ...h, status } : h)),
    };
}

export interface ServiceRequest {
    kind: 'http' | 'queue';
    method: string;
    path: string;
    count: number;
    status: number | null;
}

export interface ServiceActivity {
    service: string;
    at: number;
    count: number;
    messages: number;
    requests: ServiceRequest[];
}

export function groupByService(hits: ActivityHit[]): ServiceActivity[] {
    const services = new Map<string, ServiceActivity>();
    for (const hit of hits) {
        let group = services.get(hit.service);
        if (!group) {
            group = {
                service: hit.service,
                at: hit.at,
                count: 0,
                messages: 0,
                requests: [],
            };
            services.set(hit.service, group);
        }
        const count = hit.count ?? 1;
        group.count += count;
        if (hit.kind === 'queue') {
            group.messages += count;
        }
        const existing = group.requests.find(
            (r) => r.method === hit.method && r.path === hit.path
        );
        if (existing) {
            existing.count += count;
        } else {
            group.requests.push({
                kind: hit.kind ?? 'http',
                method: hit.method,
                path: hit.path,
                count,
                status: hit.status,
            });
        }
    }
    return [...services.values()];
}

export function recentCount(
    state: ActivityState,
    now: number,
    windowMs: number = ACTIVITY_WINDOW_MS
): number {
    return (state.arrivals ?? []).filter((t) => now - t <= windowMs).length;
}
