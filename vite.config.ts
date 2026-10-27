import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// VITE_BASE lets the same build target "/" (self-host, Docker) or
// "/Calorie-tracker/" (GitHub Pages project site). HashRouter means no
// server-side rewrite rules are needed anywhere.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      // A hand-written worker (src/sw.ts) so reminder notifications can open
      // the app when tapped. Precaching is injected into it at build time.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Calorie Tracker',
        short_name: 'Calories',
        lang: 'en',
        categories: ['health', 'food', 'lifestyle'],
        description:
          'Free, open-source calorie tracker. Bring your own AI API key. Logs stay on your device. AI runs with your chosen provider.',
        theme_color: '#ffffff',
        background_color: '#f7f7f5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Long-press / right-click on the installed icon.
        shortcuts: [
          {
            name: 'Log food',
            short_name: 'Log',
            url: './#/log',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Scan a barcode',
            short_name: 'Scan',
            url: './#/log/barcode',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
  },
});
