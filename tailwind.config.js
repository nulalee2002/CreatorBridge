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
          // Legacy class name kept for compatibility. Visually this maps to
          // CreatorBridge clay from the approved reference board.
          50:  '#fbf0ec',
          100: '#f1d2c7',
          200: '#dfa891',
          300: '#ca7959',
          400: '#c46540',
          500: '#9c4a33',
          600: '#823a27',
          700: '#642b1e',
          800: '#421c14',
          900: '#25100c',
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
          50:  '#f9e8e8',
          100: '#efc5c6',
          200: '#dc8f92',
          300: '#c15559',
          400: '#9b2c30',
          500: '#5a1012',
          600: '#4b0d0f',
          700: '#3a090b',
          800: '#280607',
          900: '#190303',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
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
