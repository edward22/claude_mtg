import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this as a project site at /claude_mtg/, but the
  // local dev server should keep serving from the root.
  base: command === 'build' ? '/claude_mtg/' : '/',
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
}))
