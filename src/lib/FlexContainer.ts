import { Widget, YogaStyle, type YogaStyleValue } from './Widget';
import type { RenderContext } from './RenderContextInterface';

/**
 * Options for configuring a FlexContainer widget
 */
export interface FlexContainerOptions {
  children?: Widget[];
  style?: YogaStyle;
  width?: YogaStyleValue;
  height?: YogaStyleValue;
}

/**
 * FlexContainer widget provides flexible layout capabilities
 * using CSS Flexbox-like properties for PDF documents
 */
export class FlexContainer extends Widget {
  constructor(options: FlexContainerOptions = {}) {
    super({ children: options.children });

    // `style` is the escape hatch and the last word (same contract as
    // Container, I11) — spreading it first let width/height clobber it (B14).
    this.setYogaStyle({
      width: options.width ?? 'auto',
      height: options.height ?? 'auto',
      ...options.style,
    });
  }

  /**
   * Render the flex container and its children using flex layout
   */
  async render(context: RenderContext): Promise<void> {
    // Layout is calculated once at the Page root.
    await this.renderChildren(context);
  }
}

/**
 * Helper function to create a new FlexContainer
 */
export function Flex(options: FlexContainerOptions = {}): FlexContainer {
  return new FlexContainer(options);
}