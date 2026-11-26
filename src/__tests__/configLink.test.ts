/** @jest-environment jsdom */
// The config.html page the mirrord CLI opens with the filter from mirrord.json.

jest.mock('@metalbear/ui/styles.css', () => ({}), { virtual: true });
jest.mock('../analytics', () => ({
    capture: jest.fn(),
    emitUserBlocked: jest.fn(),
    emitUserSucceeded: jest.fn(),
}));
jest.mock('../joinSession', () => ({
    joinMatchingSession: jest.fn(() => Promise.resolve(null)),
}));

const mockUpdateDynamicRules = jest.fn((_args: unknown, cb: () => void) =>
    cb()
);

async function openConfigLink(headerFilter: string): Promise<void> {
    const payload = btoa(JSON.stringify({ header_filter: headerFilter }));
    window.history.replaceState(
        {},
        '',
        `/pages/config.html?payload=${payload}`
    );
    // Run only this import's handler: earlier imports left theirs on `document`.
    const addListener = jest.spyOn(document, 'addEventListener');
    await jest.isolateModulesAsync(async () => {
        await import('../config');
    });
    const onLoad = addListener.mock.calls.find(
        ([type]) => type === 'DOMContentLoaded'
    )?.[1] as () => void;
    addListener.mockRestore();
    onLoad();
    await new Promise((r) => {
        setTimeout(r, 25);
    });
}

function installedHeaders(): unknown[] {
    return mockUpdateDynamicRules.mock.calls.flatMap(([args]) =>
        (
            args as {
                addRules: { action: { requestHeaders: unknown[] } }[];
            }
        ).addRules.flatMap((rule) => rule.action.requestHeaders)
    );
}

describe('config.html (CLI config link)', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        mockUpdateDynamicRules.mockClear();
        document.body.innerHTML = '<div id="content"></div>';
        globalThis.chrome = {
            runtime: { lastError: null },
            storage: {
                local: {
                    get: (_k: unknown, cb: (items: object) => void) => cb({}),
                    set: (_items: unknown, cb: () => void) => cb(),
                    remove: (_k: unknown, cb: () => void) => cb(),
                },
            },
            declarativeNetRequest: {
                getDynamicRules: (cb: (rules: unknown[]) => void) => cb([]),
                updateDynamicRules: mockUpdateDynamicRules,
            },
            action: { setBadgeText: jest.fn(), setBadgeTextColor: jest.fn() },
        } as unknown as typeof chrome;
    });

    test('derives the header from a regex filter without prompting', async () => {
        const mockPrompt = jest
            .spyOn(window, 'prompt')
            .mockImplementation(() => null);
        jest.spyOn(window, 'alert').mockImplementation(() => undefined);

        // The example from the "Debug from the browser" docs.
        await openConfigLink('^baggage: .*mirrord-session=browser-debug.*');

        expect(mockPrompt).not.toHaveBeenCalled();
        expect(installedHeaders()).toEqual([
            {
                header: 'baggage',
                operation: 'set',
                value: 'mirrord-session=browser-debug',
            },
        ]);
    });

    test('prompts when no single header can be derived', async () => {
        const mockPrompt = jest
            .spyOn(window, 'prompt')
            .mockImplementation(() => 'x-user: alice');
        jest.spyOn(window, 'alert').mockImplementation(() => undefined);

        await openConfigLink('^.+: .+$');

        expect(mockPrompt).toHaveBeenCalledTimes(1);
        expect(installedHeaders()).toEqual([
            { header: 'x-user', operation: 'set', value: 'alice' },
        ]);
    });

    test('a cancelled prompt leaves the rules alone and says so', async () => {
        jest.spyOn(window, 'prompt').mockImplementation(() => null);
        const mockAlert = jest
            .spyOn(window, 'alert')
            .mockImplementation(() => undefined);

        await openConfigLink('^.+: .+$');

        expect(mockUpdateDynamicRules).not.toHaveBeenCalled();
        expect(mockAlert).toHaveBeenCalledWith(
            expect.stringContaining('No header entered')
        );
    });
});
