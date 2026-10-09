import type { PDFDocument } from 'pdf-lib';
import { PdfDoc } from '../PdfDoc';
import type { Theme } from '../Theme';
import type { FontSet } from '../fonts/types';
import type { LoadedPage } from './LoadedPage';

export interface LoadPdfOptions {
  /**
   * Font families (from `useFonts`) available to overlay widgets. Passed to
   * the internal `PdfDoc` on {@link save}; when composing loaded pages into
   * your own `PdfDoc`, pass the same `fonts` there.
   */
  fonts?: FontSet;
  /** Theme for overlay widgets. Same wiring as {@link fonts}. */
  theme?: Theme;
}

/**
 * An existing PDF opened for editing. `pages` is a plain mutable array of
 * {@link LoadedPage} widgets — the editing API *is* array manipulation:
 *
 * - remove / reorder pages → `splice` / `sort` on `pages`
 * - blank or generated pages → `pages.push(new Page({ ... }))`
 * - overlay widgets → `pages[i].add([...])`
 * - merge → compose several `pages` arrays in one `PdfDoc`
 *
 * Save either through the {@link save} sugar (a `PdfDoc` built from `pages`
 * with the load-time fonts/theme) or by composing `pages` into your own
 * `PdfDoc` alongside generated pages.
 */
export class LoadedPdf {
  /** The loaded pages, in output order. Mutate freely — this is the edit surface. */
  readonly pages: LoadedPage[];
  private readonly source: PDFDocument;
  private readonly fonts?: FontSet;
  private readonly theme?: Theme;

  constructor(source: PDFDocument, pages: LoadedPage[], options: LoadPdfOptions = {}) {
    this.source = source;
    this.pages = pages;
    this.fonts = options.fonts;
    this.theme = options.theme;
  }

  /**
   * The underlying pdf-lib document — a read-write escape hatch for anything
   * the editing API doesn't cover (metadata, form fields, raw pdf-lib
   * drawing). Beyond `loadPdf`'s guarantees, you're on your own here.
   */
  get PDFDocument(): PDFDocument {
    return this.source;
  }

  /**
   * Saves the edited document: builds a `PdfDoc` from the current `pages`
   * with the load-time fonts/theme and renders it. Stateless — every call
   * renders fresh, so the same `LoadedPdf` can be saved repeatedly (and its
   * pages can also be composed into other documents independently).
   */
  async save(): Promise<Uint8Array> {
    const doc = new PdfDoc({ children: this.pages, fonts: this.fonts, theme: this.theme });
    return doc.save();
  }
}
