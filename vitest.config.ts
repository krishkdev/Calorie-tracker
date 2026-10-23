import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Run the suite in a timezone far from UTC so local-day logic is really exercised.
process.env.TZ = 'Pacific/Kiritimati';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // vite-plugin-pwa's virtual module is only provided by the PWA plugin.
      'virtual:pwa-register/react': '/src/test/pwaRegisterReact.ts',
    },
  },
  define: { __APP_VERSION__: JSON.stringify('test') },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
