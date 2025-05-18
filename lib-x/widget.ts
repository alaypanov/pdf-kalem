// widget.ts

export abstract class Widget {
  node: any;
  children: Widget[] = [];

  constructor() {
    this.node = null;
  }

  abstract build(...args: any[]): Promise<void>;

  async layout(width: number, height: number) {
    if (!this.node) {
    }

    // this.node.calculateLayout(width, height, Yoga.DIRECTION_LTR);
    // for (const child of this.children) {
    //   await child.layout(
    //     child.node.getComputedWidth(),
    //     child.node.getComputedHeight()
    //   );
    // }
  }
}