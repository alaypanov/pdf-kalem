import { Align, Edge, FlexDirection, Gutter, Justify, PositionType, type Node } from 'yoga-layout';

/**
 * The Yoga style interpreter — the one shared styling seam between widgets
 * and Yoga (ARCHITECTURE.md #8). Extracted from the `Widget` base class so
 * the base interface stops growing with each style key and the dispatch is
 * testable against a bare node: no widget, no context, no layout tree.
 *
 * `applyYogaStyle` is the only entry: typed dispatch on `YogaStyle` keys.
 * Unknown keys are a compile error at typed call sites (no silent no-ops);
 * undefined/null values are skipped.
 */
export type YogaStyleValue = number | 'auto' | `${number}%`;

/** Dimension value for min/max constraints — Yoga rejects 'auto' there. */
export type YogaDimensionValue = number | `${number}%`;

export interface YogaStyle {
  width?: YogaStyleValue;
  height?: YogaStyleValue;
  minWidth?: YogaDimensionValue;
  minHeight?: YogaDimensionValue;
  maxWidth?: YogaDimensionValue;
  maxHeight?: YogaDimensionValue;

  flexDirection?: 'row' | 'column';
  justifyContent?:
    | 'flex-start'
    | 'center'
    | 'flex-end'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  alignSelf?: 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch';

  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: YogaStyleValue;

  gap?: number | `${number}%`;

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

  position?: 'relative' | 'absolute';
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export function applyYogaStyle(node: Node, style: YogaStyle): void {
  for (const key of Object.keys(style) as (keyof YogaStyle)[]) {
    const value = style[key];
    if (value === undefined || value === null) continue;
    applyStyle(node, key, value);
  }
}

function applyStyle(node: Node, key: keyof YogaStyle, value: YogaStyle[keyof YogaStyle]): void {
  switch (key) {
    case 'width':
      setDimension(
        value as YogaStyleValue,
        (v) => node.setWidth(v),
        (v) => node.setWidthPercent(v),
        () => node.setWidthAuto(),
      );
      return;
    case 'height':
      setDimension(
        value as YogaStyleValue,
        (v) => node.setHeight(v),
        (v) => node.setHeightPercent(v),
        () => node.setHeightAuto(),
      );
      return;
    case 'flexBasis':
      setDimension(
        value as YogaStyleValue,
        (v) => node.setFlexBasis(v),
        (v) => node.setFlexBasisPercent(v),
        () => node.setFlexBasisAuto(),
      );
      return;

    // Yoga's min/max setters accept numbers and percent strings natively.
    case 'minWidth':
      node.setMinWidth(value as YogaDimensionValue);
      return;
    case 'minHeight':
      node.setMinHeight(value as YogaDimensionValue);
      return;
    case 'maxWidth':
      node.setMaxWidth(value as YogaDimensionValue);
      return;
    case 'maxHeight':
      node.setMaxHeight(value as YogaDimensionValue);
      return;

    case 'flexDirection':
      node.setFlexDirection(value === 'row' ? FlexDirection.Row : FlexDirection.Column);
      return;
    case 'justifyContent': {
      const map: Record<string, Justify> = {
        'flex-start': Justify.FlexStart,
        center: Justify.Center,
        'flex-end': Justify.FlexEnd,
        'space-between': Justify.SpaceBetween,
        'space-around': Justify.SpaceAround,
        'space-evenly': Justify.SpaceEvenly,
      };
      node.setJustifyContent(map[value as string] ?? Justify.FlexStart);
      return;
    }
    case 'alignItems': {
      const map: Record<string, Align> = {
        'flex-start': Align.FlexStart,
        center: Align.Center,
        'flex-end': Align.FlexEnd,
        stretch: Align.Stretch,
      };
      node.setAlignItems(map[value as string] ?? Align.FlexStart);
      return;
    }
    case 'alignSelf': {
      const map: Record<string, Align> = {
        auto: Align.Auto,
        'flex-start': Align.FlexStart,
        center: Align.Center,
        'flex-end': Align.FlexEnd,
        stretch: Align.Stretch,
      };
      node.setAlignSelf(map[value as string] ?? Align.Auto);
      return;
    }

    case 'flexGrow':
      node.setFlexGrow(value as number);
      return;
    case 'flexShrink':
      node.setFlexShrink(value as number);
      return;

    case 'gap': {
      if (typeof value === 'string' && value.endsWith('%')) {
        const pct = Number(value.slice(0, -1));
        if (Number.isFinite(pct)) {
          (node as any).setGapPercent?.(Gutter.All, pct);
        }
        return;
      }
      node.setGap(Gutter.All, value as number);
      return;
    }

    case 'padding':
      node.setPadding(Edge.All, value as number);
      return;
    case 'paddingTop':
      node.setPadding(Edge.Top, value as number);
      return;
    case 'paddingRight':
      node.setPadding(Edge.Right, value as number);
      return;
    case 'paddingBottom':
      node.setPadding(Edge.Bottom, value as number);
      return;
    case 'paddingLeft':
      node.setPadding(Edge.Left, value as number);
      return;

    case 'margin':
      node.setMargin(Edge.All, value as number);
      return;
    case 'marginTop':
      node.setMargin(Edge.Top, value as number);
      return;
    case 'marginRight':
      node.setMargin(Edge.Right, value as number);
      return;
    case 'marginBottom':
      node.setMargin(Edge.Bottom, value as number);
      return;
    case 'marginLeft':
      node.setMargin(Edge.Left, value as number);
      return;

    case 'position':
      node.setPositionType(value === 'absolute' ? PositionType.Absolute : PositionType.Relative);
      return;
    case 'top':
      node.setPosition(Edge.Top, value as number);
      return;
    case 'right':
      node.setPosition(Edge.Right, value as number);
      return;
    case 'bottom':
      node.setPosition(Edge.Bottom, value as number);
      return;
    case 'left':
      node.setPosition(Edge.Left, value as number);
      return;
  }
}

/**
 * The one shared dimension parser: `number` | `` `${number}%` `` | 'auto'
 * routed to the matching Yoga setter. Percent/auto only apply where the
 * caller passed a setter for them.
 */
function setDimension(
  value: YogaStyleValue,
  set: (v: number) => void,
  setPercent?: (v: number) => void,
  setAuto?: () => void,
): void {
  if (value === 'auto') {
    setAuto?.();
    return;
  }
  if (typeof value === 'string' && value.endsWith('%')) {
    const pct = Number(value.slice(0, -1));
    if (Number.isFinite(pct) && setPercent) {
      setPercent(pct);
    }
    return;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    set(value);
  }
}
