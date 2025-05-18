export interface WidgetOptions {
  children?: Widget[];
  child? : Widget;
}

export interface RenderContextOptions {
  margin?: number;
  // Add other global options here
}

export interface WidgetOptions {
  children?: Widget[];
  child? : Widget;
}

export abstract class Widget {
  protected yogaNode: any; 
  protected children: Widget[];

  constructor(options: WidgetOptions = {}) {
    this.children = options.children || [];
    this.yogaNode = Yoga.Node.create();
  }

  abstract render(context: RenderContext): Promise<void>;

  protected async renderChildren(context: RenderContext): Promise<void> {
    for (const child of this.children) {
      await child.render(context);
    }
  }

  abstract getWidth(): number;

  abstract getHeight(): number;

  async drawAt(context: RenderContext, x: number, y: number): Promise<void> {
    const page = context.getCurrentPage();
    // Translate y-coordinate
    const translatedY = context.translateY(y + this.getHeight());
    await this.drawWithOffset(context, x, translatedY);
  }

  protected abstract drawWithOffset(context: RenderContext, x: number, y: number): Promise<void>;
}