import type { PDFDocument, PDFPage } from 'pdf-lib';
import type { RenderContext } from './RenderContextInterface';

/**
 * The PDF-specific page-lifecycle surface (ARCHITECTURE #10).
 *
 * ADR 0001's rule is "PDF-specific features get PDF-typed modules, never
 * interface widening" — but `adoptPage` and the page-handle members lived on
 * the "backend-neutral" `RenderContext`, typed `unknown` to hide that they
 * are pdf-lib mechanics. This interface moves them where they belong: the
 * PDF-typed layer.
 *
 * `PdfRenderContext` implements both interfaces (it already had every
 * method); the edit module's `LoadedPage` — the one consumer of adoption —
 * narrows to this surface at render time.
 */
export interface PdfPageSurface {
  /** Adds a page of the given dimensions; returns the pdf-lib page handle. */
  addPage(dimensions: [number, number]): PDFPage;
  getCurrentPage(): PDFPage | null;
  setCurrentPage(page: PDFPage): void;

  /**
   * Adopts a page from a foreign `PDFDocument` as the current drawing
   * surface: the page object is copied into the output document — content
   * streams, annotations, links, and form fields come along — so subsequent
   * drawing lands on top of the original content. Used by the edit module
   * (`pdf-kalem/edit`).
   */
  adoptPage(source: PDFDocument, pageIndex: number): Promise<void>;
}

/**
 * Structural check: can this context open pages? `Page` only ever calls
 * `addPage` — demanding the full surface (including `adoptPage`, which only
 * the edit module uses) would over-constrain test fakes and future scopes.
 */
export function canAddPages(context: RenderContext): context is RenderContext & Pick<PdfPageSurface, 'addPage'> {
  return typeof (context as unknown as Partial<PdfPageSurface>).addPage === 'function';
}

/** Structural check: does this context expose the full PDF page surface (adoption included)? */
export function isPdfPageSurface(context: RenderContext): context is RenderContext & PdfPageSurface {
  // The unknown bridge is deliberate: the whole point is that RenderContext
  // no longer declares these members, so the check probes at runtime.
  const candidate = context as unknown as Partial<PdfPageSurface>;
  return (
    typeof candidate.adoptPage === 'function' &&
    typeof candidate.addPage === 'function' &&
    typeof candidate.getCurrentPage === 'function' &&
    typeof candidate.setCurrentPage === 'function'
  );
}
