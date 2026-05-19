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

let updateDynamicRulesShouldThrow = false;

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
        updateDynamicRules: (_opts: unknown, cb?: () => void) => {
            if (updateDynamicRulesShouldThrow) {
                throw new Error('update failed');
            }
            cb?.();
        },
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

import { handleLeave } from '../background';

beforeEach(() => {
    updateDynamicRulesShouldThrow = false;
    Object.keys(storage).forEach((k) => delete storage[k]);
    (emitUserBlocked as jest.Mock).mockClear();
    (emitUserSucceeded as jest.Mock).mockClear();
});

describe('handleLeave', () => {
    it('emits left on success', async () => {
        await handleLeave();
        expect(emitUserSucceeded).toHaveBeenCalledWith('left', 'user_action');
    });

    it('emits leave_failed on exception', async () => {
        updateDynamicRulesShouldThrow = true;
        await handleLeave();
        expect(emitUserBlocked).toHaveBeenCalledWith(
            'leave_failed',
            'user_action',
            expect.objectContaining({ error: expect.any(String) })
        );
    });
});
