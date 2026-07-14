import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Base is configurable so the same repo deploys anywhere:
//  - GitHub Pages (project site): VITE_BASE=/SWPmicrosite/  (set in the Pages workflow)
//  - Rabbit / Netlify / Vercel / any host at root: defaults to './' (relative)
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || './',
})
