import tailwindcssAnimate from 'tailwindcss-animate'
import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        ochre: {
          50: 'hsl(var(--ochre-50))',
          100: 'hsl(var(--ochre-100))',
          200: 'hsl(var(--ochre-200))',
          300: 'hsl(var(--ochre-300))',
          400: 'hsl(var(--ochre-400))',
          500: 'hsl(var(--ochre-500))',
          600: 'hsl(var(--ochre-600))',
          700: 'hsl(var(--ochre-700))',
          800: 'hsl(var(--ochre-800))',
          900: 'hsl(var(--ochre-900))',
          DEFAULT: 'hsl(var(--ochre))',
        },
        sienna: 'hsl(var(--sienna))',
        terracotta: 'hsl(var(--terracotta))',
        silicon: {
          50: 'hsl(var(--silicon-50))',
          100: 'hsl(var(--silicon-100))',
          200: 'hsl(var(--silicon-200))',
          300: 'hsl(var(--silicon-300))',
          400: 'hsl(var(--silicon-400))',
          500: 'hsl(var(--silicon-500))',
          600: 'hsl(var(--silicon-600))',
          700: 'hsl(var(--silicon-700))',
          800: 'hsl(var(--silicon-800))',
          900: 'hsl(var(--silicon-900))',
          925: 'hsl(var(--silicon-925))',
          950: 'hsl(var(--silicon-950))',
          975: 'hsl(var(--silicon-975))',
          blue: 'hsl(var(--silicon-blue))',
          cyan: 'hsl(var(--silicon-cyan))',
          slate: 'hsl(var(--silicon-slate))',
          glow: 'hsl(var(--silicon-glow))',
          cool: 'hsl(var(--silicon-cool))',
          warm: 'hsl(var(--silicon-warm))',
          neon: 'hsl(var(--silicon-neon))',
          foreground: 'hsl(var(--silicon-foreground))',
        },
        sage: {
          50: 'hsl(var(--sage-50))',
          100: 'hsl(var(--sage-100))',
          200: 'hsl(var(--sage-200))',
          300: 'hsl(var(--sage-300))',
          400: 'hsl(var(--sage-400))',
          500: 'hsl(var(--sage-500))',
          600: 'hsl(var(--sage-600))',
          700: 'hsl(var(--sage-700))',
          800: 'hsl(var(--sage-800))',
          900: 'hsl(var(--sage-900))',
          DEFAULT: 'hsl(var(--sage))',
        },
        cream: 'hsl(var(--cream))',
        parchment: 'hsl(var(--parchment))',
        ink: 'hsl(var(--ink))',
        pencil: 'hsl(var(--pencil))',
        'teal-warm': 'hsl(var(--teal-warm))',
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },
      fontFamily: {
        sans: ['Noto Sans SC', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['Noto Serif SC', 'serif'],
      },
      spacing: {
        '4.5': '1.125rem',
      },
    },
  },
  plugins: [tailwindcssAnimate, typography],
}

export default config
