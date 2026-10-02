import bridgeScript from './content/baggageBridge.ts?script';
import mergeScript from './content/baggageMerge.ts?script';
import { STORAGE_KEYS } from './types';
import {
    applyDynamicRules,
    baggageMergeEnabled,
    getDynamicRules,
    isBaggageRule,
    publishBaggageConfig,
    withBaggageMerge,
} from './util';

export const BAGGAGE_CONFIG_REQUEST = 'mirrord-baggage-config-request';

const SCRIPT_IDS = ['baggage-bridge', 'baggage-merge'];

async function syncScripts(enabled: boolean): Promise<boolean> {
    const registered = await chrome.scripting.getRegisteredContentScripts({
        ids: SCRIPT_IDS,
    });
    if (registered.length > 0) {
        await chrome.scripting.unregisterContentScripts({
            ids: registered.map((script) => script.id),
        });
    }
    if (!enabled) {
        return registered.length > 0;
    }
    const common = {
        matches: ['<all_urls>'],
        allFrames: true,
        matchOriginAsFallback: true,
        runAt: 'document_start' as const,
    };
    await chrome.scripting.registerContentScripts([
        { id: 'baggage-bridge', js: [bridgeScript], ...common },
        { id: 'baggage-merge', js: [mergeScript], world: 'MAIN', ...common },
    ]);
    return true;
}

let reconciling: Promise<void> = Promise.resolve();

/** Re-applies rules and page scripts to match the stored merge mode, one run at a time. */
export function syncBaggageMode(): Promise<void> {
    reconciling = reconciling.then(reconcile, reconcile);
    return reconciling;
}

async function reconcile(): Promise<void> {
    const enabled = await baggageMergeEnabled();
    const hadScripts = await syncScripts(enabled);
    const rules = await getDynamicRules();
    const stale = rules.some(
        (rule) =>
            isBaggageRule(rule) &&
            (rule.condition.resourceTypes ?? []).includes(
                'xmlhttprequest' as chrome.declarativeNetRequest.ResourceType
            ) === enabled
    );
    if (stale) {
        await applyDynamicRules({
            removeRuleIds: rules.map((rule) => rule.id),
            addRules: rules.map((rule) => withBaggageMerge(rule, enabled)),
        });
    }
    if (hadScripts) {
        await publishBaggageConfig(true);
    }
}

/** Open pages keep the merge script across an extension update but lose its bridge. */
export async function reconnectBaggageBridges(): Promise<void> {
    if (!(await baggageMergeEnabled())) {
        return;
    }
    const tabs = await chrome.tabs.query({});
    await Promise.all(
        tabs.map((tab) =>
            tab.id === undefined
                ? Promise.resolve()
                : chrome.scripting
                      .executeScript({
                          target: { tabId: tab.id, allFrames: true },
                          files: [bridgeScript],
                      })
                      .catch(() => undefined)
        )
    );
}

export function isBaggageModeChange(
    changes: Record<string, chrome.storage.StorageChange>
): boolean {
    return STORAGE_KEYS.BAGGAGE_MERGE in changes;
}
