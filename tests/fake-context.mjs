/**
 * The shared test fake: a deterministic `RenderContext` for planning pages
 * without pdf-lib, plus the `plan(page)` helper that runs the Paginator
 * against it. One home for the metrics every planning test's arithmetic
 * depends on (ARCHITECTURE.md #9).
 *
 * Metrics: char width = 0.6 * size, line height = 1.2 * size, ascent = size —
 * so Text(size: 10, lineHeight: 10) wraps 6 "word" tokens (29 chars = 174pt)
 * per 200pt line.
 *
 * Deliberately under tests/, not src/: it exists only for the test suite.
 */
import { Paginator } from '../dist/internals.js';

export class FakeContext {
  constructor() {
    this.pages = [];
    this.page = null;
  }
  setTheme() {}
  getTheme() {
    return undefined;
  }
  setDebug() {}
  isDebugEnabled() {
    return false;
  }
  getDebugStrokeWidth() {
    return 0.5;
  }
  setDefaultDimensions() {}
  getOptions() {
    return {};
  }
  measureTextWidth(text, size) {
    return text.length * size * 0.6;
  }
  measureFontAscent(size) {
    return size;
  }
  measureFontHeight(size) {
    return size;
  }
  measureDefaultLineHeight(size) {
    return size * 1.2;
  }
  async preloadFont() {}
  drawRectangle() {}
  async drawText() {}
  drawLine() {}
  drawImage() {}
  drawSvgPath() {}
  addLinkAnnotation() {}
  async embedImage() {
    throw new Error('embedImage not implemented in FakeContext');
  }
  addPage(dimensions) {
    const page = { width: dimensions[0], height: dimensions[1] };
    this.pages.push(page);
    this.page = page;
    return page;
  }
  getCurrentPage() {
    return this.page;
  }
  setCurrentPage(page) {
    this.page = page;
  }
  getPageHeight() {
    return this.page ? this.page.height : 0;
  }
  getPageWidth() {
    return this.page ? this.page.width : 0;
  }
  getDimensions() {
    return this.page ? [this.page.width, this.page.height] : [200, 100];
  }
  getLayoutBox(widget) {
    return widget.getAbsoluteLayoutBox();
  }
  mapContentBox(box) {
    return { ...box };
  }
  getFlowOffset() {
    return 0;
  }
}

/** Plan `page` through the Paginator against the fake backend. */
export async function plan(page) {
  const context = new FakeContext();
  page.setContext(context);
  return new Paginator().paginate(page, context);
}
