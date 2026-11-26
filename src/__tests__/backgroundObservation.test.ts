// The joined banner's "header observed" counter, fed by the service worker's
// webRequest listener.
import type { HeaderObservation } from '../headerObservation';

jest.mock('../analytics', () => ({
    capture: jest.fn(),
    captureException: jest.fn(),
    emitUserBlocked: jest.fn(),
    emitUserSucceeded: jest.fn(),
}));

type Listener = (...args: never[]) => unknown;
const listeners: Record<string, Listener[]> = {};
const event = (name: string) => ({
    addListener: (fn: Listener) => {
        (listeners[name] ??= []).push(fn);
    },
});

const store: Record<string, unknown> = {};
// The rule a joined session installs, scoped by the user to the local frontend.
const dynamicRules = [
    {
        id: 1,
        priority: 1,
        action: {
            type: 'modifyHeaders',
            requestHeaders: [
                {
                    header: 'baggage',
                    operation: 'set',
                    value: 'mirrord-session=alice',
                },
            ],
        },
        condition: { urlFilter: 'localhost:3000' },
    },
];

globalThis.chrome = {
    runtime: {
        id: 'ext',
        getManifest: () => ({ version: '0.0.0' }),
        lastError: undefined,
        onStartup: event('onStartup'),
        onInstalled: event('onInstalled'),
        onUpdateAvailable: event('onUpdateAvailable'),
        onConnect: event('onConnect'),
        onMessageExternal: event('onMessageExternal'),
        onMessage: event('onMessage'),
    },
    storage: {
        local: {
            get: (keys: string[], cb: (r: object) => void) =>
                cb(Object.fromEntries(keys.map((k) => [k, store[k]]))),
            set: (data: object, cb?: () => void) => {
                Object.assign(store, data);
                cb?.();
            },
            remove: (_k: string[], cb?: () => void) => cb?.(),
        },
        onChanged: event('storage.onChanged'),
    },
    webRequest: { onSendHeaders: event('onSendHeaders') },
    declarativeNetRequest: {
        getDynamicRules: (cb: (r: unknown[]) => void) => cb(dynamicRules),
        updateDynamicRules: (_o: unknown, cb: () => void) => cb(),
    },
    action: {
        setBadgeText: () => undefined,
        setBadgeTextColor: () => undefined,
        onClicked: event('action.onClicked'),
    },
    alarms: {
        create: () => undefined,
        clear: (_n: string, cb?: () => void) => cb?.(),
        onAlarm: event('onAlarm'),
    },
} as unknown as typeof chrome;

let latest: HeaderObservation | null = null;

function send(url: string, baggage: string): void {
    listeners['onSendHeaders']?.[0]?.({
        url,
        method: 'GET',
        requestHeaders: [{ name: 'baggage', value: baggage }],
    } as never);
}

beforeAll(async () => {
    await import('../background');
    await new Promise((r) => {
        setTimeout(r, 0);
    });
    listeners['onConnect']?.[0]?.({
        name: 'header-observation',
        postMessage: (o: HeaderObservation) => {
            latest = o;
        },
        onDisconnect: { addListener: () => undefined },
    } as never);
});

test('a baggage header the page sent itself is not counted as ours', () => {
    expect(latest?.headerName).toBe('baggage');

    // Out of the rule's scope, so nothing was injected: this is the app's
    // own tracing SDK.
    send(
        'https://api.staging.example.com/orders',
        'sentry-environment=staging,sentry-trace_id=abc'
    );

    expect(latest?.totalLast60s).toBe(0);
});

test('the injected value is counted, also when merged into the page baggage', () => {
    const before = latest?.totalLast60s ?? 0;
    send('http://localhost:3000/api', 'mirrord-session=alice');
    // Baggage merge mode keeps the page's members and adds ours.
    send(
        'http://localhost:3000/api',
        'sentry-environment=staging,mirrord-session=alice'
    );

    expect((latest?.totalLast60s ?? 0) - before).toBe(2);
});
