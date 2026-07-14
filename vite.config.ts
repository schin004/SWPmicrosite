import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// SINGLE_FILE=1 → bundle EVERYTHING (JS, CSS, logo) into one self-contained
// index.html for drag-and-drop / single-file hosting. Otherwise a normal
// multi-file build.
const singleFile = process.env.SINGLE_FILE === '1'

// https://vite.dev/config/
// Base is configurable so the same repo deploys anywhere:
//  - GitHub Pages (project site): VITE_BASE=/SWPmicrosite/  (set in the Pages workflow)
//  - Rabbit / Netlify / Vercel / any host at root: defaults to './' (relative)
export default defineConfig({
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
  base: process.env.VITE_BASE || './',
  build: singleFile
    ? { assetsInlineLimit: 100_000_000 } // inline the logo (and all assets) as data URIs
    : {},
})
