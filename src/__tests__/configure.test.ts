import { STORAGE_KEYS } from '../types';

describe('configure.tsx (entry)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="content"></div>';
        window.history.replaceState(
            {},
            '',
            '/pages/configure.html?backend=http://127.0.0.1:8082&token=abc'
        );
        (global as any).chrome = {
            runtime: { lastError: null, id: 'test-extension-id' },
            storage: {
                local: {
                    set: jest.fn((_items: unknown, cb: () => void) => cb()),
                    get: jest.fn((_k: unknown, cb: (items: unknown) => void) =>
                        cb({})
                    ),
                },
            },
            declarativeNetRequest: {
                getDynamicRules: jest.fn((cb: (r: unknown[]) => void) =>
                    cb([])
                ),
                updateDynamicRules: jest.fn((_args: unknown, cb: () => void) =>
                    cb()
                ),
                RuleActionType: { MODIFY_HEADERS: 'modifyHeaders' },
                HeaderOperation: { SET: 'set' },
            },
        };
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                text: () => Promise.resolve(''),
                json: () => Promise.resolve({}),
            } as any)
        ) as any;
    });

    test('stores backend+token when query params are present', async () => {
        await jest.isolateModulesAsync(async () => {
            await import('../configure');
            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise((r) => setTimeout(r, 30));
        });
        expect((global as any).chrome.storage.local.set).toHaveBeenCalledWith(
            expect.objectContaining({
                [STORAGE_KEYS.MIRRORD_UI_BACKEND]: 'http://127.0.0.1:8082',
                [STORAGE_KEYS.MIRRORD_UI_TOKEN]: 'abc',
            }),
            expect.any(Function)
        );
    });
});
