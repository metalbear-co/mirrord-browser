/** @jest-environment jsdom */
// A CLI config link opened while a session is joined.

jest.mock('@metalbear/ui/styles.css', () => ({}), { virtual: true });
jest.mock('../analytics', () => ({
    capture: jest.fn(),
    emitUserBlocked: jest.fn(),
    emitUserSucceeded: jest.fn(),
}));

const store: Record<string, unknown> = {};

test('a CLI link replaces the joined session, so its state is dropped too', async () => {
    Object.assign(store, {
        joined_key: 'alice',
        joined_session_name: 'alice',
        joined_header: 'baggage',
        joined_value: 'mirrord-session=alice',
        joined_context: 'dev',
        scope_patterns: ['localhost:3000'],
    });
    globalThis.chrome = {
        runtime: { lastError: null },
        storage: {
            local: {
                get: (keys: string[], cb: (items: object) => void) =>
                    cb(Object.fromEntries(keys.map((k) => [k, store[k]]))),
                set: (items: object, cb: () => void) => {
                    Object.assign(store, items);
                    cb();
                },
                remove: (keys: string[], cb: () => void) => {
                    for (const key of keys) {
                        Reflect.deleteProperty(store, key);
                    }
                    cb();
                },
            },
        },
        declarativeNetRequest: {
            getDynamicRules: (cb: (rules: unknown[]) => void) => cb([]),
            updateDynamicRules: (_args: unknown, cb: () => void) => cb(),
        },
        action: { setBadgeText: jest.fn(), setBadgeTextColor: jest.fn() },
    } as unknown as typeof chrome;
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    document.body.innerHTML = '<div id="content"></div>';
    // The CLI sends no `storage` param, so the link lands in the defaults slot.
    const payload = btoa(JSON.stringify({ header_filter: 'x-dev: me' }));
    window.history.replaceState(
        {},
        '',
        `/pages/config.html?payload=${payload}`
    );

    await import('../config');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((r) => {
        setTimeout(r, 25);
    });

    expect(store).toEqual({
        defaults: { headerName: 'x-dev', headerValue: 'me' },
    });
});
