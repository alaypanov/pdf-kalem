import { Widget } from './Widget';

// Column Widget
interface FlexProps {
  children: Widget[]
}

class ColumnWidget extends Widget {
  constructor(props: FlexProps){
    super()
  }
  
  render(context: any) {
    let currentY = this.position.y;

    for (const child of this.children) {
      child.setPosition(this.position.x, currentY);
      child.render(context);
      currentY += child.dimensions.height;
    }
  }
}

export function Column(props: FlexProps): Widget {
  return new ColumnWidget(props);
}


