/** @jest-environment jsdom */
import { STORAGE_KEYS } from '../types';

jest.mock('@metalbear/ui/styles.css', () => ({}), { virtual: true });
jest.mock('@metalbear/ui', () => ({
    ErrorBoundary: ({ children }: { children?: React.ReactNode }) => children,
    Card: ({ children }: { children?: React.ReactNode }) => children,
    CardContent: ({ children }: { children?: React.ReactNode }) => children,
}));

describe('configure.tsx (entry)', () => {
    let mockStorageSet: jest.Mock<void, [items: unknown, cb: () => void]>;

    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        window.history.replaceState(
            {},
            '',
            '/pages/configure.html?backend=http://127.0.0.1:8082&token=abc'
        );
        mockStorageSet = jest.fn((_items: unknown, cb: () => void) => cb());
        globalThis.chrome = {
            runtime: { lastError: null, id: 'test-extension-id' },
            storage: {
                local: {
                    set: mockStorageSet,
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
        } as unknown as typeof chrome;
        global.fetch = jest.fn(
            (): Promise<Response> =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    text: () => Promise.resolve(''),
                    json: () => Promise.resolve({ sessions: [] }),
                } as unknown as Response)
        );
    });

    test('stores backend+token when query params are present', async () => {
        await jest.isolateModulesAsync(async () => {
            await import('../configure');
            for (let i = 0; i < 20; i++) {
                if (mockStorageSet.mock.calls.length > 0) {
                    break;
                }
                await new Promise((r) => setTimeout(r, 25));
            }
        });
        expect(mockStorageSet).toHaveBeenCalledWith(
            expect.objectContaining({
                [STORAGE_KEYS.MIRRORD_UI_BACKEND]: 'http://127.0.0.1:8082',
                [STORAGE_KEYS.MIRRORD_UI_TOKEN]: 'abc',
            }),
            expect.any(Function)
        );
    });
});
