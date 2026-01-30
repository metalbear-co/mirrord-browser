/**
 * UI strings used throughout the extension.
 * Centralized here for easy maintenance and potential i18n.
 */
export const STRINGS = {
    // Page titles
    HEADER_TITLE: 'Mirrord Header Injector',

    // Section titles
    SECTION_ACTIVE_HEADER: 'Active Header',
    SECTION_CONFIGURE_HEADER: 'Configure Header',

    // Form labels
    LABEL_HEADER_NAME: 'Header Name',
    LABEL_HEADER_VALUE: 'Header Value',
    LABEL_URL_SCOPE: 'URL Scope',

    // Placeholders
    PLACEHOLDER_HEADER_NAME: 'X-MIRRORD-USER',
    PLACEHOLDER_HEADER_VALUE: 'testuser',
    PLACEHOLDER_SCOPE: 'Leave empty for all URLs',

    // Tooltips
    TOOLTIP_HEADERS: 'Headers are injected into matching requests',
    TOOLTIP_SCOPE: 'Use * as wildcard. Example: *://api.example.com/*',

    // Buttons
    BTN_SAVE: 'Save',
    BTN_SAVING: 'Saving...',
    BTN_SAVED: 'Saved!',
    BTN_RESET: 'Reset to Default',
    BTN_RESETTING: 'Resetting...',
    BTN_RESET_DONE: 'Reset!',

    // Messages
    MSG_NO_ACTIVE_HEADERS: 'No active headers',
    MSG_ALL_URLS: 'All URLs',

    // Errors
    ERR_HEADER_REQUIRED: 'Header name and value are required',
    ERR_REMOVE_RULE: 'Failed to remove rule',
    ERR_SAVE_FAILED: 'Failed to save',
    ERR_NO_DEFAULTS: 'No defaults available',
    ERR_RESET_FAILED: 'Failed to reset',
} as const;

/**
 * Badge indicator settings.
 */
export const BADGE = {
    COLOR: '#ADD8E6',
    ACTIVE: '✓',
    INACTIVE: '',
} as const;
