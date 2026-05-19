import { armCanary, cancelCanary } from '../headerObservation';

jest.mock('../headerObservation', () => {
    const actual = jest.requireActual('../headerObservation');
    return {
        ...actual,
        armCanary: jest.fn(),
        cancelCanary: jest.fn(),
        notifyHeaderObserved: jest.fn(),
    };
});

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

import { handleJoin, handleLeave } from '../background';

beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    (armCanary as jest.Mock).mockClear();
    (cancelCanary as jest.Mock).mockClear();
});

describe('canary wiring in background', () => {
    it('arms canary on successful join', async () => {
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
        expect(armCanary).toHaveBeenCalledWith({
            headerName: expect.any(String),
            flow: 'session_monitor',
        });
    });

    it('does not arm canary on failed join', async () => {
        await handleJoin('abc');
        expect(armCanary).not.toHaveBeenCalled();
    });

    it('cancels canary on leave', async () => {
        await handleLeave();
        expect(cancelCanary).toHaveBeenCalled();
    });
});
