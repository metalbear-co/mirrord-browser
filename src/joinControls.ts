import { STORAGE_KEYS } from './types';
import type { OperatorSessionSummary, OperatorSessionsResponse } from './types';
import {
    buildDnrRule,
    deriveInjectionHint,
    getDynamicRules,
    storageGet,
    storageRemove,
    storageSet,
    updateDynamicRules,
} from './util';

const BAGGAGE_HEADER_NAME = 'baggage';
const BAGGAGE_VALUE_PREFIX = 'mirrord-session=';

export type JoinError =
    | 'no_backend'
    | 'fetch_failed'
    | 'key_not_visible'
    | 'storage_failed';

export interface JoinSuccess {
    ok: true;
    joinedKey: string;
    joinedSessionId: string;
    header: string;
    value: string;
}

export interface JoinFailure {
    ok: false;
    error: JoinError;
    message?: string;
}

export type JoinResult = JoinSuccess | JoinFailure;

async function fetchOperatorSessions(
    backend: string,
    token: string
): Promise<OperatorSessionsResponse> {
    const url = `${backend}/api/operator-sessions?token=${encodeURIComponent(token)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
        throw new Error(
            `mirrord ui responded ${resp.status} ${resp.statusText}: ${await resp.text()}`
        );
    }
    return (await resp.json()) as OperatorSessionsResponse;
}

export async function joinSession(key: string): Promise<JoinResult> {
    const stored = await storageGet([
        STORAGE_KEYS.MIRRORD_UI_BACKEND,
        STORAGE_KEYS.MIRRORD_UI_TOKEN,
        STORAGE_KEYS.SCOPE_PATTERNS,
    ]);
    const backend = stored[STORAGE_KEYS.MIRRORD_UI_BACKEND] as
        | string
        | undefined;
    const token = stored[STORAGE_KEYS.MIRRORD_UI_TOKEN] as string | undefined;
    if (!backend || !token) {
        return { ok: false, error: 'no_backend' };
    }
    const scopePatterns = Array.isArray(stored[STORAGE_KEYS.SCOPE_PATTERNS])
        ? (stored[STORAGE_KEYS.SCOPE_PATTERNS] as unknown[]).filter(
              (p): p is string => typeof p === 'string'
          )
        : [];

    let response: OperatorSessionsResponse;
    try {
        response = await fetchOperatorSessions(backend, token);
    } catch (e) {
        return {
            ok: false,
            error: 'fetch_failed',
            message: e instanceof Error ? e.message : String(e),
        };
    }

    const target: OperatorSessionSummary | undefined = response.sessions.find(
        (s) => s.key === key
    );
    if (!target) {
        return { ok: false, error: 'key_not_visible' };
    }

    const filterHint = deriveInjectionHint(target.httpFilter?.headerFilter);
    const header = filterHint?.header ?? BAGGAGE_HEADER_NAME;
    const value = filterHint?.value ?? `${BAGGAGE_VALUE_PREFIX}${key}`;

    try {
        const existing = await getDynamicRules();
        await updateDynamicRules({
            removeRuleIds: existing.map((r) => r.id),
            addRules: buildDnrRule(header, value, scopePatterns),
        });
        await storageSet({
            [STORAGE_KEYS.JOINED_KEY]: key,
            [STORAGE_KEYS.JOINED_SESSION_NAME]: target.id,
            [STORAGE_KEYS.JOINED_HEADER]: header,
            [STORAGE_KEYS.JOINED_VALUE]: value,
        });
    } catch (e) {
        return {
            ok: false,
            error: 'storage_failed',
            message: e instanceof Error ? e.message : String(e),
        };
    }

    return {
        ok: true,
        joinedKey: key,
        joinedSessionId: target.id,
        header,
        value,
    };
}

export async function clearJoin(): Promise<{
    ok: true;
}> {
    const existing = await getDynamicRules();
    await updateDynamicRules({
        removeRuleIds: existing.map((r) => r.id),
        addRules: [],
    });
    await storageRemove([
        STORAGE_KEYS.JOINED_KEY,
        STORAGE_KEYS.JOINED_SESSION_NAME,
        STORAGE_KEYS.JOINED_HEADER,
        STORAGE_KEYS.JOINED_VALUE,
        STORAGE_KEYS.SCOPE_PATTERNS,
    ]);
    return { ok: true };
}
