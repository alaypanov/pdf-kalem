/**
 * The shared spacing vocabulary (I11): one type for padding and margin
 * everywhere. A `number` applies to all four sides; the object form sets
 * sides individually, with unset sides falling back to the caller's default.
 *
 * Deliberately minimal: no CSS shorthand sugar (`horizontal`/`vertical`) and
 * no margin collapsing — Yoga resolves margins as plain box geometry.
 */
export type Spacing = number | {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export interface SpacingEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Resolves `spacing` to four edges; unset sides get `fallback`. */
export function resolveSpacingEdges(spacing: Spacing | undefined, fallback: number): SpacingEdges {
  if (spacing === undefined || typeof spacing === 'number') {
    const value = spacing ?? fallback;
    return { top: value, right: value, bottom: value, left: value };
  }
  return {
    top: spacing.top ?? fallback,
    right: spacing.right ?? fallback,
    bottom: spacing.bottom ?? fallback,
    left: spacing.left ?? fallback,
  };
}
