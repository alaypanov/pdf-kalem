import { StandardFonts } from 'pdf-lib';

/**
 * Runtime-agnostic registry for custom fonts.
 *
 * Owns three pieces of shared font state that previously lived split between
 * `PdfDoc` (static `browserFontLoads` + `registerFontFromUrl`) and
 * `RenderContext` (static `registeredFonts` + `fontkit`):
 *
 * 1. Registered font bytes (name → `Uint8Array`). Shared because every
 *    backend needs the bytes: PDF embeds them via fontkit, canvas loads them
 *    as `FontFace` for measurement (pretext) and drawing.
 * 2. The fontkit instance (only used by the PDF backend, but stored here so
 *    registration is backend-neutral).
 * 3. Browser `FontFace` loading into `document.fonts` (shared by any backend
 *    that uses pretext for canvas-based measurement).
 *
 * This is a singleton accessed via {@link FontRegistry.instance}. Public API
 * on `PdfDoc` (`registerFont`, `registerFontkit`, `registerFonts`,
 * `registerFontFromUrl`) delegates here for back-compat.
 */
export class FontRegistry {
  private static _instance: FontRegistry | undefined;

  static get instance(): FontRegistry {
    if (!this._instance) {
      this._instance = new FontRegistry();
    }
    return this._instance;
  }

  private readonly registeredFonts: Map<string, Uint8Array> = new Map();
  private fontkit: unknown | undefined;
  private readonly browserFontLoads: Map<string, Promise<void>> = new Map();

  private constructor() {}

  /** Registers raw font bytes under `fontName`. Throws on empty name/data. */
  registerFont(fontName: string, fontData: Uint8Array | ArrayBuffer): void {
    const name = fontName?.trim();
    if (!name) throw new Error('registerFont: fontName is required');
    const bytes = fontData instanceof Uint8Array ? fontData : new Uint8Array(fontData);
    if (bytes.byteLength === 0) throw new Error('registerFont: fontData is empty');
    this.registeredFonts.set(name, bytes);
  }

  /** Registers the fontkit instance used by the PDF backend to embed fonts. */
  registerFontkit(fontkit: unknown): void {
    this.fontkit = fontkit;
  }

  /** Returns the fontkit instance, if any. */
  getFontkit(): unknown | undefined {
    return this.fontkit;
  }

  /** Returns the registered bytes for `fontName`, if any. */
  getFontData(fontName: string): Uint8Array | undefined {
    return this.registeredFonts.get(fontName);
  }

  /** Whether `fontName` has been registered (not a builtin). */
  hasFont(fontName: string): boolean {
    return this.registeredFonts.has(fontName);
  }

  /**
   * Loads a registered font into the browser's `document.fonts` so that
   * canvas-based measurement (pretext) and canvas drawing can use it.
   * No-op in non-browser runtimes. Cached per font name.
   */
  async loadBrowserFont(fontName: string, fontData: Uint8Array): Promise<void> {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !('fonts' in document)) {
      return;
    }

    const fontSet = document.fonts as FontFaceSet & {
      add(font: FontFace): FontFaceSet;
      ready: Promise<FontFaceSet>;
    };

    const cachedLoad = this.browserFontLoads.get(fontName);
    if (cachedLoad) {
      await cachedLoad;
      return;
    }

    const loadPromise = (async () => {
      try {
        const fontSource = fontData.slice().buffer;
        const fontFace = new FontFace(fontName, fontSource);
        const loadedFont = await fontFace.load();
        fontSet.add(loadedFont);
        await fontSet.ready;
      } catch (err) {
        console.warn(`FontRegistry.loadBrowserFont: failed to load '${fontName}' into browser fonts`, err);
      }
    })();

    this.browserFontLoads.set(fontName, loadPromise);
    await loadPromise;
  }

  /**
   * Fetches a font from `url`, registers its bytes, and loads it into the
   * browser font set. Returns false on fetch/register failure (logs the
   * error). Used by `PdfDoc.registerFontFromUrl`.
   */
  async registerFontFromUrl(fontName: string, url: string): Promise<boolean> {
    const name = fontName?.trim();
    const fontUrl = url?.trim();

    if (!name || !fontUrl) {
      console.error('FontRegistry.registerFontFromUrl: fontName and url are required');
      return false;
    }

    try {
      const res = await fetch(fontUrl);
      if (!res.ok) {
        console.error(
          `FontRegistry.registerFontFromUrl: failed to fetch '${fontUrl}' (${res.status} ${res.statusText})`
        );
        return false;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      this.registerFont(name, bytes);
      await this.loadBrowserFont(name, bytes);
      return true;
    } catch (err) {
      console.error(`FontRegistry.registerFontFromUrl: failed to load '${name}' from '${fontUrl}'`, err);
      return false;
    }
  }

  /**
   * Bulk `registerFontFromUrl`. `fonts` maps font name → URL.
   */
  async registerFonts(fonts: Record<string, string>): Promise<void> {
    const entries = Object.entries(fonts ?? {});
    for (const [fontName, url] of entries) {
      await this.registerFontFromUrl(fontName, url);
    }
  }

  /**
   * Whether `fontName` is one of pdf-lib's `StandardFonts` values. Shared
   * helper used by the PDF backend to decide between embedding a registered
   * font vs. a builtin.
   */
  static isStandardFontName(fontName: string, standardFontsValues?: string[]): boolean {
    const values = standardFontsValues ?? (Object.values(StandardFonts) as string[]);
    return values.includes(fontName);
  }
}
