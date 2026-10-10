/**
 * Face ids and per-family face resolution.
 *
 * A face id names one face of a family using the same style-suffix
 * convention as the builtin fonts (`sans`, `sans-bold`, `mono-bold-italic`):
 * `inter`, `inter-bold`, `inter-italic`, `inter-bold-italic`. Exact family
 * names always win — a family literally named `inter-bold` embeds as itself,
 * never as the bold face of `inter`.
 */
import type { FontVariants, FontStyle, FontStyleValue, FontWeightValue } from './types';

/** Longest suffix first, so `inter-bold-italic` parses as boldItalic. */
const STYLE_SUFFIXES: ReadonlyArray<readonly [FontStyle, string]> = [
  ['boldItalic', '-bold-italic'],
  ['bold', '-bold'],
  ['italic', '-italic'],
];

/** The font name that embeds/measures `style` of `family`. */
export function faceId(family: string, style: FontStyle): string {
  const suffix = STYLE_SUFFIXES.find(([s]) => s === style)?.[1];
  return suffix ? `${family}${suffix}` : family;
}

/** The face style for weight/italic bits (regular=0, bold=1, italic=2). */
export function faceStyleFromBits(bold: boolean, italic: boolean): FontStyle {
  return bold && italic ? 'boldItalic' : bold ? 'bold' : italic ? 'italic' : 'regular';
}

/**
 * CSS weight matching against the two-weight family model: 100–500 (and
 * 'normal') render regular, 600–900 (and 'bold') render bold. This is the
 * standard snap a browser applies to a family with only 400 and 700 — when
 * the font model grows real per-weight faces, matching weights hit them
 * with no call-site change.
 */
export function snapFontWeight(weight: FontWeightValue): 'regular' | 'bold' {
  if (weight === 'normal') return 'regular';
  if (weight === 'bold') return 'bold';
  return weight >= 600 ? 'bold' : 'regular';
}

/**
 * Resolves the face style for a base style plus CSS-like weight/style
 * values. Each axis is replaced when set (CSS semantics: an explicit weight
 * of 400 un-bolds a bold base); unset axes inherit the base.
 */
export function resolveFaceStyle(
  base: FontStyle,
  weight?: FontWeightValue,
  style?: FontStyleValue,
): FontStyle {
  const bold = weight !== undefined
    ? snapFontWeight(weight) === 'bold'
    : base === 'bold' || base === 'boldItalic';
  const italic = style !== undefined
    ? style === 'italic'
    : base === 'italic' || base === 'boldItalic';
  return faceStyleFromBits(bold, italic);
}

/** Parses a suffixed face id; `undefined` when `id` is a plain family name. */
export function parseFaceId(id: string): { family: string; style: FontStyle } | undefined {
  for (const [style, suffix] of STYLE_SUFFIXES) {
    if (id.length > suffix.length && id.endsWith(suffix)) {
      return { family: id.slice(0, id.length - suffix.length), style };
    }
  }
  return undefined;
}

export interface ResolvedFace {
  bytes: Uint8Array;
  /** The face actually used (may differ from the requested one). */
  style: FontStyle;
  /** True when the requested face was missing and a fallback was used. */
  fellBack: boolean;
}

const FALLBACK_CHAIN: Readonly<Record<FontStyle, readonly FontStyle[]>> = {
  regular: ['regular'],
  bold: ['bold', 'regular'],
  italic: ['italic', 'regular'],
  boldItalic: ['boldItalic', 'bold', 'italic', 'regular'],
};

/** Picks the bytes for `style`, walking the fallback chain when missing. */
export function resolveFaceBytes(variants: FontVariants, style: FontStyle): ResolvedFace {
  for (const candidate of FALLBACK_CHAIN[style]) {
    const bytes = variants[candidate];
    if (bytes) return { bytes, style: candidate, fellBack: candidate !== style };
  }
  // Unreachable: FontVariants always carries `regular`.
  return { bytes: variants.regular, style: 'regular', fellBack: style !== 'regular' };
}
