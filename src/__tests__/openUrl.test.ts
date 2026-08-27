jest.mock('../analytics', () => ({ emitUserBlocked: jest.fn() }));

import { resolveOpenUrl, urlMatchesScope } from '../configCore';

describe('urlMatchesScope', () => {
    it.each([
        ['https://shop.example.com/cart', '*://shop.example.com/*', true],
        ['https://shop.example.com/', '*://*.example.com/*', true],
        ['https://other.example.com/', '*://shop.example.com/*', false],
        ['https://example.com.evil.net/', '*://example.com/*', false],
        ['https://shop.example.com/', 'https://shop.example.com/', true],
        ['https://shop.example.com/x', 'https://shop.example.com/', false],
        ['https://shop.example.com/', '||example.com', false],
        ['https://shop.example.com/', '', false],
    ])('%s against %s -> %s', (url, scope, expected) => {
        expect(urlMatchesScope(url, scope)).toBe(expected);
    });
});

describe('resolveOpenUrl', () => {
    it('passes through when unset', () => {
        expect(resolveOpenUrl(undefined, '*://x.example/*')).toBeUndefined();
    });

    it('normalizes a valid url', () => {
        expect(
            resolveOpenUrl('https://shop.example.com', '*://shop.example.com/*')
        ).toBe('https://shop.example.com/');
    });

    it.each([
        ['http://shop.example.com/', '*://shop.example.com/*', /https/],
        ['https://shop.example.com/', undefined, /inject_scope/],
        ['https://elsewhere.example/', '*://shop.example.com/*', /inside/],
        ['nope', '*://shop.example.com/*', /valid URL/],
    ])('rejects %s with scope %s', (url, scope, message) => {
        expect(() => resolveOpenUrl(url, scope)).toThrow(message);
    });
});
