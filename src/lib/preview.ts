/**
 * Preview seam, Stage 1 (IDEAS.md I9): rasterize produced PDF bytes to PNG.
 *
 * The seam sits at the *bytes* level — WYSIWYG by construction (the pixels
 * come from the same PDF the user gets), with no second drawing path that
 * can drift, and no violation of ADR 0001's PDF-only pivot. Stage 2 (a
 * faster Node-only adapter on `pdf-raster`, and a browser adapter for the
 * docs playground) plugs into the same interface when a second adapter
 * makes the seam real.
 *
 * Node-only: the Stage 1 adapter is `pdfjs-dist` + `@napi-rs/canvas`. Both
 * are **optional peer dependencies** — they are loaded lazily on the first
 * `renderToPng` call, so consumers who never import `pdf-kalem/preview`
 * never pay for them. Install with:
 *
 * ```
 * pnpm add -D pdfjs-dist @napi-rs/canvas
 * ```
 *
 * Node built-ins are reached through the same `new Function` escape hatch
 * `doc-output.ts` uses — `src/` stays free of node type dependencies.
 */

export interface RenderToPngOptions {
  /** 0-based page index. Default: 0 (the first page). Ignored when `all` is set. */
  page?: number;
  /** Rasterize every page; resolves to an array of PNGs in page order. */
  all?: boolean;
  /** Raster density in DPI — PDF space is 72/inch, so 144 doubles it. Default: 144. */
  dpi?: number;
}

/** Minimal structural types over the lazily-loaded adapters (no hard dep). */
interface PreviewCanvas {
  getContext: (kind: '2d') => PreviewCanvasContext2D;
  width: number;
  height: number;
  encode: (format: 'png') => Promise<Uint8Array>;
}

interface PreviewCanvasContext2D {
  canvas: PreviewCanvas | null;
}

interface PdfjsPage {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: {
    canvasContext: PreviewCanvasContext2D;
    viewport: { width: number; height: number };
    canvasFactory: unknown;
  }) => { promise: Promise<void> };
}

interface PdfjsDoc {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfjsPage>;
  destroy?: () => Promise<void>;
}

interface PdfjsLoadParams {
  data: Uint8Array;
  canvasFactory: unknown;
  standardFontDataUrl: string;
  isEvalSupported: boolean;
}

interface PreviewDeps {
  getDocument: (src: PdfjsLoadParams) => { promise: Promise<PdfjsDoc> };
  createCanvas: (width: number, height: number) => PreviewCanvas;
}

async function loadPreviewDeps(): Promise<PreviewDeps> {
  try {
    const [pdfjs, canvas] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('@napi-rs/canvas'),
    ]);
    // Deliberate loosening: pdfjs's precise types stay out of this module's
    // d.ts (consumers without pdfjs-dist installed must still typecheck).
    return { getDocument: pdfjs.getDocument as unknown as PreviewDeps['getDocument'], createCanvas: canvas.createCanvas };
  } catch (err) {
    throw new Error(
      'pdf-kalem/preview requires pdfjs-dist and @napi-rs/canvas — install them: pnpm add -D pdfjs-dist @napi-rs/canvas',
      { cause: err },
    );
  }
}

/**
 * pdfjs renders standard-14 fonts (unembedded builtin fonts like Helvetica)
 * from its own data files; without this it warns and the glyphs may not
 * draw. Resolved from wherever the consumer's package manager put
 * pdfjs-dist — `require.resolve` walks the real location through pnpm's
 * symlink layout.
 */
async function standardFontDataUrl(): Promise<string> {
  try {
    // createRequire needs this module's URL — passed at the call site
    // because `new Function` bodies cannot contain `import.meta`.
    const loadCreateRequire = new Function(
      "return import('node:module').then((m) => m.createRequire)",
    ) as () => Promise<(id: string) => { resolve: (id: string) => string }>;
    const createRequire = await loadCreateRequire();
    const resolved = createRequire(import.meta.url).resolve('pdfjs-dist/package.json');

    // pdfjs's Node standard-font factory reads with fs.readFile, which wants
    // a plain filesystem path (a file:// string fails). Normalizing the
    // separators keeps node:path out of src/; fs accepts forward slashes on
    // Windows too.
    const segments = resolved.split(/[\\/]/);
    return segments.slice(0, -1).join('/') + '/standard_fonts/';
  } catch (err) {
    throw new Error(
      'pdf-kalem/preview could not locate pdfjs-dist/standard_fonts — is pdfjs-dist installed?',
      { cause: err },
    );
  }
}

/**
 * Rasterizes pages of a produced PDF to PNG bytes.
 *
 * `pdfBytes` is what `doc.save()` returned — the exact bytes a consumer
 * receives, so the preview cannot lie. Default: page 0 as one PNG.
 * `{ all: true }` rasterizes every page, resolving to an array in page
 * order. Throws with install guidance when the optional peer dependencies
 * are missing.
 */
export async function renderToPng(
  pdfBytes: Uint8Array | ArrayBuffer,
  options: RenderToPngOptions & { all: true },
): Promise<Uint8Array[]>;
export async function renderToPng(
  pdfBytes: Uint8Array | ArrayBuffer,
  options?: RenderToPngOptions,
): Promise<Uint8Array>;
export async function renderToPng(
  pdfBytes: Uint8Array | ArrayBuffer,
  options: RenderToPngOptions = {},
): Promise<Uint8Array | Uint8Array[]> {
  const { all = false, page = 0, dpi = 144 } = options;
  const { getDocument, createCanvas } = await loadPreviewDeps();

  // pdfjs asks the host for canvases; @napi-rs/canvas provides them natively
  // (prebuilt binaries, no node-gyp).
  const canvasFactory = {
    create(width: number, height: number) {
      const canvas = createCanvas(width, height);
      return { canvas, context: canvas.getContext('2d') };
    },
    reset(canvasAndContext: { canvas: PreviewCanvas | null; context: PreviewCanvasContext2D | null }, width: number, height: number) {
      canvasAndContext.canvas!.width = width;
      canvasAndContext.canvas!.height = height;
    },
    destroy(canvasAndContext: { canvas: PreviewCanvas | null; context: PreviewCanvasContext2D | null }) {
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    },
  };

  const doc = await getDocument({
    // Copy an ArrayBuffer input: pdfjs transfers the buffer to its worker,
    // which would detach the caller's memory (B20).
    data: pdfBytes instanceof ArrayBuffer ? new Uint8Array(pdfBytes.slice(0)) : new Uint8Array(pdfBytes),
    canvasFactory,
    standardFontDataUrl: await standardFontDataUrl(),
    isEvalSupported: false,
  }).promise;

  try {
    const renderPage = async (index: number): Promise<Uint8Array> => {
      const pdfPage = await doc.getPage(index + 1);
      const viewport = pdfPage.getViewport({ scale: dpi / 72 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');

      await pdfPage.render({ canvasContext: context, viewport, canvasFactory }).promise;
      return canvas.encode('png');
    };

    if (all) {
      const pages: Uint8Array[] = [];
      for (let index = 0; index < doc.numPages; index++) {
        pages.push(await renderPage(index));
      }
      return pages;
    }

    // pdfjs pages are 1-based; validate before pdfjs's bare "Invalid page
    // request" error (B20).
    if (!Number.isInteger(page) || page < 0 || page >= doc.numPages) {
      throw new Error(
        `pdf-kalem/preview: page index ${page} is out of range (document has ${doc.numPages} page${doc.numPages === 1 ? '' : 's'})`
      );
    }
    return await renderPage(page);
  } finally {
    await doc.destroy?.();
  }
}
