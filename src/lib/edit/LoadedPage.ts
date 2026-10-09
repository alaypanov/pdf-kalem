import { Edge } from 'yoga-layout';
import type { PDFDocument } from 'pdf-lib';
import { PageWidget } from '../Page';
import type { RenderContext } from '../RenderContextInterface';
import type { Widget } from '../Widget';
import { debugLog } from '../utils/debug';

/**
 * A page adopted from an existing PDF, as a real {@link PageWidget}: its
 * dimensions are preset from the original file, and the original page
 * content (streams, annotations, links, form fields) is preserved by
 * adopting the actual page object into the output document at render time
 * (see {@link RenderContext.adoptPage}). Overlay widgets draw on top of it.
 *
 * Instances come from `loadPdf` (`pdf-kalem/edit`). Because a LoadedPage is
 * a PageWidget, loaded pages compose freely with generated ones:
 * `new PdfDoc({ children: [...loaded.pages, new Page(...)] })`.
 */
export class LoadedPage extends PageWidget {
  private readonly source: PDFDocument;
  private readonly sourceIndex: number;

  constructor(source: PDFDocument, sourceIndex: number, dimensions: [number, number]) {
    // overflow: false — an overlay belongs to exactly one page; content is
    // clipped by the page edge, never paginated across pages.
    super({ dimensions, overflow: false });
    this.source = source;
    this.sourceIndex = sourceIndex;
  }

  /** This page's index in the source document (post-restructure, positions in `LoadedPdf.pages` may differ). */
  getSourceIndex(): number {
    return this.sourceIndex;
  }

  /**
   * Adds widgets on top of the original page content. Widgets join a
   * page-filling flow root (column, top-down): position with padding,
   * alignment, and spacers; use `FixedContainer` for absolute placement.
   * Repeated calls append in call order. Painting happens at save time,
   * together with the rest of the document — the widget tree is the state.
   */
  add(widgets: Widget[]): void {
    for (const widget of widgets) {
      this.appendWidgetChild(widget);
    }
  }

  async render(context: RenderContext): Promise<void> {
    debugLog(`LoadedPage: adopting source page ${this.sourceIndex}`);
    await context.adoptPage(this.source, this.sourceIndex);

    // The legacy single-page path (overflow: false): openPage is a no-op —
    // the surface already exists — then layout + paint children on top.
    await super.render(context);
    this.warnIfOverflowing();
  }

  /** The page surface was opened by adoption; nothing to add. */
  protected override async openPage(_context: RenderContext, _dimensions: [number, number]): Promise<void> {}

  /**
   * Overlay content is clipped by the page edge, never paginated — say so
   * once when the flow content outgrows the page.
   */
  private warnIfOverflowing(): void {
    if (this.children.length === 0) return;

    let bottom = 0;
    for (const child of this.children) {
      const geometry = child.getFlowGeometry();
      if (geometry.absolute) continue;
      bottom = Math.max(bottom, geometry.top + geometry.height);
    }
    const contentBottom = bottom + this.node.getComputedPadding(Edge.Bottom);
    const [, pageHeight] = this.getDimensions(this.context!);
    if (contentBottom > pageHeight) {
      console.warn(
        `LoadedPage: overlay content extends ${(contentBottom - pageHeight).toFixed(1)}pt below the page bottom; ` +
        'it will be clipped (overlays are never paginated across pages).',
      );
    }
  }
}
