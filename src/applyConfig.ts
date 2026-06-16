// Install a header-injection DNR rule and persist it as the stored default. Used by the
// metalbear.com result page (applied.tsx), which runs as a privileged extension page and so
// can call declarativeNetRequest directly.
import {
    buildDnrRule,
    getDynamicRules,
    refreshIconIndicator,
    storageRemove,
    storageSet,
    updateDynamicRules,
} from './util';
import { STORAGE_KEYS } from './types';

export async function applyHeaderConfig(
    header: string,
    value: string,
    scope?: string,
    options?: { storage?: 'override' }
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
    const config = { headerName: header, headerValue: value, scope };
    if (options?.storage === 'override') {
        // Temporary override (e.g. a shared session-join link): replace any joined-session
        // state and store under OVERRIDE so the user's saved defaults stay intact and can be
        // restored with reset-to-defaults — mirrors the config.html `storage=override` path.
        await storageRemove([
            STORAGE_KEYS.JOINED_KEY,
            STORAGE_KEYS.JOINED_SESSION_NAME,
            STORAGE_KEYS.JOINED_HEADER,
            STORAGE_KEYS.JOINED_VALUE,
            STORAGE_KEYS.SCOPE_PATTERNS,
        ]);
        await storageSet({ [STORAGE_KEYS.OVERRIDE]: config });
    } else {
        await storageSet({ [STORAGE_KEYS.DEFAULTS]: config });
    }
    refreshIconIndicator(rules.length);
}
