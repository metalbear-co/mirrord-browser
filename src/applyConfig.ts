// Install a header-injection DNR rule and persist it as a transient override. Used by the
// metalbear.com result page (applied.tsx), which runs as a privileged extension page and so
// can call declarativeNetRequest directly. Incoming config links are never written to the
// user's saved defaults — they apply as a reset-able override (or, when a live session matches,
// the caller joins it instead). The user's defaults are only ever set locally in the popup.
import {
  buildDnrRule,
  getDynamicRules,
  refreshIconIndicator,
  storageRemove,
  storageSet,
  updateDynamicRules,
} from './util'
import { STORAGE_KEYS } from './types'

export async function applyHeaderConfig(
  header: string,
  value: string,
  scope?: string,
): Promise<void> {
  const existing = await getDynamicRules()
  const rules = buildDnrRule(header, value, scope)
  await updateDynamicRules({
    removeRuleIds: [...rules.map((r) => r.id), ...existing.map((r) => r.id)],
    addRules: rules,
  })
  // Replace any joined-session state and store under OVERRIDE so the user's saved defaults
  // stay intact and can be restored with reset-to-defaults.
  await storageRemove([
    STORAGE_KEYS.JOINED_KEY,
    STORAGE_KEYS.JOINED_SESSION_NAME,
    STORAGE_KEYS.JOINED_HEADER,
    STORAGE_KEYS.JOINED_VALUE,
    STORAGE_KEYS.SCOPE_PATTERNS,
  ])
  await storageSet({
    [STORAGE_KEYS.OVERRIDE]: {
      headerName: header,
      headerValue: value,
      scope,
    },
  })
  refreshIconIndicator(rules.length)
}
