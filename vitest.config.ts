import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Run the suite in a timezone far from UTC so local-day logic is really exercised.
process.env.TZ = 'Pacific/Kiritimati';

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify('test') },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
