type Tone = 'active' | 'muted' | 'destructive' | 'inactive';

type Props = {
    size?: number;
    tone: Tone;
    glow?: boolean;
};

const TONE_COLOR: Record<Tone, string> = {
    active: 'hsl(var(--brand-green, 142 71% 45%))',
    muted: 'hsl(var(--muted-foreground) / 0.55)',
    destructive: 'hsl(var(--destructive))',
    inactive: 'hsl(var(--muted-foreground) / 0.30)',
};

const TONE_GLOW: Record<Tone, string> = {
    active: 'hsl(var(--brand-green, 142 71% 45%) / 0.22)',
    muted: 'hsl(var(--muted-foreground) / 0.18)',
    destructive: 'hsl(var(--destructive) / 0.22)',
    inactive: 'hsl(var(--muted-foreground) / 0.12)',
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
