import { Terminal } from 'lucide-react';
import { Card, CardContent } from '@metalbear/ui';
import { STRINGS } from '../constants';
import { COLORS } from '../colors';

export function RunMirrordUiPrompt() {
    return (
        <Card
            className="overflow-hidden"
            style={{
                borderColor: COLORS.primary.borderSubtle,
                background: COLORS.primary.bgSoft,
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
                    <Terminal
                        style={{
                            height: 14,
                            width: 14,
                            color: COLORS.brand.lilac,
                        }}
                    />
                    <span
                        className="font-semibold text-foreground"
                        style={{
                            fontSize: 10.5,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                        }}
                    >
                        {STRINGS.MSG_SEE_REMOTE_SESSIONS}
                    </span>
                </div>
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
                <p
                    className="text-muted-foreground"
                    style={{ fontSize: 11, lineHeight: 1.45, margin: 0 }}
                >
                    {STRINGS.MSG_RUN_MIRRORD_UI_HINT}
                </p>
            </CardContent>
        </Card>
    );
}
