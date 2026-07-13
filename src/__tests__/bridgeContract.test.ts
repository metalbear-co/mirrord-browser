import { STORAGE_KEYS } from '../types';
import fixtures from '../bridge-protocol.fixtures.json';

jest.mock('../hooks/useMirrordUi', () => ({
    fetchOperatorSessions: jest.fn(),
}));

import { fetchOperatorSessions } from '../hooks/useMirrordUi';

const mockedFetchSessions = fetchOperatorSessions as jest.MockedFunction<
    typeof fetchOperatorSessions
>;

type ExternalListener = (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
) => boolean | undefined;

let externalListener: ExternalListener | undefined;
let store: Record<string, unknown> = {};
let dynamicRules: chrome.declarativeNetRequest.Rule[] = [];

const noopEvent = { addListener: () => undefined };

globalThis.chrome = {
    runtime: {
        getManifest: () => ({ version: '0.0.0' }),
        lastError: undefined,
        onStartup: noopEvent,
        onInstalled: noopEvent,
        onConnect: noopEvent,
        onMessageExternal: {
            addListener: (l: ExternalListener) => {
                externalListener = l;
            },
        },
    },
    storage: {
        local: {
            get: (keys: string[], cb: (r: object) => void) =>
                cb(Object.fromEntries(keys.map((k) => [k, store[k]]))),
            set: (data: object, cb?: () => void) => {
                Object.assign(store, data);
                cb?.();
            },
            remove: (keys: string[], cb?: () => void) => {
                for (const k of keys) {
                    Reflect.deleteProperty(store, k);
                }
                cb?.();
            },
        },
        onChanged: noopEvent,
    },
    webRequest: { onSendHeaders: noopEvent },
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

beforeAll(async () => {
    await import('../background');
});

const TRUSTED_SENDER = {
    url: 'http://127.0.0.1:59281/',
} as chrome.runtime.MessageSender;

function dispatch(
    message: unknown,
    sender: chrome.runtime.MessageSender = TRUSTED_SENDER
): Promise<unknown> {
    return new Promise((resolve) => {
        if (!externalListener) {
            throw new Error('onMessageExternal listener was not registered');
        }
        const isAsync = externalListener(message, sender, resolve);
        if (isAsync !== true) {
            return;
        }
    });
}

describe('bridge protocol contract', () => {
    beforeEach(() => {
        store = {
            [STORAGE_KEYS.MIRRORD_UI_BACKEND]: 'http://localhost:59281',
            [STORAGE_KEYS.MIRRORD_UI_TOKEN]: 'tok',
        };
        dynamicRules = [];
        mockedFetchSessions.mockReset();
        mockedFetchSessions.mockResolvedValue({
            sessions: [],
            by_key: {},
            watch_status: { status: 'unavailable', reason: 'none' },
        });
    });

    it('answers ping with the pong shape', async () => {
        const response = (await dispatch(fixtures.inbound.ping)) as Record<
            string,
            unknown
        >;
        const expected = { ...fixtures.outbound.pong, version: '0.0.0' };
        expect(response).toEqual(expected);
    });

    it('answers join with the join_result shape', async () => {
        const response = await dispatch(fixtures.inbound.join);
        expect(response).toEqual(fixtures.outbound.join_result_ok);
    });

    it('answers leave with the leave_result shape', async () => {
        const response = await dispatch(fixtures.inbound.leave);
        expect(response).toEqual(fixtures.outbound.leave_result_ok);
    });

    it('answers configure with the ack shape and stores credentials', async () => {
        const response = await dispatch(fixtures.inbound.configure);
        expect(response).toEqual(fixtures.outbound.configure_ack);
        expect(store[STORAGE_KEYS.MIRRORD_UI_BACKEND]).toBe(
            fixtures.inbound.configure.backend
        );
        expect(store[STORAGE_KEYS.MIRRORD_UI_TOKEN]).toBe(
            fixtures.inbound.configure.token
        );
    });

    it('rejects untrusted senders', async () => {
        const response = await dispatch(fixtures.inbound.ping, {
            url: 'https://evil.example.com/',
        });
        expect(response).toEqual(fixtures.outbound.untrusted);
    });

    it('rejects unknown message types', async () => {
        const response = await dispatch({ type: 'mystery' });
        expect(response).toEqual(fixtures.outbound.unknown);
    });

    it('locks the trusted-origin pattern', () => {
        const pattern = new RegExp(fixtures.trustedOriginPattern);
        expect(pattern.test('http://127.0.0.1:59281')).toBe(true);
        expect(pattern.test('http://localhost:5173')).toBe(true);
        expect(pattern.test('https://evil.example.com')).toBe(false);
        expect(pattern.test('http://127.0.0.1.evil.com')).toBe(false);
    });
});
