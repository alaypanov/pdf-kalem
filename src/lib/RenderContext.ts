import { PDFDocument, PDFPage } from 'pdf-lib';
import { Allocator } from 'stretch-layout';

export interface RenderContextOptions {
  height?: number; // Default page height if needed before page creation
  width?: number;  // Default page width if needed before page creation
  allocator?: Allocator; // Allocator for layout engine
  // Removed margin, handled by layout engine
}


export class RenderContext {
  private options: RenderContextOptions;
  private doc: PDFDocument;
  private page: PDFPage | null;
  private dimensions?: [number, number]
  public allocator: Allocator
  
  constructor(doc: PDFDocument, options: RenderContextOptions) {
    this.options = options;
    this.doc = doc;
    this.page = null;
    this.dimensions = undefined;
  }

  setAllocator(allocator: Allocator): void {
    this.allocator = allocator;
  }

  getDocument(): PDFDocument {
    return this.doc;
  }

  getCurrentPage(): PDFPage | null{
    return this.page;
  }

  getPageHeight(): number {
    // Prioritize current page size, then options
    return this.getCurrentPage()?.getSize().height || this.options.height || 0;
  }

  getPageWidth(): number {
    // Prioritize current page size, then options
    return this.getCurrentPage()?.getSize().width || this.options.width || 0;
  }

  getDimensions(): [number, number] {
    if (this.dimensions) {
      return this.dimensions;
    }
    const page = this.getCurrentPage();
    if (page) {
      return [page.getWidth(), page.getHeight()];
    }
    return [this.options.width || 0, this.options.height || 0];
  }

  setCurrentPage(currentPage: PDFPage): void {
    this.page = currentPage;
    this.dimensions = [currentPage.getWidth(), currentPage.getHeight()];
  }

  getOptions(): RenderContextOptions {
    return this.options;
  }

}