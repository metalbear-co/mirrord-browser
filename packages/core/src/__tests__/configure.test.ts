/** @jest-environment jsdom */
import { STORAGE_KEYS } from '../types';

jest.mock('@metalbear/ui/styles.css', () => ({}), { virtual: true });
jest.mock('@metalbear/ui', () => ({
    Card: ({ children }: { children?: React.ReactNode }) => children,
    CardContent: ({ children }: { children?: React.ReactNode }) => children,
}));

describe('configure.tsx (entry)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        window.history.replaceState(
            {},
            '',
            '/pages/configure.html?backend=http://127.0.0.1:8082&token=abc'
        );
        // storage/DNR are backed by the shared webextension-polyfill mock (jest.setup.ts).
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                text: () => Promise.resolve(''),
                json: () => Promise.resolve({ sessions: [] }),
            } as any)
        ) as any;
    });

    test('stores backend+token when query params are present', async () => {
        await jest.isolateModulesAsync(async () => {
            // Grab the polyfill mock from within the isolated registry so it's the same
            // instance the freshly-imported configure module talks to.
            const browser = (await import('webextension-polyfill')).default;
            const set = browser.storage.local.set as jest.Mock;
            await import('../configure');
            for (let i = 0; i < 20; i++) {
                if (set.mock.calls.length > 0) break;
                await new Promise((r) => setTimeout(r, 25));
            }
            expect(set).toHaveBeenCalledWith(
                expect.objectContaining({
                    [STORAGE_KEYS.MIRRORD_UI_BACKEND]: 'http://127.0.0.1:8082',
                    [STORAGE_KEYS.MIRRORD_UI_TOKEN]: 'abc',
                })
            );
        });
    });
});
