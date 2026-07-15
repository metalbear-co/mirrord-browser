import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, Input, Button } from '@metalbear/ui';
import { STRINGS, MIRRORD_UI_DEFAULT_BACKEND } from '../constants';
import { COLORS } from '../colors';
import { STORAGE_KEYS } from '../types';
import { storageSet } from '../util';

// Shown when the mirrord ui poller is reachable but rejects our token (HTTP 401/403): a stale
// token after a mirrord ui restart, or another process on its port. The extension can't fix the
// token itself (it only holds the rejected one), so it points the user at the two real recoveries:
// re-run `mirrord ui` (which re-syncs the extension) or paste the current token from ~/.mirrord/token.
export function MirrordUiAuthError({ backend }: { backend: string | null }) {
    const [tokenInput, setTokenInput] = useState('');
    // The backend whose token was rejected, for display only; falls back to the default port
    // `mirrord ui` listens on when we have no stored backend.
    const host = (backend ?? MIRRORD_UI_DEFAULT_BACKEND).replace(
        /^https?:\/\//,
        ''
    );

    const setToken = async () => {
        const value = tokenInput.trim();
        if (!value) {
            return;
        }
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
                        className="text-foreground font-semibold"
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
                    className="border-primary/30 bg-primary/10 rounded-md border"
                    style={{
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <span
                        className="text-muted-foreground font-mono"
                        style={{ fontSize: 12, userSelect: 'none' }}
                    >
                        {STRINGS.TERMINAL_PROMPT}
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
                        onClick={() => void setToken()}
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
                    {STRINGS.MSG_AUTH_FAILED_BACKEND}{' '}
                    <code className="font-mono">{host}</code>
                </p>
            </CardContent>
        </Card>
    );
}
