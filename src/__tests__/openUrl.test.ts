jest.mock('../analytics', () => ({ emitUserBlocked: jest.fn() }));

import { resolveOpenUrl } from '../configCore';

describe('resolveOpenUrl', () => {
    it('passes through when unset', () => {
        expect(resolveOpenUrl(undefined, '*://x.example/*')).toBeUndefined();
    });

    it.each([
        ['https://shop.example.com', '*://shop.example.com/*'],
        ['https://shop.example.com/cart', '*://*.example.com/*'],
        ['https://shop.example.com/', 'https://shop.example.com/'],
    ])('accepts %s inside %s', (url, scope) => {
        expect(resolveOpenUrl(url, scope)).toBe(new URL(url).href);
    });

    it.each([
        ['http://shop.example.com/', '*://shop.example.com/*', /https/],
        ['https://shop.example.com/', undefined, /inject_scope/],
        ['https://elsewhere.example/', '*://shop.example.com/*', /inside/],
        ['https://example.com.evil.net/', '*://example.com/*', /inside/],
        ['https://shop.example.com/x', 'https://shop.example.com/', /inside/],
        ['nope', '*://shop.example.com/*', /valid URL/],
        ['https://shop.example.com/', '||example.com', /URLPattern/],
    ])('rejects %s with scope %s', (url, scope, message) => {
        expect(() => resolveOpenUrl(url, scope)).toThrow(message);
    });
});
