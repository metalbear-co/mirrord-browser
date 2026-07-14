import { STORAGE_KEYS } from '../types';
import type { handleJoin as HandleJoinFn } from '../background';

jest.mock('../hooks/useMirrordUi', () => ({
    ...jest.requireActual<object>('../hooks/useMirrordUi'),
    fetchOperatorSessions: jest.fn(),
}));

import { fetchOperatorSessions } from '../hooks/useMirrordUi';

const mockedFetchSessions = fetchOperatorSessions as jest.MockedFunction<
    typeof fetchOperatorSessions
>;

let store: Record<string, unknown> = {};
let dynamicRules: chrome.declarativeNetRequest.Rule[] = [];

const noopEvent = { addListener: () => undefined };

function installChrome() {
    globalThis.chrome = {
        runtime: {
            getManifest: () => ({ version: '0.0.0' }),
            lastError: undefined,
            onStartup: noopEvent,
            onInstalled: noopEvent,
            onConnect: noopEvent,
            onMessageExternal: noopEvent,
        },
        storage: {
            local: {
                get: (keys: string[], cb: (r: object) => void) =>
                    cb(Object.fromEntries(keys.map((k) => [k, store[k]]))),
                set: (data: object, cb?: () => void) => {
                    Object.assign(store, data);
                    cb?.();
                },
                remove: (_keys: string[], cb?: () => void) => cb?.(),
            },
            onChanged: noopEvent,
        },
        webRequest: {
            onSendHeaders: noopEvent,
        },
        declarativeNetRequest: {
            RuleActionType: { MODIFY_HEADERS: 'modifyHeaders' },
            HeaderOperation: { SET: 'set' },
            getDynamicRules: (
                cb: (r: chrome.declarativeNetRequest.Rule[]) => void
            ) => cb(dynamicRules),
            updateDynamicRules: (
                opts: chrome.declarativeNetRequest.UpdateRuleOptions,
                cb: () => void
            ) => {
                dynamicRules = opts.addRules ?? [];
                cb();
            },
        },
        action: {
            setBadgeText: () => undefined,
            setBadgeTextColor: () => undefined,
        },
        alarms: {
            create: () => undefined,
            clear: (_n: string, cb?: () => void) => cb?.(),
            onAlarm: noopEvent,
        },
    } as unknown as typeof chrome;
}

installChrome();

let handleJoin: typeof HandleJoinFn;

beforeAll(async () => {
    const mod = await import('../background');
    handleJoin = mod.handleJoin;
});

describe('handleJoin', () => {
    beforeEach(() => {
        store = {
            [STORAGE_KEYS.MIRRORD_UI_BACKEND]: 'http://localhost:59281',
            [STORAGE_KEYS.MIRRORD_UI_TOKEN]: 'tok',
        };
        dynamicRules = [];
        mockedFetchSessions.mockReset();
    });

    it('uses the operator session filter when the key is visible', async () => {
        mockedFetchSessions.mockResolvedValue({
            sessions: [
                {
                    id: 'sess-1',
                    key: 'k1',
                    namespace: 'ns',
                    owner: null,
                    target: null,
                    createdAt: null,
                    httpFilter: {
                        headerFilter: 'x-custom: someone',
                    },
                },
            ],
            by_key: {},
            watch_status: { status: 'watching' },
        });

        const result = await handleJoin('k1');

        expect(result.ok).toBe(true);
        const header = dynamicRules[0]?.action.requestHeaders?.[0];
        expect(header?.header).toBe('x-custom');
    });

    it('falls back to the key convention when the operator reports no sessions', async () => {
        mockedFetchSessions.mockResolvedValue({
            sessions: [],
            by_key: {},
            watch_status: { status: 'unavailable', reason: 'no operator' },
        });

        const result = await handleJoin('65b94');

        expect(result.ok).toBe(true);
        const header = dynamicRules[0]?.action.requestHeaders?.[0];
        expect(header?.header).toBe('baggage');
        expect(header?.value).toBe('mirrord-session=65b94');
        expect(store[STORAGE_KEYS.JOINED_KEY]).toBe('65b94');
    });

    it('fails the join when the token is rejected', async () => {
        const authError = new Error('mirrord ui responded 401 Unauthorized');
        (authError as Error & { status?: number }).status = 401;
        mockedFetchSessions.mockRejectedValue(authError);

        const result = await handleJoin('65b94');

        expect(result.ok).toBe(false);
        expect(dynamicRules).toHaveLength(0);
    });

    it('falls back to the key convention when the sessions fetch fails', async () => {
        mockedFetchSessions.mockRejectedValue(new Error('502'));

        const result = await handleJoin('65b94');

        expect(result.ok).toBe(true);
        const header = dynamicRules[0]?.action.requestHeaders?.[0];
        expect(header?.value).toBe('mirrord-session=65b94');
    });

    it('still fails cleanly when the extension is unconfigured', async () => {
        store = {};

        const result = await handleJoin('65b94');

        expect(result.ok).toBe(false);
        expect(dynamicRules).toHaveLength(0);
    });
});
