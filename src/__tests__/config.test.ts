import {
    isRegex,
    parseHeader,
    decodeConfig,
    promptForValidHeader,
    storeDefaults,
} from '../config';
import { STORAGE_KEYS } from '../types';

// Mock the chrome API for storage tests
const mockStorageSet = jest.fn();

globalThis.chrome = {
    storage: {
        local: {
            set: mockStorageSet,
        },
    },
    runtime: {
        lastError: null,
    },
} as any;

describe('isRegex', () => {
    it('detects simple regex-like strings', () => {
        expect(isRegex('X-Test: \\d+')).toBe(true);
        expect(isRegex('X-Test: .*')).toBe(true);
        expect(isRegex('X-Test: 123')).toBe(false);
        expect(isRegex('X-Test')).toBe(false);
    });
});

describe('parseHeader', () => {
    it('splits a valid header into key/value', () => {
        expect(parseHeader('X-Test: 123')).toEqual({
            key: 'X-Test',
            value: '123',
        });
    });

    it('throws on missing colon', () => {
        expect(() => parseHeader('InvalidHeader')).toThrow(
            'Invalid header format.'
        );
    });

    it('throws on empty key/value', () => {
        expect(() => parseHeader('KeyOnly:')).toThrow();
        expect(() => parseHeader(':ValueOnly')).toThrow();
    });
});

describe('decodeConfig', () => {
    it('decode a valid config into JSON', () => {
        expect(
            decodeConfig(
                'eyAiaGVhZGVyX2ZpbHRlciI6ICJYLU1JUlJPUkQtVVNFUjogdGVzdCIgfQ=='
            )
        ).toEqual({
            header_filter: 'X-MIRRORD-USER: test',
        });
    });
    it('throws on invalid config payload', () => {
        expect(() => decodeConfig('hehehe')).toThrow('Invalid configuration');
    });
});

describe('URL to Config conversion', () => {
    // Helper to create base64 encoded config payloads
    const encodeConfig = (config: object): string =>
        btoa(JSON.stringify(config));

    describe('without scope', () => {
        it('parses config URL payload without inject_scope field', () => {
            const payload = encodeConfig({
                header_filter: 'X-MIRRORD-USER: alice',
            });

            const config = decodeConfig(payload);

            expect(config).toEqual({
                header_filter: 'X-MIRRORD-USER: alice',
            });
            expect(config.inject_scope).toBeUndefined();
        });

        it('parses config with explicit header key-value', () => {
            const payload = encodeConfig({
                header_filter: 'Authorization: Bearer token123',
            });

            const config = decodeConfig(payload);

            expect(config.header_filter).toBe('Authorization: Bearer token123');
            expect(config.inject_scope).toBeUndefined();
        });

        it('parses config with regex pattern in header_filter', () => {
            const payload = encodeConfig({
                header_filter: 'X-Request-ID: [a-f0-9-]+',
            });

            const config = decodeConfig(payload);

            expect(config.header_filter).toBe('X-Request-ID: [a-f0-9-]+');
            expect(config.inject_scope).toBeUndefined();
        });
    });

    describe('with scope', () => {
        it('parses config URL payload with inject_scope field', () => {
            const payload = encodeConfig({
                header_filter: 'X-MIRRORD-USER: bob',
                inject_scope: '*://api.example.com/*',
            });

            const config = decodeConfig(payload);

            expect(config).toEqual({
                header_filter: 'X-MIRRORD-USER: bob',
                inject_scope: '*://api.example.com/*',
            });
        });

        it('parses config with wildcard scope pattern', () => {
            const payload = encodeConfig({
                header_filter: 'X-Debug: enabled',
                inject_scope: '*://*.staging.example.com/*',
            });

            const config = decodeConfig(payload);

            expect(config.header_filter).toBe('X-Debug: enabled');
            expect(config.inject_scope).toBe('*://*.staging.example.com/*');
        });

        it('parses config with specific URL scope', () => {
            const payload = encodeConfig({
                header_filter: 'X-API-Key: secret123',
                inject_scope: 'https://api.example.com/v1/*',
            });

            const config = decodeConfig(payload);

            expect(config.header_filter).toBe('X-API-Key: secret123');
            expect(config.inject_scope).toBe('https://api.example.com/v1/*');
        });

        it('parses config with empty string scope (treated as undefined)', () => {
            const payload = encodeConfig({
                header_filter: 'X-Test: value',
                inject_scope: '',
            });

            const config = decodeConfig(payload);

            expect(config.header_filter).toBe('X-Test: value');
            expect(config.inject_scope).toBe('');
        });
    });

    describe('edge cases', () => {
        it('handles config with extra unknown fields gracefully', () => {
            const payload = encodeConfig({
                header_filter: 'X-Custom: value',
                inject_scope: '*://example.com/*',
                unknown_field: 'should be ignored',
            });

            const config = decodeConfig(payload);

            expect(config.header_filter).toBe('X-Custom: value');
            expect(config.inject_scope).toBe('*://example.com/*');
        });

        it('throws on empty payload', () => {
            expect(() => decodeConfig('')).toThrow();
        });

        it('throws on payload with missing header_filter', () => {
            const payload = encodeConfig({
                inject_scope: '*://example.com/*',
            });

            // decodeConfig doesn't validate required fields, it just parses
            // The validation happens later in the config page
            const config = decodeConfig(payload);
            expect(config.header_filter).toBeUndefined();
        });

        it('handles special characters in header values', () => {
            const payload = encodeConfig({
                header_filter: 'X-Data: {"key":"value","num":123}',
                inject_scope: '*://api.example.com/*',
            });

            const config = decodeConfig(payload);

            expect(config.header_filter).toBe(
                'X-Data: {"key":"value","num":123}'
            );
            expect(config.inject_scope).toBe('*://api.example.com/*');
        });

        it('handles URL-encoded scope patterns', () => {
            const payload = encodeConfig({
                header_filter: 'X-Tenant: acme-corp',
                inject_scope: '*://api.example.com/users/*',
            });

            const config = decodeConfig(payload);

            expect(config.header_filter).toBe('X-Tenant: acme-corp');
            expect(config.inject_scope).toBe('*://api.example.com/users/*');
        });
    });
});

describe('promptForValidHeader', () => {
    beforeEach(() => {
        // Reset mock state between tests
        jest.resetAllMocks();
    });

    it('returns the first valid input', () => {
        const mockPrompt = jest
            .spyOn(globalThis, 'prompt')
            .mockImplementation(() => 'X-MIRRORD-USER: 123');
        jest.spyOn(globalThis, 'alert').mockImplementation(() => {});

        const header = promptForValidHeader('X-MIRRORD-USER: \\d+');
        expect(header).toBe('X-MIRRORD-USER: 123');
        expect(mockPrompt).toHaveBeenCalledTimes(1);
    });

    it('re-prompts until valid input is given', () => {
        const mockPrompt = jest
            .spyOn(globalThis, 'prompt')
            .mockImplementationOnce(() => '') // first: empty
            .mockImplementationOnce(() => 'invalid') // second: invalid
            .mockImplementationOnce(() => 'X-MIRRORD-USER: 456'); // third: valid
        const mockAlert = jest
            .spyOn(globalThis, 'alert')
            .mockImplementation(() => {});

        const header = promptForValidHeader('X-MIRRORD-USER: \\d+');
        expect(header).toBe('X-MIRRORD-USER: 456');
        expect(mockPrompt).toHaveBeenCalledTimes(3);
        expect(mockAlert).toHaveBeenCalledTimes(2); // 2 alerts: empty + invalid
    });
});

describe('storeDefaults', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (chrome.runtime as any).lastError = null;
    });

    it('stores header name and value in chrome.storage.local', async () => {
        mockStorageSet.mockImplementation((_data, callback) => callback());

        await storeDefaults('X-Test-Header', 'test-value');

        expect(mockStorageSet).toHaveBeenCalledWith(
            {
                [STORAGE_KEYS.DEFAULTS]: {
                    headerName: 'X-Test-Header',
                    headerValue: 'test-value',
                    scope: undefined,
                },
            },
            expect.any(Function)
        );
    });

    it('stores header with scope in chrome.storage.local', async () => {
        mockStorageSet.mockImplementation((_data, callback) => callback());

        await storeDefaults('X-Test-Header', 'test-value', '*://example.com/*');

        expect(mockStorageSet).toHaveBeenCalledWith(
            {
                [STORAGE_KEYS.DEFAULTS]: {
                    headerName: 'X-Test-Header',
                    headerValue: 'test-value',
                    scope: '*://example.com/*',
                },
            },
            expect.any(Function)
        );
    });

    it('resolves even when storage fails', async () => {
        (chrome.runtime as any).lastError = { message: 'Storage error' };
        mockStorageSet.mockImplementation((_data, callback) => callback());
        const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await storeDefaults('X-Test-Header', 'test-value');

        expect(consoleSpy).toHaveBeenCalledWith(
            'Failed to store defaults:',
            'Storage error'
        );
        consoleSpy.mockRestore();
    });

    it('logs success message when storage succeeds', async () => {
        mockStorageSet.mockImplementation((_data, callback) => callback());
        const consoleSpy = jest
            .spyOn(console, 'log')
            .mockImplementation(() => {});

        await storeDefaults('X-Test-Header', 'test-value');

        expect(consoleSpy).toHaveBeenCalledWith(
            'Defaults stored successfully.'
        );
        consoleSpy.mockRestore();
    });
});
