const mockFetch = jest.fn().mockResolvedValue({});
const mockSendBeacon = jest.fn().mockReturnValue(true);

Object.defineProperty(globalThis, 'fetch', {
    value: mockFetch,
    writable: true,
});
Object.defineProperty(navigator, 'sendBeacon', {
    value: mockSendBeacon,
    writable: true,
});

// Mock crypto.randomUUID
Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: jest.fn().mockReturnValue('test-uuid-1234'),
    writable: true,
});

// Mock localStorage
const store: Record<string, string> = {};
const mockLocalStorage = {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
        delete store[key];
    }),
    clear: jest.fn(() => {
        for (const key of Object.keys(store)) delete store[key];
    }),
    length: 0,
    key: jest.fn(),
};
Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
});

// Mock chrome.storage.local
const chromeStore: Record<string, unknown> = {};
const mockChromeStorage = {
    get: jest.fn((keys: string | string[]) => {
        const result: Record<string, unknown> = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) {
            if (k in chromeStore) result[k] = chromeStore[k];
        }
        return Promise.resolve(result);
    }),
    set: jest.fn((items: Record<string, unknown>) => {
        Object.assign(chromeStore, items);
        return Promise.resolve();
    }),
    remove: jest.fn((keys: string | string[]) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) delete chromeStore[k];
        return Promise.resolve();
    }),
};

Object.defineProperty(globalThis, 'chrome', {
    value: {
        storage: {
            local: mockChromeStorage,
        },
    },
    writable: true,
});

import {
    capture,
    captureBeacon,
    setOptOut,
    loadOptOutState,
    optOutReady,
} from '../analytics';

describe('analytics', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        mockLocalStorage.clear();
        for (const key of Object.keys(chromeStore)) delete chromeStore[key];
        // Wait for module-level optOutReady to settle, then reset
        await optOutReady;
        await setOptOut(false);
    });

    describe('capture', () => {
        it('sends event via fetch to PostHog capture endpoint', () => {
            capture('test_event');

            expect(mockFetch).toHaveBeenCalledWith(
                'https://hog.metalbear.com/capture/',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                })
            );

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.api_key).toBe(
                'phc_wIZh92nyk4vu6HidiLFUzjW6piZlZszuWZZFBS7yHHe'
            );
            expect(body.event).toBe('test_event');
            expect(body.distinct_id).toBeTruthy();
            expect(body.properties.$lib).toBe('mirrord-browser-extension');
            expect(body.timestamp).toBeTruthy();
        });

        it('includes custom properties', () => {
            capture('test_event', { action: 'save', count: 5 });

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.properties.action).toBe('save');
            expect(body.properties.count).toBe(5);
            expect(body.properties.$lib).toBe('mirrord-browser-extension');
        });

        it('does not throw when fetch fails', () => {
            mockFetch.mockRejectedValueOnce(new Error('network error'));
            expect(() => capture('test_event')).not.toThrow();
        });
    });

    describe('captureBeacon', () => {
        it('sends event via sendBeacon', () => {
            captureBeacon('close_event', { duration_ms: 500 });

            expect(mockSendBeacon).toHaveBeenCalledWith(
                'https://hog.metalbear.com/capture/',
                expect.any(String)
            );

            const payload = JSON.parse(mockSendBeacon.mock.calls[0][1]);
            expect(payload.event).toBe('close_event');
            expect(payload.properties.duration_ms).toBe(500);
            expect(payload.properties.$lib).toBe('mirrord-browser-extension');
        });

        it('does not throw when sendBeacon fails', () => {
            mockSendBeacon.mockImplementationOnce(() => {
                throw new Error('beacon error');
            });
            expect(() => captureBeacon('test_event')).not.toThrow();
        });
    });

    describe('distinct ID', () => {
        it('uses consistent distinct ID across events', () => {
            capture('event1');
            const body1 = JSON.parse(mockFetch.mock.calls[0][1].body);

            capture('event2');
            const body2 = JSON.parse(mockFetch.mock.calls[1][1].body);

            expect(body1.distinct_id).toBeTruthy();
            expect(body1.distinct_id).toBe(body2.distinct_id);
        });
    });

    describe('opt-out', () => {
        it('capture does nothing when opted out', async () => {
            await setOptOut(true);
            capture('test_event');
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('captureBeacon does nothing when opted out', async () => {
            await setOptOut(true);
            captureBeacon('test_event');
            expect(mockSendBeacon).not.toHaveBeenCalled();
        });

        it('setOptOut(true) prevents events, setOptOut(false) re-enables them', async () => {
            await setOptOut(true);
            capture('blocked_event');
            expect(mockFetch).not.toHaveBeenCalled();

            await setOptOut(false);
            capture('allowed_event');
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.event).toBe('allowed_event');
        });

        it('setOptOut(true) persists to chrome.storage.local', async () => {
            await setOptOut(true);
            expect(mockChromeStorage.set).toHaveBeenCalledWith({
                analytics_opt_out: true,
            });
        });

        it('setOptOut(false) removes key from chrome.storage.local', async () => {
            await setOptOut(false);
            expect(mockChromeStorage.remove).toHaveBeenCalledWith(
                'analytics_opt_out'
            );
        });

        it('loadOptOutState reads from chrome.storage.local', async () => {
            chromeStore['analytics_opt_out'] = true;
            await loadOptOutState();
            capture('test_event');
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });
});
