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
          // CreatorBridge clay from the approved brand direction, not gold.
          50:  '#fbf0ec',
          100: '#f2d5ca',
          200: '#e6b29f',
          300: '#d5876b',
          400: '#b85a3e',
          500: '#9c4a33',
          600: '#813824',
          700: '#67291b',
          800: '#4d1d14',
          900: '#35120d',
        },
        forest: {
          50:  '#eaf5ef',
          100: '#cde6d8',
          200: '#9bcfb2',
          300: '#6fb88e',
          400: '#3f8760',
          500: '#1f5a3e',
          600: '#184a33',
          700: '#113827',
          800: '#0c291d',
          900: '#071b14',
        },
        oxblood: {
          50:  '#f5e7e8',
          100: '#e9c6c8',
          200: '#d28b8f',
          300: '#b84f55',
          400: '#842329',
          500: '#5a1012',
          600: '#480d0f',
          700: '#360a0b',
          800: '#250707',
          900: '#170404',
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
