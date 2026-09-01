export interface Config {
    header_filter: string;
    inject_scope?: string;
}

export interface StoredConfig {
    headerName: string;
    headerValue: string;
    scope?: string;
}

export interface HeaderRule {
    id: number;
    header: string;
    value: string;
    scope: string;
}

export const STORAGE_KEYS = {
    DEFAULTS: 'defaults',
    OVERRIDE: 'override',
    ANALYTICS_OPT_OUT: 'analytics_opt_out',
    MIRRORD_UI_BACKEND: 'mirrord_ui_backend',
    MIRRORD_UI_TOKEN: 'mirrord_ui_token',
    JOINED_KEY: 'joined_key',
    JOINED_SESSION_NAME: 'joined_session_name',
    JOINED_HEADER: 'joined_header',
    JOINED_VALUE: 'joined_value',
    SCOPE_PATTERNS: 'scope_patterns',
    ACTIVE_TAB: 'active_tab',
    THEME: 'theme',
    SELECTED_CONTEXT: 'selected_context',
} as const;

export type ThemePref = 'system' | 'light' | 'dark';

export const ALL_RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
    'main_frame' as chrome.declarativeNetRequest.ResourceType,
    'sub_frame' as chrome.declarativeNetRequest.ResourceType,
    'stylesheet' as chrome.declarativeNetRequest.ResourceType,
    'script' as chrome.declarativeNetRequest.ResourceType,
    'image' as chrome.declarativeNetRequest.ResourceType,
    'font' as chrome.declarativeNetRequest.ResourceType,
    'object' as chrome.declarativeNetRequest.ResourceType,
    'xmlhttprequest' as chrome.declarativeNetRequest.ResourceType,
    'ping' as chrome.declarativeNetRequest.ResourceType,
    'media' as chrome.declarativeNetRequest.ResourceType,
    'websocket' as chrome.declarativeNetRequest.ResourceType,
    'other' as chrome.declarativeNetRequest.ResourceType,
];

export interface MirrordUiConfig {
    backend: string;
    token: string;
}

export interface OperatorSessionHttpFilter {
    headerFilter: string | null;
}

export interface OperatorSessionTarget {
    kind: string;
    name: string;
    container: string;
}

export interface OperatorSessionOwner {
    username: string;
    k8sUsername: string;
}

// An entry of `sessions`. Before operator status carries dedicated preview session info, preview
// environments are also folded into this list.
export interface OperatorSessionSummary {
    id: string;
    key: string;
    namespace: string;
    owner: OperatorSessionOwner | null;
    target: OperatorSessionTarget | null;
    createdAt: string | null;
    httpFilter?: OperatorSessionHttpFilter | null;
}

export const PREVIEW_PHASES = [
    'initializing',
    'waiting',
    'ready',
    'failed',
    'idle',
    'paused',
    'unknown',
] as const;

export type PreviewPhase = (typeof PREVIEW_PHASES)[number];

export interface OperatorPreviewSession {
    id: string;
    key: string;
    namespace: string;
    target: OperatorSessionTarget | null;
    createdAt: string | null;
    phase: PreviewPhase;
    // Only set while `phase` is `idle`.
    idleSecs?: number;
}

interface SessionBase {
    id: string;
    key: string;
    namespace: string;
    target: OperatorSessionTarget | null;
    createdAt: string | null;
}

// A session started with `mirrord exec` or `mirrord ci`
export interface ExecSession extends SessionBase {
    kind: 'exec';
    owner: OperatorSessionOwner | null;
    httpFilter?: OperatorSessionHttpFilter | null;
}

// A preview environment.
export interface PreviewSession extends SessionBase {
    kind: 'preview';
    phase: PreviewPhase;
    // Only set while `phase` is `idle`.
    idleSecs?: number;
}

export type ClusterSession = ExecSession | PreviewSession;

export type OperatorWatchStatus =
    | { status: 'not_started' }
    | { status: 'watching' }
    | { status: 'error'; message: string }
    | { status: 'unavailable'; reason: string };

export interface OperatorSessionsV1Response {
    by_key: Record<string, OperatorSessionSummary[]>;
    sessions: OperatorSessionSummary[];
    watch_status: OperatorWatchStatus;
}

export interface OperatorSessionsResponse {
    by_key: Record<string, ClusterSession[]>;
    sessions: ClusterSession[];
    watch_status: OperatorWatchStatus;
}

// A kube context and its default namespace, from `GET /api/v2/kube/contexts`.
export interface KubeContext {
    name: string;
    namespace: string | null;
}

export interface ContextsResponse {
    current: string | null;
    contexts: KubeContext[];
}

// `GET /api/v2/operator/sessions?context=`. Namespace is filtered client-side, so this doesn't take
// a namespace param.
export interface OperatorSessionsV2Response {
    context: string | null;
    status: 'available' | 'unavailable';
    reason?: string;
    sessions: OperatorSessionSummary[];
    // Absent when there are no previews, or against an operator that predates the
    // dedicated preview list.
    previewSessions?: OperatorPreviewSession[];
}

export type SessionNotification =
    | { type: 'session_added'; session: unknown }
    | { type: 'session_removed'; session_id: string }
    | { type: 'operator_session_added'; session: OperatorSessionSummary }
    | { type: 'operator_session_removed'; id: string }
    | { type: 'operator_session_updated'; session: OperatorSessionSummary };
