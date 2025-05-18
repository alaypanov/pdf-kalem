import { RenderContext } from '../RenderContext';
import { Widget } from '../Widget';

/**
 * Flex layout style properties for positioning and sizing widgets
 */
export interface FlexStyle {
  // Sizing
  width?: number | string;  // Can be pixels or percentage (e.g., '50%')
  height?: number | string; // Can be pixels or percentage (e.g., '50%')
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  
  // Flex properties
  flexDirection?: 'row' | 'column';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | string;
  flex?: number | string;  // Shorthand for flexGrow, flexShrink, and flexBasis
  
  // Spacing
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  padding?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  margin?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
}

/**
 * Computed layout properties for a widget
 */
export interface ComputedLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  flippedY?: number; // Add flippedY for PDF coordinate system
}

/**
 * FlexNode represents a widget with flex layout properties
 */
export class FlexNode {
  widget: Widget;
  style: FlexStyle;
  computed: ComputedLayout;
  children: FlexNode[];
  parent?: FlexNode;
  name: string;

  constructor(widget: Widget, style: FlexStyle = {}) {
    this.widget = widget;
    this.style = style;
    this.computed = { x: 0, y: 0, width: 0, height: 0 };
    this.children = [];
    this.name = widget.constructor.name; 
  }

  addChild(child: FlexNode): void {
    this.children.push(child);
    child.parent = this;
  }
}

/**
 * FlexLayoutEngine handles flexible layouts for PDF documents
 */
export class FlexLayoutEngine {
  private width: number;
  private height: number;
  // private flipY: boolean;

  constructor(width: number = 0, height: number = 0) {
    // Initialize with default width and height
    this.width = width;
    this.height = height;
    // this.flipY = flipY;
  }
  /**
   * Calculate layout for a flex container and its children
   */
  calculateLayout(
    rootNode: FlexNode,
    width?: number,
    height?: number,
    // flipY?: boolean
  ): void {
    if (width !== undefined) this.width = width;
    if (height !== undefined) this.height = height;
    // if (flipY !== undefined) this.flipY = flipY;

    // Initialize the root node's computed values
    rootNode.computed.x = 0;
    rootNode.computed.y = 0;
    rootNode.computed.width = this.resolveWidth(rootNode.style.width, this.width) || this.width;
    rootNode.computed.height = this.resolveHeight(rootNode.style.height, this.height) || this.height;

    // Process the layout tree recursively
    this.layoutNode(rootNode);
  }

  /**
   * Process layout for a single node and its children
   */
  private layoutNode(node: FlexNode): void {
    // Get content area after applying padding
    const padding = {
      top: node.style.paddingTop || node.style.padding || 0,
      right: node.style.paddingRight || node.style.padding || 0,
      bottom: node.style.paddingBottom || node.style.padding || 0,
      left: node.style.paddingLeft || node.style.padding || 0
    };

    const contentWidth = node.computed.width - padding.left - padding.right;
    const contentHeight = node.computed.height - padding.top - padding.bottom;
    node.computed.flippedY = this.height - node.computed.y - node.computed.height;
    
    // If there are no children, we're done
    if (node.children.length === 0) {
      return;
    }

    // Determine if we're using row or column layout
    const isRow = node.style.flexDirection === 'row';
    
    // Calculate flexbox properties
    this.calculateFlexChildren(node, isRow, contentWidth, contentHeight);

    // Position children, now passing parent position
    this.positionChildren(node, isRow, padding);

    // Recursively layout child nodes, passing down the parent's computed position
    for (const child of node.children) {
      // Pass the child's computed width/height as container for its children
      this.layoutNode(child);
    }
  }

  /**
   * Calculate flex children sizes
   */
  private calculateFlexChildren(
    node: FlexNode,
    isRow: boolean,
    containerWidth: number,
    containerHeight: number
  ): void {
    const children = node.children;
    const totalChildren = children.length;
    
    // Get the gap between items
    const gap = isRow 
      ? (node.style.columnGap || node.style.gap || 0) 
      : (node.style.rowGap || node.style.gap || 0);
    
    // Calculate total fixed sizes and flex factors
    let totalFixedSize = gap * (totalChildren - 1);
    let totalFlexGrow = 0;
    let totalFlexShrink = 0;
    let flexibleChildrenCount = 0;

    // First pass: handle fixed sizes and collect flex factors
    for (const child of children) {
      // Apply flex if specified
      if (child.style.flex !== undefined) {
        const flexParts = typeof child.style.flex === 'string' 
          ? child.style.flex.split(' ').map(part => parseFloat(part))
          : [child.style.flex];
          
        child.style.flexGrow = flexParts[0] || 0;
        child.style.flexShrink = flexParts[1] || 1;
        child.style.flexBasis = flexParts[2] || 'auto';
      }

      // Get child size in the main dimension (width for row, height for column)
      const childSize = isRow 
        ? this.resolveWidth(child.style.width || child.style.flexBasis, containerWidth)
        : this.resolveHeight(child.style.height || child.style.flexBasis, containerHeight);

      if (childSize !== undefined && childSize > 0) {
        // Fixed size
        child.computed[isRow ? 'width' : 'height'] = childSize;
        totalFixedSize += childSize;
      } else {
        // Flexible size
        flexibleChildrenCount++;
        totalFlexGrow += child.style.flexGrow || 1;
        totalFlexShrink += child.style.flexShrink || 1;
      }
      
      // Set the cross axis dimension (height for row, width for column)
      const crossSize = isRow
        ? this.resolveHeight(child.style.height, containerHeight)
        : this.resolveWidth(child.style.width, containerWidth);
        
      child.computed[isRow ? 'height' : 'width'] = crossSize || (isRow ? containerHeight : containerWidth);
    }

    // Calculate remaining space for flexible items
    const mainAxisSize = isRow ? containerWidth : containerHeight;
    const remainingSpace = mainAxisSize - totalFixedSize;

    // Second pass: distribute remaining space to flexible items
    if (flexibleChildrenCount > 0 && remainingSpace !== 0) {
      const spacePerFlexUnit = remainingSpace > 0 
        ? remainingSpace / totalFlexGrow 
        : remainingSpace / totalFlexShrink;

      for (const child of children) {
        if (child.computed[isRow ? 'width' : 'height'] === undefined || child.computed[isRow ? 'width' : 'height'] === 0) {
          const flexFactor = remainingSpace > 0 
            ? (child.style.flexGrow || 1)
            : (child.style.flexShrink || 1);
            
          let size = Math.max(0, flexFactor * spacePerFlexUnit);
          
          // Apply min/max constraints
          if (isRow) {
            if (child.style.minWidth !== undefined) {
              size = Math.max(size, child.style.minWidth);
            }
            if (child.style.maxWidth !== undefined) {
              size = Math.min(size, child.style.maxWidth);
            }
          } else {
            if (child.style.minHeight !== undefined) {
              size = Math.max(size, child.style.minHeight);
            }
            if (child.style.maxHeight !== undefined) {
              size = Math.min(size, child.style.maxHeight);
            }
          }
          
          child.computed[isRow ? 'width' : 'height'] = size;
        }
      }
    }
  }

  /**
   * Position children within the container according to flex properties
   */
  private positionChildren(
    node: FlexNode, 
    isRow: boolean,
    padding: { top: number; right: number; bottom: number; left: number }
  ): void {
    const children = node.children;
    const containerWidth = node.computed.width;
    const containerHeight = node.computed.height;
    const contentWidth = containerWidth - padding.left - padding.right;
    const contentHeight = containerHeight - padding.top - padding.bottom;
    
    const gap = isRow 
      ? (node.style.columnGap || node.style.gap || 0) 
      : (node.style.rowGap || node.style.gap || 0);
    
    // Calculate total children size in the main direction
    let totalChildrenSize = 0;
    for (const child of children) {
      totalChildrenSize += child.computed[isRow ? 'width' : 'height'];
    }
    totalChildrenSize += gap * (children.length - 1);
    
    // Determine the starting position and spacing based on justifyContent
    let mainAxisOffset = 0;
    let extraSpacePerChild = 0;
    
    const remainingSpace = (isRow ? contentWidth : contentHeight) - totalChildrenSize;
    
    switch (node.style.justifyContent) {
      case 'flex-end':
        mainAxisOffset = remainingSpace;
        break;
      case 'center':
        mainAxisOffset = remainingSpace / 2;
        break;
      case 'space-between':
        extraSpacePerChild = children.length > 1 ? remainingSpace / (children.length - 1) : 0;
        break;
      case 'space-around':
        extraSpacePerChild = children.length > 0 ? remainingSpace / children.length : 0;
        mainAxisOffset = extraSpacePerChild / 2;
        break;
      case 'space-evenly':
        extraSpacePerChild = children.length > 0 ? remainingSpace / (children.length + 1) : 0;
        mainAxisOffset = extraSpacePerChild;
        break;
      default: // 'flex-start' is default
        mainAxisOffset = 0;
    }
    
    // Position each child
    let currentMainPos = mainAxisOffset;
    
    // Get parent's absolute position
    const parentAbsX = node.computed.x;
    const parentAbsY = node.computed.y;

    // For normal layouts
    if (isRow) {
      currentMainPos += padding.left;
      for (const child of children) {
        // Position on main axis (x for row)
        child.computed.x = parentAbsX + currentMainPos;
       
        // Position on cross axis (y) based on alignItems
        this.alignChildInCrossAxisWithParent(child, parentAbsY, padding.top, contentHeight, node.style.alignItems);
        
        currentMainPos += child.computed.width + gap + extraSpacePerChild;
      }
    } else {
      // Column
      currentMainPos += padding.top;
      for (const child of children) {
        // Position on main axis (y for column)
        child.computed.y = parentAbsY + currentMainPos;
        // child.computed.y = parentAbsY + node.computed.height - (padding.top + currentMainPos + child.computed.height);
        
        // Position on cross axis (x) based on alignItems
        this.alignChildInCrossAxisWithParent(child, parentAbsX, padding.left, contentWidth, node.style.alignItems);
        
        currentMainPos += child.computed.height + gap + extraSpacePerChild;
      }
    }
  }

  /**
   * Align a child along the cross axis based on alignItems
   */
  private alignChildInCrossAxisWithParent(
    child: FlexNode,
    parentAbsCross: number,
    crossAxisStart: number,
    crossAxisSize: number,
    alignItems?: string
  ): void {
    // Determine if we're in row or column
    const isRow = child.parent?.style.flexDirection === 'row';
    
    // Get child size in cross direction
    const childCrossSize = isRow ? child.computed.height : child.computed.width;
    
    // Get alignment (prioritize alignSelf over alignItems)
    const alignment = child.style.alignSelf || alignItems || 'flex-start';
    
    // Calculate position
    let position = crossAxisStart;
    console.log(`Aligning child ${child.name} with alignment ${alignment} and cross size ${childCrossSize} ${child.style.flexDirection}`);
    
    switch (alignment) {
      case 'flex-end':
        position = crossAxisStart + crossAxisSize - childCrossSize;
        break;
      case 'center':
        position = crossAxisStart + (crossAxisSize - childCrossSize) / 2;
        break;
      case 'stretch':
        // For stretch, we would increase the child's cross dimension
        // This is typically handled during size calculation
        break;
      default: // 'flex-start' is default
        position = crossAxisStart;
    }
    
    // Set the cross axis position, adding parent's absolute position
    if (isRow) {
      child.computed.y = parentAbsCross + position;
    } else {
      child.computed.x = parentAbsCross + position;
    }
  }

  /**
   * Helper methods to parse dimensions
   */
  private resolveWidth(value: number | string | undefined, containerWidth: number): number | undefined {
    if (value === undefined) {
      return undefined;
    }
    
    if (typeof value === 'number') {
      return value;
    }
    
    // Parse percentage values
    if (typeof value === 'string' && value.endsWith('%')) {
      const percentage = parseFloat(value) / 100;
      return containerWidth * percentage;
    }
    
    return undefined;
  }
  
  private resolveHeight(value: number | string | undefined, containerHeight: number): number | undefined {
    if (value === undefined) {
      return undefined;
    }
    
    if (typeof value === 'number') {
      return value;
    }
    
    // Parse percentage values
    if (typeof value === 'string' && value.endsWith('%')) {
      const percentage = parseFloat(value) / 100;
      return containerHeight * percentage;
    }
    
    return undefined;
  }
}