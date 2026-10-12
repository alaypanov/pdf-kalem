import type { PDFForm, PDFPage } from 'pdf-lib';
import type {
  RenderContext,
} from '../RenderContextInterface';
import type {
  RenderImage,
  RenderContextOptions,
  DrawRectangleArgs,
  DrawTextArgs,
  DrawLineArgs,
  DrawImageArgs,
  DrawSvgPathArgs,
  LinkAnnotationArgs,
} from '../RenderContextTypes';
import type { Theme } from '../Theme';
import type { Widget } from '../Widget';
import type { PdfFormSurface } from '../forms/surface';
import type { Fragment, LayoutBox, PagePlan } from './types';

/**
 * One output page's view of the backend. Implements {@link RenderContext} by
 * answering geometry from the page's plan and delegating everything else to
 * the backend. This is where pagination meets rendering: widgets keep calling
 * `render(context)` + `getLayoutBox(this)` — the scope is a second answer at
 * the seam they already trust, so the render path is unchanged.
 */
export class PageScope implements RenderContext {
  private readonly fragByWidget = new Map<Widget, Fragment>();

  constructor(private readonly backend: RenderContext, plan: PagePlan) {
    const index = (fragment: Fragment): void => {
      this.fragByWidget.set(fragment.widget, fragment);
      fragment.children.forEach(index);
    };
    plan.fixed.forEach(index);
    plan.roots.forEach(index);
  }

  // --- Pagination-aware geometry ---

  getLayoutBox(widget: Widget): LayoutBox {
    const frag = this.fragByWidget.get(widget);
    if (frag) {
      return this.backend.mapContentBox(frag.box);
    }
    // Descendant of a placed widget: translate its flow box by the nearest
    // placed ancestor's placement delta (whole-placed subtrees keep their
    // internal Yoga geometry; only the subtree root moved).
    const box = widget.getAbsoluteLayoutBox();
    let ancestor = widget.getParent();
    while (ancestor) {
      const ancestorFrag = this.fragByWidget.get(ancestor);
      if (ancestorFrag) {
        const flow = ancestor.getAbsoluteLayoutBox();
        return this.backend.mapContentBox({
          x: box.x + (ancestorFrag.box.x - flow.x),
          y: box.y + (ancestorFrag.box.y - flow.y),
          width: box.width,
          height: box.height,
        });
      }
      ancestor = ancestor.getParent();
    }
    return this.backend.getLayoutBox(widget);
  }

  getFlowOffset(widget: Widget): number {
    return this.fragByWidget.get(widget)?.sliceTop ?? 0;
  }

  getRenderChildren(widget: Widget): Widget[] | undefined {
    const frag = this.fragByWidget.get(widget);
    if (frag && frag.children.length > 0) {
      return frag.children.map((f) => f.widget);
    }
    // Whole-placed widget (or unplaced descendant): its real children.
    return undefined;
  }

  // --- Everything else delegates to the backend ---

  setTheme(theme?: Theme): void {
    this.backend.setTheme(theme);
  }

  getTheme(): Theme | undefined {
    return this.backend.getTheme();
  }

  setDebug(enabled: boolean): void {
    this.backend.setDebug(enabled);
  }

  isDebugEnabled(): boolean {
    return this.backend.isDebugEnabled();
  }

  getDebugStrokeWidth(): number {
    return this.backend.getDebugStrokeWidth();
  }

  setDefaultDimensions(width: number, height: number): void {
    this.backend.setDefaultDimensions(width, height);
  }

  getOptions(): RenderContextOptions {
    return this.backend.getOptions();
  }

  measureTextWidth(text: string, size: number, fontName: string): number {
    return this.backend.measureTextWidth(text, size, fontName);
  }

  measureFontAscent(size: number, fontName: string): number {
    return this.backend.measureFontAscent(size, fontName);
  }

  measureFontHeight(size: number, fontName: string): number {
    return this.backend.measureFontHeight(size, fontName);
  }

  measureDefaultLineHeight(size: number, fontName: string): number {
    return this.backend.measureDefaultLineHeight(size, fontName);
  }

  preloadFont(fontName: string): Promise<void> {
    return this.backend.preloadFont(fontName);
  }

  drawRectangle(args: DrawRectangleArgs): void {
    this.backend.drawRectangle(args);
  }

  async drawText(args: DrawTextArgs): Promise<void> {
    await this.backend.drawText(args);
  }

  drawLine(args: DrawLineArgs): void {
    this.backend.drawLine(args);
  }

  drawImage(image: RenderImage, args: DrawImageArgs): void {
    this.backend.drawImage(image, args);
  }

  drawSvgPath(args: DrawSvgPathArgs): void {
    this.backend.drawSvgPath(args);
  }

  addLinkAnnotation(args: LinkAnnotationArgs): void {
    this.backend.addLinkAnnotation(args);
  }

  embedImage(bytes: ArrayBuffer, format: 'png' | 'jpeg'): Promise<RenderImage> {
    return this.backend.embedImage(bytes, format);
  }

  getPageHeight(): number {
    return this.backend.getPageHeight();
  }

  getPageWidth(): number {
    return this.backend.getPageWidth();
  }

  getDimensions(): [number, number] {
    return this.backend.getDimensions();
  }

  mapContentBox(box: LayoutBox): LayoutBox {
    return this.backend.mapContentBox(box);
  }

  // --- PDF-typed form surface (pass-through) ---

  /**
   * Form widgets (`src/lib/forms/`) narrow to `PdfFormSurface` at render
   * time — including when they render through a scope on a paginated page.
   * The scope is a view of ITS backend, so the PDF-typed members pass
   * through; a backend without them fails with the same honest error the
   * form widgets themselves throw.
   */
  getForm(): PDFForm {
    return this.requirePdfMember('getForm').getForm();
  }

  getCurrentPage(): PDFPage | null {
    return this.requirePdfMember('getCurrentPage').getCurrentPage();
  }

  private requirePdfMember<K extends 'getForm' | 'getCurrentPage'>(name: K): PdfFormSurface & Pick<PdfFormSurface, K> {
    const backend = this.backend as unknown as Partial<PdfFormSurface>;
    if (typeof backend[name] !== 'function') {
      throw new Error(
        `PageScope: the backend does not expose ${name}() — form widgets require the PDF render context (pdf-kalem/forms renders through pdf-lib).`,
      );
    }
    return this.backend as unknown as PdfFormSurface & Pick<PdfFormSurface, K>;
  }
}