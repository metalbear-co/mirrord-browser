import { Button } from '@metalbear/ui';
import type { OperatorSessionSummary } from '../types';
import { STRINGS } from '../constants';

type Props = {
    joinedKey: string;
    session: OperatorSessionSummary | undefined;
    sessionEnded: boolean;
    onLeave: () => void;
};

const LIVE_ACCENT = 'hsl(var(--brand-green, 142 71% 45%))';
const ENDED_ACCENT = 'hsl(var(--destructive))';
const LIVE_GLOW = 'hsl(var(--brand-green, 142 71% 45%) / 0.22)';
const ENDED_GLOW = 'hsl(var(--destructive) / 0.22)';
const LIVE_BG = 'hsl(var(--primary) / 0.12)';
const ENDED_BG = 'hsl(var(--destructive) / 0.1)';
const LIVE_BORDER = 'hsl(var(--primary) / 0.4)';
const ENDED_BORDER = 'hsl(var(--destructive) / 0.4)';

export function ConnectedBanner({ joinedKey, sessionEnded, onLeave }: Props) {
    const accent = sessionEnded ? ENDED_ACCENT : LIVE_ACCENT;
    const glow = sessionEnded ? ENDED_GLOW : LIVE_GLOW;
    const label = sessionEnded
        ? STRINGS.MSG_SESSION_ENDED
        : STRINGS.MSG_SESSION_LIVE;
    const buttonLabel = sessionEnded ? STRINGS.BTN_DISMISS : STRINGS.BTN_LEAVE;

    return (
        <div
            className="flex items-center"
            style={{
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${sessionEnded ? ENDED_BORDER : LIVE_BORDER}`,
                background: sessionEnded ? ENDED_BG : LIVE_BG,
            }}
        >
            <span
                className="inline-block shrink-0 rounded-full"
                style={{
                    height: 8,
                    width: 8,
                    backgroundColor: accent,
                    boxShadow: `0 0 0 3px ${glow}`,
                }}
            />
            <div className="min-w-0" style={{ flex: 1 }}>
                <div
                    className="font-semibold"
                    style={{
                        fontSize: 10.5,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: sessionEnded
                            ? ENDED_ACCENT
                            : 'hsl(var(--brand-purple-medium))',
                    }}
                >
                    {label}
                </div>
                <div
                    className="font-mono"
                    style={{
                        fontSize: 13,
                        fontWeight: 500,
                        marginTop: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {joinedKey}
                </div>
            </div>
            <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onLeave}
                style={{ height: 28, padding: '0 12px' }}
            >
                {buttonLabel}
            </Button>
        </div>
    );
}
