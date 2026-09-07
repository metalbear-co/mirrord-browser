import {
    refreshIconIndicator,
    parseRules,
    buildDnrRule,
    encodeConfig,
    buildShareUrl,
    sessionInjectionPair,
    aggregateSessions,
    toClusterSessions,
    normalizePreviewPhase,
    previewPhaseTone,
    previewPhaseLabel,
    previewStatusLine,
    isPreviewLive,
    isGroupLive,
    formatDurationSecs,
} from '../util';
import type {
    ClusterSession,
    ExecSession,
    OperatorPreviewSession,
    OperatorSessionSummary,
    PreviewPhase,
    PreviewSession,
} from '../types';
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
        expect(result[0]?.scope).toBe('*://api.example.com/*');
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

        expect(result[0]?.scope).toBe(STRINGS.MSG_ALL_URLS);
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

        expect(rules[0]?.condition.urlFilter).toBe('|');
    });

    it('uses provided scope as urlFilter', () => {
        const rules = buildDnrRule('X-Test', 'value', '*://api.example.com/*');

        expect(rules[0]?.condition.urlFilter).toBe('*://api.example.com/*');
    });

    it('includes ALL_RESOURCE_TYPES', () => {
        const rules = buildDnrRule('X-Test', 'value');

        expect(rules[0]?.condition.resourceTypes).toBe(ALL_RESOURCE_TYPES);
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
        if (payload === undefined) {
            throw new Error('expected a config payload in the share url');
        }
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

describe('aggregateSessions', () => {
    const session = (over: Partial<ExecSession>): ClusterSession => ({
        kind: 'exec',
        id: 'id-1',
        key: 'k',
        namespace: 'ns',
        owner: { username: 'alice', k8sUsername: 'alice@k8s' },
        target: { kind: 'deployment', name: 'web', container: 'app' },
        createdAt: '2026-07-13T00:00:00Z',
        ...over,
    });

    it('aggregates owners, targets, and namespaces', () => {
        const agg = aggregateSessions([
            session({}),
            session({
                id: 'id-2',
                owner: { username: 'bob', k8sUsername: 'b' },
            }),
        ]);
        expect(agg.owners.sort()).toEqual(['alice', 'bob']);
        expect(agg.targets).toEqual(['deployment/web']);
        expect(agg.preview).toBeNull();
    });

    it('tolerates sessions with null owner, target, and createdAt', () => {
        const agg = aggregateSessions([
            session({ owner: null, target: null, createdAt: null }),
            session({ id: 'id-2' }),
        ]);
        expect(agg.owners).toEqual(['alice']);
        expect(agg.targets.sort()).toEqual(['deployment/web', 'targetless']);
        expect(agg.earliestCreatedAt).toBe('2026-07-13T00:00:00Z');
    });

    it('surfaces the preview environment behind the key', () => {
        const agg = aggregateSessions([
            previewSession({ phase: 'idle', idleSecs: 90 }),
        ]);
        expect(agg.preview?.phase).toBe('idle');
        // A preview has no owner to attribute it to.
        expect(agg.owners).toEqual([]);
    });
});

const wirePreview = (
    over: Partial<OperatorPreviewSession> = {}
): OperatorPreviewSession => ({
    id: 'id-1',
    key: 'k',
    namespace: 'ns',
    target: { kind: 'deployment', name: 'web', container: 'app' },
    createdAt: '2026-07-13T00:00:00Z',
    phase: 'ready',
    ...over,
});

const previewSession = (
    over: Partial<PreviewSession> = {}
): PreviewSession => ({
    kind: 'preview',
    id: 'id-1',
    key: 'k',
    namespace: 'ns',
    target: { kind: 'deployment', name: 'web', container: 'app' },
    createdAt: '2026-07-13T00:00:00Z',
    phase: 'ready',
    ...over,
});

describe('toClusterSessions', () => {
    // A preview as the operator folds it into the plain session list, for older clients.
    const folded = (
        over: Partial<OperatorSessionSummary> = {}
    ): OperatorSessionSummary => ({
        id: 'id-1',
        key: 'k',
        namespace: 'ns',
        owner: { username: 'preview-env', k8sUsername: 'preview-env' },
        target: { kind: 'deployment', name: 'web', container: 'app' },
        createdAt: '2026-07-13T00:00:00Z',
        ...over,
    });

    const exec = (
        over: Partial<OperatorSessionSummary> = {}
    ): OperatorSessionSummary => ({
        id: 'exec-1',
        key: 'k2',
        namespace: 'ns',
        owner: { username: 'alice', k8sUsername: 'alice@k8s' },
        target: { kind: 'deployment', name: 'api', container: 'app' },
        createdAt: '2026-07-13T00:00:00Z',
        ...over,
    });

    it('classifies an ordinary session as exec', () => {
        const [session] = toClusterSessions([exec()], undefined);
        expect(session?.kind).toBe('exec');
        expect(session?.kind === 'exec' && session.owner?.username).toBe(
            'alice'
        );
    });

    it('lists a preview once when it arrives in both lists', () => {
        const sessions = toClusterSessions(
            [exec(), folded()],
            [wirePreview({ phase: 'idle', idleSecs: 30 })]
        );
        expect(sessions).toHaveLength(2);
        const previews = sessions.filter((s) => s.kind === 'preview');
        expect(previews).toHaveLength(1);
        // The dedicated list wins, so the phase survives.
        expect(previews[0]?.kind === 'preview' && previews[0].phase).toBe(
            'idle'
        );
    });

    it('prefers the dedicated list even when the folded entry has a different id', () => {
        const sessions = toClusterSessions(
            [folded({ id: 'stale-id' })],
            [wirePreview({ id: 'fresh-id', phase: 'failed' })]
        );
        expect(sessions).toHaveLength(1);
        expect(sessions[0]?.kind === 'preview' && sessions[0].phase).toBe(
            'failed'
        );
    });

    it('falls back to the folded preview when the operator reports no preview list', () => {
        const sessions = toClusterSessions([exec(), folded()], undefined);
        expect(sessions.map((s) => s.kind).sort()).toEqual(['exec', 'preview']);
        // Nothing told us the phase, so we claim nothing about it.
        const preview = sessions.find((s) => s.kind === 'preview');
        expect(preview?.kind === 'preview' && preview.phase).toBe('unknown');
    });

    it('keeps a folded preview the dedicated list never mentioned', () => {
        const sessions = toClusterSessions(
            [folded({ id: 'orphan', key: 'k-orphan' })],
            [wirePreview({ id: 'other', key: 'k-other' })]
        );
        expect(sessions.map((s) => s.key).sort()).toEqual([
            'k-orphan',
            'k-other',
        ]);
    });

    // A preview is reached by key, so the folded twin's filter is not consulted. The operator
    // sends the bare key there, which never parses as a header line anyway.
    it('routes a preview by key, ignoring the folded filter', () => {
        const [session] = toClusterSessions(
            [folded({ httpFilter: { headerFilter: 'x-tenant: alice' } })],
            [wirePreview()]
        );
        expect(session).toBeDefined();
        expect(session && sessionInjectionPair(session)).toEqual({
            header: 'baggage',
            value: 'mirrord-session=k',
        });
    });

    it('takes a preview the operator never folded in', () => {
        const sessions = toClusterSessions([], [wirePreview()]);
        expect(sessions).toHaveLength(1);
        expect(sessions[0] && sessionInjectionPair(sessions[0])).toEqual({
            header: 'baggage',
            value: 'mirrord-session=k',
        });
    });

    it('normalizes an unrecognized phase on the way in', () => {
        const [session] = toClusterSessions(
            [],
            [wirePreview({ phase: 'hibernating' as PreviewPhase })]
        );
        expect(session?.kind === 'preview' && session.phase).toBe('unknown');
    });

    it('drops idleSecs for a phase that is not idle', () => {
        const [session] = toClusterSessions(
            [],
            [wirePreview({ phase: 'ready', idleSecs: 90 })]
        );
        expect(session?.kind === 'preview' && session.idleSecs).toBeUndefined();
    });
});

describe('normalizePreviewPhase', () => {
    it.each([
        'initializing',
        'waiting',
        'ready',
        'failed',
        'idle',
        'paused',
        'unknown',
    ])('passes %s through', (phase) => {
        expect(normalizePreviewPhase(phase)).toBe(phase);
    });

    it.each([['hibernating'], [''], [undefined], [null], [42]])(
        'falls back to unknown for %p',
        (raw) => {
            expect(normalizePreviewPhase(raw)).toBe('unknown');
        }
    );
});

describe('previewPhaseTone', () => {
    it.each([
        ['ready', 'live'],
        ['initializing', 'pending'],
        ['waiting', 'pending'],
        ['failed', 'failed'],
        ['idle', 'idle'],
        ['paused', 'paused'],
    ] as const)('maps %s to %s', (phase, tone) => {
        expect(previewPhaseTone(previewSession({ phase }))).toBe(tone);
    });

    it('gives an unreported phase no tone, so it renders as it always did', () => {
        expect(
            previewPhaseTone(previewSession({ phase: 'unknown' }))
        ).toBeNull();
    });
});

describe('previewPhaseLabel', () => {
    it('annotates idle with how long it has been idling', () => {
        expect(
            previewPhaseLabel(previewSession({ phase: 'idle', idleSecs: 330 }))
        ).toBe('idle 5m 30s');
    });

    it('omits the duration when the operator did not report one', () => {
        expect(previewPhaseLabel(previewSession({ phase: 'idle' }))).toBe(
            'idle'
        );
    });

    it.each(['initializing', 'waiting', 'failed', 'paused'] as const)(
        'labels %s with the phase word',
        (phase) => {
            expect(previewPhaseLabel(previewSession({ phase }))).toBe(phase);
        }
    );

    it.each(['ready', 'unknown'] as const)('leaves %s unannotated', (phase) => {
        expect(previewPhaseLabel(previewSession({ phase }))).toBeNull();
    });
});

describe('previewStatusLine', () => {
    it('reports how long an idle preview has been idling', () => {
        expect(
            previewStatusLine(previewSession({ phase: 'idle', idleSecs: 330 }))
        ).toBe('Idle for 5m 30s');
    });

    it('omits the duration when the operator did not report one', () => {
        expect(previewStatusLine(previewSession({ phase: 'idle' }))).toBe(
            'Idle'
        );
    });

    it('reports a paused preview', () => {
        expect(previewStatusLine(previewSession({ phase: 'paused' }))).toBe(
            STRINGS.MSG_PREVIEW_PAUSED
        );
    });

    it('reports a failed preview', () => {
        expect(previewStatusLine(previewSession({ phase: 'failed' }))).toBe(
            STRINGS.MSG_PREVIEW_FAILED
        );
    });

    it('falls back to the generic line for an unknown phase', () => {
        expect(previewStatusLine(previewSession({ phase: 'unknown' }))).toBe(
            STRINGS.MSG_AVAILABLE
        );
    });
});

describe('isPreviewLive', () => {
    it.each(['ready', 'idle', 'unknown'] as const)(
        'counts %s as live',
        (phase) => {
            expect(isPreviewLive(previewSession({ phase }))).toBe(true);
        }
    );

    it.each(['initializing', 'waiting', 'paused', 'failed'] as const)(
        'does not count %s as live',
        (phase) => {
            expect(isPreviewLive(previewSession({ phase }))).toBe(false);
        }
    );
});

describe('isGroupLive', () => {
    const exec: ClusterSession = {
        kind: 'exec',
        id: 'e1',
        key: 'k',
        namespace: 'ns',
        owner: { username: 'alice', k8sUsername: 'alice@k8s' },
        target: null,
        createdAt: null,
    };

    it('treats a group of exec sessions as live', () => {
        expect(isGroupLive([exec])).toBe(true);
    });

    it('follows the preview phase when the group is a preview', () => {
        expect(isGroupLive([previewSession({ phase: 'ready' })])).toBe(true);
        expect(isGroupLive([previewSession({ phase: 'failed' })])).toBe(false);
        expect(isGroupLive([previewSession({ phase: 'paused' })])).toBe(false);
    });

    it('treats an empty group as live', () => {
        expect(isGroupLive([])).toBe(true);
    });
});

describe('formatDurationSecs', () => {
    it.each([
        [0, '0s'],
        [45, '45s'],
        [90, '1m 30s'],
        [3600, '1h 0m'],
        [7860, '2h 11m'],
        [-5, '0s'],
    ])('formats %d as %s', (secs, expected) => {
        expect(formatDurationSecs(secs)).toBe(expected);
    });
});
