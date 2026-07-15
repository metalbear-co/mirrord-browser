import {
  isRegex,
  parseHeader,
  decodeConfig,
  promptForValidHeader,
  storeDefaults,
  storeOverride,
  joinMatchingSession,
} from '../config'
import { STORAGE_KEYS } from '../types'
import type { OperatorSessionSummary } from '../types'

// Mock the chrome API for storage tests
const mockStorageSet = jest.fn()
const mockStorageGet = jest.fn()
const mockGetDynamicRules = jest.fn()
const mockUpdateDynamicRules = jest.fn()

globalThis.chrome = {
  storage: {
    local: {
      set: mockStorageSet,
      get: mockStorageGet,
    },
  },
  runtime: {
    lastError: null,
  },
  declarativeNetRequest: {
    getDynamicRules: mockGetDynamicRules,
    updateDynamicRules: mockUpdateDynamicRules,
    RuleActionType: { MODIFY_HEADERS: 'modifyHeaders' },
    HeaderOperation: { SET: 'set' },
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeTextColor: jest.fn(),
  },
} as unknown as typeof chrome

describe('isRegex', () => {
  it('detects simple regex-like strings', () => {
    expect(isRegex('X-Test: \\d+')).toBe(true)
    expect(isRegex('X-Test: .*')).toBe(true)
    expect(isRegex('X-Test: 123')).toBe(false)
    expect(isRegex('X-Test')).toBe(false)
  })
})

describe('parseHeader', () => {
  it('splits a valid header into key/value', () => {
    expect(parseHeader('X-Test: 123')).toEqual({
      key: 'X-Test',
      value: '123',
    })
  })

  it('throws on missing colon', () => {
    expect(() => parseHeader('InvalidHeader')).toThrow('Invalid header format.')
  })

  it('throws on empty key/value', () => {
    expect(() => parseHeader('KeyOnly:')).toThrow()
    expect(() => parseHeader(':ValueOnly')).toThrow()
  })

  it('keeps colons in the value (splits on the first colon only)', () => {
    expect(parseHeader('X-Forwarded: host:8080')).toEqual({
      key: 'X-Forwarded',
      value: 'host:8080',
    })
    expect(parseHeader('baggage: mirrord-session=k1')).toEqual({
      key: 'baggage',
      value: 'mirrord-session=k1',
    })
  })
})

describe('decodeConfig', () => {
  it('decode a valid config into JSON', () => {
    expect(decodeConfig('eyAiaGVhZGVyX2ZpbHRlciI6ICJYLU1JUlJPUkQtVVNFUjogdGVzdCIgfQ==')).toEqual({
      header_filter: 'X-MIRRORD-USER: test',
    })
  })
  it('throws on invalid config payload', () => {
    expect(() => decodeConfig('hehehe')).toThrow('Invalid configuration')
  })
})

describe('URL to Config conversion', () => {
  // Helper to create base64 encoded config payloads
  const encodeConfig = (config: object): string => btoa(JSON.stringify(config))

  describe('without scope', () => {
    it('parses config URL payload without inject_scope field', () => {
      const payload = encodeConfig({
        header_filter: 'X-MIRRORD-USER: alice',
      })

      const config = decodeConfig(payload)

      expect(config).toEqual({
        header_filter: 'X-MIRRORD-USER: alice',
      })
      expect(config.inject_scope).toBeUndefined()
    })

    it('parses config with regex pattern in header_filter', () => {
      const payload = encodeConfig({
        header_filter: 'X-Request-ID: [a-f0-9-]+',
      })

      const config = decodeConfig(payload)

      expect(config.header_filter).toBe('X-Request-ID: [a-f0-9-]+')
      expect(config.inject_scope).toBeUndefined()
    })
  })

  describe('with scope', () => {
    it('parses config URL payload with inject_scope field', () => {
      const payload = encodeConfig({
        header_filter: 'X-MIRRORD-USER: bob',
        inject_scope: '*://api.example.com/*',
      })

      const config = decodeConfig(payload)

      expect(config).toEqual({
        header_filter: 'X-MIRRORD-USER: bob',
        inject_scope: '*://api.example.com/*',
      })
    })

    it('parses config with wildcard scope pattern', () => {
      const payload = encodeConfig({
        header_filter: 'X-Debug: enabled',
        inject_scope: '*://*.staging.example.com/*',
      })

      const config = decodeConfig(payload)

      expect(config.header_filter).toBe('X-Debug: enabled')
      expect(config.inject_scope).toBe('*://*.staging.example.com/*')
    })

    it('parses config with specific URL scope', () => {
      const payload = encodeConfig({
        header_filter: 'X-API-Key: secret123',
        inject_scope: 'https://api.example.com/v1/*',
      })

      const config = decodeConfig(payload)

      expect(config.header_filter).toBe('X-API-Key: secret123')
      expect(config.inject_scope).toBe('https://api.example.com/v1/*')
    })

    it('parses config with empty string scope (treated as undefined)', () => {
      const payload = encodeConfig({
        header_filter: 'X-Test: value',
        inject_scope: '',
      })

      const config = decodeConfig(payload)

      expect(config.header_filter).toBe('X-Test: value')
      expect(config.inject_scope).toBe('')
    })
  })

  describe('edge cases', () => {
    it('handles config with extra unknown fields gracefully', () => {
      const payload = encodeConfig({
        header_filter: 'X-Custom: value',
        inject_scope: '*://example.com/*',
        unknown_field: 'should be ignored',
      })

      const config = decodeConfig(payload)

      expect(config.header_filter).toBe('X-Custom: value')
      expect(config.inject_scope).toBe('*://example.com/*')
    })

    it('throws on empty payload', () => {
      expect(() => decodeConfig('')).toThrow()
    })

    it('throws on payload with missing header_filter', () => {
      const payload = encodeConfig({
        inject_scope: '*://example.com/*',
      })

      // decodeConfig doesn't validate required fields, it just parses
      // The validation happens later in the config page
      const config = decodeConfig(payload)
      expect(config.header_filter).toBeUndefined()
    })

    it('handles special characters in header values', () => {
      const payload = encodeConfig({
        header_filter: 'X-Data: {"key":"value","num":123}',
        inject_scope: '*://api.example.com/*',
      })

      const config = decodeConfig(payload)

      expect(config.header_filter).toBe('X-Data: {"key":"value","num":123}')
      expect(config.inject_scope).toBe('*://api.example.com/*')
    })

    it('handles URL-encoded scope patterns', () => {
      const payload = encodeConfig({
        header_filter: 'X-Tenant: acme-corp',
        inject_scope: '*://api.example.com/users/*',
      })

      const config = decodeConfig(payload)

      expect(config.header_filter).toBe('X-Tenant: acme-corp')
      expect(config.inject_scope).toBe('*://api.example.com/users/*')
    })
  })
})

describe('promptForValidHeader', () => {
  beforeEach(() => {
    // Reset mock state between tests
    jest.resetAllMocks()
  })

  it('returns the first valid input', () => {
    const mockPrompt = jest
      .spyOn(globalThis, 'prompt')
      .mockImplementation(() => 'X-MIRRORD-USER: 123')
    jest.spyOn(globalThis, 'alert').mockImplementation(() => undefined)

    const header = promptForValidHeader('X-MIRRORD-USER: \\d+')
    expect(header).toBe('X-MIRRORD-USER: 123')
    expect(mockPrompt).toHaveBeenCalledTimes(1)
  })

  it('re-prompts until valid input is given', () => {
    const mockPrompt = jest
      .spyOn(globalThis, 'prompt')
      .mockImplementationOnce(() => '') // first: empty
      .mockImplementationOnce(() => 'invalid') // second: invalid
      .mockImplementationOnce(() => 'X-MIRRORD-USER: 456') // third: valid
    const mockAlert = jest.spyOn(globalThis, 'alert').mockImplementation(() => undefined)

    const header = promptForValidHeader('X-MIRRORD-USER: \\d+')
    expect(header).toBe('X-MIRRORD-USER: 456')
    expect(mockPrompt).toHaveBeenCalledTimes(3)
    expect(mockAlert).toHaveBeenCalledTimes(2) // 2 alerts: empty + invalid
  })
})

describe('storeDefaults', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(chrome.runtime as { lastError: chrome.runtime.LastError | null }).lastError = null
  })

  it('stores header name and value in chrome.storage.local', async () => {
    mockStorageSet.mockImplementation((_data: unknown, callback: () => void) => callback())

    await storeDefaults('X-Test-Header', 'test-value')

    expect(mockStorageSet).toHaveBeenCalledWith(
      {
        [STORAGE_KEYS.DEFAULTS]: {
          headerName: 'X-Test-Header',
          headerValue: 'test-value',
          scope: undefined,
        },
      },
      expect.any(Function),
    )
  })

  it('stores header with scope in chrome.storage.local', async () => {
    mockStorageSet.mockImplementation((_data: unknown, callback: () => void) => callback())

    await storeDefaults('X-Test-Header', 'test-value', '*://example.com/*')

    expect(mockStorageSet).toHaveBeenCalledWith(
      {
        [STORAGE_KEYS.DEFAULTS]: {
          headerName: 'X-Test-Header',
          headerValue: 'test-value',
          scope: '*://example.com/*',
        },
      },
      expect.any(Function),
    )
  })

  it('resolves even when storage fails', async () => {
    ;(chrome.runtime as { lastError: chrome.runtime.LastError | null }).lastError = {
      message: 'Storage error',
    }
    mockStorageSet.mockImplementation((_data: unknown, callback: () => void) => callback())
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    await storeDefaults('X-Test-Header', 'test-value')

    expect(consoleSpy).toHaveBeenCalledWith('Failed to store defaults:', 'Storage error')
    consoleSpy.mockRestore()
  })

  it('resolves quietly when storage succeeds', async () => {
    mockStorageSet.mockImplementation((_data: unknown, callback: () => void) => callback())
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    await storeDefaults('X-Test-Header', 'test-value')

    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('storeOverride', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(chrome.runtime as { lastError: chrome.runtime.LastError | null }).lastError = null
  })

  it('stores header name and value as an override', async () => {
    mockStorageSet.mockImplementation((_data: unknown, callback: () => void) => callback())

    await storeOverride('X-Test-Header', 'test-value')

    expect(mockStorageSet).toHaveBeenCalledWith(
      {
        [STORAGE_KEYS.OVERRIDE]: {
          headerName: 'X-Test-Header',
          headerValue: 'test-value',
          scope: undefined,
        },
      },
      expect.any(Function),
    )
  })
})

describe('joinMatchingSession', () => {
  const session: OperatorSessionSummary = {
    id: 'sess-1',
    key: 'k1',
    namespace: 'default',
    owner: { username: 'alice', k8sUsername: 'alice@ex' },
    target: null,
    createdAt: '2026-01-01T00:00:00Z',
  }

  const sessionsResponse = (sessions: OperatorSessionSummary[]) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(''),
    json: () =>
      Promise.resolve({
        sessions,
        by_key: {},
        watch_status: { status: 'watching' },
      }),
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(chrome.runtime as { lastError: chrome.runtime.LastError | null }).lastError = null
    mockStorageGet.mockImplementation(
      (_keys: unknown, callback: (items: Record<string, unknown>) => void) =>
        callback({
          [STORAGE_KEYS.MIRRORD_UI_BACKEND]: 'http://127.0.0.1:9000',
          [STORAGE_KEYS.MIRRORD_UI_TOKEN]: 'tok',
        }),
    )
    mockStorageSet.mockImplementation((_data: unknown, callback: () => void) => callback())
    mockGetDynamicRules.mockImplementation((callback: (rules: { id: number }[]) => void) =>
      callback([{ id: 7 }]),
    )
    mockUpdateDynamicRules.mockImplementation((_opts: unknown, callback: () => void) => callback())
    global.fetch = jest.fn().mockResolvedValue(sessionsResponse([session]))
  })

  it('joins the live session whose baggage value matches', async () => {
    const joined = await joinMatchingSession('baggage', 'mirrord-session=k1')

    expect(joined).toBe('k1')
    expect(mockUpdateDynamicRules).toHaveBeenCalledWith(
      expect.objectContaining({ removeRuleIds: [7] }),
      expect.any(Function),
    )
    expect(mockStorageSet).toHaveBeenCalledWith(
      {
        [STORAGE_KEYS.JOINED_KEY]: 'k1',
        [STORAGE_KEYS.JOINED_SESSION_NAME]: 'sess-1',
        [STORAGE_KEYS.JOINED_HEADER]: 'baggage',
        [STORAGE_KEYS.JOINED_VALUE]: 'mirrord-session=k1',
      },
      expect.any(Function),
    )
  })

  it('matches the header name case-insensitively against the http filter', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      sessionsResponse([
        {
          ...session,
          httpFilter: { headerFilter: '^x-tenant: alice$' },
        },
      ]),
    )

    const joined = await joinMatchingSession('X-Tenant', 'alice')

    expect(joined).toBe('k1')
    expect(mockStorageSet).toHaveBeenCalledWith(
      expect.objectContaining({
        [STORAGE_KEYS.JOINED_HEADER]: 'x-tenant',
        [STORAGE_KEYS.JOINED_VALUE]: 'alice',
      }),
      expect.any(Function),
    )
  })

  it('returns null when mirrord ui is not configured', async () => {
    mockStorageGet.mockImplementation(
      (_keys: unknown, callback: (items: Record<string, unknown>) => void) => callback({}),
    )

    const joined = await joinMatchingSession('baggage', 'mirrord-session=k1')

    expect(joined).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockUpdateDynamicRules).not.toHaveBeenCalled()
  })

  it('returns null when no live session matches', async () => {
    const joined = await joinMatchingSession('baggage', 'mirrord-session=other')

    expect(joined).toBeNull()
    expect(mockUpdateDynamicRules).not.toHaveBeenCalled()
    expect(mockStorageSet).not.toHaveBeenCalled()
  })

  it('returns null when fetching sessions fails', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('boom'))

    const joined = await joinMatchingSession('baggage', 'mirrord-session=k1')

    expect(joined).toBeNull()
    expect(mockUpdateDynamicRules).not.toHaveBeenCalled()
  })
})
