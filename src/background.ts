import { STORAGE_KEYS } from './types'
import type { OperatorSessionSummary } from './types'
import {
  buildDnrRule,
  getDynamicRules,
  refreshIconIndicator,
  sessionInjectionPair,
  storageGet,
  storageRemove,
  storageSet,
  updateDynamicRules,
} from './util'
import { fetchOperatorSessions, isAuthFailureStatus } from './hooks/useMirrordUi'
import {
  HEADER_OBSERVATION_PORT,
  armCanary,
  cancelCanary,
  emptyObservation,
  notifyHeaderObserved,
  recordRequest,
  rotateBuckets,
  setHeaderName,
  type HeaderObservation,
} from './headerObservation'
import { emitUserBlocked, emitUserSucceeded } from './analytics'

const MIRRORD_UI_CONFIGURE_TYPE = 'mirrord-ui-configure'
const PONG_TYPE = 'pong'
const JOIN_RESULT_TYPE = 'join_result'
const LEAVE_RESULT_TYPE = 'leave_result'
const TRUSTED_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/
const OBSERVATION_SESSION_KEY = 'header_observation'
const EXTENSION_VERSION = chrome.runtime.getManifest().version
const ROTATION_INTERVAL_MS = 1000

interface ConfigureMessage {
  type: typeof MIRRORD_UI_CONFIGURE_TYPE
  backend: string
  token: string
}

interface PingMessage {
  type: 'ping'
}
interface JoinMessage {
  type: 'join'
  key: string
}
interface LeaveMessage {
  type: 'leave'
}
type BridgeMessage = ConfigureMessage | PingMessage | JoinMessage | LeaveMessage

let observation: HeaderObservation = emptyObservation('')
const subscribers = new Set<chrome.runtime.Port>()
let rotationTimer: ReturnType<typeof setInterval> | null = null
let observationLoaded = false

self.addEventListener('error', (event: ErrorEvent) => {
  emitUserBlocked('unhandled_error', 'health', {
    error: event.message,
    source: 'error',
  })
})

self.addEventListener('unhandledrejection', (event: Event) => {
  const reason = (event as Event & { reason?: unknown }).reason
  const error =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'unknown rejection'
  emitUserBlocked('unhandled_error', 'health', {
    error,
    source: 'unhandledrejection',
  })
})

restrictStorageAccess()
configureSidePanel()
chrome.runtime.onStartup.addListener(restrictStorageAccess)
chrome.runtime.onInstalled.addListener(restrictStorageAccess)
chrome.runtime.onStartup.addListener(configureSidePanel)
chrome.runtime.onInstalled.addListener(configureSidePanel)
chrome.runtime.onStartup.addListener(refreshIcon)
chrome.runtime.onInstalled.addListener(refreshIcon)

void restoreObservation().then(loadHeaderName)
chrome.runtime.onStartup.addListener(() => {
  void restoreObservation().then(loadHeaderName)
})
chrome.runtime.onInstalled.addListener(() => {
  void restoreObservation().then(loadHeaderName)
})

const RULE_TRIGGERING_KEYS: readonly string[] = [
  STORAGE_KEYS.OVERRIDE,
  STORAGE_KEYS.DEFAULTS,
  STORAGE_KEYS.JOINED_KEY,
  STORAGE_KEYS.JOINED_SESSION_NAME,
]

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') {
    return
  }
  if (RULE_TRIGGERING_KEYS.some((key) => key in changes)) {
    loadHeaderName()
  }
})

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (!observation.headerName) {
      return
    }
    const target = observation.headerName.toLowerCase()
    const headers = details.requestHeaders ?? []
    if (!headers.some((h) => h.name.toLowerCase() === target)) {
      return
    }
    observation = recordRequest(observation, details.url, details.method, Date.now())
    const matchedHeader = headers.find((h) => h.name.toLowerCase() === target)
    if (matchedHeader) {
      notifyHeaderObserved(matchedHeader.name)
    }
    persistObservation()
    broadcast()
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders', 'extraHeaders'],
)

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== HEADER_OBSERVATION_PORT) {
    return
  }
  subscribers.add(port)
  ensureRotation()
  pushTo(port)
  port.onDisconnect.addListener(() => {
    subscribers.delete(port)
    if (subscribers.size === 0) {
      stopRotation()
    }
  })
})

function restrictStorageAccess() {
  const setAccessLevel = (
    chrome.storage.local as unknown as {
      setAccessLevel?: (opts: { accessLevel: string }) => Promise<void>
    }
  ).setAccessLevel
  if (typeof setAccessLevel !== 'function') {
    return
  }
  setAccessLevel
    .call(chrome.storage.local, { accessLevel: 'TRUSTED_CONTEXTS' })
    .catch(() => undefined)
}

chrome.runtime.onMessageExternal.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (!isTrustedSender(sender)) {
      sendResponse({ ok: false, error: 'untrusted sender' })
      return
    }
    const m = message as Partial<BridgeMessage> | null
    if (m?.type === 'ping') {
      void handlePing().then(sendResponse)
      return true
    }
    if (m?.type === 'join' && typeof m.key === 'string') {
      void handleJoin(m.key).then(sendResponse)
      return true
    }
    if (m?.type === 'leave') {
      void handleLeave().then(sendResponse)
      return true
    }
    if (!isConfigureMessage(message)) {
      sendResponse({ ok: false, error: 'unknown message' })
      return
    }
    chrome.storage.local.set(
      {
        [STORAGE_KEYS.MIRRORD_UI_BACKEND]: message.backend,
        [STORAGE_KEYS.MIRRORD_UI_TOKEN]: message.token,
      },
      () => {
        if (chrome.runtime.lastError) {
          sendResponse({
            ok: false,
            error: chrome.runtime.lastError.message,
          })
        } else {
          sendResponse({ ok: true })
        }
      },
    )
    return true
  },
)

async function handlePing() {
  const stored = await storageGet([
    STORAGE_KEYS.JOINED_KEY,
    STORAGE_KEYS.MIRRORD_UI_BACKEND,
    STORAGE_KEYS.MIRRORD_UI_TOKEN,
  ])
  return {
    type: PONG_TYPE,
    version: EXTENSION_VERSION,
    joinedKey: (stored[STORAGE_KEYS.JOINED_KEY] as string | undefined) ?? null,
    hasBackend: !!stored[STORAGE_KEYS.MIRRORD_UI_BACKEND],
    watching: !!stored[STORAGE_KEYS.MIRRORD_UI_TOKEN],
  }
}

export async function handleJoin(key: string) {
  try {
    const stored = await storageGet([
      STORAGE_KEYS.MIRRORD_UI_BACKEND,
      STORAGE_KEYS.MIRRORD_UI_TOKEN,
      STORAGE_KEYS.SCOPE_PATTERNS,
    ])
    const backend = stored[STORAGE_KEYS.MIRRORD_UI_BACKEND] as string | undefined
    const token = stored[STORAGE_KEYS.MIRRORD_UI_TOKEN] as string | undefined
    if (!backend || !token) {
      const error = 'mirrord ui not configured in extension'
      emitUserBlocked('join_misconfigured', 'user_action', { error })
      return {
        type: JOIN_RESULT_TYPE,
        ok: false,
        error,
      }
    }
    let target: OperatorSessionSummary | undefined
    try {
      const sessionsResp = await fetchOperatorSessions(backend, token)
      target = sessionsResp.sessions.find((s) => s.key === key)
    } catch (err) {
      const status =
        err instanceof Error && typeof (err as Error & { status?: unknown }).status === 'number'
          ? (err as Error & { status: number }).status
          : undefined
      if (isAuthFailureStatus(status)) {
        const error = 'mirrord ui token rejected'
        emitUserBlocked('join_auth_failed', 'user_action', {
          error,
          key,
        })
        return { type: JOIN_RESULT_TYPE, ok: false, error }
      }
      target = undefined
    }
    const { header, value } = sessionInjectionPair(target ?? { key, httpFilter: null })
    const scope = (stored[STORAGE_KEYS.SCOPE_PATTERNS] as string[] | undefined) ?? []
    const existing = await getDynamicRules()
    await updateDynamicRules({
      removeRuleIds: existing.map((r) => r.id),
      addRules: buildDnrRule(header, value, scope),
    })
    await storageSet({
      [STORAGE_KEYS.JOINED_KEY]: key,
      [STORAGE_KEYS.JOINED_SESSION_NAME]: target?.id ?? key,
      [STORAGE_KEYS.JOINED_HEADER]: header,
      [STORAGE_KEYS.JOINED_VALUE]: value,
    })
    armCanary({ headerName: header, flow: 'session_monitor' })
    emitUserSucceeded('joined', 'user_action', {
      key,
      resolved: target ? 'operator' : 'key_convention',
    })
    return { type: JOIN_RESULT_TYPE, ok: true, joinedKey: key }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    emitUserBlocked('join_failed', 'user_action', { error })
    return {
      type: JOIN_RESULT_TYPE,
      ok: false,
      error,
    }
  }
}

export async function handleLeave() {
  try {
    const existing = await getDynamicRules()
    await updateDynamicRules({
      removeRuleIds: existing.map((r) => r.id),
      addRules: [],
    })
    await storageRemove([
      STORAGE_KEYS.JOINED_KEY,
      STORAGE_KEYS.JOINED_SESSION_NAME,
      STORAGE_KEYS.JOINED_HEADER,
      STORAGE_KEYS.JOINED_VALUE,
      STORAGE_KEYS.SCOPE_PATTERNS,
    ])
    cancelCanary()
    emitUserSucceeded('left', 'user_action')
    return { type: LEAVE_RESULT_TYPE, ok: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    emitUserBlocked('leave_failed', 'user_action', { error })
    return {
      type: LEAVE_RESULT_TYPE,
      ok: false,
      error,
    }
  }
}

function isTrustedSender(sender: chrome.runtime.MessageSender): boolean {
  if (!sender.url) {
    return false
  }
  try {
    const origin = new URL(sender.url).origin
    return TRUSTED_ORIGIN.test(origin)
  } catch {
    return false
  }
}

function isConfigureMessage(value: unknown): value is ConfigureMessage {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const m = value as Record<string, unknown>
  return (
    m['type'] === MIRRORD_UI_CONFIGURE_TYPE &&
    typeof m['backend'] === 'string' &&
    typeof m['token'] === 'string'
  )
}

function configureSidePanel() {
  const sidePanel = (
    chrome as unknown as {
      sidePanel?: {
        setPanelBehavior?: (opts: { openPanelOnActionClick: boolean }) => Promise<void>
      }
    }
  ).sidePanel
  sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => undefined)
}

function refreshIcon() {
  chrome.declarativeNetRequest.getDynamicRules((rules) => {
    refreshIconIndicator(rules.length)
  })
}

function loadHeaderName() {
  chrome.declarativeNetRequest.getDynamicRules((rules) => {
    let headerName = ''
    for (const rule of rules) {
      if (rule.action.type === chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS) {
        const h = rule.action.requestHeaders?.[0]?.header
        if (h) {
          headerName = h
          break
        }
      }
    }
    const next = setHeaderName(observation, headerName)
    if (next !== observation) {
      observation = next
      persistObservation()
    }
    broadcast()
  })
}

async function restoreObservation(): Promise<void> {
  if (observationLoaded) {
    return
  }
  observationLoaded = true
  const session = (chrome.storage as unknown as { session?: chrome.storage.StorageArea }).session
  if (!session) {
    return
  }
  try {
    const stored = await session.get(OBSERVATION_SESSION_KEY)
    const value = stored[OBSERVATION_SESSION_KEY] as HeaderObservation | undefined
    if (value && Array.isArray(value.buckets)) {
      observation = rotateBuckets(value, Date.now())
    }
  } catch {}
}

function persistObservation() {
  const session = (chrome.storage as unknown as { session?: chrome.storage.StorageArea }).session
  if (!session) {
    return
  }
  session.set({ [OBSERVATION_SESSION_KEY]: observation }).catch(() => undefined)
}

function ensureRotation() {
  if (rotationTimer !== null) {
    return
  }
  rotationTimer = setInterval(() => {
    observation = rotateBuckets(observation, Date.now())
    broadcast()
  }, ROTATION_INTERVAL_MS)
}

function stopRotation() {
  if (rotationTimer === null) {
    return
  }
  clearInterval(rotationTimer)
  rotationTimer = null
}

function broadcast() {
  for (const port of subscribers) {
    pushTo(port)
  }
}

function pushTo(port: chrome.runtime.Port) {
  try {
    port.postMessage(observation)
  } catch {
    subscribers.delete(port)
  }
}
