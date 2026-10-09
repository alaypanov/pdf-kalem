import { PDFDocument } from 'pdf-lib';
import { LoadedPage } from './LoadedPage';
import { LoadedPdf, type LoadPdfOptions } from './LoadedPdf';

/** A PDF source: fetched when a string (http/data URL), used directly otherwise. */
export type PdfSource = string | Uint8Array | ArrayBuffer;

/**
 * Loads an existing PDF for editing. Every page becomes a {@link LoadedPage}
 * widget (dimensions preset from the file) on `LoadedPdf.pages` — restructure
 * pages by mutating that array, overlay widgets with `page.add([...])`, and
 * save with `pdf.save()` or by composing `pages` into a `PdfDoc`.
 *
 * A string source is fetched (browser and Node 18+ both have global `fetch`);
 * pass bytes for other runtimes or when the bytes are already in hand.
 * Encrypted documents are not supported: pdf-lib's load error propagates
 * as-is. Rotated pages (`/Rotate ≠ 0`) throw a clear error — overlaying them
 * is not supported yet.
 */
export async function loadPdf(
  source: PdfSource,
  options: LoadPdfOptions = {},
): Promise<LoadedPdf> {
  const bytes = typeof source === 'string' ? await fetchPdf(source) : source;
  const doc = await PDFDocument.load(bytes);

  const pages: LoadedPage[] = [];
  const docPages = doc.getPages();
  for (let i = 0; i < docPages.length; i++) {
    const page = docPages[i];
    const rotation = page.getRotation().angle % 360;
    if (rotation !== 0) {
      throw new Error(
        `loadPdf: page ${i} is rotated ${rotation}°. Overlaying rotated pages is not supported yet ` +
        '(the overlay would land sideways relative to the viewer); remove the rotation or flatten the page first.',
      );
    }
    pages.push(new LoadedPage(doc, i, [page.getWidth(), page.getHeight()]));
  }

  return new LoadedPdf(doc, pages, options);
}

/** Fetches a string source (http/data URL) with a loadPdf-branded error. */
async function fetchPdf(url: string): Promise<Uint8Array | ArrayBuffer> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`loadPdf: failed to fetch '${url}' (${err instanceof Error ? err.message : String(err)})`);
  }
  if (!response.ok) {
    throw new Error(`loadPdf: failed to fetch '${url}' (${response.status} ${response.statusText})`);
  }
  return response.arrayBuffer();
}
