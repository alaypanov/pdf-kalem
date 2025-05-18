type ViewStyle = {
  width?: number | `${number}%` | undefined;
  height?: number | `${number}%` | undefined;
  flexDirection?: "row" | "column";
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around"
    | "space-evenly";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  alignSelf?: "flex-start" | "center" | "flex-end" | "stretch";
  flex?: number;
  position?: "absolute" | "relative";
  gap?: number;
  zIndex?: number;
  display?: "flex" | "none";
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  margin?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  marginLeft?: number;
  marginRight?: number;
  marginTop?: number;
  marginBottom?: number;
  backgroundColor?: string; // The only value not related to layout.
};


// Define the style interface for a layout node.
interface LayoutStyle {
  width?: number;        // Fixed width
  height?: number;       // Fixed height
  flexDirection?: 'row' | 'column';  // Layout direction, default is column if not set
  margin?: number;       // A simple uniform margin (for demonstration)
  padding?: number;      // Uniform padding inside the node
}

// The computed layout result.
interface LayoutComputed {
  x: number;
  y: number;
  width: number;
  height: number;
}

// The base layout node.
export class LayoutNode {
  style: LayoutStyle;
  computed: LayoutComputed;
  children: LayoutNode[];

  constructor(style: LayoutStyle = {}) {
    this.style = style;
    this.computed = { x: 0, y: 0, width: 0, height: 0 };
    this.children = [];
  }

  addChild(child: LayoutNode) {
    this.children.push(child);
  }
}

/**
 * Recursively compute the layout for a node.
 *
 * @param node - The layout node to compute layout for.
 * @param x - Starting x position.
 * @param y - Starting y position.
 * @param availableWidth - Available width for this node.
 * @param availableHeight - Available height for this node.
 */
function layoutNode(
  node: LayoutNode,
  x: number,
  y: number,
  availableWidth: number,
  availableHeight: number
) {
  // Apply margins and padding if defined (here we use margin for both sides for simplicity)
  const margin = node.style.margin || 0;
  const padding = node.style.padding || 0;
  const startX = x + margin;
  const startY = y + margin;
  const contentWidth = (node.style.width ?? availableWidth) - 2 * margin - 2 * padding;
  const contentHeight = (node.style.height ?? availableHeight) - 2 * margin - 2 * padding;

  // Set our own computed size. Use the style if fixed, or the available space.
  node.computed.width = node.style.width ?? availableWidth;
  node.computed.height = node.style.height ?? availableHeight;
  node.computed.x = startX + padding;
  node.computed.y = startY + padding;

  // If there are no children, we’re done.
  if (node.children.length === 0) {
    return;
  }

  // For now, handle two basic flex directions: column (vertical) and row (horizontal).
  if (node.style.flexDirection === 'row') {
    let currentX = node.computed.x;
    for (const child of node.children) {
      // For each child, we assume the full available height and let it define its own width.
      const childWidth = child.style.width || contentWidth / node.children.length;
      const childHeight = child.style.height || contentHeight;
      layoutNode(child, currentX, node.computed.y, childWidth, childHeight);
      currentX += child.computed.width;
    }
  } else {
    // Default to column layout.
    let currentY = node.computed.y;
    for (const child of node.children) {
      // For each child, we assume the full available width and let it define its own height.
      const childWidth = child.style.width || contentWidth;
      const childHeight = child.style.height || contentHeight / node.children.length;
      layoutNode(child, node.computed.x, currentY, childWidth, childHeight);
      currentY += child.computed.height;
    }
  }
}