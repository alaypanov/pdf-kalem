import type { RenderContext, RenderColor } from './RenderContext';
import type { TextLayoutLine } from './TextLayoutEngine';

/**
 * A laid-out line positioned for drawing: the substring, its width, and the
 * x/y of its baseline in PDF coordinates.
 */
export interface PositionedTextLine extends TextLayoutLine {
  x: number;
  y: number;
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
  /**
   * Draws each line of `layout` at its baseline, optionally underlining.
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
    }
  ): Promise<void> {
    for (const line of layout.lines) {
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
   * Lines are placed from the bottom of the box upward (PDF y grows upward),
   * each line's baseline sitting `ascent` below the line's top. Horizontal
   * alignment is applied per line.
   */
  static position(
    box: { x: number; y: number; width: number; height: number },
    lines: TextLayoutLine[],
    maxWidth: number,
    options: {
      lineHeight: number;
      ascent: number;
      align: 'left' | 'center' | 'right';
    }
  ): RenderedTextLayout {
    const topY = box.y + box.height;

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

        return {
          ...line,
          x,
          y: topY - index * options.lineHeight - options.ascent,
        };
      }),
    };
  }
}
