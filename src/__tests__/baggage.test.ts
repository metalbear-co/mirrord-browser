import { entryForUrl, mergeBaggage, urlFilterToRegExp } from '../baggage';

describe('mergeBaggage', () => {
    it('keeps page members and replaces a stale mirrord member', () => {
        expect(
            mergeBaggage(
                'sentry-trace_id=abc, mirrord-session=old;p=1',
                'mirrord-session=k1'
            )
        ).toBe('sentry-trace_id=abc,mirrord-session=k1');
        expect(mergeBaggage(null, 'mirrord-session=k1')).toBe(
            'mirrord-session=k1'
        );
    });
});

describe('urlFilterToRegExp', () => {
    it.each([
        ['|', 'https://any.example/path', true],
        ['||example.com', 'https://api.example.com/x', true],
        ['||example.com', 'https://notexample.com/x', false],
        ['|https://a.com/|', 'https://a.com/', true],
        ['|https://a.com/|', 'https://a.com/b', false],
        ['example.com^', 'https://example.com:8080/', true],
        ['example.com^', 'https://example.community/', false],
        ['api*/v1', 'https://API.host/v1', true],
        [
            '||api.example.com/search?ids=1|2',
            'https://unrelated.example/v2',
            false,
        ],
        [
            '||api.example.com/search?ids=1|2',
            'https://api.example.com/search?ids=1|2',
            true,
        ],
    ])('%s matches %s: %s', (filter, url, expected) => {
        expect(urlFilterToRegExp(filter).test(url)).toBe(expected);
    });

    it('picks the entry whose scope matches', () => {
        const entries = [
            { value: 'mirrord-session=a', filters: ['||a.com'] },
            { value: 'mirrord-session=b', filters: ['||b.com'] },
        ];
        expect(entryForUrl('https://b.com/x', entries)).toBe(
            'mirrord-session=b'
        );
        expect(entryForUrl('https://c.com/x', entries)).toBeUndefined();
    });
});
