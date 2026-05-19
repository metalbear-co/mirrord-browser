import { emitUserBlocked, emitUserSucceeded } from '../analytics';

jest.mock('../analytics', () => ({
    emitUserBlocked: jest.fn(),
    emitUserSucceeded: jest.fn(),
    capture: jest.fn(),
    captureBeacon: jest.fn(),
    optOutReady: Promise.resolve(),
    loadOptOutState: jest.fn(() => Promise.resolve()),
}));

const storage: Record<string, unknown> = {};

const addListener = jest.fn();

(global as unknown as { chrome: object }).chrome = {
    runtime: {
        getManifest: () => ({ version: '0.3.0' }),
        lastError: null,
        onStartup: { addListener },
        onInstalled: { addListener },
        onConnect: { addListener },
        onMessageExternal: { addListener },
    },
    storage: {
        local: {
            get: (
                keys: string[],
                cb: (result: Record<string, unknown>) => void
            ) => {
                cb(Object.fromEntries(keys.map((k) => [k, storage[k]])));
            },
            set: (entries: Record<string, unknown>, cb?: () => void) => {
                Object.assign(storage, entries);
                cb?.();
            },
            remove: (keys: string[], cb?: () => void) => {
                keys.forEach((k) => delete storage[k]);
                cb?.();
            },
            setAccessLevel: undefined,
        },
        onChanged: { addListener },
    },
    declarativeNetRequest: {
        getDynamicRules: (cb: (rules: unknown[]) => void) => cb([]),
        updateDynamicRules: (_opts: unknown, cb?: () => void) => cb?.(),
        RuleActionType: { MODIFY_HEADERS: 'modifyHeaders' },
        HeaderOperation: { SET: 'set' },
    },
    webRequest: {
        onSendHeaders: { addListener },
    },
    action: {
        setBadgeText: jest.fn(),
        setBadgeBackgroundColor: jest.fn(),
    },
};

import { handleJoin } from '../background';

beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    (emitUserBlocked as jest.Mock).mockClear();
    (emitUserSucceeded as jest.Mock).mockClear();
});

describe('handleJoin', () => {
    it('emits join_misconfigured when backend/token are missing', async () => {
        await handleJoin('some-key');
        expect(emitUserBlocked).toHaveBeenCalledWith(
            'join_misconfigured',
            'user_action',
            expect.objectContaining({
                error: 'mirrord ui not configured in extension',
            })
        );
    });

    it('emits join_key_not_visible when fetched sessions do not contain the key', async () => {
        storage['mirrord_ui_backend'] = 'http://localhost:59281';
        storage['mirrord_ui_token'] = 'tok';
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ sessions: [] }),
            } as Response)
        ) as jest.Mock;
        await handleJoin('nope');
        expect(emitUserBlocked).toHaveBeenCalledWith(
            'join_key_not_visible',
            'user_action',
            expect.objectContaining({ key: 'nope' })
        );
    });

    it('emits joined on success', async () => {
        storage['mirrord_ui_backend'] = 'http://localhost:59281';
        storage['mirrord_ui_token'] = 'tok';
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        sessions: [{ key: 'abc', id: 'sid', httpFilter: {} }],
                    }),
            } as Response)
        ) as jest.Mock;
        await handleJoin('abc');
        expect(emitUserSucceeded).toHaveBeenCalledWith(
            'joined',
            'user_action',
            expect.objectContaining({ key: 'abc' })
        );
    });

    it('emits join_failed on exception', async () => {
        storage['mirrord_ui_backend'] = 'http://localhost:59281';
        storage['mirrord_ui_token'] = 'tok';
        global.fetch = jest.fn(() =>
            Promise.reject(new Error('network down'))
        ) as jest.Mock;
        await handleJoin('abc');
        expect(emitUserBlocked).toHaveBeenCalledWith(
            'join_failed',
            'user_action',
            expect.objectContaining({ error: 'network down' })
        );
    });
});
