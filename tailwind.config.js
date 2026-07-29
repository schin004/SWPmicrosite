/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // GreenPass — green & nature palette
        forest: '#2D6A4F',
        'forest-dark': '#1B4332',
        sage: '#95D5B2',
        'sage-light': '#E8F5E9',
        cream: '#F8F4E3',
        earth: '#6B4226',
        'earth-light': '#8A5A38',
      },
      fontFamily: {
        sans: ['Nunito', 'Lato', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 20px -4px rgba(45, 106, 79, 0.18)',
        soft: '0 2px 10px -2px rgba(45, 106, 79, 0.12)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        sway: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        sway: 'sway 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
