/**
 * Configuration payload decoded from the URL parameter.
 * This is what mirrord CLI sends to the extension.
 */
export type Config = {
    header_filter: string;
};

/**
 * Stored configuration in chrome.storage.local.
 * Contains the parsed header key-value pair.
 */
export type StoredConfig = {
    headerName: string;
    headerValue: string;
};

/**
 * Keys used in chrome.storage.local.
 */
export const STORAGE_KEYS = {
    DEFAULTS: 'defaults',
} as const;
