import '@metalbear/ui/styles.css';
import { refreshIconIndicator } from './util';
import type { Config, StoredConfig } from './types';
import { STORAGE_KEYS, ALL_RESOURCE_TYPES } from './types';
import { capture, emitUserBlocked, emitUserSucceeded } from './analytics';
import {
    isRegex,
    parseHeader,
    decodeConfig,
    promptForValidHeader,
} from './configCore';
import { joinMatchingSession } from './joinSession';

// Re-exported so existing importers (and tests) keep using `./config`.
export { isRegex, parseHeader, decodeConfig, promptForValidHeader };
export { joinMatchingSession };

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
    return storeHeaderConfig(
        STORAGE_KEYS.DEFAULTS,
        headerName,
        headerValue,
        scope
    );
}

export function storeOverride(
    headerName: string,
    headerValue: string,
    scope?: string
): Promise<void> {
    return storeHeaderConfig(
        STORAGE_KEYS.OVERRIDE,
        headerName,
        headerValue,
        scope
    );
}

function storeHeaderConfig(
    storageKey: typeof STORAGE_KEYS.DEFAULTS | typeof STORAGE_KEYS.OVERRIDE,
    headerName: string,
    headerValue: string,
    scope?: string
): Promise<void> {
    return new Promise((resolve) => {
        const config: StoredConfig = {
            headerName,
            headerValue,
            ...(scope !== undefined ? { scope } : {}),
        };
        chrome.storage.local.set({ [storageKey]: config }, () => {
            if (chrome.runtime.lastError) {
                console.error(
                    `Failed to store ${storageKey}:`,
                    chrome.runtime.lastError.message
                );
            }
            resolve();
        });
    });
}

function clearJoinedSession(): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.remove(
            [
                STORAGE_KEYS.JOINED_KEY,
                STORAGE_KEYS.JOINED_SESSION_NAME,
                STORAGE_KEYS.JOINED_HEADER,
                STORAGE_KEYS.JOINED_VALUE,
                STORAGE_KEYS.SCOPE_PATTERNS,
            ],
            () => resolve()
        );
    });
}

function setHeaderRule(
    header: string,
    scope?: string,
    storageKey:
        | typeof STORAGE_KEYS.DEFAULTS
        | typeof STORAGE_KEYS.OVERRIDE = STORAGE_KEYS.DEFAULTS
): Promise<void> {
    return new Promise((resolve, reject) => {
        let key: string, value: string;

        try {
            ({ key, value } = parseHeader(header));
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            alert(error.message);
            reject(error);
            return;
        }

        // Use scope if provided, otherwise apply to all URLs.
        // '|' is a left anchor in Chrome DNR urlFilter syntax meaning "start of URL",
        // so '|' alone matches all URLs.
        // See: https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#type-RuleCondition
        const urlFilter = scope && scope.length > 0 ? scope : '|';

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
                        emitUserBlocked('configure_failed', 'user_action', {
                            error:
                                chrome.runtime.lastError.message ??
                                'DNR update failed',
                        });
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        console.warn('Header rule set successfully.');
                        refreshIconIndicator(rules.length);

                        const storeConfig =
                            storageKey === STORAGE_KEYS.OVERRIDE
                                ? storeOverride
                                : storeDefaults;
                        const clearSession =
                            storageKey === STORAGE_KEYS.OVERRIDE
                                ? clearJoinedSession()
                                : Promise.resolve();
                        void clearSession
                            .then(() =>
                                storeConfig(key.trim(), value.trim(), scope)
                            )
                            .then(resolve);
                    }
                }
            );
        });
    });
}

// Listener for the configuration link page
async function handleConfigLink(): Promise<void> {
    const params = new URLSearchParams(location.search);
    const encoded = params.get('payload');
    const storageKey =
        params.get('storage') === STORAGE_KEYS.OVERRIDE
            ? STORAGE_KEYS.OVERRIDE
            : STORAGE_KEYS.DEFAULTS;

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
        if (storageKey === STORAGE_KEYS.OVERRIDE) {
            const { key, value } = parseHeader(header);
            const joinedKey = await joinMatchingSession(key, value);
            if (joinedKey) {
                capture('extension_config_received', {
                    is_regex: isRegex(config.header_filter),
                    has_scope: !!scope,
                    joined_session: true,
                });
                emitUserSucceeded('joined', 'user_action', { key: joinedKey });
                alert(`Joined live session "${joinedKey}"!`);
                return;
            }
        }
        await setHeaderRule(header, scope, storageKey);
        const scopeMsg = scope ? ` (scope: ${scope})` : ' (all URLs)';
        capture('extension_config_received', {
            is_regex: isRegex(config.header_filter),
            has_scope: !!scope,
        });
        emitUserSucceeded('configured', 'user_action', {
            hasJoinParam: !!scope,
        });
        alert('Header set successfully!' + scopeMsg);
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        emitUserBlocked('configure_failed', 'user_action', { error: errMsg });
        alert('Failed to set header: ' + errMsg);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    void handleConfigLink();
});
