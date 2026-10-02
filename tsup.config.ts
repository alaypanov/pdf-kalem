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
  // Code splitting is required: with multiple entry points and no shared
  // chunks, classes like PageWidget get bundled into each entry separately,
  // giving them distinct identities and breaking `instanceof` checks across
  // entry points (e.g. `Page()` from 'pdf-kalem/widgets' passed to `PdfDoc` from
  // 'pdf-kalem').
  splitting: true,
  external: ['@chenglou/pretext', 'pdf-lib', 'yoga-layout'],
});