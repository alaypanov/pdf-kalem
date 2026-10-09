import { Widget, WidgetOptions } from './Widget';
import type { RenderContext } from './RenderContextInterface';
import { PageSize, PDFDocSize } from './types/doc-sizes';
import { Align, Direction, Edge, FlexDirection, Justify } from 'yoga-layout';
import { Paginator } from './pagination/Paginator';
import { PageScope } from './pagination/PageScope';
import type { LayoutBox } from './pagination/types';
import { debugLog } from './utils/debug';

interface PageOptions extends WidgetOptions {
  padding?: number;
  size?: PageSize;
  dimensions?: [number, number];
  children?: Widget[];
  /**
   * When true (default), content taller than one page is split across
   * additional output pages. Set to false to render a single page and let
   * overflow be clipped by the viewer.
   */
  overflow?: boolean;
}

export class PageWidget extends Widget {
  private dimensions?: [number, number];
  private size?: PageSize;
  private readonly paginateContent: boolean;

  constructor(options: PageOptions = {}) {
    super(options);
    this.dimensions = options.dimensions;
    this.size = options.size;
    this.paginateContent = options.overflow ?? true;

    // Root page node defaults
    this.node.setFlexDirection(FlexDirection.Column);
    this.node.setJustifyContent(Justify.FlexStart);
    this.node.setAlignItems(Align.Stretch);
    this.node.setPadding(Edge.All, options.padding ?? 0);
  }

  getDimensions(context: RenderContext): [number, number] {
    if (this.dimensions) {
      return this.dimensions;
    }
    if (this.size) {
      const size = PDFDocSize[this.size as keyof typeof PDFDocSize];
      if (size) {
        return size as [number, number];
      }
    }

    const docDimensions = context.getDimensions();
    return docDimensions;
  }

  /** Whether content overflowing this page splits across continuation pages. */
  get paginates(): boolean {
    return this.paginateContent;
  }

  /** @internal — flow layout pass for pagination (used by Paginator). */
  runFlowLayout(width: number, height: number | undefined): void {
    this.node.setWidth(width);
    if (height === undefined) {
      this.node.setHeightAuto();
    } else {
      this.node.setHeight(height);
    }
    this.calculateLayout(width, height, Direction.LTR);
  }

  /** @internal — content box after layout, page-relative top-left origin. */
  getContentBox(dimensions: [number, number]): LayoutBox {
    const padTop = this.node.getComputedPadding(Edge.Top);
    const padBottom = this.node.getComputedPadding(Edge.Bottom);
    const padLeft = this.node.getComputedPadding(Edge.Left);
    const padRight = this.node.getComputedPadding(Edge.Right);
    const borderTop = this.node.getComputedBorder(Edge.Top);
    const borderBottom = this.node.getComputedBorder(Edge.Bottom);
    const borderLeft = this.node.getComputedBorder(Edge.Left);
    const borderRight = this.node.getComputedBorder(Edge.Right);

    return {
      x: padLeft + borderLeft,
      y: padTop + borderTop,
      width: Math.max(0, dimensions[0] - padLeft - padRight - borderLeft - borderRight),
      height: Math.max(0, dimensions[1] - padTop - padBottom - borderTop - borderBottom),
    };
  }

  /**
   * Opens the backend surface this page paints onto. LoadedPage overrides
   * this to a no-op — its surface is an adopted existing page, opened in
   * render() before the layout pass.
   */
  protected async openPage(context: RenderContext, dimensions: [number, number]): Promise<void> {
    context.addPage(dimensions);
  }

  async render(context: RenderContext): Promise<void> {
    debugLog('Drawing Page');
    const dimensions = this.getDimensions(context);
    debugLog(`Page dimensions: ${dimensions[0]} x ${dimensions[1]}`);

    if (!this.paginateContent) {
      // Legacy single-page path — byte-identical to pre-pagination behavior.
      await this.openPage(context, dimensions);
      await this.prepareLayout(context);
      this.node.setWidth(dimensions[0]);
      this.node.setHeight(dimensions[1]);
      this.calculateLayout(dimensions[0], dimensions[1], Direction.LTR);
      await this.renderChildren(context);
      return;
    }

    const pagination = await new Paginator().paginate(this, context);

    if (!pagination.overflow) {
      // Content fits: render through the legacy path with the pass-1
      // geometry still on the nodes (byte-identical output).
      await this.openPage(context, dimensions);
      await this.renderChildren(context);
      return;
    }

    for (const plan of pagination.pages) {
      context.addPage(plan.pageSize);
      const scope = new PageScope(context, plan);
      for (const fragment of plan.fixed) await fragment.widget.render(scope);
      for (const fragment of plan.roots) await fragment.widget.render(scope);
    }
  }
}

export function Page(options: PageOptions = {}): PageWidget {
  return new PageWidget(options);
}