import { MeasureMode } from 'yoga-layout';

/**
 * How a media widget scales its intrinsic box into its layout box.
 *
 * - `Fit` — largest size that fits inside the box, aspect ratio preserved
 *   (the default everywhere).
 * - `Cover` — smallest size that covers the box, aspect ratio preserved.
 * - `None` — no scaling: draw at the intrinsic size, centered in the box.
 */
export enum ImageSizing {
  Fit = 'fit',
  Cover = 'cover',
  None = 'none',
}

/**
 * The intrinsic geometry + fit policy of a media widget (Image, SVGPath, or
 * Icon). One place owns the measure/placement math all three share — see
 * ARCHITECTURE.md #4.
 */
export interface FitSpec {
  /** Intrinsic width in points at base scale (e.g. the SVG viewBox width). */
  intrinsicWidth: number;
  /** Intrinsic height in points at base scale. */
  intrinsicHeight: number;
  /** Extra multiplier on top of fit/cover scaling. */
  baseScale: number;
  /** How to scale into the layout box. */
  sizing: ImageSizing;
}

export interface MeasuredSize {
  width: number;
  height: number;
}

export type YogaMeasureFunc = (
  width: number,
  widthMode: MeasureMode,
  height: number,
  heightMode: MeasureMode,
) => MeasuredSize;

/**
 * The Yoga measure function for fit/cover media, shared by Image, SVGPath,
 * and Icon. `getSpec` is re-read on every measure so widgets with late-loading
 * intrinsic sizes (Image embeds its bytes asynchronously) can return `null`
 * until known — measured as zero-size, same as before.
 *
 * Unconstrained, or `sizing: None`, measures at the intrinsic size.
 * Otherwise the intrinsic box scales into the constraints: Fit takes the
 * smaller scale, Cover the larger; a single constrained dimension derives the
 * other from the aspect ratio.
 */
export function aspectFitMeasure(getSpec: () => FitSpec | null): YogaMeasureFunc {
  return (width, widthMode, height, heightMode) => {
    const spec = getSpec();
    if (!spec || spec.intrinsicWidth <= 0 || spec.intrinsicHeight <= 0) {
      return { width: 0, height: 0 };
    }

    const widthConstrained =
      widthMode === MeasureMode.Exactly || widthMode === MeasureMode.AtMost;
    const heightConstrained =
      heightMode === MeasureMode.Exactly || heightMode === MeasureMode.AtMost;
    const intrinsicW = spec.intrinsicWidth * spec.baseScale;
    const intrinsicH = spec.intrinsicHeight * spec.baseScale;

    if (spec.sizing === ImageSizing.None || (!widthConstrained && !heightConstrained)) {
      return { width: intrinsicW, height: intrinsicH };
    }

    const aspect = spec.intrinsicWidth / spec.intrinsicHeight;
    let targetW = intrinsicW;
    let targetH = intrinsicH;

    if (widthConstrained && heightConstrained) {
      const scale =
        spec.sizing === ImageSizing.Cover
          ? Math.max(width / intrinsicW, height / intrinsicH)
          : Math.min(width / intrinsicW, height / intrinsicH);
      targetW = intrinsicW * scale;
      targetH = intrinsicH * scale;
    } else if (widthConstrained) {
      targetW = width;
      targetH = width / aspect;
    } else if (heightConstrained) {
      targetH = height;
      targetW = height * aspect;
    }

    return { width: targetW, height: targetH };
  };
}

export interface FitBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FitPlacement {
  /** Final scale: baseScale × fit/cover scale (baseScale for None). */
  scale: number;
  /** Drawn size in points. */
  drawnWidth: number;
  drawnHeight: number;
  /** Left edge of the drawn area. */
  left: number;
  /** Bottom edge of the drawn area (PDF y grows up) — the drawImage origin. */
  bottom: number;
  /**
   * Top edge of the drawn area in PDF coordinates — the drawSvgPath origin.
   * pdf-lib's drawSvgPath applies scale(s, -s): the path's SVG top lands at
   * y and content extends downward from it, so SVG-space widgets must anchor
   * at the drawn area's TOP, not its bottom (bug B1).
   */
  top: number;
}

/**
 * Places an intrinsic box inside a laid-out layout box: computes the final
 * scale (fit/cover per the spec, None draws at intrinsic size), centers the
 * drawn area in the box, and exposes the drawn edges in PDF coordinates.
 * Zero-size box dimensions fall back to the intrinsic size.
 */
export function aspectFitPlacement(spec: FitSpec, box: FitBox): FitPlacement {
  const intrinsicW = spec.intrinsicWidth * spec.baseScale;
  const intrinsicH = spec.intrinsicHeight * spec.baseScale;
  const boxW = box.width > 0 ? box.width : intrinsicW;
  const boxH = box.height > 0 ? box.height : intrinsicH;

  let scale = spec.baseScale;
  if (spec.sizing === ImageSizing.Fit || spec.sizing === ImageSizing.Cover) {
    if (boxW > 0 && boxH > 0) {
      const fitScale =
        spec.sizing === ImageSizing.Cover
          ? Math.max(boxW / intrinsicW, boxH / intrinsicH)
          : Math.min(boxW / intrinsicW, boxH / intrinsicH);
      scale = spec.baseScale * fitScale;
    } else if (boxW > 0) {
      scale = spec.baseScale * (boxW / intrinsicW);
    } else if (boxH > 0) {
      scale = spec.baseScale * (boxH / intrinsicH);
    }
  }

  const drawnWidth = spec.intrinsicWidth * scale;
  const drawnHeight = spec.intrinsicHeight * scale;
  const offsetX = boxW > 0 ? (boxW - drawnWidth) / 2 : 0;
  const offsetY = boxH > 0 ? (boxH - drawnHeight) / 2 : 0;

  return {
    scale,
    drawnWidth,
    drawnHeight,
    left: box.x + offsetX,
    bottom: box.y + offsetY,
    top: box.y + boxH - offsetY,
  };
}