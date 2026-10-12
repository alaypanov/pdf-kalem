import type { RenderContext } from '../RenderContextInterface';
import type { ThemeColorValue } from '../Theme';
import { resolveColor, resolveFont } from '../theme-resolve';
import { fromHex } from '../utils/color-utils';
import { Widget, type WidgetOptions, type YogaStyleValue } from '../Widget';

export interface SignatureOptions extends WidgetOptions {
  /** Box size overrides (default: full width × 48pt). */
  width?: YogaStyleValue;
  height?: YogaStyleValue;
  /** Caption under the signing line. Default: 'Signature' (empty string omits it). */
  label?: string;
  /** Line + label color. */
  color?: ThemeColorValue;
  /** Label font family (theme token or name). Default: the sans alias. */
  font?: string;
}

/**
 * A signature line — a visual placeholder, NOT an AcroForm field: pdf-lib can
 * read but not create signature fields, so there is nothing interactive to
 * make. The widget draws the signing line and caption with the vector/text
 * primitives (the same drawing surface SVGPath uses); the empty space above
 * the line is where the signer signs (by hand after printing, or by a
 * downstream tool that CAN create real signature fields).
 */
export class SignatureWidget extends Widget {
  private readonly label: string;
  private readonly color?: ThemeColorValue;
  private readonly font?: string;

  constructor(options: SignatureOptions = {}) {
    super(options);
    this.label = options.label ?? 'Signature';
    this.color = options.color;
    this.font = options.font;

    this.setYogaStyle({
      // Same floor as TextField: '100%' collapses to zero inside a
      // shrink-wrapping Column; explicit `width` is honored exactly.
      width: options.width ?? '100%',
      minWidth: options.width === undefined ? 120 : undefined,
      height: options.height ?? 48,
    });
  }

  async render(context: RenderContext): Promise<void> {
    const { x, y, width } = context.getLayoutBox(this);
    const color = resolveColor(context.getTheme(), this.color, undefined, fromHex('#6B7280'));
    const fontName = resolveFont(context.getTheme(), this.font) ?? 'sans';

    // The signing line sits 14pt above the box bottom; the caption sits
    // under it (PDF coords: y grows up, so "under" is a smaller y).
    context.drawLine({
      start: { x, y: y + 14 },
      end: { x: x + width, y: y + 14 },
      thickness: 1,
      color,
    });
    if (this.label) {
      await context.drawText({ text: this.label, x, y: y + 2, size: 8, color, fontName });
    }
  }
}

export function Signature(options: SignatureOptions = {}): SignatureWidget {
  return new SignatureWidget(options);
}
