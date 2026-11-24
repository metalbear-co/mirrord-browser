import {
    applyOperatorEvent,
    emptyActivity,
    groupByService,
    imageVersion,
    type ActivityState,
} from '../activity';

const httpEvent = (service: string, uri: string, key = 'k') =>
    JSON.stringify({
        session_key: key,
        service_name: service,
        cluster: 'c',
        data: { http_request: { method: 'GET', uri } },
    });

describe('activity', () => {
    test('a service keeps its card after its rows fall off the cap', () => {
        let state: ActivityState = emptyActivity('k');
        state = applyOperatorEvent(state, httpEvent('auth', '/login'), 0);
        let t = 0;
        for (let page = 1; page <= 30; page++) {
            t += 30_000;
            for (let call = 0; call < 10; call++) {
                const service = call < 5 ? 'orders' : 'catalog';
                state = applyOperatorEvent(
                    state,
                    httpEvent(service, `/api/item/${page * 10 + call}`),
                    t
                );
            }
        }
        expect(state.hits.some((h) => h.service === 'auth')).toBe(false);
        const auth = groupByService(state).find((g) => g.service === 'auth');
        expect(auth?.count).toBe(1);
        expect(auth?.latest.path).toBe('/login');
        expect(auth?.requests).toHaveLength(1);
        const orders = groupByService(state).find(
            (g) => g.service === 'orders'
        );
        expect(orders?.count).toBe(150);
    });

    test('groups services by most recent hit and merges repeats', () => {
        let state = emptyActivity('k');
        state = applyOperatorEvent(state, httpEvent('a', '/x'), 0);
        state = applyOperatorEvent(state, httpEvent('b', '/y'), 1_000);
        state = applyOperatorEvent(state, httpEvent('a', '/x'), 2_000);
        const groups = groupByService(state);
        expect(groups.map((g) => g.service)).toEqual(['a', 'b']);
        expect(groups[0]?.count).toBe(2);
        expect(groups[0]?.requests).toEqual([
            { kind: 'http', method: 'GET', path: '/x', count: 2, status: null },
        ]);
    });

    test('ignores events for other session keys', () => {
        const state = emptyActivity('k');
        expect(
            applyOperatorEvent(state, httpEvent('a', '/x', 'other'), 0)
        ).toBe(state);
    });

    test.each([
        ['ghcr.io/org/app:v1.2', 'v1.2'],
        ['ghcr.io/org/app', 'latest'],
        ['localhost:5000/app', 'latest'],
        ['ghcr.io/org/app@sha256:4f2a9c1b7e3d8a6f0b5c2e9d1a7f3b8c', '4f2a9c1'],
        ['ghcr.io/org/app:v1@sha256:4f2a9c1b7e3d8a6f0b5c2e9d1a7f3b8c', 'v1'],
        ['ghcr.io/org/app:4f2a9c1b7e3d8a6f', '4f2a9c1'],
    ])('imageVersion(%s) is %s', (image, version) => {
        expect(imageVersion(image)).toBe(version);
    });
});
