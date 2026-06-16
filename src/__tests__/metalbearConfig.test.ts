import {
    parseConfigPayload,
    parseStorageOption,
} from '../content/metalbearConfig';

describe('parseConfigPayload', () => {
    it('extracts the payload from a #config= hash', () => {
        expect(parseConfigPayload('#config=abc123')).toBe('abc123');
    });

    it('requires a leading # (a bare query string is not a hash)', () => {
        expect(parseConfigPayload('config=abc123')).toBeNull();
    });

    it('preserves base64 characters verbatim (no + -> space)', () => {
        const payload = 'eyJhIjoiYiJ9+/==';
        expect(parseConfigPayload(`#config=${payload}`)).toBe(payload);
    });

    it('reads config alongside other hash params', () => {
        expect(parseConfigPayload('#foo=1&config=xyz&bar=2')).toBe('xyz');
    });

    it('returns null when there is no config param', () => {
        expect(parseConfigPayload('#other=1')).toBeNull();
        expect(parseConfigPayload('')).toBeNull();
        expect(parseConfigPayload('#')).toBeNull();
    });

    it('returns null for an empty config value', () => {
        expect(parseConfigPayload('#config=')).toBeNull();
        expect(parseConfigPayload('#config=   ')).toBeNull();
    });
});

describe('parseStorageOption', () => {
    it('reads the storage option alongside the config payload', () => {
        expect(parseStorageOption('#config=abc&storage=override')).toBe(
            'override'
        );
    });

    it('returns null when no storage param is present', () => {
        expect(parseStorageOption('#config=abc')).toBeNull();
        expect(parseStorageOption('')).toBeNull();
    });
});
