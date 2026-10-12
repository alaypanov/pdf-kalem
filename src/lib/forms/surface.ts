import type { PDFForm, PDFPage } from 'pdf-lib';
import type { RenderContext } from '../RenderContextInterface';

/**
 * The PDF-typed surface form widgets need (ADR 0001: PDF features get
 * PDF-typed modules, never interface widening).
 *
 * Form fields are pure PDF mechanics — an AcroForm field lives in the
 * document's catalog and its widget annotations live on pages — so the seam
 * stays out of the backend-neutral `RenderContext`. `PdfRenderContext`
 * supplies both members; form widgets narrow to this surface at render time,
 * the same runtime narrowing `LoadedPage` uses for `PdfPageSurface`.
 */
export interface PdfFormSurface {
  /** The document's interactive form (created in the catalog on first use). */
  getForm(): PDFForm;
  /** The page being painted by the current render walk. */
  getCurrentPage(): PDFPage | null;
}

/** Structural check: does this context expose the form surface? */
export function isPdfFormSurface(context: RenderContext): context is RenderContext & PdfFormSurface {
  // The unknown bridge mirrors `isPdfPageSurface`: `RenderContext` does not
  // declare these members, so the check probes at runtime.
  const candidate = context as unknown as Partial<PdfFormSurface>;
  return (
    typeof candidate.getForm === 'function' &&
    typeof candidate.getCurrentPage === 'function'
  );
}
