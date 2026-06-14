import browser, {
    __reset,
} from './packages/core/src/__mocks__/webextension-polyfill';

// The source code talks to the cross-browser API through `webextension-polyfill`, which is
// mapped to a shared in-memory mock (see packages/core/src/__mocks__). Mirror that same
// mock onto the global `chrome`/`browser` objects so tests can keep asserting against
// `chrome.*`, and reset all state before each test.
beforeEach(() => {
    __reset();
    (globalThis as unknown as { chrome: unknown }).chrome = browser;
    (globalThis as unknown as { browser: unknown }).browser = browser;
});
