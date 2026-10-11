import { Widget, WidgetOptions } from './Widget';
import type { RenderContext } from './RenderContextInterface';

export interface SpacerOptions extends WidgetOptions {
  /**
   * Fixed extent along the parent's main axis — a gap of exactly this many
   * points. Takes precedence over `grow`.
   */
  size?: number;
  /**
   * Flex grow factor: how much of the parent's free main-axis space this
   * spacer absorbs. Default 1 when `size` is not given (a bare `Spacer()`
   * pushes siblings apart); 0 with a `size` for a fixed gap.
   */
  grow?: number;
}

/**
 * Invisible box that occupies space in flow — the replacement for faking
 * gaps with empty `Container({ height: 12 })`. Fixed (`size`) or flexible
 * (`grow`); paints nothing.
 */
export class SpacerWidget extends Widget {
  constructor(options: SpacerOptions = {}) {
    super(options);

    if (options.size !== undefined) {
      const size = Number.isFinite(options.size) && (options.size as number) >= 0
        ? options.size as number
        : 0;
      this.setYogaStyle({
        width: size,
        height: size,
        flexGrow: options.grow ?? 0,
      });
    } else {
      this.setYogaStyle({
        flexBasis: 0,
        flexGrow: options.grow ?? 1,
        flexShrink: 1,
      });
    }
  }

  async render(_context: RenderContext): Promise<void> {}
}

export function Spacer(options: SpacerOptions = {}): SpacerWidget {
  return new SpacerWidget(options);
}
