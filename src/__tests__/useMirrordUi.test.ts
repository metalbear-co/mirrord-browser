import { renderHook, act, waitFor } from '@testing-library/react';
import { useMirrordUi } from '../hooks/useMirrordUi';
import type { OperatorSessionsResponse } from '../types';
import { STORAGE_KEYS } from '../types';

const sampleResponse: OperatorSessionsResponse = {
    by_key: {
        '': [
            {
                name: 'u',
                key: null,
                namespace: 'ns',
                owner: null,
                target: null,
                createdAt: null,
            },
        ],
        k1: [
            {
                name: 'a',
                key: 'k1',
                namespace: 'ns-a',
                owner: null,
                target: null,
                createdAt: null,
            },
            {
                name: 'b',
                key: 'k1',
                namespace: 'ns-b',
                owner: null,
                target: null,
                createdAt: null,
            },
        ],
    },
    sessions: [
        {
            name: 'u',
            key: null,
            namespace: 'ns',
            owner: null,
            target: null,
            createdAt: null,
        },
        {
            name: 'a',
            key: 'k1',
            namespace: 'ns-a',
            owner: null,
            target: null,
            createdAt: null,
        },
        {
            name: 'b',
            key: 'k1',
            namespace: 'ns-b',
            owner: null,
            target: null,
            createdAt: null,
        },
    ],
    watch_status: { status: 'watching' },
};

beforeEach(() => {
    const storage: Record<string, unknown> = {
        [STORAGE_KEYS.MIRRORD_UI_BACKEND]: 'http://127.0.0.1:8082',
        [STORAGE_KEYS.MIRRORD_UI_TOKEN]: 'tok',
    };
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

test('namespace filter narrows sessions', async () => {
    const { result } = renderHook(() => useMirrordUi());
    await waitFor(() =>
        expect(result.current.sessions?.sessions.length).toBe(3)
    );
    act(() => result.current.setNamespace('ns-a'));
    await waitFor(() => {
        const grouped = result.current.groupedFiltered;
        expect(grouped['k1']?.length).toBe(1);
        expect(grouped['k1']?.[0]?.name).toBe('a');
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
