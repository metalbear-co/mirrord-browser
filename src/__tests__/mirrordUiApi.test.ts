/** @jest-environment node */
import { fetchOperatorSessions, buildWsUrl } from '../hooks/useMirrordUi'

const urlToString = (url: RequestInfo | URL): string =>
  typeof url === 'string' ? url : url instanceof URL ? url.href : url.url

describe('mirrordUiClient', () => {
  const backend = 'http://127.0.0.1:8082'
  const token = 'secret123'

  test('fetchOperatorSessions authenticates with a header', async () => {
    const fakeFetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
      expect(urlToString(url)).toBe(`${backend}/api/operator-sessions`)
      expect(new Headers(init?.headers).get('x-auth-token')).toBe(token)
      return Promise.resolve(
        new Response(
          JSON.stringify({
            by_key: {
              foo: [
                {
                  name: 'a',
                  key: 'foo',
                  namespace: 'ns',
                  owner: null,
                  target: null,
                  createdAt: null,
                },
              ],
            },
            sessions: [
              {
                name: 'a',
                key: 'foo',
                namespace: 'ns',
                owner: null,
                target: null,
                createdAt: null,
              },
            ],
            watch_status: { status: 'watching' },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
    })

    const resp = await fetchOperatorSessions(backend, token, fakeFetch)
    expect(resp.watch_status).toEqual({ status: 'watching' })
    expect(resp.sessions).toHaveLength(1)
    expect(resp.by_key['foo']).toHaveLength(1)
  })

  test('fetchOperatorSessions falls back to a query token for pre-3.222 servers', async () => {
    const fakeFetch: jest.MockedFunction<typeof fetch> = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            by_key: {},
            sessions: [],
            watch_status: { status: 'watching' },
          }),
          { status: 200 },
        ),
      )

    const resp = await fetchOperatorSessions(backend, token, fakeFetch)

    expect(resp.watch_status).toEqual({ status: 'watching' })
    expect(fakeFetch.mock.calls).toHaveLength(2)
    expect(urlToString(fakeFetch.mock.calls[1]?.[0] ?? '')).toBe(
      `${backend}/api/operator-sessions?token=${token}`,
    )
  })

  test('a rejected token surfaces the original auth failure after one retry', async () => {
    const fakeFetch: jest.MockedFunction<typeof fetch> = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(
        new Response('', {
          status: 401,
          statusText: 'Unauthorized',
        }),
      )

    await expect(fetchOperatorSessions(backend, token, fakeFetch)).rejects.toThrow(/401/)

    expect(fakeFetch.mock.calls).toHaveLength(2)
    expect(urlToString(fakeFetch.mock.calls[0]?.[0] ?? '')).not.toContain('token=')
  })

  test('an HTML page on the retry does not count as a legacy server', async () => {
    const fakeFetch: jest.MockedFunction<typeof fetch> = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(
        new Response('<!doctype html><html></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      )

    await expect(fetchOperatorSessions(backend, token, fakeFetch)).rejects.toThrow(/401/)
  })

  test('an HTML error page from a proxy surfaces the auth failure', async () => {
    const fakeFetch: jest.MockedFunction<typeof fetch> = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(
        new Response('<html>502 Bad Gateway</html>', {
          status: 502,
          headers: { 'content-type': 'text/html' },
        }),
      )

    await expect(fetchOperatorSessions(backend, token, fakeFetch)).rejects.toThrow(/401/)
  })

  test('fetchOperatorSessions throws on non-2xx with status info', async () => {
    const fakeFetch = jest.fn(() =>
      Promise.resolve(
        new Response('bad token', {
          status: 401,
          statusText: 'Unauthorized',
        }),
      ),
    )
    await expect(fetchOperatorSessions(backend, token, fakeFetch)).rejects.toThrow(/401/)
  })

  test('buildWsUrl converts http/https to ws/wss and appends token', () => {
    expect(buildWsUrl('http://127.0.0.1:8082', 'tok')).toBe('ws://127.0.0.1:8082/ws?token=tok')
    expect(buildWsUrl('https://example.test', 'tok')).toBe('wss://example.test/ws?token=tok')
  })

  test('buildWsUrl rejects a non-http backend', () => {
    expect(() => buildWsUrl('ftp://nope', 'tok')).toThrow(/backend/)
  })
})
