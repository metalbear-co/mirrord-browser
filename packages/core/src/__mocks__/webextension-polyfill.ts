/**
 * Shared stateful mock for the `webextension-polyfill` `browser` API used across unit
 * tests. Storage and dynamic DNR rules are kept in memory so promise-based call sites
 * behave realistically; everything is a jest.fn so tests can assert calls and override
 * behaviour. `__reset()` (called globally in jest.setup.ts before each test) clears state,
 * clears recorded calls, and re-applies the default implementations — so tests that call
 * `jest.resetAllMocks()` don't leave the mock inert for later tests.
 */

type AnyRule = { id: number; [key: string]: unknown };
type Store = Record<string, unknown>;

const localStore: Store = {};
const sessionStore: Store = {};
let dynamicRules: AnyRule[] = [];

function getFrom(store: Store, keys: unknown): Store {
    if (keys == null) return { ...store };
    const list = Array.isArray(keys) ? keys : [keys];
    const result: Store = {};
    for (const k of list) {
        if (typeof k === 'string' && k in store) result[k] = store[k];
    }
    return result;
}

const browser = {
    action: {
        setBadgeText: jest.fn(),
        setBadgeTextColor: jest.fn(),
    },
    declarativeNetRequest: {
        // Enum objects mirror the real namespace so test data using
        // `RuleActionType.MODIFY_HEADERS` / `HeaderOperation.SET` resolves at runtime.
        RuleActionType: {
            BLOCK: 'block',
            REDIRECT: 'redirect',
            ALLOW: 'allow',
            UPGRADE_SCHEME: 'upgradeScheme',
            MODIFY_HEADERS: 'modifyHeaders',
            ALLOW_ALL_REQUESTS: 'allowAllRequests',
        },
        HeaderOperation: {
            APPEND: 'append',
            SET: 'set',
            REMOVE: 'remove',
        },
        getDynamicRules: jest.fn(),
        updateDynamicRules: jest.fn(),
        // Test helpers (not part of the real API).
        __setRules: (rules: AnyRule[]) => {
            dynamicRules = [...rules];
        },
        __getRules: () => dynamicRules,
    },
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn(),
        },
        session: {
            get: jest.fn(),
            set: jest.fn(),
        },
        onChanged: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
    },
    runtime: {
        id: 'test-extension-id',
        lastError: null as { message: string } | null,
        getManifest: jest.fn(() => ({ version: '0.0.0-test' })),
        getURL: jest.fn(
            (path: string) => `chrome-extension://test-extension-id/${path}`
        ),
        openOptionsPage: jest.fn(),
        connect: jest.fn(),
        sendMessage: jest.fn(),
        onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
        onMessageExternal: { addListener: jest.fn() },
        onConnect: { addListener: jest.fn() },
        onStartup: { addListener: jest.fn() },
        onInstalled: { addListener: jest.fn() },
    },
    tabs: {
        create: jest.fn(),
    },
    webRequest: {
        onSendHeaders: { addListener: jest.fn() },
    },
};

function applyDefaults(): void {
    browser.action.setBadgeText.mockImplementation(() => Promise.resolve());
    browser.action.setBadgeTextColor.mockImplementation(() =>
        Promise.resolve()
    );

    browser.declarativeNetRequest.getDynamicRules.mockImplementation(() =>
        Promise.resolve([...dynamicRules])
    );
    browser.declarativeNetRequest.updateDynamicRules.mockImplementation(
        (opts: { removeRuleIds?: number[]; addRules?: AnyRule[] }) => {
            const remove = new Set(opts?.removeRuleIds ?? []);
            dynamicRules = dynamicRules.filter((r) => !remove.has(r.id));
            if (opts?.addRules) dynamicRules.push(...opts.addRules);
            return Promise.resolve();
        }
    );

    browser.storage.local.get.mockImplementation((keys?: unknown) =>
        Promise.resolve(getFrom(localStore, keys))
    );
    browser.storage.local.set.mockImplementation((items: Store) => {
        Object.assign(localStore, items);
        return Promise.resolve();
    });
    browser.storage.local.remove.mockImplementation((keys: unknown) => {
        const list = Array.isArray(keys) ? keys : [keys];
        for (const k of list) delete localStore[k as string];
        return Promise.resolve();
    });

    browser.storage.session.get.mockImplementation((keys?: unknown) =>
        Promise.resolve(getFrom(sessionStore, keys))
    );
    browser.storage.session.set.mockImplementation((items: Store) => {
        Object.assign(sessionStore, items);
        return Promise.resolve();
    });

    browser.runtime.getManifest.mockImplementation(() => ({
        version: '0.0.0-test',
    }));
    browser.runtime.getURL.mockImplementation(
        (path: string) => `chrome-extension://test-extension-id/${path}`
    );
    browser.runtime.openOptionsPage.mockImplementation(() => Promise.resolve());
    browser.runtime.sendMessage.mockImplementation(() => Promise.resolve());
    browser.runtime.connect.mockImplementation(() => ({
        name: '',
        onMessage: { addListener: jest.fn() },
        onDisconnect: { addListener: jest.fn() },
        postMessage: jest.fn(),
        disconnect: jest.fn(),
    }));
}

applyDefaults();

/** Reset all in-memory state and recorded calls between tests. */
export function __reset(): void {
    for (const k of Object.keys(localStore)) delete localStore[k];
    for (const k of Object.keys(sessionStore)) delete sessionStore[k];
    dynamicRules = [];
    browser.runtime.lastError = null;
    jest.clearAllMocks();
    applyDefaults();
}

export default browser;
