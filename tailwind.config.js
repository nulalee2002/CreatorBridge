/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        charcoal: {
          50:  '#f0f0f5',
          100: '#d8d8e8',
          200: '#b0b0d0',
          300: '#8888b8',
          400: '#5555a0',
          500: '#333358',
          600: '#252540',
          700: '#1e1e36',
          800: '#16162a',
          900: '#1a1a2e',
          950: '#0d0d18',
        },
        gold: {
          50:  '#fdf8ec',
          100: '#faefd0',
          200: '#f5dea0',
          300: '#efc970',
          400: '#e8b040',
          500: '#d4a941',
          600: '#b88e2e',
          700: '#9a7320',
          800: '#7c5a14',
          900: '#5e430a',
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
