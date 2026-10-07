/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH permet de servir l'app dans un sous-dossier (ex. GitHub Pages : /rythme/).
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Rythme : ton alternance, organisée',
        short_name: 'Rythme',
        description: 'Organise ton alternance entre école et entreprise, et partage ton calendrier avec ton tuteur.',
        lang: 'fr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#111113',
        theme_color: '#111113',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [{ name: 'Tâches', short_name: 'Tâches', url: `${base}taches` }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: 'index.html',
        // Les fonctions serveur (statistiques, flux .ics) ne passent jamais par le cache.
        navigateFallbackDenylist: [/^\/api\//, /^\/cal\//],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.ts', 'api/**/*.test.ts'],
    environment: 'node',
  },
});
