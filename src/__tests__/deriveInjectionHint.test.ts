/** @jest-environment node */
import { deriveInjectionHint } from '../util';

describe('deriveInjectionHint', () => {
    test('exact header+value', () => {
        expect(deriveInjectionHint('^x-tenant: alice$')).toEqual({
            header: 'x-tenant',
            value: 'alice',
        });
    });

    test('substring within a header value (baggage convention)', () => {
        expect(
            deriveInjectionHint('^baggage: .*mirrord-session=alice.*$')
        ).toEqual({
            header: 'baggage',
            value: 'mirrord-session=alice',
        });
    });

    test('loose (no anchors)', () => {
        expect(deriveInjectionHint('x-team: alpha')).toEqual({
            header: 'x-team',
            value: 'alpha',
        });
    });

    test('leading free prefix + value', () => {
        expect(deriveInjectionHint('^x-route: .*prod$')).toEqual({
            header: 'x-route',
            value: 'prod',
        });
    });

    test('trailing free suffix after value', () => {
        expect(deriveInjectionHint('^x-route: prod.*$')).toEqual({
            header: 'x-route',
            value: 'prod',
        });
    });

    test('disjunction at header name is unparseable', () => {
        expect(deriveInjectionHint('^(x-a|x-b): alice$')).toBeNull();
    });

    test('empty filter is null', () => {
        expect(deriveInjectionHint('')).toBeNull();
        expect(deriveInjectionHint(null)).toBeNull();
        expect(deriveInjectionHint(undefined)).toBeNull();
    });

    test('filter without a literal header name is null', () => {
        expect(deriveInjectionHint('^.+: .+$')).toBeNull();
    });

    test('filter with alternation at the top level is null', () => {
        expect(deriveInjectionHint('^a: 1$|^b: 2$')).toBeNull();
    });

    test('escaped special chars in value are unescaped', () => {
        expect(deriveInjectionHint('^x-h: a\\.b$')).toEqual({
            header: 'x-h',
            value: 'a.b',
        });
    });
});
