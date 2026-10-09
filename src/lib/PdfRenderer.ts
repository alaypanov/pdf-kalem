import type { PdfDoc } from './PdfDoc';
import type { RenderContext } from './RenderContextInterface';
import type { Widget } from './Widget';

/**
 * Walks a {@link PdfDoc}'s page tree and drives the {@link RenderContext}.
 *
 * This is the renderer-specific concern that used to live on `PdfDoc` when it
 * extended `Widget`. Keeping it separate means `PdfDoc` is just a document
 * model and the rendering strategy can evolve independently.
 */
export class PdfRenderer {
  constructor(private readonly doc: PdfDoc) {}

  async render(): Promise<void> {
    await this.renderPages(this.doc.getContext(), this.doc.getChildren());
  }

  // PdfDoc's constructor enforces that every child is a PageWidget; the base
  // type is all the render loop needs.
  private async renderPages(context: RenderContext, pages: ReadonlyArray<Widget>): Promise<void> {
    for (const page of pages) {
      await page.render(context);
    }
  }
}