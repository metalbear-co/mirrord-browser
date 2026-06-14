import type Browser from 'webextension-polyfill';

// Cross-browser API type aliases sourced from webextension-polyfill, so the rest of the
// codebase never references the `chrome.*` global namespace directly.
export type DnrResourceType = Browser.DeclarativeNetRequest.ResourceType;
export type DnrRule = Browser.DeclarativeNetRequest.Rule;
export type DnrUpdateOptions =
    Browser.DeclarativeNetRequest.UpdateDynamicRulesOptionsType;
export type RuntimePort = Browser.Runtime.Port;
export type RuntimeMessageSender = Browser.Runtime.MessageSender;
export type StorageChange = Browser.Storage.StorageChange;

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
    JOINED_HEADER: 'joined_header',
    JOINED_VALUE: 'joined_value',
    SCOPE_PATTERNS: 'scope_patterns',
    ACTIVE_TAB: 'active_tab',
    THEME: 'theme',
} as const;

export type ThemePref = 'system' | 'light' | 'dark';

export const ALL_RESOURCE_TYPES: DnrResourceType[] = [
    'main_frame',
    'sub_frame',
    'stylesheet',
    'script',
    'image',
    'font',
    'object',
    'xmlhttprequest',
    'ping',
    'media',
    'websocket',
    'other',
];

export type MirrordUiConfig = {
    backend: string;
    token: string;
};

export type OperatorSessionHttpFilter = {
    headerFilter: string | null;
};

export type OperatorSessionSummary = {
    id: string;
    key: string;
    namespace: string;
    owner: { username: string; k8sUsername: string };
    target: { kind: string; name: string; container: string } | null;
    createdAt: string;
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
    | { type: 'operator_session_removed'; id: string }
    | { type: 'operator_session_updated'; session: OperatorSessionSummary };
