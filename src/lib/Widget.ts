import { RenderContext } from './RenderContext';
import { FlexNode } from './utils/FlexLayoutEngine';
import { Allocator, Node, JustifyContent } from 'stretch-layout';

export interface WidgetOptions {
  children?: Widget[];
  child? : Widget;
  node?: FlexNode;
}

export abstract class Widget {
  protected children: Widget[];
  protected child?: Widget; 
  // public node: FlexNode; // <-- make node public for external access
  public stretchNode?: Node; // <-- make stretchNode public for external access

  constructor(context: RenderContext, options: WidgetOptions = {}) {
    const allocator: Allocator = context.allocator!;
    this.children = options.children || [];
    if (options.child) {
      this.children.push(options.child);
    }
    // this.node = options.node || new FlexNode(this, {});
    // Link child FlexNodes to this node
    this.stretchNode = new Node(allocator,{
      width: '100%',
      height: '100%',
      justifyContent: JustifyContent.FlexStart,
      alignItems: 'stretch',
      flexDirection: 'column',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      padding: 0,
      margin: 0,
      border: 0,
    })
    for (const child of this.children) {
      this.stretchNode.addChild(child.stretchNode!);
    }



    // Create a stretch node for layout
    

    // case for single child
    if(this.child) {
      this.stretchNode.addChild(this.child.stretchNode!);
    }
    
  }

  abstract render(context:RenderContext): Promise<void>;

  protected async renderChildren(context: RenderContext): Promise<void> {
    for (const child of this.children) {
      await child.render(context);
    }
  }

  abstract getWidth(): number;

  abstract getHeight(): number;

  async drawAt(context: RenderContext, x: number, y: number): Promise<void> {
  }

  setProperty(context: RenderContext, key: string, value: any): void {
  }

  getProperty(context: RenderContext, key: string, defaultValue?: any): any {
  }
}