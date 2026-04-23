import { Button } from '@metalbear/ui';
import type { OperatorSessionSummary } from '../types';

type Props = {
    joinedKey: string;
    session: OperatorSessionSummary | undefined;
    sessionEnded: boolean;
    onLeave: () => void;
};

const COLOR_EMERALD = '#34D399';
const COLOR_DESTRUCTIVE = '#F87171';
const COLOR_LILAC = '#C4BFFE';

export default function ConnectedBanner({
    joinedKey,
    sessionEnded,
    onLeave,
}: Props) {
    const accent = sessionEnded ? COLOR_DESTRUCTIVE : COLOR_EMERALD;
    const label = sessionEnded ? 'Session ended' : 'Session live';

    return (
        <div
            className="flex items-center"
            style={{
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                border: sessionEnded
                    ? '1px solid rgba(248, 113, 113, 0.4)'
                    : '1px solid rgba(117, 109, 243, 0.4)',
                background: sessionEnded
                    ? 'rgba(248, 113, 113, 0.1)'
                    : 'rgba(117, 109, 243, 0.12)',
            }}
        >
            <span
                className="inline-block shrink-0 rounded-full"
                style={{
                    height: 8,
                    width: 8,
                    backgroundColor: accent,
                    boxShadow: `0 0 0 3px ${
                        sessionEnded
                            ? 'rgba(248, 113, 113, 0.22)'
                            : 'rgba(52, 211, 153, 0.22)'
                    }`,
                }}
            />
            <div className="min-w-0" style={{ flex: 1 }}>
                <div
                    className="font-semibold"
                    style={{
                        fontSize: 10.5,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: sessionEnded ? COLOR_DESTRUCTIVE : COLOR_LILAC,
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
                {sessionEnded ? 'Dismiss' : 'Leave'}
            </Button>
        </div>
    );
}
