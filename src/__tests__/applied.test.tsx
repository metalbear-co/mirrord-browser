/** @jest-environment jsdom */
jest.mock('../analytics', () => ({
  capture: jest.fn(),
  emitUserBlocked: jest.fn(),
  emitUserSucceeded: jest.fn(),
}))
// joinMatchingSession's internals are covered by config.test; here we control its result to
// exercise run()'s join-vs-static-override orchestration.
jest.mock('../joinSession', () => ({ joinMatchingSession: jest.fn() }))

import { run } from '../applied'
import { joinMatchingSession } from '../joinSession'

const mockJoinMatchingSession = joinMatchingSession as jest.Mock
const mockGetDynamicRules = jest.fn((cb: (rules: unknown[]) => void) => cb([]))
const mockUpdateDynamicRules = jest.fn((_opts: unknown, cb: () => void) => cb())
const mockStorageSet = jest.fn((_data: unknown, cb: () => void) => cb())
const mockStorageRemove = jest.fn((_keys: unknown, cb: () => void) => cb())

beforeEach(() => {
  mockJoinMatchingSession.mockReset()
  mockJoinMatchingSession.mockResolvedValue(null)
  mockGetDynamicRules.mockClear()
  mockUpdateDynamicRules.mockClear()
  mockStorageSet.mockClear()
  mockStorageRemove.mockClear()
  globalThis.chrome = {
    storage: { local: { set: mockStorageSet, remove: mockStorageRemove } },
    runtime: { lastError: null },
    declarativeNetRequest: {
      getDynamicRules: mockGetDynamicRules,
      updateDynamicRules: mockUpdateDynamicRules,
      RuleActionType: { MODIFY_HEADERS: 'modifyHeaders' },
      HeaderOperation: { SET: 'set' },
    },
    action: { setBadgeText: jest.fn(), setBadgeTextColor: jest.fn() },
  } as unknown as typeof chrome
})

function setSearch(search: string): void {
  window.history.replaceState({}, '', `/pages/applied.html${search}`)
}

describe('applied result page run()', () => {
  it('errors when there is no payload', async () => {
    setSearch('')
    const state = await run()
    expect(state).toEqual({
      kind: 'error',
      error: 'No config payload provided.',
    })
  })

  it('errors on a malformed payload and echoes the invalid input', async () => {
    setSearch('?payload=@@@not-base64@@@')
    const state = await run()
    expect(state.kind).toBe('error')
    if (state.kind === 'error') {
      expect(state.input).toBe('@@@not-base64@@@')
    }
  })

  it('applies a valid payload as a transient override (never defaults)', async () => {
    const payload = btoa(
      JSON.stringify({
        header_filter: 'X-Test: v',
        inject_scope: '*://example.com/*',
      }),
    )
    setSearch(`?payload=${encodeURIComponent(payload)}`)

    const state = await run()

    expect(state).toMatchObject({
      kind: 'done',
      header: 'X-Test',
      value: 'v',
      scope: '*://example.com/*',
    })
    expect(mockUpdateDynamicRules).toHaveBeenCalled()
    // every link first tries to join a matching live session
    expect(mockJoinMatchingSession).toHaveBeenCalledWith('X-Test', 'v')
    // persisted as a reset-able override, never the saved defaults
    expect(mockStorageSet).toHaveBeenCalledWith(
      expect.objectContaining({ override: expect.anything() as unknown }),
      expect.any(Function),
    )
    expect(mockStorageSet).not.toHaveBeenCalledWith(
      expect.objectContaining({ defaults: expect.anything() as unknown }),
      expect.any(Function),
    )
    expect(mockStorageRemove).toHaveBeenCalled()
  })

  it('joins a matching live session instead of writing a static rule', async () => {
    mockJoinMatchingSession.mockResolvedValue('k1')
    const payload = btoa(JSON.stringify({ header_filter: 'baggage: mirrord-session=k1' }))
    setSearch(`?payload=${encodeURIComponent(payload)}`)

    const state = await run()

    expect(mockJoinMatchingSession).toHaveBeenCalledWith('baggage', 'mirrord-session=k1')
    expect(state).toMatchObject({ kind: 'done', joinedKey: 'k1' })
    // joined the live session — no static override written
    expect(mockStorageSet).not.toHaveBeenCalledWith(
      expect.objectContaining({ override: expect.anything() as unknown }),
      expect.any(Function),
    )
  })

  it('falls back to a transient override when no live session matches', async () => {
    mockJoinMatchingSession.mockResolvedValue(null)
    const payload = btoa(JSON.stringify({ header_filter: 'baggage: mirrord-session=k1' }))
    setSearch(`?payload=${encodeURIComponent(payload)}`)

    const state = await run()

    expect(mockJoinMatchingSession).toHaveBeenCalled()
    expect(state).toMatchObject({ kind: 'done' })
    if (state.kind === 'done') {
      expect(state.joinedKey).toBeUndefined()
    }
    expect(mockStorageSet).toHaveBeenCalledWith(
      expect.objectContaining({ override: expect.anything() as unknown }),
      expect.any(Function),
    )
    expect(mockStorageRemove).toHaveBeenCalled()
  })
})
