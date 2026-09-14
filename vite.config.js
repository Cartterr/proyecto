// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true,
  },
  publicDir: 'public', // ✅ aquí Vite copiará confirm.html y otros archivos estáticos
  server: {
    port: 5173,
    ...(process.env.VITE_NETLIFY_FUNCTIONS_PROXY ? {
      proxy: {
        '/.netlify/functions': {
          target: process.env.VITE_NETLIFY_FUNCTIONS_PROXY,
          changeOrigin: true,
        },
      },
    } : {}),
  },
})
