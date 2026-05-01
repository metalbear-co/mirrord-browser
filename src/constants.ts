export const STRINGS = {
    HEADER_TITLE: 'Mirrord Header Injector',

    SECTION_ACTIVE_HEADER: 'Active Header',
    SECTION_CONFIGURE_HEADER: 'Configure Header',

    LABEL_HEADER_NAME: 'Header Name',
    LABEL_HEADER_VALUE: 'Header Value',
    LABEL_URL_SCOPE: 'URL Scope',
    LABEL_NAMESPACE: 'Namespace',

    PLACEHOLDER_HEADER_NAME: 'X-MIRRORD-USER',
    PLACEHOLDER_HEADER_VALUE: 'testuser',
    PLACEHOLDER_SCOPE: 'Leave empty for all URLs',

    TOOLTIP_HEADERS: 'Headers are injected into matching requests',
    TOOLTIP_SCOPE: 'Use * as wildcard. Example: *://api.example.com/*',

    BTN_SAVE: 'Save',
    BTN_SAVING: 'Saving...',
    BTN_SAVED: 'Saved!',
    BTN_RESET: 'Reset to Default',
    BTN_RESETTING: 'Resetting...',
    BTN_RESET_DONE: 'Reset!',
    BTN_JOIN: 'Join',
    BTN_LEAVE: 'Leave',
    BTN_DISMISS: 'Dismiss',

    MSG_NO_ACTIVE_HEADERS: 'No active headers',
    MSG_ALL_URLS: 'All URLs',
    MSG_NOT_CONFIGURED: 'Not configured',
    MSG_NOT_CONFIGURED_HINT: 'Run this in your terminal to connect.',
    MSG_MIRRORD_UI_COMMAND: 'mirrord ui',
    MSG_NO_ACTIVE_SESSIONS: 'No active sessions yet.',
    MSG_LOCAL_SESSIONS_ONLY: 'Showing local sessions only.',
    MSG_INSTALL_OPERATOR: 'Install the operator',
    MSG_INSTALL_OPERATOR_TO_VIEW_REMOTE: 'to view your teammates’ sessions.',
    MSG_ALL_NAMESPACES: 'All',
    MSG_LIVE_SESSIONS: 'Live sessions',
    MSG_SHOW_MORE: (n: number) => `Show ${n} more session${n === 1 ? '' : 's'}`,
    MSG_SHOW_LESS: 'Show less',
    MSG_USE_SEARCH_HINT: 'Use search to narrow down',
    MSG_SESSION_LIVE: 'Session live',
    MSG_SESSION_ENDED: 'Session ended',
    MSG_ROUTING_TRAFFIC: 'Routing your traffic',
    MSG_AVAILABLE: 'Available',
    MSG_JOINED_TAG: 'Joined',
    MSG_ACTIVE: 'Active',
    MSG_INACTIVE: 'Inactive',
    MSG_LOADING: 'Loading…',
    MSG_INJECTION_TOOLTIP:
        'When on, the extension injects the saved header into matching requests. Toggle off to pause injection without losing your config.',
    LABEL_TOGGLE_INJECTION: 'Toggle header injection',
    LABEL_INFO: 'ⓘ',
    LABEL_MIRRORD: 'mirrord',
    LABEL_HEADER_INJECTOR: 'Header Injector',
    BTN_COPIED: 'Copied!',
    BTN_COPY_CONFIG_LINK: 'Copy config link',
    BTN_SHARE_CONFIG: 'Share configuration',
    MSG_MIRRORD_UI_CONNECTED: 'mirrord ui connected',
    MSG_MIRRORD_UI_CONNECTED_HINT:
        'You can close this tab and open the extension popup.',
    MSG_JOINED_SESSION: 'Joined session',
    MSG_JOINED_SESSION_HINT: 'Injecting',
    MSG_KEY_NOT_VISIBLE: 'Key not visible',
    MSG_KEY_NOT_VISIBLE_HINT:
        'is not listed by your mirrord ui. It may have ended, or your credentials cannot see it.',
    MSG_MISSING_CONFIG: 'Missing configuration',
    MSG_MISSING_CONFIG_HINT:
        'Expected backend+token, or join parameter in the URL.',
    MSG_UI_NOT_CONFIGURED: 'mirrord ui not configured',
    MSG_UI_NOT_CONFIGURED_HINT:
        'Run mirrord ui first and open the configure URL it prints.',

    TAB_SESSIONS: 'Sessions',
    TAB_MANUAL: 'Override',
    LABEL_URL_SCOPE_HEADING: 'URL scope',
    LABEL_HEADER_OBSERVED: 'header observed',
    LABEL_INJECTING: 'injecting',
    BTN_COPY_HEADER: 'Copy header',
    PLACEHOLDER_URL_PATTERN: '+ pattern',
    LABEL_REMOVE_PATTERN: 'Remove pattern',
    PLACEHOLDER_SEARCH_SESSIONS: 'search sessions',
    LABEL_SEARCH_SESSIONS: 'Search sessions',
    MSG_NO_SESSIONS_MATCH_QUERY: 'No sessions match your search.',
    MSG_PATTERN_COUNT: (n: number) => `${n} pattern${n === 1 ? '' : 's'}`,

    ERR_HEADER_REQUIRED: 'Header name and value are required',
    ERR_REMOVE_RULE: 'Failed to remove rule',
    ERR_SAVE_FAILED: 'Failed to save',
    ERR_NO_DEFAULTS: 'No defaults available',
    ERR_RESET_FAILED: 'Failed to reset',
    ERR_WS_PARSE: 'Received malformed session update from mirrord ui',
    ERR_WS_CONNECTION: 'Lost connection to mirrord ui',
    ERR_KEY_NOT_VISIBLE: (key: string) =>
        `Key "${key}" not visible in current session list`,

    SETTINGS_TITLE: 'Settings',
    SETTINGS_ANALYTICS_LABEL: 'Usage analytics',
    SETTINGS_ANALYTICS_DESCRIPTION:
        'Help improve mirrord by sending anonymous usage data.',
} as const;

export const BADGE = {
    COLOR: '#ADD8E6',
    ACTIVE: '✓',
    INACTIVE: '',
} as const;

export const TAB = {
    SESSIONS: 'sessions',
    MANUAL: 'manual',
} as const;

export type TabId = (typeof TAB)[keyof typeof TAB];

export const SESSION_NOTIFICATION_TYPE = {
    SESSION_ADDED: 'session_added',
    SESSION_REMOVED: 'session_removed',
    OPERATOR_SESSION_ADDED: 'operator_session_added',
    OPERATOR_SESSION_REMOVED: 'operator_session_removed',
    OPERATOR_SESSION_UPDATED: 'operator_session_updated',
} as const;

export const ROW_TAG = {
    JOINED: 'joined',
    LOCAL: 'local',
} as const;

export type RowTag = (typeof ROW_TAG)[keyof typeof ROW_TAG];

export const NAMESPACE_ALL_SENTINEL = '__all__';

export const CONFIGURE_STATUS = {
    LOADING: 'loading',
    CONNECTED: 'connected',
    JOINED: 'joined',
    KEY_NOT_VISIBLE: 'key-not-visible',
    MISSING_CONFIG: 'missing-config',
    NOT_CONFIGURED: 'not-configured',
} as const;

export type ConfigureStatusKind =
    (typeof CONFIGURE_STATUS)[keyof typeof CONFIGURE_STATUS];
