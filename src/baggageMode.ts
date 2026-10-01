import bridgeScript from './content/baggageBridge.ts?script';
import mergeScript from './content/baggageMerge.ts?script';
import { STORAGE_KEYS } from './types';
import {
    baggageMergeEnabled,
    getDynamicRules,
    publishBaggageConfig,
    updateDynamicRules,
} from './util';

export const BAGGAGE_CONFIG_REQUEST = 'mirrord-baggage-config-request';

const SCRIPT_IDS = ['baggage-bridge', 'baggage-merge'];

async function syncScripts(enabled: boolean) {
    const registered = await chrome.scripting.getRegisteredContentScripts({
        ids: SCRIPT_IDS,
    });
    if (registered.length > 0) {
        await chrome.scripting.unregisterContentScripts({
            ids: registered.map((script) => script.id),
        });
    }
    if (!enabled) {
        return;
    }
    const common = {
        matches: ['<all_urls>'],
        allFrames: true,
        runAt: 'document_start' as const,
    };
    await chrome.scripting.registerContentScripts([
        { id: 'baggage-bridge', js: [bridgeScript], ...common },
        { id: 'baggage-merge', js: [mergeScript], world: 'MAIN', ...common },
    ]);
}

/** Re-applies rules and page scripts to match the stored merge mode. */
export async function syncBaggageMode(): Promise<void> {
    const enabled = await baggageMergeEnabled();
    await syncScripts(enabled);
    const rules = await getDynamicRules();
    if (rules.length > 0) {
        await updateDynamicRules({
            removeRuleIds: rules.map((rule) => rule.id),
            addRules: rules,
        });
    } else {
        await publishBaggageConfig();
    }
}

export function isBaggageModeChange(
    changes: Record<string, chrome.storage.StorageChange>
): boolean {
    return STORAGE_KEYS.BAGGAGE_MERGE in changes;
}
