import type { Theme } from './Theme';
import type { Widget } from './Widget';
import type {
  RenderImage,
  RenderContextOptions,
  DrawRectangleArgs,
  DrawTextArgs,
  DrawLineArgs,
  DrawImageArgs,
  DrawSvgPathArgs,
  LinkAnnotationArgs,
} from './RenderContextTypes';

/**
 * Backend-neutral render context.
 *
 * Widgets depend on this interface, not on any concrete backend. The PDF
 * backend supplies a {@link PdfRenderContext}; future backends (image, HTML)
 * supply their own implementations. This is the polymorphism point that lets
 * the same widget tree render to different output formats.
 *
 * The interface is split into three concerns:
 *
 * 1. **Theme / debug** — shared configuration every backend needs.
 * 2. **Measurement** — font metrics. The signatures are shared, but each
 *    backend implements them against its own font system (pdf-lib's
 *    `PDFFont`, canvas `measureText`, etc.).
 * 3. **Drawing + page lifecycle** — backend-specific. `addPage` returns
 *    `unknown` because the page handle type differs per backend (`PDFPage`
 *    for PDF, `CanvasRenderingContext2D` for image, etc.).
 *
 * Note: {@link getLayoutBox} returns a box in yoga coordinates (top-left
 * origin, y grows down). Backends that need a different origin (e.g. PDF,
 * which grows up from the bottom-left) apply the flip inside their
 * implementation.
 */
export interface RenderContext {
  // --- Theme / debug (shared) ---

  setTheme(theme?: Theme): void;
  getTheme(): Theme | undefined;
  setDebug(enabled: boolean): void;
  isDebugEnabled(): boolean;
  getDebugStrokeWidth(): number;
  setDefaultDimensions(width: number, height: number): void;
  getOptions(): RenderContextOptions;

  // --- Measurement (shared signatures, backend-specific impl) ---

  measureTextWidth(text: string, size: number, fontName: string): number;
  measureFontAscent(size: number, fontName: string): number;
  measureDefaultLineHeight(size: number, fontName: string): number;
  preloadFont(fontName: string): Promise<void>;

  // --- Drawing (backend-specific) ---

  drawRectangle(args: DrawRectangleArgs): void;
  drawText(args: DrawTextArgs): Promise<void>;
  drawLine(args: DrawLineArgs): void;
  drawImage(image: RenderImage, args: DrawImageArgs): void;
  drawSvgPath(args: DrawSvgPathArgs): void;
  addLinkAnnotation(args: LinkAnnotationArgs): void;

  /**
   * Embeds image bytes in the backend's native image format. The return type
   * is backend-specific (PDFImage for PDF, canvas ImageData for image, etc.);
   * it's typed as `RenderImage` for now but will become backend-neutral in v2.
   */
  embedImage(bytes: ArrayBuffer, format: 'png' | 'jpeg'): Promise<RenderImage>;

  // --- Page lifecycle (backend-specific) ---

  /** Adds a new page/canvas/surface of the given dimensions. Returns the backend's page handle. */
  addPage(dimensions: [number, number]): unknown;
  /** Returns the current page handle (typed as `unknown` since it's backend-specific). */
  getCurrentPage(): unknown;
  /** Sets the current page handle. Implementations should accept their own page type. */
  setCurrentPage(page: unknown): void;

  getPageHeight(): number;
  getPageWidth(): number;
  getDimensions(): [number, number];

  /**
   * Returns the layout box of `widget` in the backend's coordinate system.
   * Implementations that need a non-yoga origin (e.g. PDF's bottom-left
   * origin) apply the transform here.
   */
  getLayoutBox(widget: Widget): { x: number; y: number; width: number; height: number };

  /** @deprecated Renamed to {@link getLayoutBox}. Kept for back-comat. */
  getLayoutBoxInPdfCoords(widget: Widget): { x: number; y: number; width: number; height: number };
}
