/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // NParks-inspired green palette.
        nparks: {
          dark: "#1f5c3a",
          DEFAULT: "#2e7d32",
          accent: "#43a047",
          soft: "#eef6ee",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
