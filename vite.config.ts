import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GreenPass front-end (Vite + React). In development the app runs on Vite's
// dev server and proxies API + uploaded-photo requests to the Express backend
// (default port 3001), so `npm start` gives a single-origin experience.
const API_TARGET = process.env.API_TARGET || 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': API_TARGET,
      '/uploads': API_TARGET,
    },
  },
})
