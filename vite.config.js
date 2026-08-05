import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Solo precache por defecto del shell. NADA de runtime caching custom:
      // el padrón vive en IndexedDB, no en el cache del service worker.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,otf}'],
      },
      manifest: {
        name: 'Puerta STSEGOB',
        short_name: 'Puerta',
        description: 'Control de acceso en puerta — Evento 6 de agosto',
        lang: 'es-MX',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0e322e',
        background_color: '#0e322e',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
