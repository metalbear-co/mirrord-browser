// Install a header-injection DNR rule and persist it as the stored default. Used by the
// metalbear.com result page (applied.tsx), which runs as a privileged extension page and so
// can call declarativeNetRequest directly.
import {
    buildDnrRule,
    getDynamicRules,
    refreshIconIndicator,
    storageSet,
    updateDynamicRules,
} from './util';
import { STORAGE_KEYS } from './types';

export async function applyHeaderConfig(
    header: string,
    value: string,
    scope?: string
): Promise<void> {
    const existing = await getDynamicRules();
    const rules = buildDnrRule(header, value, scope);
    await updateDynamicRules({
        removeRuleIds: [
            ...rules.map((r) => r.id),
            ...existing.map((r) => r.id),
        ],
        addRules: rules,
    });
    await storageSet({
        [STORAGE_KEYS.DEFAULTS]: {
            headerName: header,
            headerValue: value,
            scope,
        },
    });
    refreshIconIndicator(rules.length);
}
