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

export interface OperatorSessionSummary {
    id: string;
    key: string;
    namespace: string;
    owner: { username: string; k8sUsername: string } | null;
    target: { kind: string; name: string; container: string } | null;
    createdAt: string | null;
    httpFilter?: OperatorSessionHttpFilter | null;
}

export type OperatorWatchStatus =
    | { status: 'not_started' }
    | { status: 'watching' }
    | { status: 'error'; message: string }
    | { status: 'unavailable'; reason: string };

export interface OperatorSessionsResponse {
    by_key: Record<string, OperatorSessionSummary[]>;
    sessions: OperatorSessionSummary[];
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
// a namespace param. `OperatorSession` is the same shape the extension already uses for a summary.
export interface OperatorSessionsV2Response {
    context: string | null;
    status: 'available' | 'unavailable';
    reason?: string;
    sessions: OperatorSessionSummary[];
}

export type SessionNotification =
    | { type: 'session_added'; session: unknown }
    | { type: 'session_removed'; session_id: string }
    | { type: 'operator_session_added'; session: OperatorSessionSummary }
    | { type: 'operator_session_removed'; id: string }
    | { type: 'operator_session_updated'; session: OperatorSessionSummary };
