import { parseConfigPayload } from '../content/metalbearConfig';

describe('parseConfigPayload', () => {
    it('extracts the payload from a #config= hash', () => {
        expect(parseConfigPayload('#config=abc123')).toBe('abc123');
    });

    it('works without a leading #', () => {
        expect(parseConfigPayload('config=abc123')).toBe('abc123');
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
