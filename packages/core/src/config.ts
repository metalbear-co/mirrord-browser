import '@metalbear/ui/styles.css';
import {
    buildDnrRule,
    getDynamicRules,
    refreshIconIndicator,
    storageSet,
    updateDynamicRules,
} from './util';
import { Config, StoredConfig, STORAGE_KEYS } from './types';
import { capture, emitUserBlocked, emitUserSucceeded } from './analytics';
import {
    decodeConfig,
    isRegex,
    parseHeader,
    promptForValidHeader,
} from './configCore';

// Re-exported for backwards compatibility (and unit tests import these from ./config).
export { decodeConfig, isRegex, parseHeader, promptForValidHeader };

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
    const defaults: StoredConfig = {
        headerName,
        headerValue,
        scope,
    };
    return storageSet({ [STORAGE_KEYS.DEFAULTS]: defaults })
        .then(() => {
            console.log('Defaults stored successfully.');
        })
        .catch((err) => {
            console.error(
                'Failed to store defaults:',
                err instanceof Error ? err.message : String(err)
            );
        });
}

async function setHeaderRule(header: string, scope?: string): Promise<void> {
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
    await storeDefaults(key.trim(), value.trim(), scope);
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
