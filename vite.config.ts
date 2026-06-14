import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist-examples',
    rollupOptions: {
      input: {
        examples: resolve(__dirname, 'examples/index.html'),
        invoice: resolve(__dirname, 'examples/invoice/index.html'),
        playground: resolve(__dirname, 'examples/playground/index.html'),
      },
    },
  },
});