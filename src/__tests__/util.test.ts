import { refreshIconIndicator, parseRules } from '../util';
import { STRINGS } from '../constants';

describe('refreshIconIndicator', () => {
    beforeEach(() => {
        globalThis.chrome = {
            action: {
                setBadgeTextColor: jest.fn(),
                setBadgeText: jest.fn(),
            },
        } as any;
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
        } as any;
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
