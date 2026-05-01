export const HEADER_OBSERVATION_PORT = 'header-observation';

export const RING_SECONDS = 60;
export const RECENT_URL_LIMIT = 3;

export type RecentUrl = {
    url: string;
    method: string;
    at: number;
};

export type HeaderObservation = {
    headerName: string;
    bucketStartMs: number;
    buckets: number[];
    recent: RecentUrl[];
    totalLast60s: number;
};

export function emptyObservation(
    headerName: string,
    nowMs: number = Date.now()
): HeaderObservation {
    return {
        headerName,
        bucketStartMs: alignToSecond(nowMs),
        buckets: new Array<number>(RING_SECONDS).fill(0),
        recent: [],
        totalLast60s: 0,
    };
}

export function alignToSecond(ms: number): number {
    return Math.floor(ms / 1000) * 1000;
}

export function rotateBuckets(
    obs: HeaderObservation,
    nowMs: number
): HeaderObservation {
    const nowSec = alignToSecond(nowMs);
    const elapsedSec = Math.floor((nowSec - obs.bucketStartMs) / 1000);
    if (elapsedSec <= 0) return obs;
    const buckets = obs.buckets.slice();
    if (elapsedSec >= RING_SECONDS) {
        buckets.fill(0);
    } else {
        buckets.splice(0, elapsedSec);
        for (let i = 0; i < elapsedSec; i += 1) buckets.push(0);
    }
    return {
        ...obs,
        bucketStartMs: nowSec,
        buckets,
        totalLast60s: buckets.reduce((a, b) => a + b, 0),
    };
}

export function recordRequest(
    obs: HeaderObservation,
    url: string,
    method: string,
    nowMs: number
): HeaderObservation {
    const rotated = rotateBuckets(obs, nowMs);
    const buckets = rotated.buckets.slice();
    buckets[RING_SECONDS - 1] = (buckets[RING_SECONDS - 1] ?? 0) + 1;
    const recent = [{ url, method, at: nowMs }, ...rotated.recent].slice(
        0,
        RECENT_URL_LIMIT
    );
    return {
        ...rotated,
        buckets,
        recent,
        totalLast60s: buckets.reduce((a, b) => a + b, 0),
    };
}

export function setHeaderName(
    obs: HeaderObservation,
    headerName: string
): HeaderObservation {
    if (obs.headerName.toLowerCase() === headerName.toLowerCase()) return obs;
    return emptyObservation(headerName);
}
