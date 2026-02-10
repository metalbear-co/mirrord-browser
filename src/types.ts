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

/**
 * All resource types for declarativeNetRequest rules.
 * Chrome's MODIFY_HEADERS rules exclude main_frame by default when resourceTypes
 * is omitted, so we must explicitly list all types to ensure headers are injected
 * on every request type (scripts, stylesheets, images, fonts, etc.).
 * See: https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#type-ResourceType
 */
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
