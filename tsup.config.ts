import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    widgets: 'src/widgets.ts',
    markdown: 'src/markdown.ts',
    edit: 'src/edit.ts',
    // Node-only preview rasterizer (IDEAS.md I9). Its deps are optional
    // peers, loaded lazily — external keeps them out of the bundle.
    preview: 'src/preview.ts',
    // Test-only surface (Paginator/PageScope/plans). Shipped in dist/ but not
    // in package.json exports, so it is not importable by package consumers.
    internals: 'src/internals.ts',
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
  external: ['@chenglou/pretext', 'pdf-lib', 'yoga-layout', '@pdf-lib/fontkit', 'pdfjs-dist', '@napi-rs/canvas'],
});