import '@metalbear/ui/styles.css';
import {
    buildDnrRule,
    getDynamicRules,
    refreshIconIndicator,
    sessionInjectionPair,
    storageGet,
    storageSet,
    storageRemove,
    updateDynamicRules,
} from './util';
import {
    Config,
    StoredConfig,
    OperatorSessionSummary,
    STORAGE_KEYS,
} from './types';
import { fetchOperatorSessions } from './hooks/useMirrordUi';
import { capture, emitUserBlocked, emitUserSucceeded } from './analytics';
import {
    decodeConfig,
    isRegex,
    parseHeader,
    promptForValidHeader,
} from './configCore';

// Re-exported for backwards compatibility (and unit tests import these from ./config).
export { decodeConfig, isRegex, parseHeader, promptForValidHeader };

type HeaderStorageKey =
    | typeof STORAGE_KEYS.DEFAULTS
    | typeof STORAGE_KEYS.OVERRIDE;

/**
 * Store the given header configuration under the given storage key.
 * @param storageKey DEFAULTS (CLI/link default) or OVERRIDE (user-pinned)
 * @param headerName the HTTP header name
 * @param headerValue the HTTP header value
 * @param scope optional URL pattern for scoping header injection
 * @returns Promise that resolves when storage is complete
 */
function storeHeaderConfig(
    storageKey: HeaderStorageKey,
    headerName: string,
    headerValue: string,
    scope?: string
): Promise<void> {
    const config: StoredConfig = {
        headerName,
        headerValue,
        scope,
    };
    return storageSet({ [storageKey]: config })
        .then(() => {
            console.log(`${storageKey} stored successfully.`);
        })
        .catch((err) => {
            console.error(
                `Failed to store ${storageKey}:`,
                err instanceof Error ? err.message : String(err)
            );
        });
}

/**
 * Store the given header configuration as defaults in chrome.storage.local.
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

/**
 * Store the given header configuration as a user override in chrome.storage.local.
 */
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
    return storageRemove([
        STORAGE_KEYS.JOINED_KEY,
        STORAGE_KEYS.JOINED_SESSION_NAME,
        STORAGE_KEYS.JOINED_HEADER,
        STORAGE_KEYS.JOINED_VALUE,
        STORAGE_KEYS.SCOPE_PATTERNS,
    ]);
}

async function setHeaderRule(
    header: string,
    scope?: string,
    storageKey: HeaderStorageKey = STORAGE_KEYS.DEFAULTS
): Promise<void> {
    let key: string, value: string;

    try {
        ({ key, value } = parseHeader(header));
    } catch (err) {
        alert((err as Error).message);
        throw err;
    }

    // buildDnrRule applies the header to all URLs when no scope is given (urlFilter '|',
    // a left anchor meaning "start of URL", so it matches everything).
    const rules = buildDnrRule(key.trim(), value.trim(), scope);

    try {
        // remove all existing rules and add new ones
        const existingRules = await getDynamicRules();
        await updateDynamicRules({
            removeRuleIds: rules
                .map(({ id }) => id)
                .concat(existingRules.map((rule) => rule.id)),
            addRules: rules,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Failed to set header:', message);
        emitUserBlocked('configure_failed', 'user_action', {
            error: message || 'DNR update failed',
        });
        throw err instanceof Error ? err : new Error(message);
    }

    console.log('Header rule set successfully.');
    refreshIconIndicator(rules.length);
    if (storageKey === STORAGE_KEYS.OVERRIDE) {
        await clearJoinedSession();
        await storeOverride(key.trim(), value.trim(), scope);
    } else {
        await storeDefaults(key.trim(), value.trim(), scope);
    }
}

// Listener for the configuration link page
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(location.search);
    const encoded = params.get('payload');
    const storageKey: HeaderStorageKey =
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
