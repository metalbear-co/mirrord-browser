/**
 * @jest-environment node
 */
import { fetchOperatorSessions, buildWsUrl } from '../mirrordUiClient';

describe('mirrordUiClient', () => {
    const backend = 'http://127.0.0.1:8082';
    const token = 'secret123';

    test('fetchOperatorSessions hits /api/operator-sessions with token query', async () => {
        const fakeFetch = jest.fn((url: RequestInfo | URL) => {
            expect(url.toString()).toBe(
                `${backend}/api/operator-sessions?token=${token}`
            );
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
                    }
                )
            );
        });

        const resp = await fetchOperatorSessions(backend, token, fakeFetch);
        expect(resp.watch_status).toEqual({ status: 'watching' });
        expect(resp.sessions).toHaveLength(1);
        expect(resp.by_key['foo']).toHaveLength(1);
    });

    test('fetchOperatorSessions throws on non-2xx with status info', async () => {
        const fakeFetch = jest.fn(() =>
            Promise.resolve(
                new Response('bad token', {
                    status: 401,
                    statusText: 'Unauthorized',
                })
            )
        );
        await expect(
            fetchOperatorSessions(backend, token, fakeFetch)
        ).rejects.toThrow(/401/);
    });

    test('buildWsUrl converts http/https to ws/wss and appends token', () => {
        expect(buildWsUrl('http://127.0.0.1:8082', 'tok')).toBe(
            'ws://127.0.0.1:8082/ws?token=tok'
        );
        expect(buildWsUrl('https://example.test', 'tok')).toBe(
            'wss://example.test/ws?token=tok'
        );
    });

    test('buildWsUrl rejects a non-http backend', () => {
        expect(() => buildWsUrl('ftp://nope', 'tok')).toThrow(/backend/);
    });
});
