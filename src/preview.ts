/**
 * Preview subpath (`pdf-kalem/preview`): rasterize produced PDF bytes to
 * PNG — the fast visual feedback loop (IDEAS.md I9, Stage 1). Node-only;
 * needs the optional peer deps `pdfjs-dist` + `@napi-rs/canvas`.
 */
export { renderToPng, type RenderToPngOptions } from './lib/preview';
