import { renderHook, act, waitFor } from '@testing-library/react';
import {
    useMirrordUi,
    fetchContexts,
    fetchOperatorSessionsV2,
} from '../hooks/useMirrordUi';
import type { OperatorSessionsResponse } from '../types';
import { STORAGE_KEYS } from '../types';
import { decodeConfig } from '../config';

const owner = { username: 'alice', k8sUsername: 'alice@ex' };
const createdAt = '2026-01-01T00:00:00Z';

const sampleResponse: OperatorSessionsResponse = {
    by_key: {
        k0: [
            {
                id: 'u',
                key: 'k0',
                namespace: 'ns',
                owner,
                target: null,
                createdAt,
            },
        ],
        k1: [
            {
                id: 'a',
                key: 'k1',
                namespace: 'ns-a',
                owner,
                target: null,
                createdAt,
            },
            {
                id: 'b',
                key: 'k1',
                namespace: 'ns-b',
                owner,
                target: null,
                createdAt,
            },
        ],
    },
    sessions: [
        {
            id: 'u',
            key: 'k0',
            namespace: 'ns',
            owner,
            target: null,
            createdAt,
        },
        {
            id: 'a',
            key: 'k1',
            namespace: 'ns-a',
            owner,
            target: null,
            createdAt,
        },
        {
            id: 'b',
            key: 'k1',
            namespace: 'ns-b',
            owner,
            target: null,
            createdAt,
        },
    ],
    watch_status: { status: 'watching' },
};

let storage: Record<string, unknown>;
let storageListeners: ((
    changes: Record<string, chrome.storage.StorageChange>
) => void)[];

beforeEach(() => {
    storage = {
        [STORAGE_KEYS.MIRRORD_UI_BACKEND]: 'http://127.0.0.1:8082',
        [STORAGE_KEYS.MIRRORD_UI_TOKEN]: 'tok',
    };
    storageListeners = [];
    (global as unknown as { chrome: unknown }).chrome = {
        ...((global as unknown as { chrome?: unknown }).chrome ?? {}),
        storage: {
            local: {
                get: jest.fn(
                    (
                        _keys: unknown,
                        cb: (items: Record<string, unknown>) => void
                    ) => cb(storage)
                ),
                set: jest.fn(
                    (items: Record<string, unknown>, cb?: () => void) => {
                        Object.assign(storage, items);
                        cb?.();
                    }
                ),
                remove: jest.fn((_keys: unknown, cb?: () => void) => {
                    cb?.();
                }),
            },
            onChanged: {
                addListener: jest.fn(
                    (
                        l: (
                            changes: Record<
                                string,
                                chrome.storage.StorageChange
                            >
                        ) => void
                    ) => storageListeners.push(l)
                ),
                removeListener: jest.fn(
                    (
                        l: (
                            changes: Record<
                                string,
                                chrome.storage.StorageChange
                            >
                        ) => void
                    ) => {
                        storageListeners = storageListeners.filter(
                            (x) => x !== l
                        );
                    }
                ),
            },
        },
        declarativeNetRequest: {
            getDynamicRules: jest.fn((cb: (r: unknown[]) => void) => cb([])),
            updateDynamicRules: jest.fn((_args: unknown, cb?: () => void) =>
                cb?.()
            ),
            RuleActionType: { MODIFY_HEADERS: 'modifyHeaders' },
            HeaderOperation: { SET: 'set' },
        },
        runtime: {
            id: 'test-extension-id',
            getURL: (p: string) => `chrome-extension://test/${p}`,
            lastError: null,
        },
    };

    const makeResponse = (body: string, status = 200) =>
        ({
            ok: status >= 200 && status < 300,
            status,
            statusText: 'OK',
            text: () => Promise.resolve(body),
            json: () => Promise.resolve(JSON.parse(body)),
        }) as unknown as Response;

    global.fetch = jest.fn((url: RequestInfo | URL) => {
        if (String(url).includes('/api/operator-sessions')) {
            return Promise.resolve(
                makeResponse(JSON.stringify(sampleResponse))
            );
        }
        if (String(url).includes('/health')) {
            return Promise.resolve(makeResponse('ok'));
        }
        return Promise.reject(new Error('unexpected fetch'));
    }) as unknown as typeof fetch;

    (global as unknown as { WebSocket: unknown }).WebSocket = class {
        onmessage: ((ev: MessageEvent) => void) | null = null;
        onerror: ((ev: Event) => void) | null = null;
        onclose: ((ev: CloseEvent) => void) | null = null;
        close() {}
    };
});

test('fetches sessions on mount when backend is configured', async () => {
    const { result } = renderHook(() => useMirrordUi());
    await waitFor(() =>
        expect(result.current.sessions?.sessions.length).toBe(3)
    );
    expect(result.current.status).toEqual({ status: 'watching' });
    expect(Object.keys(result.current.groupedFiltered)).toContain('k1');
});

test('flags authFailed when the poller rejects the token (401)', async () => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
        const u = String(url);
        if (u.includes('/health')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                text: () => Promise.resolve('ok'),
                json: () => Promise.resolve({}),
            } as unknown as Response);
        }
        return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            text: () => Promise.resolve('bad token'),
            json: () => Promise.resolve({}),
        } as unknown as Response);
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useMirrordUi());
    await waitFor(() => expect(result.current.authFailed).toBe(true));
    expect(result.current.sessions).toBeNull();
});

test('clears authFailed once a freshly stored token is accepted', async () => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
        const u = String(url);
        if (u.includes('/health')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                text: () => Promise.resolve('ok'),
                json: () => Promise.resolve({}),
            } as unknown as Response);
        }
        if (u.includes('token=fresh')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                text: () => Promise.resolve(JSON.stringify(sampleResponse)),
                json: () => Promise.resolve(sampleResponse),
            } as unknown as Response);
        }
        return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            text: () => Promise.resolve('bad token'),
            json: () => Promise.resolve({}),
        } as unknown as Response);
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useMirrordUi());
    await waitFor(() => expect(result.current.authFailed).toBe(true));

    await act(async () => {
        storage[STORAGE_KEYS.MIRRORD_UI_TOKEN] = 'fresh';
        storageListeners.forEach((l) =>
            l({
                [STORAGE_KEYS.MIRRORD_UI_TOKEN]: {
                    oldValue: 'tok',
                    newValue: 'fresh',
                },
            })
        );
    });

    await waitFor(() => expect(result.current.authFailed).toBe(false));
    await waitFor(() =>
        expect(result.current.sessions?.sessions.length).toBe(3)
    );
});

test('clears authFailed when a later poll fails for a non-auth reason', async () => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
        const u = String(url);
        if (u.includes('/health')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                text: () => Promise.resolve('ok'),
                json: () => Promise.resolve({}),
            } as unknown as Response);
        }
        if (u.includes('token=other')) {
            return Promise.resolve({
                ok: false,
                status: 503,
                statusText: 'Service Unavailable',
                text: () => Promise.resolve('down'),
                json: () => Promise.resolve({}),
            } as unknown as Response);
        }
        return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            text: () => Promise.resolve('bad token'),
            json: () => Promise.resolve({}),
        } as unknown as Response);
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useMirrordUi());
    await waitFor(() => expect(result.current.authFailed).toBe(true));

    await act(async () => {
        storage[STORAGE_KEYS.MIRRORD_UI_TOKEN] = 'other';
        storageListeners.forEach((l) =>
            l({
                [STORAGE_KEYS.MIRRORD_UI_TOKEN]: {
                    oldValue: 'tok',
                    newValue: 'other',
                },
            })
        );
    });

    await waitFor(() => expect(result.current.authFailed).toBe(false));
});

test('namespace filter narrows sessions', async () => {
    const { result } = renderHook(() => useMirrordUi());
    await waitFor(() =>
        expect(result.current.sessions?.sessions.length).toBe(3)
    );
    act(() => result.current.setNamespace('ns-a'));
    await waitFor(() => {
        const grouped = result.current.groupedFiltered;
        expect(grouped['k1']?.length).toBe(1);
        expect(grouped['k1']?.[0]?.id).toBe('a');
    });
});

test('join writes the DNR rule and stores joined key', async () => {
    const { result } = renderHook(() => useMirrordUi());
    await waitFor(() =>
        expect(result.current.sessions?.sessions.length).toBe(3)
    );
    await act(() => result.current.join('k1'));
    expect(
        (
            global as unknown as {
                chrome: {
                    declarativeNetRequest: { updateDynamicRules: jest.Mock };
                };
            }
        ).chrome.declarativeNetRequest.updateDynamicRules
    ).toHaveBeenCalled();
    expect(
        (
            global as unknown as {
                chrome: { storage: { local: { set: jest.Mock } } };
            }
        ).chrome.storage.local.set
    ).toHaveBeenCalledWith(
        expect.objectContaining({ [STORAGE_KEYS.JOINED_KEY]: 'k1' }),
        expect.any(Function)
    );
});

test('session share builds a config link without backend or join params', async () => {
    const { result } = renderHook(() => useMirrordUi());
    await waitFor(() =>
        expect(result.current.sessions?.sessions.length).toBe(3)
    );

    const url = result.current.buildShareUrl('k1');
    const payload = url.match(/#config=([^&]+)/)?.[1];

    expect(url).toMatch(/^https:\/\/metalbear\.com\/mirrord\/extension#/);
    expect(url).not.toContain('storage=');
    expect(url).not.toContain('/pages/configure.html');
    expect(url).not.toContain('backend=');
    expect(url).not.toContain('join=');
    expect(payload).toBeTruthy();
    expect(decodeConfig(payload!)).toEqual({
        header_filter: 'baggage: mirrord-session=k1',
    });
});

test('session share uses the operator HTTP filter when it can derive a header', async () => {
    const responseWithFilter: OperatorSessionsResponse = {
        ...sampleResponse,
        sessions: sampleResponse.sessions.map((session) =>
            session.key === 'k0'
                ? {
                      ...session,
                      httpFilter: {
                          headerFilter: '^x-tenant: alice$',
                      },
                  }
                : session
        ),
    };
    (global.fetch as jest.Mock).mockImplementation((url: RequestInfo | URL) => {
        const makeResponse = (body: string, status = 200) =>
            ({
                ok: status >= 200 && status < 300,
                status,
                statusText: 'OK',
                text: () => Promise.resolve(body),
                json: () => Promise.resolve(JSON.parse(body)),
            }) as unknown as Response;
        if (String(url).includes('/api/operator-sessions')) {
            return Promise.resolve(
                makeResponse(JSON.stringify(responseWithFilter))
            );
        }
        if (String(url).includes('/health')) {
            return Promise.resolve(makeResponse('ok'));
        }
        return Promise.reject(new Error('unexpected fetch'));
    });

    const { result } = renderHook(() => useMirrordUi());
    await waitFor(() =>
        expect(result.current.sessions?.sessions.length).toBe(3)
    );

    const url = result.current.buildShareUrl('k0');
    const payload = url.match(/#config=([^&]+)/)?.[1];

    expect(payload).toBeTruthy();
    expect(decodeConfig(payload!)).toEqual({
        header_filter: 'x-tenant: alice',
    });
});

describe('v2 API', () => {
    const makeResp = (body: string, status = 200) =>
        ({
            ok: status >= 200 && status < 300,
            status,
            statusText: 'OK',
            text: () => Promise.resolve(body),
            json: () => Promise.resolve(JSON.parse(body)),
        }) as unknown as Response;

    const mockFetch = (impl: (url: string) => Response) =>
        jest.fn((url: RequestInfo | URL) =>
            Promise.resolve(impl(String(url)))
        ) as unknown as typeof fetch;

    test('fetchContexts returns null on 404 (server without v2)', async () => {
        const f = mockFetch(() => makeResp('', 404));
        await expect(fetchContexts('http://b', 't', f)).resolves.toBeNull();
    });

    test('fetchContexts parses the context list on success', async () => {
        const body = JSON.stringify({
            current: 'ctx-a',
            contexts: [
                { name: 'ctx-a', namespace: 'default' },
                { name: 'ctx-b', namespace: null },
            ],
        });
        const f = mockFetch(() => makeResp(body));
        const r = await fetchContexts('http://b', 't', f);
        expect(r?.current).toBe('ctx-a');
        expect(r?.contexts.map((c) => c.name)).toEqual(['ctx-a', 'ctx-b']);
    });

    test('fetchOperatorSessionsV2 maps the v2 shape to the internal one', async () => {
        const v2 = {
            context: 'ctx-a',
            status: 'available',
            sessions: [
                {
                    id: 'a',
                    key: 'k1',
                    namespace: 'ns-a',
                    owner,
                    target: null,
                    createdAt,
                },
                {
                    id: 'b',
                    key: 'k1',
                    namespace: 'ns-b',
                    owner,
                    target: null,
                    createdAt,
                },
            ],
        };
        const f = mockFetch(() => makeResp(JSON.stringify(v2)));
        const r = await fetchOperatorSessionsV2('http://b', 't', 'ctx-a', f);
        expect(r.sessions).toHaveLength(2);
        expect(Object.keys(r.by_key)).toEqual(['k1']);
        expect(r.watch_status).toEqual({ status: 'watching' });
    });

    test('fetchOperatorSessionsV2 maps an unavailable operator with its reason', async () => {
        const v2 = {
            context: null,
            status: 'unavailable',
            reason: 'operator not available',
            sessions: [],
        };
        const f = mockFetch(() => makeResp(JSON.stringify(v2)));
        const r = await fetchOperatorSessionsV2('http://b', 't', null, f);
        expect(r.watch_status).toEqual({
            status: 'unavailable',
            reason: 'operator not available',
        });
    });

    test('fetchOperatorSessionsV2 sends the selected context as a query param', async () => {
        const f = mockFetch(() =>
            makeResp(
                JSON.stringify({
                    context: 'ctx-a',
                    status: 'available',
                    sessions: [],
                })
            )
        );
        await fetchOperatorSessionsV2('http://b', 'tok', 'ctx-a', f);
        const calledUrl = String((f as jest.Mock).mock.calls[0][0]);
        expect(calledUrl).toContain('/api/v2/operator/sessions');
        expect(calledUrl).toContain('context=ctx-a');
        expect(calledUrl).toContain('token=tok');
    });
});
