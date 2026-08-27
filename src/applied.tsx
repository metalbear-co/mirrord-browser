// Result page the metalbear.com config link lands on. The content script navigates here (a
// web-accessible extension page) with `?payload=<base64>`; this page decodes it, installs the
// header rule (it runs as a privileged extension page, so it can call declarativeNetRequest),
// and shows the outcome. Styling mirrors metalbear.com (Unbounded/Poppins/IBM Plex Mono,
// ink-navy stamp card) — see the inline styles in pages/applied.html.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
    decodeConfig,
    isRegex,
    parseHeader,
    promptForValidHeader,
    resolveOpenUrl,
} from './configCore';
import { applyHeaderConfig } from './applyConfig';
import { joinMatchingSession } from './joinSession';
import {
    capture,
    emitUserBlocked,
    emitUserSucceeded,
    initErrorTracking,
} from './analytics';
import { STRINGS } from './constants';

initErrorTracking('applied');

export type AppliedState =
    | { kind: 'loading' }
    | {
          kind: 'done';
          header: string;
          value: string;
          scope?: string;
          joinedKey?: string;
          openUrl?: string;
      }
    | { kind: 'error'; error: string; input?: string };

const OPEN_URL_DELAY_MS = 800;

/** Decode the `?payload=` query, install the rule, and return the outcome. */
export async function run(): Promise<AppliedState> {
    const params = new URLSearchParams(window.location.search);
    const payload = params.get('payload');
    if (!payload) {
        return { kind: 'error', error: 'No config payload provided.' };
    }

    let header: string;
    let value: string;
    let scope: string | undefined;
    let openUrl: string | undefined;
    try {
        const config = decodeConfig(payload);
        if (!config.header_filter) {
            throw new Error('Config is missing a header filter.');
        }
        const headerLine = isRegex(config.header_filter)
            ? promptForValidHeader(config.header_filter)
            : config.header_filter;
        ({ key: header, value } = parseHeader(headerLine));
        scope = config.inject_scope;
        openUrl = resolveOpenUrl(config.open_url, scope);
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
        // Prefer joining a matching live operator session so traffic is actually routed. When
        // none matches (mirrord ui not up, session ended), fall back to a transient override
        // rule. Either way the link never overwrites the user's saved defaults.
        const joinedKey = await joinMatchingSession(header, value);
        if (joinedKey) {
            capture('extension_config_received', {
                has_scope: !!scope,
                has_open_url: !!openUrl,
                source: 'web_link',
                joined_session: true,
            });
            emitUserSucceeded('joined', 'user_action', {
                key: joinedKey,
                source: 'web_link',
            });
            return {
                kind: 'done',
                header,
                value,
                ...(scope !== undefined ? { scope } : {}),
                joinedKey,
                ...(openUrl !== undefined ? { openUrl } : {}),
            };
        }

        await applyHeaderConfig(header, value, scope);
        capture('extension_config_received', {
            has_scope: !!scope,
            has_open_url: !!openUrl,
            source: 'web_link',
        });
        emitUserSucceeded('configured', 'user_action', { source: 'web_link' });
        return {
            kind: 'done',
            header,
            value,
            ...(scope !== undefined ? { scope } : {}),
            ...(openUrl !== undefined ? { openUrl } : {}),
        };
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
        void run().then(setState);
    }, []);

    const openUrl = state.kind === 'done' ? state.openUrl : undefined;
    useEffect(() => {
        if (!openUrl) {
            return;
        }
        const timer = window.setTimeout(() => {
            window.location.replace(openUrl);
        }, OPEN_URL_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [openUrl]);

    return (
        <div className="mb-card">
            {state.kind === 'loading' && (
                <p className="mb-text">{STRINGS.MSG_APPLYING_CONFIG}</p>
            )}

            {openUrl && (
                <p className="mb-text">
                    {STRINGS.MSG_OPENING}{' '}
                    <code className="mb-code">{openUrl}</code>
                    {STRINGS.PUNCT_PERIOD}
                </p>
            )}

            {state.kind === 'done' && state.joinedKey && (
                <>
                    <span className="mb-eyebrow mb-eyebrow--success">
                        {STRINGS.MSG_JOINED_TAG}
                    </span>
                    <h1 className="mb-title">
                        {STRINGS.MSG_JOINED_LIVE_SESSION}
                    </h1>
                    <p className="mb-text">
                        {STRINGS.MSG_ROUTING_TO_SESSION}{' '}
                        <code className="mb-code">{state.joinedKey}</code>{' '}
                        {STRINGS.MSG_BY_INJECTING}{' '}
                        <code className="mb-code">
                            {state.header}: {state.value}
                        </code>
                        {STRINGS.PUNCT_PERIOD}
                    </p>
                </>
            )}

            {state.kind === 'done' && !state.joinedKey && (
                <>
                    <span className="mb-eyebrow mb-eyebrow--success">
                        {STRINGS.MSG_CONFIGURED_TAG}
                    </span>
                    <h1 className="mb-title">
                        {STRINGS.MSG_HEADER_CONFIGURED}
                    </h1>
                    <p className="mb-text">
                        {STRINGS.MSG_JOINED_SESSION_HINT}{' '}
                        <code className="mb-code">
                            {state.header}: {state.value}
                        </code>{' '}
                        {state.scope
                            ? `on requests matching ${state.scope}.`
                            : 'on all requests.'}
                    </p>
                </>
            )}

            {state.kind === 'error' && (
                <>
                    <span className="mb-eyebrow mb-eyebrow--error">
                        {STRINGS.MSG_COULDNT_APPLY_TAG}
                    </span>
                    <h1 className="mb-title">
                        {STRINGS.MSG_COULDNT_APPLY_CONFIG}
                    </h1>
                    <p className="mb-text">{state.error}</p>
                    {state.input && (
                        <>
                            <p className="mb-label">
                                {STRINGS.MSG_INVALID_INPUT}
                            </p>
                            <pre className="mb-terminal">{state.input}</pre>
                        </>
                    )}
                </>
            )}
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
