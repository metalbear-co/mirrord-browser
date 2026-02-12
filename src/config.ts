import '@metalbear/ui/styles.css';
import { refreshIconIndicator } from './util';
import {
    Config,
    StoredConfig,
    STORAGE_KEYS,
    ALL_RESOURCE_TYPES,
} from './types';

/**
 * Check if the input string is a regex or an explicit HTTP header.
 * @param str a string value that's either a regex or an explicit HTTP header
 * @returns
 */
export function isRegex(str: string): boolean {
    const regexIndicators = [
        /\\[dDsSwWbB]/, // escaped shorthand classes
        /\\./, // escaped dot
        /[.*+?^${}()|[\]]/, // unescaped special characters
    ];
    return regexIndicators.some((pattern) => pattern.test(str));
}

/**
 * Prase the input string value and return an HTTP header key-value pair.
 * @param header a string value to be parsed as HTTP header key and value
 * @returns HTTP header key-value pair
 */
export function parseHeader(header: string): { key: string; value: string } {
    const [key, value] = header.split(':').map((s) => s.trim());
    if (!key || !value) {
        throw new Error('Invalid header format.');
    }
    return { key, value };
}

/**
 * Decode the given string into a configuration object.
 * @param encoded a base64 encoded string configuration payload
 * @returns deserialized configuration object
 */
export function decodeConfig(encoded: string): Config {
    const decoded = atob(encoded);
    try {
        return JSON.parse(decoded) as Config;
    } catch (error) {
        throw new Error('Invalid configuration');
    }
}

/**
 * Store the given header configuration as defaults in chrome.storage.local.
 * @param headerName the HTTP header name
 * @param headerValue the HTTP header value
 * @param scope optional URL pattern for scoping header injection
 * @returns Promise that resolves when storage is complete
 */
export function storeDefaults(
    headerName: string,
    headerValue: string,
    scope?: string
): Promise<void> {
    return new Promise((resolve) => {
        const defaults: StoredConfig = {
            headerName,
            headerValue,
            scope,
        };
        chrome.storage.local.set({ [STORAGE_KEYS.DEFAULTS]: defaults }, () => {
            if (chrome.runtime.lastError) {
                console.error(
                    'Failed to store defaults:',
                    chrome.runtime.lastError.message
                );
            } else {
                console.log('Defaults stored successfully.');
            }
            resolve();
        });
    });
}

/**
 * Prompt the user for an HTTP header value that matches the given pattern.
 * @param pattern a regex pattern for HTTP headers
 * @returns
 */
export function promptForValidHeader(pattern: string): string {
    const regex = new RegExp(pattern);
    let header: string | null = null;

    while (!header) {
        const input = prompt(
            `Enter a header that matches pattern:\n${pattern}`
        );
        if (!input) {
            alert('No input provided.');
            continue;
        }
        if (!regex.test(input)) {
            alert('Input does not match the required pattern.');
            continue;
        }
        header = input;
    }

    return header;
}

function setHeaderRule(header: string, scope?: string): Promise<void> {
    return new Promise((resolve, reject) => {
        let key: string, value: string;

        try {
            ({ key, value } = parseHeader(header));
        } catch (err) {
            alert((err as Error).message);
            reject(err);
            return;
        }

        // Use scope if provided, otherwise apply to all URLs.
        // '|' is a left anchor in Chrome DNR urlFilter syntax meaning "start of URL",
        // so '|' alone matches all URLs.
        // See: https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#type-RuleCondition
        const urlFilter = scope || '|';

        const rules = [
            {
                id: 1,
                priority: 1,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType
                        .MODIFY_HEADERS,
                    requestHeaders: [
                        {
                            header: key.trim(),
                            operation:
                                chrome.declarativeNetRequest.HeaderOperation
                                    .SET,
                            value: value.trim(),
                        },
                    ],
                },
                condition: {
                    urlFilter,
                    resourceTypes: ALL_RESOURCE_TYPES,
                },
            },
        ];

        // remove all existing rules and add new ones
        chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
            chrome.declarativeNetRequest.updateDynamicRules(
                {
                    removeRuleIds: rules
                        .map(({ id }) => id)
                        .concat(existingRules.map((rule) => rule.id)),
                    addRules: rules,
                },
                () => {
                    if (chrome.runtime.lastError) {
                        console.error(
                            'Failed to set header:',
                            chrome.runtime.lastError.message
                        );
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        console.log('Header rule set successfully.');
                        refreshIconIndicator(rules.length);

                        // Store defaults in chrome.storage
                        storeDefaults(key.trim(), value.trim(), scope).then(
                            resolve
                        );
                    }
                }
            );
        });
    });
}

// Listener for the configuration link page
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(location.search);
    const encoded = params.get('payload');

    if (!encoded) {
        alert(
            'Configuration data missing, please make sure to copy the complete link.'
        );
        return;
    }

    const contentDiv = document.getElementById('content');
    if (!contentDiv) return;

    let config: Config;
    try {
        config = decodeConfig(encoded);
    } catch (err) {
        alert((err as Error).message);
        return;
    }

    if (!config.header_filter) {
        console.error('no header filter in the config');
        return;
    }

    const header = isRegex(config.header_filter)
        ? promptForValidHeader(config.header_filter)
        : config.header_filter;

    // Scope is set by user via popup UI, not provided by CLI.
    // This field exists for future use but will be undefined here.
    const scope = config.inject_scope;

    try {
        await setHeaderRule(header, scope);
        const scopeMsg = scope ? ` (scope: ${scope})` : ' (all URLs)';
        alert('Header set successfully!' + scopeMsg);
    } catch (err) {
        alert('Failed to set header: ' + (err as Error).message);
    }
});
