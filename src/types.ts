/**
 * Configuration payload decoded from the URL parameter.
 * This is what mirrord CLI sends to the extension.
 */
export type Config = {
    header_filter: string;
    /** URL pattern to scope header injection (optional, defaults to all URLs) */
    inject_scope?: string;
};

/**
 * Stored configuration in chrome.storage.local.
 * Contains the parsed header key-value pair and scope.
 */
export type StoredConfig = {
    headerName: string;
    headerValue: string;
    /** URL pattern for header injection scope (undefined means all URLs) */
    scope?: string;
};

/**
 * Parsed header rule for display in the popup UI.
 */
export type HeaderRule = {
    id: number;
    header: string;
    value: string;
    scope: string;
};

/**
 * Keys used in chrome.storage.local.
 */
export const STORAGE_KEYS = {
    /** Original config from CLI - used for "Reset to Default" */
    DEFAULTS: 'defaults',
    /** User's custom overrides from popup UI */
    OVERRIDE: 'override',
} as const;
