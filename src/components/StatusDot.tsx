import { COLORS } from '../colors';

type Tone = 'active' | 'muted' | 'destructive' | 'inactive';

type Props = {
    size?: number;
    tone: Tone;
    glow?: boolean;
};

const TONE_COLOR: Record<Tone, string> = {
    active: COLORS.success.dot,
    muted: COLORS.muted.dot,
    destructive: COLORS.destructive.solid,
    inactive: COLORS.muted.dotInactive,
};

const TONE_GLOW: Record<Tone, string> = {
    active: COLORS.success.glow,
    muted: COLORS.muted.glow,
    destructive: COLORS.destructive.glow,
    inactive: COLORS.muted.glowInactive,
};

export function StatusDot({ size = 8, tone, glow = false }: Props) {
    return (
        <span
            data-testid="status-dot"
            className="inline-block shrink-0 rounded-full"
            style={{
                height: size,
                width: size,
                backgroundColor: TONE_COLOR[tone],
                boxShadow: glow ? `0 0 0 3px ${TONE_GLOW[tone]}` : undefined,
            }}
        />
    );
}
