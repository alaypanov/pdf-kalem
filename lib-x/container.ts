// container.ts
import { Widget } from './widget';
import { PDFPage } from 'pdf-lib';

interface ContainerProps {
  width?: number;
  height?: number;
  bgColor?: string;
  child?: Widget;
}

class ContainerWidget extends Widget {
  props: ContainerProps;

  constructor(props: ContainerProps) {
    super();
    this.props = props;

    if (props.width) this.node.setWidth(props.width);
    if (props.height) this.node.setHeight(props.height);

    if (props.children) {
      this.children = props.children;
      for (const child of this.children) {
        this.node.insertChild(child.node, this.node.getChildCount());
      }
    }
  }

  async build(page: PDFPage) {
    if (this.props.bgColor) {
      page.drawRectangle({
        x: this.node.getComputedLeft(),
        y: this.node.getComputedTop(),
        width: this.node.getComputedWidth(),
        height: this.node.getComputedHeight(),
        color: this.props.bgColor,
      });
    }

    for (const child of this.children) {
      await child.build(page);
    }
  }
}

export function Container(props: ContainerProps): Widget {
  return new ContainerWidget(props);
}