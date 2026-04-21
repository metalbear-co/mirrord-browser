export type Config = {
    header_filter: string;
    inject_scope?: string;
};

export type StoredConfig = {
    headerName: string;
    headerValue: string;
    scope?: string;
};

export type HeaderRule = {
    id: number;
    header: string;
    value: string;
    scope: string;
};

export const STORAGE_KEYS = {
    DEFAULTS: 'defaults',
    OVERRIDE: 'override',
    ANALYTICS_OPT_OUT: 'analytics_opt_out',
    MIRRORD_UI_BACKEND: 'mirrord_ui_backend',
    MIRRORD_UI_TOKEN: 'mirrord_ui_token',
    JOINED_KEY: 'joined_key',
    JOINED_SESSION_NAME: 'joined_session_name',
} as const;

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

export type MirrordUiConfig = {
    backend: string;
    token: string;
};

export type OperatorSessionHttpFilter = {
    headerFilter: string | null;
};

export type OperatorSessionSummary = {
    name: string;
    key: string | null;
    namespace: string;
    owner: { username: string; k8sUsername: string } | null;
    target: { kind: string; name: string; container: string } | null;
    createdAt: string | null;
    httpFilter?: OperatorSessionHttpFilter | null;
};

export type OperatorWatchStatus =
    | { status: 'not_started' }
    | { status: 'watching' }
    | { status: 'error'; message: string }
    | { status: 'unavailable'; reason: string };

export type OperatorSessionsResponse = {
    by_key: Record<string, OperatorSessionSummary[]>;
    sessions: OperatorSessionSummary[];
    watch_status: OperatorWatchStatus;
};

export type SessionNotification =
    | { type: 'session_added'; session: unknown }
    | { type: 'session_removed'; session_id: string }
    | { type: 'operator_session_added'; session: OperatorSessionSummary }
    | { type: 'operator_session_removed'; name: string }
    | { type: 'operator_session_updated'; session: OperatorSessionSummary };
