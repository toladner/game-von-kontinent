import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  // Relative base so the same build works on any static host and in
  // Capacitor / Tauri shells later on.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Von Kontinent zu Kontinent',
        short_name: 'Kontinente',
        description: 'Import- und Exporthandel auf hoher See.',
        theme_color: '#0f3b54',
        background_color: '#9dd3e0',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        icons: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@engine': r('./src/engine'),
      '@content': r('./src/content'),
      '@ui': r('./src/ui'),
      '@app': r('./src/app'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
