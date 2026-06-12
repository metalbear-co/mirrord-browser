import '@metalbear/ui/styles.css';
import {
    buildDnrRule,
    getDynamicRules,
    refreshIconIndicator,
    sessionInjectionPair,
    storageGet,
    storageSet,
    updateDynamicRules,
} from './util';
import {
    Config,
    StoredConfig,
    OperatorSessionSummary,
    STORAGE_KEYS,
    ALL_RESOURCE_TYPES,
} from './types';
import { fetchOperatorSessions } from './hooks/useMirrordUi';
import { capture, emitUserBlocked, emitUserSucceeded } from './analytics';

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
        emitUserBlocked('configure_invalid', 'user_action', {
            error: 'Invalid header format.',
        });
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
        emitUserBlocked('configure_invalid', 'user_action', {
            error: 'Invalid configuration',
        });
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
            scope,
        };
        chrome.storage.local.set({ [storageKey]: config }, () => {
            if (chrome.runtime.lastError) {
                console.error(
                    `Failed to store ${storageKey}:`,
                    chrome.runtime.lastError.message
                );
            } else {
                console.log(`${storageKey} stored successfully.`);
            }
            resolve();
        });
    });
}

/**
 * Look for a live operator session whose injection header matches the shared
 * header, and join it (same storage/DNR shape as the popup join flow).
 * @param headerName the HTTP header name from the shared link
 * @param headerValue the HTTP header value from the shared link
 * @returns the joined session key, or null when mirrord ui isn't configured
 * or no live session matches — the caller then falls back to a manual rule
 */
export async function joinMatchingSession(
    headerName: string,
    headerValue: string
): Promise<string | null> {
    const stored = await storageGet([
        STORAGE_KEYS.MIRRORD_UI_BACKEND,
        STORAGE_KEYS.MIRRORD_UI_TOKEN,
        STORAGE_KEYS.SCOPE_PATTERNS,
    ]);
    const backend = stored[STORAGE_KEYS.MIRRORD_UI_BACKEND] as
        | string
        | undefined;
    const token = stored[STORAGE_KEYS.MIRRORD_UI_TOKEN] as string | undefined;
    if (!backend || !token) return null;

    let sessions: OperatorSessionSummary[];
    try {
        ({ sessions } = await fetchOperatorSessions(backend, token));
    } catch {
        return null;
    }

    const target = sessions.find((s) => {
        const pair = sessionInjectionPair(s);
        return (
            pair.header.toLowerCase() === headerName.toLowerCase() &&
            pair.value === headerValue
        );
    });
    if (!target) return null;

    const { header, value } = sessionInjectionPair(target);
    const scope =
        (stored[STORAGE_KEYS.SCOPE_PATTERNS] as string[] | undefined) ?? [];
    const existing = await getDynamicRules();
    await updateDynamicRules({
        removeRuleIds: existing.map((r) => r.id),
        addRules: buildDnrRule(header, value, scope),
    });
    await storageSet({
        [STORAGE_KEYS.JOINED_KEY]: target.key,
        [STORAGE_KEYS.JOINED_SESSION_NAME]: target.id,
        [STORAGE_KEYS.JOINED_HEADER]: header,
        [STORAGE_KEYS.JOINED_VALUE]: value,
    });
    refreshIconIndicator(1);
    return target.key;
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
                        emitUserBlocked('configure_failed', 'user_action', {
                            error:
                                chrome.runtime.lastError.message ??
                                'DNR update failed',
                        });
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        console.log('Header rule set successfully.');
                        refreshIconIndicator(rules.length);

                        const storeConfig =
                            storageKey === STORAGE_KEYS.OVERRIDE
                                ? storeOverride
                                : storeDefaults;
                        const clearSession =
                            storageKey === STORAGE_KEYS.OVERRIDE
                                ? clearJoinedSession()
                                : Promise.resolve();
                        clearSession
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
document.addEventListener('DOMContentLoaded', async () => {
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
});
