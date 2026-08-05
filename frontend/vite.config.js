import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = process.env.VITE_API_URL || 'http://localhost:8000'

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
    __API_BASE__: JSON.stringify(mode === 'production' ? BACKEND : '')
  }
}))
