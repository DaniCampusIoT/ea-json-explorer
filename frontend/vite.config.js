import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: mode === 'development' ? {
      '/api': 'http://localhost:8000'
    } : undefined
  },
  build: {
    outDir: 'dist',
  },
  // En produccion VITE_API_URL apunta al backend de Railway
  define: {
    __API_BASE__: JSON.stringify(
      process.env.VITE_API_URL || ''
    )
  }
}))
