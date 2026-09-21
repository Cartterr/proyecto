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
    // Allow temporary ngrok hostnames when exposing the local dev server.
    allowedHosts: true,
    // Local-only proxies. Both are opt-in via env so production builds are unaffected.
    // VITE_REPISAS_3D_PROXY routes the embedded configurator, its assets and the generated
    // PDFs through this same origin, so a single tunnel serves the whole flow.
    proxy: {
      ...(process.env.VITE_NETLIFY_FUNCTIONS_PROXY ? {
        '/.netlify/functions': {
          target: process.env.VITE_NETLIFY_FUNCTIONS_PROXY,
          changeOrigin: true,
        },
      } : {}),
      ...(process.env.VITE_REPISAS_3D_PROXY ? {
        '/embed': { target: process.env.VITE_REPISAS_3D_PROXY, changeOrigin: true },
        // El configurador completo que se abre en el modal. Cualquier ruta que no sea /embed
        // hace que la app 3D monte su interfaz entera.
        '/configurador': { target: process.env.VITE_REPISAS_3D_PROXY, changeOrigin: true },
        '/assets': { target: process.env.VITE_REPISAS_3D_PROXY, changeOrigin: true },
        '/generated': { target: process.env.VITE_REPISAS_3D_PROXY, changeOrigin: true },
      } : {}),
    },
  },
})
