// User-defined URL redirect rules, e.g. mapping an env-scoped host the app
// links to (built from an injected header value) back onto a host that actually
// resolves. Stored in chrome.storage.local as the source of truth and mirrored
// into DNR redirect rules in their own id range (REDIRECT_RULE_ID_BASE+), so
// header-injection flows never touch them.
import {
    buildRedirectDnrRules,
    getDynamicRules,
    isRedirectDnrRule,
    storageGet,
    storageSet,
    updateDynamicRules,
} from './util';
import type { RedirectRule } from './types';
import { STORAGE_KEYS } from './types';

export async function getRedirectRules(): Promise<RedirectRule[]> {
    const stored = await storageGet([STORAGE_KEYS.REDIRECT_RULES]);
    const rules = stored[STORAGE_KEYS.REDIRECT_RULES] as
        | RedirectRule[]
        | undefined;
    return rules ?? [];
}

// Persist `redirects` and swap the DNR redirect rules to match. Throws (from
// updateDynamicRules) when a pattern is not valid RE2 or the substitution is
// malformed — storage is only written after Chrome accepts the rules, so the
// stored list never diverges from what's active.
export async function setRedirectRules(
    redirects: RedirectRule[]
): Promise<void> {
    const existing = await getDynamicRules();
    await updateDynamicRules({
        removeRuleIds: existing.filter(isRedirectDnrRule).map((r) => r.id),
        addRules: buildRedirectDnrRules(redirects),
    });
    await storageSet({ [STORAGE_KEYS.REDIRECT_RULES]: redirects });
}

export async function addRedirectRule(rule: RedirectRule): Promise<void> {
    const current = await getRedirectRules();
    await setRedirectRules([...current, rule]);
}

export async function removeRedirectRule(index: number): Promise<void> {
    const current = await getRedirectRules();
    await setRedirectRules(current.filter((_, i) => i !== index));
}
