import { rgb } from 'pdf-lib';
import { Widget } from './Widget';

interface ContainerProps {
  width?: number;
  height?: number;
  bgColor?: string;
  children?: Widget[];
}

// Container Widget
class ContainerWidget extends Widget {
  private bgColor: string;

  constructor(props: ContainerProps) {
    super();
    this.bgColor = props.bgColor || '#FFFFFF';
    this.dimensions.width = props.width || 0;
    this.dimensions.height = props.height || 0;
  }

  render(context: any) {
    context.drawRectangle({
      x: this.position.x,
      y: context.getHeight() - this.position.y - this.dimensions.height,
      width: this.dimensions.width,
      height: this.dimensions.height,
      color: rgb(
        parseInt(this.bgColor.substring(1, 3), 16) / 255,
        parseInt(this.bgColor.substring(3, 5), 16) / 255,
        parseInt(this.bgColor.substring(5, 7), 16) / 255
      ),
    });

    for (const child of this.children) {
      child.setPosition(this.position.x, this.position.y);
      child.render(context);
    }
  }
}

export function Container(props: ContainerProps): Widget {
  return new ContainerWidget(props);
}
