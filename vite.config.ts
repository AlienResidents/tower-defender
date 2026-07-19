import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        lab: fileURLToPath(new URL('./lab.html', import.meta.url)),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
