import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    widgets: 'src/widgets.ts',
    'utils/color-utils': 'src/lib/utils/color-utils.ts',
  },
  format: ['esm'],
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ['@chenglou/pretext', 'pdf-lib', 'yoga-layout'],
});