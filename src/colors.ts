export const COLORS = {
    primary: {
        border: 'hsl(var(--primary) / 0.45)',
        borderSoft: 'hsl(var(--primary) / 0.4)',
        borderSubtle: 'hsl(var(--primary) / 0.3)',
        tint: 'hsl(var(--primary) / 0.22)',
        band: 'hsl(var(--primary) / 0.14)',
        bg: 'hsl(var(--primary) / 0.12)',
        bgSoft: 'hsl(var(--primary) / 0.06)',
    },
    destructive: {
        solid: 'hsl(var(--destructive))',
        border: 'hsl(var(--destructive) / 0.4)',
        bg: 'hsl(var(--destructive) / 0.1)',
        glow: 'hsl(var(--destructive) / 0.22)',
    },
    success: {
        dot: 'hsl(var(--brand-green, 142 71% 45%))',
        glow: 'hsl(var(--brand-green, 142 71% 45%) / 0.22)',
    },
    muted: {
        band: 'hsl(var(--foreground) / 0.035)',
        dot: 'hsl(var(--muted-foreground) / 0.55)',
        dotInactive: 'hsl(var(--muted-foreground) / 0.30)',
        glow: 'hsl(var(--muted-foreground) / 0.18)',
        glowInactive: 'hsl(var(--muted-foreground) / 0.12)',
    },
    brand: {
        lilac: 'hsl(var(--brand-purple-medium))',
        yellow: 'hsl(var(--brand-yellow))',
    },
} as const;
