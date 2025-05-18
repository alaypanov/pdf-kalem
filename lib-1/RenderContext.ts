import { PDFDocument, PDFPage } from 'pdf-lib';
import { Widget } from './Widget';
import { FlexNode } from './utils/FlexLayoutEngine';

export interface RenderContextOptions {
  height?: number; // Default page height if needed before page creation
  width?: number;  // Default page width if needed before page creation
  // Removed margin, handled by layout engine
}

export interface WidgetTreeNode {
  widget: Widget;
  props: Record<string, any>;
  parent?: WidgetTreeNode;
  children: WidgetTreeNode[];
}

export class RenderContext {
  private options: RenderContextOptions;
  private doc: PDFDocument;
  private page: PDFPage | null;
  private dimensions?: [number, number]
  
  // Widget tree props storage
  private widgetTree: WidgetTreeNode | null = null;
  private currentNode: WidgetTreeNode | null = null;
  private widgetProps: Map<Widget, Record<string, any>> = new Map();

  // flex‐layout tree storage
  private flexRoot: FlexNode | null = null;
  private currentFlexNode: FlexNode | null = null;

  constructor(doc: PDFDocument, options: RenderContextOptions = {}) {
    this.options = options;
    this.doc = doc;
    this.page = null;
  }

  getDocument(): PDFDocument {
    return this.doc;
  }

  getCurrentPage(): PDFPage | null{
    return this.page;
  }

  getPageHeight(): number {
    // Prioritize current page size, then options
    return this.getCurrentPage()?.getSize().height || this.options.height || 0;
  }

  getPageWidth(): number {
    // Prioritize current page size, then options
    return this.getCurrentPage()?.getSize().width || this.options.width || 0;
  }

  getDimensions(): [number, number] {
    if (this.dimensions) {
      return this.dimensions;
    }
    const page = this.getCurrentPage();
    if (page) {
      return [page.getWidth(), page.getHeight()];
    }
    return [this.options.width || 0, this.options.height || 0];
  }

  setDimensions(width: number, height: number): void {
    this.dimensions = [width, height];
    this.options.width = width;
    this.options.height = height;
  }

  setCurrentPage(currentPage: PDFPage): void {
    this.page = currentPage;
  }

  getOptions(): RenderContextOptions {
    return this.options;
  }

  // Widget tree methods
  initWidgetTree(rootWidget: Widget): void {
    console.log('init widget tree')
    this.widgetTree = {
      widget: rootWidget,
      props: {},
      children: []
    };
    this.currentNode = this.widgetTree;
  }

  pushWidget(widget: Widget): void {
    if (!this.currentNode) {
      this.initWidgetTree(widget);
      return;
    }

    const newNode: WidgetTreeNode = {
      widget,
      props: {},
      parent: this.currentNode,
      children: []
    };
    
    this.currentNode.children.push(newNode);
    this.currentNode = newNode;
  }

  popWidget(): void {
    if (!this.currentNode || !this.currentNode.parent) return;
    this.currentNode = this.currentNode.parent;
  }

  setWidgetProp(widget: Widget, propName: string, value: any): void {
    // Store in the current node if it's the same widget
    if (this.currentNode && this.currentNode.widget === widget) {
      this.currentNode.props[propName] = value;
    } else {
      // Otherwise store in the map
      let props = this.widgetProps.get(widget);
      if (!props) {
        props = {};
        this.widgetProps.set(widget, props);
      }
      props[propName] = value;
    }
  }

  getWidgetProp(widget: Widget, propName: string, defaultValue?: any): any {
    // Try to get from the current node if it's the same widget
    if (this.currentNode && this.currentNode.widget === widget) {
      return this.currentNode.props[propName] !== undefined ? 
        this.currentNode.props[propName] : defaultValue;
    }
    
    // Otherwise try the map
    const props = this.widgetProps.get(widget);
    if (props && props[propName] !== undefined) {
      return props[propName];
    }
    
    return defaultValue;
  }

  getCurrentNode(): WidgetTreeNode | null {
    return this.currentNode;
  }

  getWidgetTree(): WidgetTreeNode | null {
    return this.widgetTree;
  }

  // initialize the flex tree
  initFlexRoot(root: FlexNode): void {
    this.flexRoot = root;
    this.currentFlexNode = root;
  }

  pushFlexNode(node: FlexNode): void {
    this.currentFlexNode = node;
  }

  popFlexNode(): void {
    if (this.currentFlexNode?.parent) {
      this.currentFlexNode = this.currentFlexNode.parent;
    }
  }

  getFlexRoot(): FlexNode | null {
    return this.flexRoot;
  }

  getCurrentFlexNode(): FlexNode | null {
    return this.currentFlexNode;
  }
}