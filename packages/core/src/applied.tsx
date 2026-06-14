// Result page the metalbear.com config link lands on. The content script navigates here (a
// web-accessible extension page) with `?payload=<base64>`; this page decodes it, installs the
// header rule (it runs as a privileged extension page, so it can call declarativeNetRequest),
// and shows the outcome — so the user ends up on a real extension page, not the website.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import '@metalbear/ui/styles.css';
import './tokens.css';
import { initTheme } from './theme';
import { Card, CardContent } from '@metalbear/ui';
import {
    decodeConfig,
    isRegex,
    parseHeader,
    promptForValidHeader,
} from './configCore';
import { applyHeaderConfig } from './applyConfig';
import { capture, emitUserBlocked, emitUserSucceeded } from './analytics';

initTheme();

export type AppliedState =
    | { kind: 'loading' }
    | { kind: 'done'; header: string; value: string; scope?: string }
    | { kind: 'error'; error: string; input?: string };

/** Decode the `?payload=` query, install the rule, and return the outcome. */
export async function run(): Promise<AppliedState> {
    const payload = new URLSearchParams(window.location.search).get('payload');
    if (!payload) {
        return { kind: 'error', error: 'No config payload provided.' };
    }

    let header: string;
    let value: string;
    let scope: string | undefined;
    try {
        const config = decodeConfig(payload);
        if (!config.header_filter) {
            throw new Error('Config is missing a header filter.');
        }
        const headerLine = isRegex(config.header_filter)
            ? promptForValidHeader(config.header_filter)
            : config.header_filter;
        ({ key: header, value } = parseHeader(headerLine));
        scope = config.inject_scope || undefined;
    } catch (err) {
        return {
            kind: 'error',
            error:
                err instanceof Error
                    ? err.message
                    : 'The config link is malformed.',
            input: payload,
        };
    }

    try {
        await applyHeaderConfig(header, value, scope);
        capture('extension_config_received', {
            has_scope: !!scope,
            source: 'web_link',
        });
        emitUserSucceeded('configured', 'user_action', { source: 'web_link' });
        return { kind: 'done', header, value, scope };
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        emitUserBlocked('configure_failed', 'user_action', {
            error,
            source: 'web_link',
        });
        return { kind: 'error', error };
    }
}

function AppliedPage() {
    const [state, setState] = useState<AppliedState>({ kind: 'loading' });

    useEffect(() => {
        run().then(setState);
    }, []);

    return (
        <div style={{ maxWidth: 520, margin: '24px auto', padding: '0 16px' }}>
            <Card>
                <CardContent
                    style={{
                        padding: 24,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                    }}
                >
                    {state.kind === 'loading' && (
                        <p className="text-sm text-muted-foreground">
                            Applying mirrord config…
                        </p>
                    )}
                    {state.kind === 'error' && (
                        <>
                            <h2 className="text-lg font-semibold">
                                Couldn’t apply mirrord config
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {state.error}
                            </p>
                            {state.input && (
                                <>
                                    <p className="text-meta text-muted-foreground">
                                        Invalid input:
                                    </p>
                                    <pre
                                        style={{
                                            margin: 0,
                                            padding: 12,
                                            borderRadius: 6,
                                            background: 'rgba(0, 0, 0, 0.06)',
                                            fontFamily:
                                                'ui-monospace, monospace',
                                            fontSize: 12,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-all',
                                            maxHeight: 160,
                                            overflow: 'auto',
                                        }}
                                    >
                                        {state.input}
                                    </pre>
                                </>
                            )}
                        </>
                    )}
                    {state.kind === 'done' && (
                        <>
                            <h2 className="text-lg font-semibold">
                                mirrord header configured
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Injecting{' '}
                                <code className="font-mono bg-muted px-1 py-0.5 rounded">
                                    {state.header}: {state.value}
                                </code>{' '}
                                {state.scope
                                    ? `on requests matching ${state.scope}.`
                                    : 'on all requests.'}
                            </p>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <ErrorBoundary flow="header_injector" component="applied">
                <AppliedPage />
            </ErrorBoundary>
        </StrictMode>
    );
}
