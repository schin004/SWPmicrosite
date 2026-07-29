import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GreenPass front-end (Vite + React). In development (`npm run dev`) the app
// runs on Vite's dev server and proxies /api requests to the Express backend
// (default port 3000), giving a single-origin experience. In production the
// backend serves the built dist/ itself, so no proxy is involved.
const API_TARGET = process.env.API_TARGET || 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': API_TARGET,
    },
  },
})
