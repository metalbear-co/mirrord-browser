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
 * Keys used in chrome.storage.local.
 */
export const STORAGE_KEYS = {
    DEFAULTS: 'defaults',
} as const;
