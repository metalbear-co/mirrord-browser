import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, Input, Button } from '@metalbear/ui';
import { STRINGS, MIRRORD_UI_DEFAULT_BACKEND } from '../constants';
import { COLORS } from '../colors';
import { STORAGE_KEYS } from '../types';
import { storageSet } from '../util';

// Shown when the mirrord ui poller is reachable but rejects our token (HTTP 401/403) — a
// stale token, or another process squatting on the port. Offers the two fixes: paste a fresh
// token (from `mirrord ui`) or re-open the mirrord ui page so it re-sets backend + token.
export function MirrordUiAuthError({ backend }: { backend: string | null }) {
    const [tokenInput, setTokenInput] = useState('');
    // Use the stored backend's actual port when we have it, otherwise fall back to the
    // default port `mirrord ui` listens on.
    const uiPage = backend ?? MIRRORD_UI_DEFAULT_BACKEND;
    const host = uiPage.replace(/^https?:\/\//, '');

    const setToken = async () => {
        const value = tokenInput.trim();
        if (!value) return;
        await storageSet({ [STORAGE_KEYS.MIRRORD_UI_TOKEN]: value });
        setTokenInput('');
    };

    return (
        <Card
            className="overflow-hidden"
            style={{
                borderColor: COLORS.destructive.border,
                background: COLORS.destructive.bg,
            }}
        >
            <CardContent
                style={{
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                }}
            >
                <div className="flex items-center gap-2">
                    <AlertTriangle
                        style={{
                            height: 14,
                            width: 14,
                            color: COLORS.destructive.solid,
                        }}
                    />
                    <span
                        className="font-semibold text-foreground"
                        style={{
                            fontSize: 10.5,
                            letterSpacing: 'normal',
                            textTransform: 'none',
                        }}
                    >
                        {STRINGS.MSG_AUTH_FAILED_TITLE}
                    </span>
                </div>

                <p
                    className="text-muted-foreground"
                    style={{ fontSize: 11, lineHeight: 1.45, margin: 0 }}
                >
                    {STRINGS.MSG_AUTH_FAILED_HINT}
                </p>

                <div
                    className="rounded-md border border-primary/30 bg-primary/10"
                    style={{
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <span
                        className="font-mono text-muted-foreground"
                        style={{ fontSize: 12, userSelect: 'none' }}
                    >
                        $
                    </span>
                    <code
                        className="font-mono"
                        style={{
                            color: COLORS.brand.yellow,
                            fontSize: 13,
                            fontWeight: 500,
                        }}
                    >
                        {STRINGS.MSG_MIRRORD_UI_COMMAND}
                    </code>
                </div>

                <div className="flex items-center" style={{ gap: 8 }}>
                    <Input
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder={STRINGS.PLACEHOLDER_MIRRORD_UI_TOKEN}
                        aria-label={STRINGS.LABEL_MIRRORD_UI_TOKEN}
                        spellCheck={false}
                        autoComplete="off"
                        className="font-mono"
                        style={{ flex: 1, height: 32, fontSize: 11 }}
                    />
                    <Button
                        onClick={setToken}
                        disabled={!tokenInput.trim()}
                        style={{ height: 32, fontSize: 11 }}
                    >
                        {STRINGS.BTN_SET_TOKEN}
                    </Button>
                </div>

                <p
                    className="text-muted-foreground"
                    style={{ fontSize: 11, lineHeight: 1.45, margin: 0 }}
                >
                    {STRINGS.MSG_REOPEN_UI_PAGE}{' '}
                    <a
                        href={uiPage}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono underline"
                    >
                        {host}
                    </a>
                </p>
            </CardContent>
        </Card>
    );
}
