/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          blue: '#3B82F6',
          purple: '#8B5CF6',
          teal: '#14B8A6',
          orange: '#F59E0B',
          green: '#22C55E',
          red: '#EF4444',
          // Ctrl • Alt • Del logo-derived tokens
          navy: '#1E2A44',      // primary ink / strategic anchor
          ink: '#16213E',       // deeper navy
          ctrl: '#A7D3F3',      // CTRL keycap (blue)
          alt: '#F0726E',       // ALT keycap (coral)
          del: '#B7DE8F',       // DEL keycap (green)
          accent: '#F59418',    // orange accent from the icons
        },
      },
      boxShadow: {
        card: '0 4px 24px 0 rgba(0,0,0,0.07)',
        'card-hover': '0 8px 40px 0 rgba(0,0,0,0.13)',
        nav: '0 2px 16px 0 rgba(0,0,0,0.06)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        float: { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-20px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        fadeIn: 'fadeIn 0.6s ease both',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        shimmer: 'shimmer 3s linear infinite',
      },
    },
  },
  plugins: [],
};
