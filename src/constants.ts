/**
 * UI strings used throughout the extension.
 * Centralized here for easy maintenance and potential i18n.
 */
export const STRINGS = {
    // Page
    PAGE_TITLE: 'mirrord',
    HEADER_TITLE: 'mirrord header injector',

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
    TOOLTIP_SCOPE: 'Use * as wildcard. Example: *://api.example.com/*',
    HINT_ICON: 'ⓘ',

    // Buttons
    BTN_SAVE: 'Save',
    BTN_SAVING: 'Saving...',
    BTN_SAVED: 'Saved!',
    BTN_REMOVE: 'Remove',

    // Messages
    MSG_NO_ACTIVE_HEADER: 'No active header',
    MSG_ALL_URLS: 'All URLs',
    MSG_HEADER_SET_SUCCESS: 'Header set successfully!',
    MSG_DEFAULTS_STORED: 'Defaults stored successfully.',
    MSG_HEADER_RULE_SET: 'Header rule set successfully.',
    MSG_SCOPE_PREFIX: ' (scope: ',
    MSG_SCOPE_ALL: ' (all URLs)',
    MSG_NO_INPUT: 'No input provided.',
    MSG_PATTERN_MISMATCH: 'Input does not match the required pattern.',
    MSG_ENTER_HEADER_PATTERN: 'Enter a header that matches pattern:\n',

    // Errors
    ERR_HEADER_REQUIRED: 'Header name and value are required',
    ERR_REMOVE_RULE: 'Failed to remove rule:',
    ERR_SAVE_PREFIX: 'Failed to save: ',
    ERR_INVALID_HEADER: 'Invalid header format.',
    ERR_INVALID_CONFIG: 'Invalid configuration',
    ERR_STORE_DEFAULTS: 'Failed to store defaults:',
    ERR_SET_HEADER: 'Failed to set header:',
    ERR_CONFIG_MISSING:
        'Configuration data missing, please make sure to copy the complete link.',
    ERR_NO_HEADER_FILTER: 'no header filter in the config',
} as const;

/**
 * Badge indicator settings.
 */
export const BADGE = {
    COLOR: '#ADD8E6',
    ACTIVE: '✓',
    INACTIVE: '',
} as const;

/**
 * Element IDs used in the popup HTML.
 */
export const ELEMENT_IDS = {
    RULES_LIST: 'rulesList',
    HEADER_NAME: 'headerName',
    HEADER_VALUE: 'headerValue',
    SCOPE: 'scope',
    SAVE_BTN: 'saveBtn',
} as const;
