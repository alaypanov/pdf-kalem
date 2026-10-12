import { Widget, WidgetOptions, type YogaStyle } from './Widget';
import type { RenderContext } from './RenderContextInterface';

/**
 * Where non-positioned children sit inside the stack box. Vertical comes
 * from `justifyContent`, horizontal from `alignItems` (column direction).
 */
export type StackAlignment =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'centerLeft'
  | 'center'
  | 'centerRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';

export interface StackOptions extends WidgetOptions {
  /** Alignment of non-positioned children. Default: 'topLeft'. */
  alignment?: StackAlignment;
  width?: YogaStyle['width'];
  height?: YogaStyle['height'];
}

const ALIGNMENTS: Record<StackAlignment, { justify: YogaStyle['justifyContent']; align: YogaStyle['alignItems'] }> = {
  topLeft: { justify: 'flex-start', align: 'flex-start' },
  topCenter: { justify: 'flex-start', align: 'center' },
  topRight: { justify: 'flex-start', align: 'flex-end' },
  centerLeft: { justify: 'center', align: 'flex-start' },
  center: { justify: 'center', align: 'center' },
  centerRight: { justify: 'center', align: 'flex-end' },
  bottomLeft: { justify: 'flex-end', align: 'flex-start' },
  bottomCenter: { justify: 'flex-end', align: 'center' },
  bottomRight: { justify: 'flex-end', align: 'flex-end' },
};

/**
 * Overlays its children in the same box, painted in order (first child
 * bottom-most). The overlay composition primitive `FixedContainer` alone
 * can't provide: it positions one subtree absolutely but has nothing to
 * size to or align against.
 *
 * Children split into two kinds:
 *
 * - **Positioned** children — widgets that declare their own absolute
 *   insets (`FixedContainer`). Stack leaves their nodes untouched.
 * - **Non-positioned** children — aligned per `alignment` (Yoga aligns
 *   inset-less absolute children via justifyContent/alignItems).
 *
 * Sizing follows the same rule as Flutter's Stack: explicit `width`/
 * `height` win; otherwise the stack sizes to its largest non-positioned
 * child (measured intrinsically in prepareLayout, after children have
 * their intrinsic sizes). Positioned children may overflow the box.
 *
 * Stack is atomic under pagination — overlaid children cannot split
 * coherently, so the whole box moves or is clipped.
 */
export class StackWidget extends Widget {
  private readonly explicitWidth?: YogaStyle['width'];
  private readonly explicitHeight?: YogaStyle['height'];

  constructor(options: StackOptions = {}) {
    // Forward the full options so the base wiring (margin, breakable) runs —
    // passing only `children` silently dropped `margin` (B15).
    super(options);

    this.explicitWidth = options.width;
    this.explicitHeight = options.height;

    const { justify, align } = ALIGNMENTS[options.alignment ?? 'topLeft'];
    this.setYogaStyle({
      flexDirection: 'column',
      justifyContent: justify,
      alignItems: align,
      width: options.width ?? 'auto',
      height: options.height ?? 'auto',
    });

    for (const child of this.children) {
      if (child.getPositionEdges() === undefined) {
        child.positionAbsolute();
      }
    }
  }

  override async prepareLayout(context: RenderContext): Promise<void> {
    await super.prepareLayout(context);
    this.sizeToNonPositionedChildren();
  }

  /**
   * Auto sizing: measure each non-positioned child intrinsically (its own
   * Yoga pass — Text's measure function and Image's intrinsic size are in
   * place by now) and take the max. The page-root layout recomputes the
   * tree afterward, so the throwaway passes leave nothing behind.
   */
  private sizeToNonPositionedChildren(): void {
    let width = 0;
    let height = 0;
    let found = false;
    for (const child of this.children) {
      if (child.getPositionEdges() !== undefined) continue;
      found = true;
      child.calculateLayout(undefined, undefined);
      width = Math.max(width, child.getWidth());
      height = Math.max(height, child.getHeight());
    }

    if (!found) {
      if (this.explicitWidth === undefined || this.explicitHeight === undefined) {
        throw new Error(
          'Stack with only positioned children (e.g. FixedContainer) cannot be sized — pass explicit width and height.',
        );
      }
      return;
    }

    if (this.explicitWidth === undefined) this.node.setWidth(width);
    if (this.explicitHeight === undefined) this.node.setHeight(height);
  }

  async render(context: RenderContext): Promise<void> {
    await this.renderChildren(context);
  }
}

export function Stack(options: StackOptions = {}): StackWidget {
  return new StackWidget(options);
}
