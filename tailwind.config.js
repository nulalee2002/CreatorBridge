/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        charcoal: {
          50:  '#f4eee4',
          100: '#e6ddd0',
          200: '#cfc4b6',
          300: '#b8ada0',
          400: '#8f867c',
          500: '#665d54',
          600: '#43362f',
          700: '#2c211d',
          800: '#1c1512',
          900: '#130f0d',
          950: '#0a0807',
        },
        gold: {
          // Legacy class name kept for compatibility. Visually this is now
          // CreatorBridge oxblood from the approved brand direction, not gold.
          50:  '#f8e9ea',
          100: '#efc9cc',
          200: '#df969b',
          300: '#c96269',
          400: '#a3292f',
          500: '#8a1d22',
          600: '#6d161a',
          700: '#521014',
          800: '#370b0d',
          900: '#1f0507',
        },
        forest: {
          50:  '#eaf5ef',
          100: '#cde6d8',
          200: '#9acdad',
          300: '#65b685',
          400: '#3f7d59',
          500: '#1f3a2e',
          600: '#183126',
          700: '#11241c',
          800: '#0c1a14',
          900: '#07120e',
        },
        oxblood: {
          50:  '#f8e9ea',
          100: '#efc9cc',
          200: '#df969b',
          300: '#c96269',
          400: '#a3292f',
          500: '#8a1d22',
          600: '#6d161a',
          700: '#521014',
          800: '#370b0d',
          900: '#1f0507',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseSoft: { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
      },
    },
  },
  plugins: [],
};
