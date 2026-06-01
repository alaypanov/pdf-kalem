import type { ThemeColorValue } from './Theme';
import { RenderContext } from './RenderContext';
import { fromHex } from './utils/color-utils';
import { TextWidget, type TextOptions } from './Text';

export interface LinkOptions extends TextOptions {
  href: string;
  color?: ThemeColorValue;
  underline?: boolean;
}

class LinkWidget extends TextWidget {
  private readonly href: string;
  private readonly underlineOverride?: boolean;

  constructor(text: string, options: LinkOptions) {
    super(text, options);
    this.href = options.href;
    this.underlineOverride = options.underline;
  }

  protected getThemeVariantNames(): string[] {
    return ['body', 'link', this.getVariantName() ?? ''];
  }

  protected getFallbackColor() {
    return fromHex('#0000EE');
  }

  protected getFallbackLineHeightMultiplier(): number {
    return 1.2;
  }

  private getUnderline(): boolean {
    return this.underlineOverride ?? this.getThemeTextStyle()?.underline ?? true;
  }

  private addLinkAnnotation(context: RenderContext, rect: [number, number, number, number]): void {
    context.addLinkAnnotation({ href: this.href, rect });
  }

  async render(context: RenderContext): Promise<void> {
    const renderedLayout = this.getRenderedTextLayout(context);

    // Clickable rect covers the whole layout box.
    this.addLinkAnnotation(context, [
      renderedLayout.box.x,
      renderedLayout.box.y,
      renderedLayout.box.x + renderedLayout.maxWidth,
      renderedLayout.box.y + renderedLayout.box.height,
    ]);

    await this.drawRenderedTextLayout(context, renderedLayout, {
      underline: this.getUnderline(),
      underlineColor: this.getColor(),
    });
  }
}

export function Link(text: string, options: LinkOptions): LinkWidget {
  return new LinkWidget(text, options);
}
