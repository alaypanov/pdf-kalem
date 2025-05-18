import { Widget } from './Widget';
import { RenderContext } from './RenderContext';
import { FlexLayoutEngine, FlexNode, FlexStyle } from './utils/FlexLayoutEngine';

/**
 * Options for configuring a FlexContainer widget
 */
export interface FlexContainerOptions {
  children?: Widget[];
  style?: FlexStyle;
  width?: number | string;
  height?: number | string;
}

/**
 * FlexContainer widget provides flexible layout capabilities
 * using CSS Flexbox-like properties for PDF documents
 */
export class FlexContainer extends Widget {
  public children: Widget[];
  public width: number | string;
  protected height: number | string;

  constructor(options: FlexContainerOptions = {}) {
    super({ children: options.children });
    this.children = options.children || [];
    this.width = options.width || 'auto';
    this.height = options.height || 'auto';

    // Set style on the node directly
    this.node.style = {
      ...this.node.style,
      ...(options.style || {}),
    };
    if (options.width) {
      this.node.style.width = options.width;
    }
    if (options.height) {
      this.node.style.height = options.height;
    }
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
    // Calculate layout for this container and its children
    const layoutEngine = new FlexLayoutEngine();
    layoutEngine.calculateLayout(
      this.node,
      this.getWidth(),
      this.getHeight()
    );
    // Now render children at their computed positions
    await this.renderChildren(context);
  }

  /**
   * Draw the flex container at the specified position
   */
  protected async drawWithOffset(context: RenderContext, x: number, y: number): Promise<void> {
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