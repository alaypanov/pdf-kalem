import type { RenderContext } from './RenderContextInterface';
import type { RenderColor } from './RenderContextTypes';
import type { LineFragment, TextLayoutLine } from './TextLayoutEngine';

/**
 * A laid-out line positioned for drawing: the substring, its width, and the
 * x/y of its baseline in PDF coordinates. Rich-run lines also carry their
 * fragments positioned at absolute x (whitespace pieces included).
 */
export interface PositionedTextLine extends TextLayoutLine {
  x: number;
  y: number;
  fragments?: PositionedFragment[];
}

/** A {@link LineFragment} resolved to an absolute x position. */
export interface PositionedFragment extends LineFragment {
  x: number;
}

/**
 * Per-run paint style, indexed by fragment `runIndex`. The painter draws
 * each fragment with its own font/color and renders strikethrough/underline
 * for flagged runs.
 */
export interface PaintRun {
  fontName: string;
  color: RenderColor;
  strike: boolean;
  underline: boolean;
}

/**
 * A fully resolved text layout ready to paint: the layout box, the positioned
 * lines, and the max line width.
 */
export interface RenderedTextLayout {
  box: { x: number; y: number; width: number; height: number };
  lines: PositionedTextLine[];
  maxWidth: number;
}

/**
 * Paints a {@link RenderedTextLayout} onto a {@link RenderContext}.
 *
 * This is the shared drawing concern that used to be duplicated between
 * `TextWidget` and `LinkWidget`. It knows nothing about themes or widgets —
 * callers hand it concrete font name, size, color, and an optional underline.
 */
export class TextPainter {
  /** Strikethrough sits ~0.28em above the baseline. */
  private static strikeOffset(size: number): number {
    return size * 0.28;
  }

  /**
   * Draws each line of `layout` at its baseline. Lines carrying fragments
   * draw per-fragment fonts/colors/strikethrough from `options.runs`; plain
   * lines draw whole with `options.fontName`/`color`, optionally underlined.
   */
  static async paint(
    context: RenderContext,
    layout: RenderedTextLayout,
    options: {
      size: number;
      color: RenderColor;
      fontName: string;
      underline?: boolean;
      underlineColor?: RenderColor;
      runs?: ReadonlyArray<PaintRun>;
    }
  ): Promise<void> {
    for (const line of layout.lines) {
      if (line.fragments && options.runs) {
        for (const fragment of line.fragments) {
          const run = options.runs[fragment.runIndex];
          if (!run) {
            continue;
          }

          await context.drawText({
            text: fragment.text,
            x: fragment.x,
            y: line.y,
            size: options.size,
            color: run.color,
            fontName: run.fontName,
          });

          if (run.strike) {
            // PDF y grows up: the strike sits ~0.28em ABOVE the baseline
            // (subtracting would draw it below the baseline, like an
            // underline).
            const strikeY = line.y + TextPainter.strikeOffset(options.size);
            context.drawLine({
              start: { x: fragment.x, y: strikeY },
              end: { x: fragment.x + fragment.width, y: strikeY },
              thickness: Math.max(0.5, options.size * 0.06),
              color: run.color,
            });
          }

          if (options.underline || run.underline) {
            const underlineY = line.y - Math.max(1, options.size * 0.08);
            context.drawLine({
              start: { x: fragment.x, y: underlineY },
              end: { x: fragment.x + fragment.width, y: underlineY },
              thickness: Math.max(0.5, options.size * 0.06),
              color: options.underlineColor ?? run.color,
            });
          }
        }
        continue;
      }

      await context.drawText({
        text: line.text,
        x: line.x,
        y: line.y,
        size: options.size,
        color: options.color,
        fontName: options.fontName,
      });

      if (options.underline) {
        const underlineY = line.y - Math.max(1, options.size * 0.08);
        context.drawLine({
          start: { x: line.x, y: underlineY },
          end: { x: line.x + line.width, y: underlineY },
          thickness: Math.max(0.5, options.size * 0.06),
          color: options.underlineColor ?? options.color,
        });
      }
    }
  }

  /**
   * Positions a {@link TextLayoutResult} inside a layout box.
   *
   * Lines are placed from the bottom of the box upward (PDF y grows upward).
   * Each line's baseline sits `halfLeading + ascent` below the line's top —
   * the CSS line-box model: the extra leading (`lineHeight - fontHeight`)
   * splits half above and half below the text, so single-line text is
   * optically centered in its line box instead of hugging the top with all
   * the slack below the baseline. Horizontal alignment is applied per line.
   */
  static position(
    box: { x: number; y: number; width: number; height: number },
    lines: TextLayoutLine[],
    maxWidth: number,
    options: {
      lineHeight: number;
      ascent: number;
      /** Full font height (ascent + descent); half-leading derives from it. */
      fontHeight: number;
      align: 'left' | 'center' | 'right';
    }
  ): RenderedTextLayout {
    const topY = box.y + box.height;
    const halfLeading = (options.lineHeight - options.fontHeight) / 2;

    return {
      box,
      maxWidth,
      lines: lines.map((line, index) => {
        let x = box.x;
        if (options.align === 'center') {
          x = box.x + (maxWidth - line.width) / 2;
        } else if (options.align === 'right') {
          x = box.x + (maxWidth - line.width);
        }

        let cursor = x;
        const fragments = line.fragments?.map((fragment) => {
          const fragmentX = cursor;
          cursor += fragment.width;
          return { ...fragment, x: fragmentX };
        });

        return {
          ...line,
          x,
          y: topY - index * options.lineHeight - halfLeading - options.ascent,
          fragments,
        };
      }),
    };
  }
}
