import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// URL hardcodeada: no depende de variables de entorno ni de Docker cache
const BACKEND = 'https://ea-explorer-backend-production.up.railway.app'

export default defineConfig({
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
})
