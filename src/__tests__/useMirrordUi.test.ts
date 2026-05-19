import { renderHook, act, waitFor } from '@testing-library/react';
import { useMirrordUi } from '../hooks/useMirrordUi';
import type { OperatorSessionsResponse } from '../types';
import { STORAGE_KEYS } from '../types';
import { emitUserBlocked, emitUserSucceeded } from '../analytics';

jest.mock('../analytics', () => ({
    emitUserBlocked: jest.fn(),
    emitUserSucceeded: jest.fn(),
    capture: jest.fn(),
    captureBeacon: jest.fn(),
    optOutReady: Promise.resolve(),
    loadOptOutState: jest.fn(() => Promise.resolve()),
}));

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
            onChanged: {
                addListener: jest.fn(),
                removeListener: jest.fn(),
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

describe('useMirrordUi bridge health emission', () => {
    let mockEmitUserBlocked: jest.Mock;
    let mockEmitUserSucceeded: jest.Mock;
    let runPoll: (
        backend: string,
        token: string
    ) => Promise<OperatorSessionsResponse | null>;

    beforeEach(() => {
        jest.resetModules();
        mockEmitUserBlocked = jest.fn();
        mockEmitUserSucceeded = jest.fn();
        jest.doMock('../analytics', () => ({
            emitUserBlocked: mockEmitUserBlocked,
            emitUserSucceeded: mockEmitUserSucceeded,
            capture: jest.fn(),
            captureBeacon: jest.fn(),
            optOutReady: Promise.resolve(),
            loadOptOutState: jest.fn(() => Promise.resolve()),
        }));
        ({ runPoll } = require('../hooks/useMirrordUi'));
    });

    it('emits bridge_unhealthy ONCE on first poll failure, NOT on subsequent failures', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: false,
                status: 503,
                statusText: 'Service Unavailable',
                text: () => Promise.resolve(''),
            } as unknown as Response)
        ) as jest.Mock;
        await runPoll('http://x', 'tok');
        await runPoll('http://x', 'tok');
        await runPoll('http://x', 'tok');
        expect(mockEmitUserBlocked).toHaveBeenCalledTimes(1);
        expect(mockEmitUserBlocked).toHaveBeenCalledWith(
            'bridge_unhealthy',
            'health',
            expect.objectContaining({ status: 503 })
        );
    });

    it('emits bridge_recovered ONCE when poll succeeds after failure, NOT on subsequent successes', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 503,
                statusText: 'Service Unavailable',
                text: () => Promise.resolve(''),
            } as unknown as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ sessions: [] }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ sessions: [] }),
            } as Response);
        await runPoll('http://x', 'tok');
        await runPoll('http://x', 'tok');
        await runPoll('http://x', 'tok');
        expect(mockEmitUserSucceeded).toHaveBeenCalledTimes(1);
        expect(mockEmitUserSucceeded).toHaveBeenCalledWith(
            'bridge_recovered',
            'health'
        );
    });

    it('emits nothing when first poll succeeds (steady-state)', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ sessions: [] }),
            } as Response)
        ) as jest.Mock;
        await runPoll('http://x', 'tok');
        await runPoll('http://x', 'tok');
        expect(mockEmitUserBlocked).not.toHaveBeenCalled();
        expect(mockEmitUserSucceeded).not.toHaveBeenCalled();
    });
});
