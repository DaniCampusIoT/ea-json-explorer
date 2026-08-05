import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = process.env.VITE_API_URL
             || process.env.VITE_BACKEND_URL
             || 'https://ea-explorer-backend-production.up.railway.app'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
  },
  define: {
    __API_BASE__: JSON.stringify(BACKEND)
  }
}))
