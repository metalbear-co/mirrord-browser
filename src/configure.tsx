import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@metalbear/ui/styles.css';
import { Card, CardContent } from '@metalbear/ui';
import { STORAGE_KEYS } from './types';
import { capture } from './analytics';
import { fetchOperatorSessions } from './mirrordUiClient';
import {
    buildDnrRule,
    getDynamicRules,
    updateDynamicRules,
    storageGet,
    storageSet,
} from './util';
import { STRINGS } from './constants';

type Status =
    | { kind: 'loading' }
    | { kind: 'connected' }
    | { kind: 'joined'; header: string; value: string }
    | { kind: 'key-not-visible'; key: string }
    | { kind: 'missing-config' }
    | { kind: 'not-configured' };

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
    if (!target) return { kind: 'key-not-visible', key };
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
    return { kind: 'joined', header, value };
}

async function resolveStatus(params: URLSearchParams): Promise<Status> {
    const backendParam = params.get('backend');
    const tokenParam = params.get('token');
    const joinParam = params.get('join');

    if (backendParam && tokenParam) {
        await storeBackendAndToken(backendParam, tokenParam);
        capture('extension_configured', { hasJoinParam: !!joinParam });
        if (!joinParam) return { kind: 'connected' };
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
        if (!backend || !token) return { kind: 'not-configured' };
        return joinKey(joinParam, backend, token);
    }

    return { kind: 'missing-config' };
}

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
    switch (status.kind) {
        case 'loading':
            return <p className="text-muted-foreground">Loading…</p>;
        case 'connected':
            return (
                <>
                    <h2 className="text-lg font-semibold">
                        {STRINGS.MSG_MIRRORD_UI_CONNECTED}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {STRINGS.MSG_MIRRORD_UI_CONNECTED_HINT}
                    </p>
                </>
            );
        case 'joined':
            return (
                <>
                    <h2 className="text-lg font-semibold">
                        {STRINGS.MSG_JOINED_SESSION}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {STRINGS.MSG_JOINED_SESSION_HINT}{' '}
                        <code className="font-mono bg-muted px-1 py-0.5 rounded">
                            {status.header}: {status.value}
                        </code>{' '}
                        on all requests.
                    </p>
                </>
            );
        case 'key-not-visible':
            return (
                <>
                    <h2 className="text-lg font-semibold">
                        {STRINGS.MSG_KEY_NOT_VISIBLE}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Key{' '}
                        <code className="font-mono bg-muted px-1 py-0.5 rounded">
                            {status.key}
                        </code>{' '}
                        {STRINGS.MSG_KEY_NOT_VISIBLE_HINT}
                    </p>
                </>
            );
        case 'missing-config':
            return (
                <>
                    <h2 className="text-lg font-semibold">
                        {STRINGS.MSG_MISSING_CONFIG}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {STRINGS.MSG_MISSING_CONFIG_HINT}
                    </p>
                </>
            );
        case 'not-configured':
            return (
                <>
                    <h2 className="text-lg font-semibold">
                        {STRINGS.MSG_UI_NOT_CONFIGURED}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {STRINGS.MSG_UI_NOT_CONFIGURED_HINT}
                    </p>
                </>
            );
    }
}

export function ConfigurePage() {
    const [status, setStatus] = useState<Status>({ kind: 'loading' });

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
