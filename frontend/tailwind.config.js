/**
 * WATI Customer Engagement Design System specification for Tailwind CSS.
 *
 * Spec:
 * - Pure White #ffffff surfaces on modern soft SaaS canvas #f8fafc
 * - Signature WATI Emerald Green #00C269 with deep #00A859 and mint light #E8F8F0
 * - Rounded cards with clean hairline borders #E2E8F0
 * - Modern typography hierarchy with Outfit / Inter style
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'wati-green': {
          DEFAULT: '#00C269',
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#00C269',
          600: '#00A859',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        'gallery-white': '#ffffff',
        'studio-mist': '#f8fafc',
        'paper-frost': '#f1f5f9',
        'hairline-silver': '#cbd5e1',
        'control-gray': '#e2e8f0',
        ink: {
          DEFAULT: '#0f172a',
          deep: '#020617',
          muted: '#475569',
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
          DEFAULT: '#64748b',
        },
        steel: '#94a3b8',
        'apple-blue': '#00C269',
        'pricing-blue': '#00C269',
        'launch-orange': '#f59e0b',

        // Theme functional mapping
        primary: {
          DEFAULT: '#00C269',
          deep: '#00A859',
          soft: '#E8F8F0',
        },
        'on-primary': '#ffffff',
        'ink-button': '#0f172a',
        'on-ink-button': '#ffffff',
        success: {
          DEFAULT: '#00C269',
          bg: '#E8F8F0',
        },
        attention: '#f59e0b',
        warning: {
          DEFAULT: '#f59e0b',
          bg: '#fffbeb',
        },
        critical: {
          DEFAULT: '#ef4444',
          strong: '#dc2626',
        },
        canvas: '#f8fafc',
        'surface-soft': '#f8fafc',
        charcoal: '#1e293b',
        stone: '#94a3b8',
        hairline: '#e2e8f0',
        'hairline-soft': '#f1f5f9',
        'disabled-text': '#cbd5e1',

        // Compatibility aliases mapped to WATI palette
        'g-blue': {
          DEFAULT: '#00C269',
          600: '#00A859',
          700: '#047857',
          50: '#F0FDF4',
        },
        'g-red': '#ef4444',
        'g-yellow': '#f59e0b',
        'g-green': '#00C269',
        'ink-soft': '#475569',
        'ink-muted': '#64748b',
        'ink-quiet': '#94a3b8',
        'surface-1': '#f8fafc',
        'hero-bg': '#ffffff',
      },
      fontFamily: {
        display: [
          '"Inter"',
          '"Segoe UI"',
          '-apple-system',
          'BlinkMacSystemFont',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        text: [
          '"Inter"',
          '"Segoe UI"',
          '-apple-system',
          'BlinkMacSystemFont',
          'Roboto',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"SFMono-Regular"',
          'ui-monospace',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      borderRadius: {
        cards: '16px',
        links: '8px',
        pills: '9999px',
        badges: '9999px',
        images: '16px',
        inputs: '10px',
        buttons: '8px',
        navigation: '10px',
      },
      boxShadow: {
        none: 'none',
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'wati-card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.02)',
        'wati-hover': '0 10px 25px -5px rgba(0, 194, 105, 0.15), 0 8px 10px -6px rgba(0, 194, 105, 0.1)',
        'wati-glow': '0 0 0 3px rgba(0, 194, 105, 0.2)',
      },
      maxWidth: {
        content: '1400px',
        reading: '720px',
      },
    },
  },
  plugins: [],
};
