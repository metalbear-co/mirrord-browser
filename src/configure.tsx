import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@metalbear/ui/styles.css';
import { Card, CardContent } from '@metalbear/ui';
import { STORAGE_KEYS } from './types';
import { capture } from './analytics';
import { fetchOperatorSessions } from './hooks/useMirrordUi';
import {
    buildDnrRule,
    getDynamicRules,
    updateDynamicRules,
    storageGet,
    storageSet,
} from './util';
import {
    CONFIGURE_STATUS,
    STRINGS,
    type ConfigureStatusKind,
} from './constants';

type Status =
    | { kind: typeof CONFIGURE_STATUS.LOADING }
    | { kind: typeof CONFIGURE_STATUS.CONNECTED }
    | { kind: typeof CONFIGURE_STATUS.JOINED; header: string; value: string }
    | { kind: typeof CONFIGURE_STATUS.KEY_NOT_VISIBLE; key: string }
    | { kind: typeof CONFIGURE_STATUS.MISSING_CONFIG }
    | { kind: typeof CONFIGURE_STATUS.NOT_CONFIGURED };

async function storeBackendAndToken(
    backend: string,
    token: string
): Promise<void> {
    await storageSet({
        [STORAGE_KEYS.MIRRORD_UI_BACKEND]: backend,
        [STORAGE_KEYS.MIRRORD_UI_TOKEN]: token,
    });
}

async function joinKey(
    key: string,
    backend: string,
    token: string
): Promise<Status> {
    const resp = await fetchOperatorSessions(backend, token);
    const target = resp.sessions.find((s) => s.key === key);
    if (!target) return { kind: CONFIGURE_STATUS.KEY_NOT_VISIBLE, key };
    const header = 'baggage';
    const value = `mirrord-session=${key}`;
    const existing = await getDynamicRules();
    await updateDynamicRules({
        removeRuleIds: existing.map((r) => r.id),
        addRules: buildDnrRule(header, value),
    });
    await storageSet({
        [STORAGE_KEYS.JOINED_KEY]: key,
        [STORAGE_KEYS.JOINED_SESSION_NAME]: target.id,
    });
    return { kind: CONFIGURE_STATUS.JOINED, header, value };
}

async function resolveStatus(params: URLSearchParams): Promise<Status> {
    const backendParam = params.get('backend');
    const tokenParam = params.get('token');
    const joinParam = params.get('join');

    if (backendParam && tokenParam) {
        await storeBackendAndToken(backendParam, tokenParam);
        capture('extension_configured', { hasJoinParam: !!joinParam });
        if (!joinParam) return { kind: CONFIGURE_STATUS.CONNECTED };
        return joinKey(joinParam, backendParam, tokenParam);
    }

    if (joinParam) {
        const stored = await storageGet([
            STORAGE_KEYS.MIRRORD_UI_BACKEND,
            STORAGE_KEYS.MIRRORD_UI_TOKEN,
        ]);
        const backend = stored[STORAGE_KEYS.MIRRORD_UI_BACKEND] as
            | string
            | undefined;
        const token = stored[STORAGE_KEYS.MIRRORD_UI_TOKEN] as
            | string
            | undefined;
        if (!backend || !token)
            return { kind: CONFIGURE_STATUS.NOT_CONFIGURED };
        return joinKey(joinParam, backend, token);
    }

    return { kind: CONFIGURE_STATUS.MISSING_CONFIG };
}

const COPY: Record<
    Exclude<ConfigureStatusKind, typeof CONFIGURE_STATUS.LOADING>,
    { title: string; hint: string }
> = {
    [CONFIGURE_STATUS.CONNECTED]: {
        title: STRINGS.MSG_MIRRORD_UI_CONNECTED,
        hint: STRINGS.MSG_MIRRORD_UI_CONNECTED_HINT,
    },
    [CONFIGURE_STATUS.JOINED]: {
        title: STRINGS.MSG_JOINED_SESSION,
        hint: STRINGS.MSG_JOINED_SESSION_HINT,
    },
    [CONFIGURE_STATUS.KEY_NOT_VISIBLE]: {
        title: STRINGS.MSG_KEY_NOT_VISIBLE,
        hint: STRINGS.MSG_KEY_NOT_VISIBLE_HINT,
    },
    [CONFIGURE_STATUS.MISSING_CONFIG]: {
        title: STRINGS.MSG_MISSING_CONFIG,
        hint: STRINGS.MSG_MISSING_CONFIG_HINT,
    },
    [CONFIGURE_STATUS.NOT_CONFIGURED]: {
        title: STRINGS.MSG_UI_NOT_CONFIGURED,
        hint: STRINGS.MSG_UI_NOT_CONFIGURED_HINT,
    },
};

function StatusCard({ status }: { status: Status }) {
    return (
        <Card>
            <CardContent
                style={{
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }}
            >
                <StatusBody status={status} />
            </CardContent>
        </Card>
    );
}

function StatusBody({ status }: { status: Status }) {
    if (status.kind === CONFIGURE_STATUS.LOADING) {
        return <p className="text-muted-foreground">{STRINGS.MSG_LOADING}</p>;
    }
    const copy = COPY[status.kind];
    return (
        <>
            <h2 className="text-lg font-semibold">{copy.title}</h2>
            <p className="text-sm text-muted-foreground">
                {status.kind === CONFIGURE_STATUS.JOINED ? (
                    <>
                        {copy.hint}{' '}
                        <code className="font-mono bg-muted px-1 py-0.5 rounded">
                            {status.header}: {status.value}
                        </code>{' '}
                        on all requests.
                    </>
                ) : status.kind === CONFIGURE_STATUS.KEY_NOT_VISIBLE ? (
                    <>
                        Key{' '}
                        <code className="font-mono bg-muted px-1 py-0.5 rounded">
                            {status.key}
                        </code>{' '}
                        {copy.hint}
                    </>
                ) : (
                    copy.hint
                )}
            </p>
        </>
    );
}

export function ConfigurePage() {
    const [status, setStatus] = useState<Status>({
        kind: CONFIGURE_STATUS.LOADING,
    });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        resolveStatus(params).then(setStatus);
    }, []);

    return (
        <div style={{ maxWidth: 520, margin: '24px auto', padding: '0 16px' }}>
            <StatusCard status={status} />
        </div>
    );
}

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <ConfigurePage />
        </StrictMode>
    );
}
