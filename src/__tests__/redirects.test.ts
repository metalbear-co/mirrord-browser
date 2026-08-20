import {
    buildRedirectDnrRules,
    headerRuleIds,
    isRedirectDnrRule,
} from '../util';
import {
    addRedirectRule,
    getRedirectRules,
    removeRedirectRule,
    setRedirectRules,
} from '../redirects';
import {
    ALL_RESOURCE_TYPES,
    REDIRECT_RULE_ID_BASE,
    STORAGE_KEYS,
} from '../types';

function mockChrome(overrides: {
    dynamicRules?: chrome.declarativeNetRequest.Rule[];
    storage?: Record<string, unknown>;
}) {
    const storage = overrides.storage ?? {};
    const updateDynamicRules = jest.fn(
        (
            _opts: chrome.declarativeNetRequest.UpdateRuleOptions,
            cb: () => void
        ) => cb()
    );
    globalThis.chrome = {
        runtime: {},
        declarativeNetRequest: {
            RuleActionType: {
                MODIFY_HEADERS: 'modifyHeaders',
                REDIRECT: 'redirect',
            },
            getDynamicRules: jest.fn(
                (cb: (rules: chrome.declarativeNetRequest.Rule[]) => void) =>
                    cb(overrides.dynamicRules ?? [])
            ),
            updateDynamicRules,
        },
        storage: {
            local: {
                get: jest.fn(
                    (
                        _keys: string[],
                        cb: (result: Record<string, unknown>) => void
                    ) => cb(storage)
                ),
                set: jest.fn(
                    (data: Record<string, unknown>, cb: () => void) => {
                        Object.assign(storage, data);
                        cb();
                    }
                ),
            },
        },
    } as unknown as typeof chrome;
    return { updateDynamicRules, storage };
}

const HEADER_RULE = {
    id: 1,
    priority: 1,
    action: {
        type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
        requestHeaders: [
            {
                header: 'X-Test',
                operation:
                    'set' as chrome.declarativeNetRequest.HeaderOperation,
                value: 'v',
            },
        ],
    },
    condition: { urlFilter: '|' },
};

const REDIRECT_DNR_RULE = {
    id: REDIRECT_RULE_ID_BASE,
    priority: 1,
    action: {
        type: 'redirect' as chrome.declarativeNetRequest.RuleActionType,
        redirect: { regexSubstitution: 'https://app-master.example.com/\\1' },
    },
    condition: { regexFilter: '^https://app-[^.]*\\.example\\.com/(.*)' },
};

describe('buildRedirectDnrRules', () => {
    beforeEach(() => {
        mockChrome({});
    });

    it('builds redirect rules in the reserved id range', () => {
        const rules = buildRedirectDnrRules([
            {
                from: '^https://app-[^.]*\\.example\\.com/(.*)',
                to: 'https://app-master.example.com/\\1',
            },
            {
                from: '^https://other\\.example\\.com/',
                to: 'https://x.example.com/',
            },
        ]);

        expect(rules).toHaveLength(2);
        expect(rules[0]?.id).toBe(REDIRECT_RULE_ID_BASE);
        expect(rules[1]?.id).toBe(REDIRECT_RULE_ID_BASE + 1);
        expect(rules[0]?.action.type).toBe('redirect');
        expect(rules[0]?.action.redirect?.regexSubstitution).toBe(
            'https://app-master.example.com/\\1'
        );
        expect(rules[0]?.condition.regexFilter).toBe(
            '^https://app-[^.]*\\.example\\.com/(.*)'
        );
        expect(rules[0]?.condition.resourceTypes).toEqual(ALL_RESOURCE_TYPES);
    });
});

describe('headerRuleIds / isRedirectDnrRule', () => {
    it('excludes redirect-range rules from header wipe ids', () => {
        expect(isRedirectDnrRule(HEADER_RULE)).toBe(false);
        expect(isRedirectDnrRule(REDIRECT_DNR_RULE)).toBe(true);
        expect(headerRuleIds([HEADER_RULE, REDIRECT_DNR_RULE])).toEqual([1]);
    });
});

describe('redirect rule storage sync', () => {
    it('setRedirectRules removes only redirect-range rules and stores the list', async () => {
        const { updateDynamicRules, storage } = mockChrome({
            dynamicRules: [HEADER_RULE, REDIRECT_DNR_RULE],
        });

        const next = [
            {
                from: '^https://a\\.example\\.com/',
                to: 'https://b.example.com/',
            },
        ];
        await setRedirectRules(next);

        const opts = updateDynamicRules.mock.calls[0]?.[0];
        expect(opts?.removeRuleIds).toEqual([REDIRECT_RULE_ID_BASE]);
        expect(opts?.addRules?.map((r) => r.id)).toEqual([
            REDIRECT_RULE_ID_BASE,
        ]);
        expect(storage[STORAGE_KEYS.REDIRECT_RULES]).toEqual(next);
    });

    it('addRedirectRule appends to the stored list', async () => {
        const existing = [
            {
                from: '^https://a\\.example\\.com/',
                to: 'https://b.example.com/',
            },
        ];
        const { storage } = mockChrome({
            storage: { [STORAGE_KEYS.REDIRECT_RULES]: [...existing] },
        });

        await addRedirectRule({
            from: '^https://c\\.example\\.com/',
            to: 'https://d.example.com/',
        });

        expect(storage[STORAGE_KEYS.REDIRECT_RULES]).toHaveLength(2);
    });

    it('removeRedirectRule drops by index', async () => {
        const { storage } = mockChrome({
            storage: {
                [STORAGE_KEYS.REDIRECT_RULES]: [
                    { from: 'a', to: 'b' },
                    { from: 'c', to: 'd' },
                ],
            },
        });

        await removeRedirectRule(0);

        expect(storage[STORAGE_KEYS.REDIRECT_RULES]).toEqual([
            { from: 'c', to: 'd' },
        ]);
    });

    it('getRedirectRules returns empty list when nothing stored', async () => {
        mockChrome({});
        expect(await getRedirectRules()).toEqual([]);
    });
});
