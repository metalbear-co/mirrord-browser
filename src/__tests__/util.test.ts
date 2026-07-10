import {
    refreshIconIndicator,
    parseRules,
    buildDnrRule,
    encodeConfig,
    buildShareUrl,
    sessionInjectionPair,
} from '../util';
import { decodeConfig } from '../config';
import { STRINGS } from '../constants';
import { ALL_RESOURCE_TYPES } from '../types';

describe('refreshIconIndicator', () => {
    beforeEach(() => {
        globalThis.chrome = {
            action: {
                setBadgeTextColor: jest.fn(),
                setBadgeText: jest.fn(),
            },
        } as unknown as typeof chrome;
    });

    it('sets badge color and ✓ when num > 0', () => {
        refreshIconIndicator(1);

        expect(chrome.action.setBadgeTextColor).toHaveBeenCalledWith({
            color: '#ADD8E6',
        });
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '✓' });
    });

    it('sets badge color and clears text when num is 0', () => {
        refreshIconIndicator(0);

        expect(chrome.action.setBadgeTextColor).toHaveBeenCalledWith({
            color: '#ADD8E6',
        });
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    });
});

describe('parseRules', () => {
    beforeEach(() => {
        globalThis.chrome = {
            declarativeNetRequest: {
                RuleActionType: {
                    MODIFY_HEADERS: 'modifyHeaders',
                },
            },
        } as unknown as typeof chrome;
    });

    it('parses a valid MODIFY_HEADERS rule', () => {
        const rules: chrome.declarativeNetRequest.Rule[] = [
            {
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
                    requestHeaders: [
                        {
                            header: 'X-Test',
                            operation:
                                'set' as chrome.declarativeNetRequest.HeaderOperation,
                            value: 'testvalue',
                        },
                    ],
                },
                condition: {
                    urlFilter: '|',
                },
            },
        ];

        const result = parseRules(rules);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            id: 1,
            header: 'X-Test',
            value: 'testvalue',
            scope: STRINGS.MSG_ALL_URLS,
        });
    });

    it('parses rule with custom URL scope', () => {
        const rules: chrome.declarativeNetRequest.Rule[] = [
            {
                id: 2,
                priority: 1,
                action: {
                    type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
                    requestHeaders: [
                        {
                            header: 'X-API-Key',
                            operation:
                                'set' as chrome.declarativeNetRequest.HeaderOperation,
                            value: 'secret',
                        },
                    ],
                },
                condition: {
                    urlFilter: '*://api.example.com/*',
                },
            },
        ];

        const result = parseRules(rules);

        expect(result).toHaveLength(1);
        expect(result[0].scope).toBe('*://api.example.com/*');
    });

    it('filters out non-MODIFY_HEADERS rules', () => {
        const rules: chrome.declarativeNetRequest.Rule[] = [
            {
                id: 1,
                priority: 1,
                action: {
                    type: 'block' as chrome.declarativeNetRequest.RuleActionType,
                },
                condition: {},
            },
        ];

        const result = parseRules(rules);

        expect(result).toHaveLength(0);
    });

    it('filters out rules without requestHeaders', () => {
        const rules: chrome.declarativeNetRequest.Rule[] = [
            {
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
                },
                condition: {},
            },
        ];

        const result = parseRules(rules);

        expect(result).toHaveLength(0);
    });

    it('returns empty array for empty input', () => {
        const result = parseRules([]);

        expect(result).toEqual([]);
    });

    it('handles missing urlFilter by defaulting to All URLs', () => {
        const rules: chrome.declarativeNetRequest.Rule[] = [
            {
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
                    requestHeaders: [
                        {
                            header: 'X-Test',
                            operation:
                                'set' as chrome.declarativeNetRequest.HeaderOperation,
                            value: 'value',
                        },
                    ],
                },
                condition: {},
            },
        ];

        const result = parseRules(rules);

        expect(result[0].scope).toBe(STRINGS.MSG_ALL_URLS);
    });
});

describe('buildDnrRule', () => {
    beforeEach(() => {
        globalThis.chrome = {
            declarativeNetRequest: {
                RuleActionType: {
                    MODIFY_HEADERS: 'modifyHeaders',
                },
                HeaderOperation: {
                    SET: 'set',
                },
            },
        } as unknown as typeof chrome;
    });

    it('builds a rule with correct structure', () => {
        const rules = buildDnrRule('X-Test', 'testvalue');

        expect(rules).toHaveLength(1);
        expect(rules[0]).toEqual({
            id: 1,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [
                    {
                        header: 'X-Test',
                        operation: 'set',
                        value: 'testvalue',
                    },
                ],
            },
            condition: {
                urlFilter: '|',
                resourceTypes: ALL_RESOURCE_TYPES,
            },
        });
    });

    it('defaults scope to | when not provided', () => {
        const rules = buildDnrRule('X-Test', 'value');

        expect(rules[0].condition.urlFilter).toBe('|');
    });

    it('uses provided scope as urlFilter', () => {
        const rules = buildDnrRule('X-Test', 'value', '*://api.example.com/*');

        expect(rules[0].condition.urlFilter).toBe('*://api.example.com/*');
    });

    it('includes ALL_RESOURCE_TYPES', () => {
        const rules = buildDnrRule('X-Test', 'value');

        expect(rules[0].condition.resourceTypes).toBe(ALL_RESOURCE_TYPES);
    });
});

describe('encodeConfig', () => {
    it('produces valid base64 that decodeConfig can read back', () => {
        const config = {
            header_filter: 'X-Test: value',
            inject_scope: '*://example.com/*',
        };

        const encoded = encodeConfig(config);
        const decoded = decodeConfig(encoded);

        expect(decoded).toEqual(config);
    });

    it('handles config without inject_scope', () => {
        const config = { header_filter: 'X-Test: value' };

        const encoded = encodeConfig(config);
        const decoded = decodeConfig(encoded);

        expect(decoded).toEqual(config);
    });
});

describe('buildShareUrl', () => {
    it('points at the metalbear.com extension landing page', () => {
        const config = { header_filter: 'X-Test: value' };

        const url = buildShareUrl(config);

        expect(url).toMatch(/^https:\/\/metalbear\.com\/mirrord\/extension#/);
    });

    it('carries the payload in the #config= hash', () => {
        const config = { header_filter: 'X-Test: value' };

        const url = buildShareUrl(config);

        expect(url).toContain('#config=');
        expect(url).not.toContain('?payload=');
    });

    it('contains encoded config that can be decoded', () => {
        const config = {
            header_filter: 'X-Test: value',
            inject_scope: '*://api.test.com/*',
        };

        const url = buildShareUrl(config);
        const payload = url.split('#config=')[1];
        const decoded = decodeConfig(payload);

        expect(decoded).toEqual(config);
    });

    it('carries no extra params (links are applied transiently, never persisted)', () => {
        const config = { header_filter: 'X-Test: value' };

        const url = buildShareUrl(config);

        expect(url).not.toContain('&');
        expect(url).not.toContain('storage=');
    });
});

describe('sessionInjectionPair', () => {
    it('falls back to the baggage header when there is no http filter', () => {
        expect(sessionInjectionPair({ key: 'k1' })).toEqual({
            header: 'baggage',
            value: 'mirrord-session=k1',
        });
    });

    it('derives the pair from the session http filter when possible', () => {
        expect(
            sessionInjectionPair({
                key: 'k1',
                httpFilter: { headerFilter: '^x-tenant: alice$' },
            })
        ).toEqual({ header: 'x-tenant', value: 'alice' });
    });

    it('falls back to baggage when the filter cannot be derived', () => {
        expect(
            sessionInjectionPair({
                key: 'k1',
                httpFilter: { headerFilter: null },
            })
        ).toEqual({ header: 'baggage', value: 'mirrord-session=k1' });
    });
});
