/**
 * Apple Design System specification for Tailwind CSS.
 *
 * Spec:
 * - Gallery White #ffffff surfaces on Studio Mist #f5f5f7 canvas
 * - Flat and shadowless 28px card rounding with hairline silver 1px borders
 * - Pricing Blue #0071e3 for primary conversion pill buttons (9999px radius)
 * - Apple Blue #0066cc for inline text links and subtle punctuation
 * - SF Pro Display & SF Pro Text typography hierarchy
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'gallery-white': '#ffffff',
        'studio-mist': '#f5f5f7',
        'paper-frost': '#fafafc',
        'hairline-silver': '#d6d6d6',
        'control-gray': '#e6e6e8',
        ink: {
          DEFAULT: '#1d1d1f',
          deep: '#1d1d1f',
        },
        slate: '#707070',
        steel: '#86868b',
        'apple-blue': '#0066cc',
        'pricing-blue': '#0071e3',
        'launch-orange': '#b64400',

        // Theme functional mapping
        primary: {
          DEFAULT: '#0071e3',
          deep: '#0066cc',
          soft: '#409cff',
        },
        'on-primary': '#ffffff',
        'ink-button': '#1d1d1f',
        'on-ink-button': '#ffffff',
        success: {
          DEFAULT: '#34c759',
          bg: '#e8f9ed',
        },
        attention: '#ff9500',
        warning: {
          DEFAULT: '#ff9500',
          bg: '#fff5e5',
        },
        critical: {
          DEFAULT: '#ff3b30',
          strong: '#d70015',
        },
        canvas: '#f5f5f7',
        'surface-soft': '#f5f5f7',
        charcoal: '#333336',
        stone: '#86868b',
        hairline: '#d6d6d6',
        'hairline-soft': '#e6e6e8',
        'disabled-text': '#d2d2d7',

        // Legacy compatibility aliases
        'g-blue': {
          DEFAULT: '#0071e3',
          600: '#0071e3',
          700: '#0066cc',
          50: '#f0f7ff',
        },
        'g-red': '#ff3b30',
        'g-yellow': '#ff9500',
        'g-green': '#34c759',
        'ink-soft': '#707070',
        'ink-muted': '#86868b',
        'ink-quiet': '#86868b',
        'surface-1': '#f5f5f7',
        'hero-bg': '#ffffff',
      },
      fontFamily: {
        display: [
          '"SF Pro Display"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        text: [
          '"SF Pro Text"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"SFMono-Regular"',
          'ui-monospace',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        'hero-display': ['80px', { lineHeight: '1.05', fontWeight: '600', letterSpacing: '-1.2px' }],
        'feature-heading': ['40px', { lineHeight: '1.0', fontWeight: '600', letterSpacing: '0px' }],
        'product-kicker': ['21px', { lineHeight: '1.0', fontWeight: '600', letterSpacing: '0.231px' }],
        'product-nav-title': ['19px', { lineHeight: '1.21', fontWeight: '600', letterSpacing: '0.228px' }],
        'body-feature': ['17px', { lineHeight: '1.24', fontWeight: '400', letterSpacing: '-0.374px' }],
        'body-apple': ['17px', { lineHeight: '1.47', fontWeight: '400', letterSpacing: '-0.374px' }],
        'body-small': ['14px', { lineHeight: '1.29', fontWeight: '400', letterSpacing: '-0.224px' }],
        'compact-control': ['12px', { lineHeight: '1.33', fontWeight: '400', letterSpacing: '-0.12px' }],
        'global-nav': ['12px', { lineHeight: '1.0', fontWeight: '400', letterSpacing: '-0.12px' }],
      },
      borderRadius: {
        cards: '28px',
        links: '10px',
        pills: '36px',
        badges: '0px',
        images: '28px',
        inputs: '980px',
        buttons: '9999px',
        navigation: '20px',
      },
      boxShadow: {
        none: 'none',
        card: 'none',
        'card-hover': 'none',
        summary: 'none',
        cobalt: 'none',
        ink: 'none',
        subtle: 'rgb(230, 230, 232) 0px 0px 0px 1px',
        'subtle-2': 'rgb(134, 134, 139) 0px 0px 0px 1px',
      },
      maxWidth: {
        content: '1240px',
        reading: '680px',
      },
    },
  },
  plugins: [],
};
