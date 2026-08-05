import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // En produccion el proxy lo hace Cloudflare Pages (_redirects).
  // En desarrollo local sigue usando el backend en :8000.
  server: {
    proxy: mode === 'development' ? {
      '/api': 'http://localhost:8000'
    } : undefined
  },
  build: {
    outDir: 'dist',
  },
}))
