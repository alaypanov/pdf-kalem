import type { ThemeColorValue } from './Theme';
import type { RenderContext } from './RenderContextInterface';
import { fromHex } from './utils/color-utils';
import { TextWidget, type Run, type TextOptions } from './Text';

export interface LinkOptions extends TextOptions {
  href: string;
  color?: ThemeColorValue;
  underline?: boolean;
}

class LinkWidget extends TextWidget {
  private readonly href: string;
  private readonly underlineOverride?: boolean;

  constructor(text: string | Run[], options: LinkOptions) {
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

    // Plain links get one clickable rect over the whole layout box. Run
    // links annotate per fragment instead (see addRunLinkAnnotations), so a
    // run wrapping across lines never covers unrelated text.
    if (!this.hasRuns()) {
      this.addLinkAnnotation(context, [
        renderedLayout.box.x,
        renderedLayout.box.y,
        renderedLayout.box.x + renderedLayout.maxWidth,
        renderedLayout.box.y + renderedLayout.box.height,
      ]);
    }

    await this.drawRenderedTextLayout(context, renderedLayout, {
      underline: this.getUnderline(),
      underlineColor: this.getColor(),
      linkHref: this.href,
    });
  }
}

export function Link(text: string | Run[], options: LinkOptions): LinkWidget {
  return new LinkWidget(text, options);
}
