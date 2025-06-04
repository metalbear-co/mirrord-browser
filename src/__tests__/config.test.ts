import {
    isRegex,
    parseHeader,
    decodeConfig,
    promptForValidHeader,
} from '../config';

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
