import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import { manifest } from './src/app/manifest'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  // Relative base so the same build works on any static host and in
  // Capacitor / Tauri shells later on.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Our own worker rather than a generated one: it has to receive a push
      // from the Partieserver, which is the only thing that reaches a
      // telephone whose app has been closed. `sw/sw.ts` keeps the precaching
      // the generated one did, and calls skipWaiting itself.
      strategies: 'injectManifest',
      srcDir: 'sw',
      filename: 'sw.ts',
      // The app registers the worker itself, in `@app/updates`: the injected
      // snippet only registers, and never checks for a newer build.
      injectRegister: null,
      includeAssets: ['favicon.svg'],
      manifest,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: true,
    // Cloudflare quick tunnels hand out a random *.trycloudflare.com name;
    // without this Vite refuses the request as an unknown host.
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.loca.lt'],
    // `npm run server` runs the Partieserver on 8787; the game talks to it
    // through the same origin so no CORS or URL juggling is needed.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true, ws: true },
    },
    watch: {
      // The Partieserver writes its Durable Object storage constantly. Without
      // this every save reloads the page, which on a telephone looks exactly
      // like the game crashing and losing your place.
      ignored: ['**/.wrangler/**', '**/dist/**'],
    },
  },
  resolve: {
    alias: {
      '@engine': r('./src/engine'),
      '@content': r('./src/content'),
      '@ui': r('./src/ui'),
      '@app': r('./src/app'),
      '@i18n': r('./src/i18n'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.ts'],
    // Pins the language, so copy assertions do not depend on the machine.
    setupFiles: ['./src/test-setup.ts'],
  },
})
