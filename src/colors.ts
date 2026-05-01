export const COLORS = {
    // The "primary" shades used to be drawn from --primary (brand purple),
    // but the user wanted the popup to lean less on purple chrome. They map
    // to neutral foreground tints now — readable in both themes, no
    // ambient AI-purple wash. The brand purple still lives in the JOINED
    // pill background and the joined row's left strip via direct usage.
    primary: {
        border: 'hsl(var(--foreground) / 0.25)',
        borderSoft: 'hsl(var(--foreground) / 0.20)',
        borderSubtle: 'hsl(var(--foreground) / 0.12)',
        tint: 'hsl(var(--foreground) / 0.10)',
        band: 'hsl(var(--foreground) / 0.05)',
        bg: 'hsl(var(--foreground) / 0.04)',
        bgSoft: 'hsl(var(--foreground) / 0.02)',
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
        // Use --foreground (theme-aware: dark text in light mode, light text in
        // dark mode) instead of brand-purple-medium / brand-yellow which were
        // tuned for dark mode only and washed out in light mode. Also keeps
        // the UI from leaning too hard on the purple accent.
        lilac: 'hsl(var(--foreground))',
        yellow: 'hsl(var(--foreground))',
    },
} as const;
