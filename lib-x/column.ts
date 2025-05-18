// column.ts
import { Widget } from './widget';

interface FlexProps {
  children: Widget[];
}

class ColumnWidget extends Widget {
  constructor(props: FlexProps) {
    super();

    this.children = props.children;
    for (const child of this.children) {
      this.node.insertChild(child.node, this.node.getChildCount());
    }
  }

  async build(page: PDFPage) {
    for (const child of this.children) {
      await child.build(page);
    }
  }
}

export function Column(props: FlexProps): Widget {
  return new ColumnWidget(props);
}

// row.ts
class RowWidget extends Widget {
  constructor(props: FlexProps) {
    super();


    this.children = props.children;
    for (const child of this.children) {
      this.node.insertChild(child.node, this.node.getChildCount());
    }
  }

  async build(page: PDFPage) {
    for (const child of this.children) {
      await child.build(page);
    }
  }
}

export function Row(props: FlexProps): Widget {
  return new RowWidget(props);
}