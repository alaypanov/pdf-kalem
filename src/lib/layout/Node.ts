export class Node {
  /**
   * State of the node updated by the layout engine.
   */
  // _state: LayoutNodeState;
  // _style: ExactLayoutProps;
  firstChild: Node | null;
  lastChild: Node | null;
  next: Node | null;
  parent: Node | null;
  prev: Node | null;


  constructor() {
    this.firstChild = null;
    this.lastChild = null;
    this.next = null;
    this.parent = null;
    this.prev = null;
  }
}

