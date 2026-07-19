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
    : {
        // Multi-file build: emit predictable, un-hashed, root-level filenames
        // (app.js / app.css) as SEPARATE external files. Restrictive networks
        // (e.g. government CSP) block inline scripts, so external same-origin
        // scripts are required.
        assetsInlineLimit: 0,
        // Emit a single classic (IIFE) script — NOT an ES module — so it loads
        // without CORS mode, which restrictive proxies/browser-isolation break.
        rollupOptions: {
          output: {
            format: 'iife',
            inlineDynamicImports: true,
            entryFileNames: 'app.js',
            assetFileNames: 'app.[ext]',
          },
        },
      },
})
