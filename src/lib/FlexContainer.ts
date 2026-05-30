import { Widget } from './Widget';
import { RenderContext } from './RenderContext';
import { YogaStyle } from './Widget';

/**
 * Options for configuring a FlexContainer widget
 */
export interface FlexContainerOptions {
  children?: Widget[];
  style?: YogaStyle;
  width?: number | string;
  height?: number | string;
}

/**
 * FlexContainer widget provides flexible layout capabilities
 * using CSS Flexbox-like properties for PDF documents
 */
export class FlexContainer extends Widget {
  public width: number | string;
  protected height: number | string;

  constructor(options: FlexContainerOptions = {}) {
    super({ children: options.children });
    this.width = options.width || 'auto';
    this.height = options.height || 'auto';

    this.setYogaStyle({
      ...(options.style || {}),
      width: options.width ?? this.width,
      height: options.height ?? this.height,
    } as any);
  }

  /**
   * Get the computed width or default for the container
   */
  getWidth(): number {
    if (typeof this.width === 'number') {
      return this.width;
    }
    // Default width if no explicit width is set
    return 595; // A4 default width
  }

  /**
   * Get the computed height or default for the container
   */
  getHeight(): number {
    if (typeof this.height === 'number') {
      return this.height;
    }
    // Default height if no explicit height is set
    return 842; // A4 default height
  }

  /**
   * Render the flex container and its children using flex layout
   */
  async render(context: RenderContext): Promise<void> {
    // Layout is calculated once at the Page root.
    await this.renderChildren(context);
  }

  /**
   * Draw the flex container at the specified position
   */
  protected async drawWithOffset(context: RenderContext, _x: number, _y: number): Promise<void> {
    // The actual drawing is handled by the flex layout engine
    // We just need to trigger the layout calculation
    await this.render(context);
  }
}

/**
 * Helper function to create a new FlexContainer
 */
export function Flex(options: FlexContainerOptions = {}): FlexContainer {
  return new FlexContainer(options);
}