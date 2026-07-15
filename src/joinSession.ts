// Shared session-join logic, kept free of module-level side effects so it can be imported by
// both the config-link handler (config.ts) and the metalbear.com result page (applied.tsx)
// without dragging in either page's DOM bootstrap.
import {
  buildDnrRule,
  getDynamicRules,
  refreshIconIndicator,
  sessionInjectionPair,
  storageGet,
  storageSet,
  updateDynamicRules,
} from './util'
import type { OperatorSessionSummary } from './types'
import { STORAGE_KEYS } from './types'
import { fetchOperatorSessions } from './hooks/useMirrordUi'

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
  headerValue: string,
): Promise<string | null> {
  const stored = await storageGet([
    STORAGE_KEYS.MIRRORD_UI_BACKEND,
    STORAGE_KEYS.MIRRORD_UI_TOKEN,
    STORAGE_KEYS.SCOPE_PATTERNS,
  ])
  const backend = stored[STORAGE_KEYS.MIRRORD_UI_BACKEND] as string | undefined
  const token = stored[STORAGE_KEYS.MIRRORD_UI_TOKEN] as string | undefined
  if (!backend || !token) {
    return null
  }

  let sessions: OperatorSessionSummary[]
  try {
    ;({ sessions } = await fetchOperatorSessions(backend, token))
  } catch {
    return null
  }

  const target = sessions.find((s) => {
    const pair = sessionInjectionPair(s)
    return pair.header.toLowerCase() === headerName.toLowerCase() && pair.value === headerValue
  })
  if (!target) {
    return null
  }

  const { header, value } = sessionInjectionPair(target)
  const scope = (stored[STORAGE_KEYS.SCOPE_PATTERNS] as string[] | undefined) ?? []
  const existing = await getDynamicRules()
  await updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: buildDnrRule(header, value, scope),
  })
  await storageSet({
    [STORAGE_KEYS.JOINED_KEY]: target.key,
    [STORAGE_KEYS.JOINED_SESSION_NAME]: target.id,
    [STORAGE_KEYS.JOINED_HEADER]: header,
    [STORAGE_KEYS.JOINED_VALUE]: value,
  })
  refreshIconIndicator(1)
  return target.key
}
