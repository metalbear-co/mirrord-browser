/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx}', './pages/**/*.html'],
  theme: {
    extend: {
      colors: {
        // Brand colors from MetalBear
        brand: {
          purple: '#756DF3',
          'purple-medium': '#E4E3FD',
          'purple-dark': '#232141',
          yellow: '#FFCB7D',
          black: '#000000',
          'grey-light': '#FAFAFD',
          'red-blush': '#F36869',
          'grey-dark': '#ACACAC',
          'grey-bear': '#EEEEEE',
        },
        // Semantic colors using CSS variables for theming
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
