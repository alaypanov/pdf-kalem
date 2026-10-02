import type { PdfDoc } from './PdfDoc';
import type { RenderContext } from './RenderContextInterface';
import type { PageWidget } from './Page';

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

  private async renderPages(context: RenderContext, pages: ReadonlyArray<unknown>): Promise<void> {
    for (const page of pages as ReadonlyArray<PageWidget>) {
      await page.render(context);
    }
  }
}
