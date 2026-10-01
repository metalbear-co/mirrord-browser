import { syncBaggageMode } from '../baggageMode';

const baggageRule: chrome.declarativeNetRequest.Rule = {
    id: 1,
    priority: 1,
    action: {
        type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
        requestHeaders: [
            {
                header: 'baggage',
                operation:
                    'set' as chrome.declarativeNetRequest.HeaderOperation,
                value: 'mirrord-session=k1',
            },
        ],
    },
    condition: {
        urlFilter: '|',
        resourceTypes: [
            'xmlhttprequest' as chrome.declarativeNetRequest.ResourceType,
        ],
    },
};

describe('syncBaggageMode', () => {
    const store: Record<string, unknown> = {};
    const registered = new Set<string>();
    let rules: chrome.declarativeNetRequest.Rule[];

    beforeEach(() => {
        store['baggage_merge'] = true;
        registered.clear();
        rules = [baggageRule];
        globalThis.chrome = {
            runtime: { lastError: undefined },
            storage: {
                local: {
                    get: (keys: string[], cb: (r: object) => void) =>
                        cb(Object.fromEntries(keys.map((k) => [k, store[k]]))),
                },
            },
            tabs: { query: () => Promise.resolve([]) },
            scripting: {
                getRegisteredContentScripts: ({ ids }: { ids: string[] }) =>
                    Promise.resolve(
                        ids
                            .filter((id) => registered.has(id))
                            .map((id) => ({ id }))
                    ),
                unregisterContentScripts: ({ ids }: { ids: string[] }) =>
                    ids.every((id) => registered.delete(id))
                        ? Promise.resolve()
                        : Promise.reject(new Error('Nonexistent script ID')),
                registerContentScripts: (scripts: { id: string }[]) => {
                    if (scripts.some(({ id }) => registered.has(id))) {
                        return Promise.reject(new Error('Duplicate script ID'));
                    }
                    scripts.forEach(({ id }) => {
                        registered.add(id);
                    });
                    return Promise.resolve();
                },
            },
            declarativeNetRequest: {
                getDynamicRules: (cb: (r: typeof rules) => void) => {
                    cb(rules);
                },
                updateDynamicRules: (
                    opts: chrome.declarativeNetRequest.UpdateRuleOptions,
                    cb: () => void
                ) => {
                    const removed = new Set(opts.removeRuleIds ?? []);
                    rules = [
                        ...rules.filter(({ id }) => !removed.has(id)),
                        ...(opts.addRules ?? []),
                    ];
                    cb();
                },
            },
        } as unknown as typeof chrome;
    });

    it('ends in the latest mode when toggles overlap', async () => {
        await syncBaggageMode();
        store['baggage_merge'] = false;
        const off = syncBaggageMode();
        store['baggage_merge'] = true;
        const on = syncBaggageMode();
        await Promise.allSettled([off, on]);

        expect([...registered].sort()).toEqual([
            'baggage-bridge',
            'baggage-merge',
        ]);
        expect(rules[0]?.condition.resourceTypes).not.toContain(
            'xmlhttprequest'
        );
    });
});
