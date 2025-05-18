// Base Widget class
export abstract class Widget {
  protected position: { x: number; y: number } = { x: 0, y: 0 };
  protected dimensions: { width: number; height: number } = { width: 0, height: 0 };
  protected children: Widget[] = [];

  addChild(child: Widget) {
    this.children.push(child);
  }

  setPosition(x: number, y: number) {
    this.position = { x, y };
  }

  abstract render(context: any): void;
}