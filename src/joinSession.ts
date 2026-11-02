// Shared session-join logic, kept free of module-level side effects so it can be imported by
// both the config-link handler (config.ts) and the metalbear.com result page (applied.tsx)
// without dragging in either page's DOM bootstrap.
import {
    buildDnrRule,
    deriveInjectionHint,
    getDynamicRules,
    refreshIconIndicator,
    sessionInjectionPair,
    storageGet,
    storageSet,
    updateDynamicRules,
} from './util';
import type { ClusterSession, LocalSessionSummary } from './types';
import { STORAGE_KEYS } from './types';
import {
    fetchLocalSessions,
    fetchOperatorSessions,
    fetchOperatorSessionsV2,
    isAuthFailureStatus,
} from './hooks/useMirrordUi';

export interface JoinTarget {
    header: string;
    value: string;
    sessionName: string;
    context: string | null;
    resolved: 'local' | 'operator' | 'key_convention';
}

export function isMirrordUiAuthError(err: unknown): boolean {
    const status =
        err instanceof Error
            ? (err as Error & { status?: unknown }).status
            : undefined;
    return isAuthFailureStatus(typeof status === 'number' ? status : undefined);
}

function localHeaderFilter(session: LocalSessionSummary): string | null {
    const config = session.config as
        | {
              feature?: {
                  network?: {
                      incoming?: { http_filter?: { header_filter?: unknown } };
                  };
              };
          }
        | undefined;
    const filter =
        config?.feature?.network?.incoming?.http_filter?.header_filter;
    return typeof filter === 'string' ? filter : null;
}

async function findLocalSession(
    backend: string,
    token: string,
    key: string
): Promise<LocalSessionSummary | undefined> {
    try {
        const sessions = await fetchLocalSessions(backend, token);
        return sessions.find((s) => s.key === key);
    } catch (err) {
        if (isMirrordUiAuthError(err)) {
            throw err;
        }
        return undefined;
    }
}

async function listOperatorSessions(
    backend: string,
    token: string,
    context: string | null
): Promise<ClusterSession[]> {
    if (context) {
        try {
            return (await fetchOperatorSessionsV2(backend, token, context))
                .sessions;
        } catch (err) {
            if (isMirrordUiAuthError(err)) {
                throw err;
            }
        }
    }
    return (await fetchOperatorSessions(backend, token)).sessions;
}

async function findOperatorSession(
    backend: string,
    token: string,
    key: string,
    context: string | null
): Promise<ClusterSession | undefined> {
    try {
        const sessions = await listOperatorSessions(backend, token, context);
        return sessions.find((s) => s.key === key);
    } catch (err) {
        if (isMirrordUiAuthError(err)) {
            throw err;
        }
        return undefined;
    }
}

export async function resolveJoinTarget(
    backend: string,
    token: string,
    key: string,
    context: string | null
): Promise<JoinTarget> {
    const local = await findLocalSession(backend, token, key);
    const sessionContext = context ?? local?.context ?? null;
    const target = await findOperatorSession(
        backend,
        token,
        key,
        sessionContext
    );
    const localHint = local
        ? deriveInjectionHint(localHeaderFilter(local))
        : null;
    const { header, value } =
        localHint ?? sessionInjectionPair(target ?? { key, httpFilter: null });
    return {
        header,
        value,
        sessionName: target?.id ?? key,
        context: sessionContext,
        resolved: localHint ? 'local' : target ? 'operator' : 'key_convention',
    };
}

/**
 * Look for a live operator session whose injection header matches the shared
 * header, and join it (same storage/DNR shape as the popup join flow).
 * @param headerName the HTTP header name from the shared link
 * @param headerValue the HTTP header value from the shared link
 * @returns the joined session key, or null when mirrord ui isn't configured
 * or no live session matches — the caller then falls back to a manual rule
 */
export async function joinMatchingSession(
    headerName: string,
    headerValue: string
): Promise<string | null> {
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
        return null;
    }

    let sessions: ClusterSession[];
    try {
        ({ sessions } = await fetchOperatorSessions(backend, token));
    } catch {
        return null;
    }

    const target = sessions.find((s) => {
        const pair = sessionInjectionPair(s);
        return (
            pair.header.toLowerCase() === headerName.toLowerCase() &&
            pair.value === headerValue
        );
    });
    if (!target) {
        return null;
    }

    const { header, value } = sessionInjectionPair(target);
    const scope =
        (stored[STORAGE_KEYS.SCOPE_PATTERNS] as string[] | undefined) ?? [];
    const existing = await getDynamicRules();
    await updateDynamicRules({
        removeRuleIds: existing.map((r) => r.id),
        addRules: buildDnrRule(header, value, scope),
    });
    await storageSet({
        [STORAGE_KEYS.JOINED_KEY]: target.key,
        [STORAGE_KEYS.JOINED_SESSION_NAME]: target.id,
        [STORAGE_KEYS.JOINED_HEADER]: header,
        [STORAGE_KEYS.JOINED_VALUE]: value,
    });
    refreshIconIndicator(1);
    return target.key;
}
