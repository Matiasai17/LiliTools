import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

// GitHub Pages serves this repo under /LiliTools/.
// Set VITE_BASE_PATH=/ when deploying to a root domain such as Hostinger.
const base = process.env.VITE_BASE_PATH || '/LiliTools/'

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: 'github-pages-spa-fallback',
      closeBundle() {
        copyFileSync(resolve('dist/index.html'), resolve('dist/404.html'))
      },
    },
  ],
})
