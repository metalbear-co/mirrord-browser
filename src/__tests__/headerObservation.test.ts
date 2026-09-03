import {
    RING_SECONDS,
    armCanary,
    cancelCanary,
    emptyObservation,
    noteRequestSeen,
    notifyHeaderObserved,
    recordRequest,
    rotateBuckets,
    setHeaderName,
} from '../headerObservation';
import { emitUserBlocked } from '../analytics';

jest.mock('../analytics', () => ({
    emitUserBlocked: jest.fn(),
    emitUserSucceeded: jest.fn(),
}));

const blocked = emitUserBlocked as jest.MockedFunction<typeof emitUserBlocked>;

describe('headerObservation', () => {
    test('emptyObservation seeds RING_SECONDS zero buckets', () => {
        const obs = emptyObservation('x-mirrord-user', 1_700_000_000_000);
        expect(obs.buckets.length).toBe(RING_SECONDS);
        expect(obs.totalLast60s).toBe(0);
        expect(obs.recent.length).toBe(0);
    });

    test('recordRequest increments and tracks recent URLs', () => {
        const t0 = 1_700_000_000_000;
        const obs = emptyObservation('x-mirrord-user', 1_700_000_000_000);
        const next = recordRequest(obs, 'https://x.test/a', 'GET', t0);
        expect(next.totalLast60s).toBe(1);
        expect(next.recent[0]?.url).toBe('https://x.test/a');
    });

    test('rotateBuckets shifts elapsed seconds and zeros new buckets', () => {
        const t0 = 1_700_000_000_000;
        let obs = emptyObservation('h', t0);
        obs = recordRequest(obs, 'https://x.test/a', 'GET', t0);
        const after = rotateBuckets(obs, t0 + 5_000);
        expect(after.totalLast60s).toBe(1);
        expect(after.bucketStartMs).toBe(
            Math.floor((t0 + 5_000) / 1000) * 1000
        );
    });

    test('rotateBuckets clears entirely after RING_SECONDS', () => {
        const t0 = 1_700_000_000_000;
        let obs = emptyObservation('h', t0);
        obs = recordRequest(obs, 'https://x.test/a', 'GET', t0);
        const after = rotateBuckets(obs, t0 + (RING_SECONDS + 5) * 1000);
        expect(after.totalLast60s).toBe(0);
    });

    test('setHeaderName resets when changed (case-insensitive match keeps state)', () => {
        const t0 = 1_700_000_000_000;
        let obs = emptyObservation('x-mirrord-user', t0);
        obs = recordRequest(obs, 'https://x.test/a', 'GET', t0);
        const same = setHeaderName(obs, 'X-Mirrord-User');
        expect(same).toBe(obs);
        const changed = setHeaderName(obs, 'x-other');
        expect(changed.totalLast60s).toBe(0);
        expect(changed.headerName).toBe('x-other');
    });

    test('recent ring caps at three entries with newest first', () => {
        const t0 = 1_700_000_000_000;
        let obs = emptyObservation('h', t0);
        obs = recordRequest(obs, 'https://x.test/1', 'GET', t0);
        obs = recordRequest(obs, 'https://x.test/2', 'GET', t0 + 1);
        obs = recordRequest(obs, 'https://x.test/3', 'GET', t0 + 2);
        obs = recordRequest(obs, 'https://x.test/4', 'GET', t0 + 3);
        expect(obs.recent.length).toBe(3);
        expect(obs.recent[0]?.url).toBe('https://x.test/4');
        expect(obs.recent[2]?.url).toBe('https://x.test/2');
    });
});

describe('header canary timeout context', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        blocked.mockClear();
        cancelCanary();
    });

    afterEach(() => {
        cancelCanary();
        jest.useRealTimers();
    });

    test('reports zero requests when the browser sent none', () => {
        armCanary({
            headerName: 'x-mirrord-user',
            flow: 'header_injector',
            scoped: false,
        });
        jest.advanceTimersByTime(60_000);
        expect(blocked).toHaveBeenCalledWith('no_header_observed', 'health', {
            headerName: 'x-mirrord-user',
            flow: 'header_injector',
            scoped: false,
            requestsSeen: 0,
        });
    });

    test('reports the request count when traffic flowed without the header', () => {
        armCanary({
            headerName: 'x-mirrord-user',
            flow: 'session_monitor',
            scoped: true,
        });
        noteRequestSeen();
        noteRequestSeen();
        noteRequestSeen();
        jest.advanceTimersByTime(60_000);
        expect(blocked).toHaveBeenCalledWith('no_header_observed', 'health', {
            headerName: 'x-mirrord-user',
            flow: 'session_monitor',
            scoped: true,
            requestsSeen: 3,
        });
    });

    test('does not count requests seen while no canary is armed', () => {
        noteRequestSeen();
        noteRequestSeen();
        armCanary({
            headerName: 'x-mirrord-user',
            flow: 'header_injector',
            scoped: false,
        });
        noteRequestSeen();
        jest.advanceTimersByTime(60_000);
        expect(blocked).toHaveBeenCalledWith(
            'no_header_observed',
            'health',
            expect.objectContaining({ requestsSeen: 1 })
        );
    });

    test('observing the header cancels the timeout entirely', () => {
        armCanary({
            headerName: 'x-mirrord-user',
            flow: 'header_injector',
            scoped: false,
        });
        noteRequestSeen();
        notifyHeaderObserved('X-Mirrord-User');
        jest.advanceTimersByTime(60_000);
        expect(blocked).not.toHaveBeenCalled();
    });
});
