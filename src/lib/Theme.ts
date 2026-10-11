import type { ColorValue } from './utils/color-utils';
import { fromHex } from './utils/color-utils';

export type ThemeColorValue = ColorValue | string;

export interface ThemeTextStyle {
  size?: number;
  color?: ThemeColorValue;
  align?: 'left' | 'center' | 'right';
  font?: string;
  /** CSS-like weight: 100–900, 'normal', or 'bold'. Snaps to the family's two-weight model (100–500 → regular, 600–900 → bold). */
  fontWeight?: number | 'normal' | 'bold';
  /** CSS-like style. 'oblique' is intentionally absent — no synthetic slant yet. */
  fontStyle?: 'normal' | 'italic';
  lineHeight?: number;
  underline?: boolean;
}

export interface ThemeTableStyle {
  rowHeight?: number;
  cellPadding?: number;
  borderColor?: ThemeColorValue;
  borderWidth?: number;
  headBgColor?: ThemeColorValue;
  rowBgColor?: ThemeColorValue;
  alternateRowBgColor?: ThemeColorValue;
}

export interface ThemeContainerStyle {
  bgColor?: ThemeColorValue;
  padding?: number;
  borderColor?: ThemeColorValue;
  borderWidth?: number;
  borderRadius?: number;
}

export interface Theme {
  colors?: Record<string, ColorValue>;
  fonts?: Record<string, string>;
  text?: Record<string, ThemeTextStyle | undefined>;
  table?: ThemeTableStyle;
  container?: ThemeContainerStyle;
}

export function createTheme(theme: Theme = {}): Theme {
  return theme;
}

/**
 * Tokens already warned about — one warning per token, not per render call
 * (a widget renders once per page fragment; the typo is the same typo).
 * I12: a misspelled theme token used to produce wrong colors with no
 * warning, because every call site fell back silently.
 */
const warnedTokens = new Set<string>();

function warnUnknownColorToken(token: string, hasTheme: boolean): void {
  const key = `color:${token}`;
  if (warnedTokens.has(key)) return;
  warnedTokens.add(key);
  console.warn(
    `pdf-kalem: color token "${token}" is not defined in the theme${hasTheme ? '' : ' (no theme is set)'} — using the widget's fallback color.`,
  );
}

/** @internal — test isolation for the warn-once state. Exported via internals. */
export function resetThemeWarningsForTests(): void {
  warnedTokens.clear();
}

export function resolveThemeColor(theme: Theme | undefined, value?: ThemeColorValue): ColorValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const tokenColor = theme?.colors?.[value];
  if (tokenColor) {
    return tokenColor;
  }

  if (value.startsWith('#')) {
    return fromHex(value);
  }

  // Not a hex literal and not a known token: always a miss (colors have no
  // pass-through semantics — unlike font names, which are family names by
  // default). Warn once; the call site's fallback applies.
  warnUnknownColorToken(value, theme !== undefined);
  return undefined;
}

export function resolveThemeFont(theme: Theme | undefined, font?: string): string | undefined {
  if (!font) {
    return undefined;
  }

  return theme?.fonts?.[font] ?? font;
}

export function resolveThemeTextStyle(
  theme: Theme | undefined,
  variantNames: string[],
): ThemeTextStyle | undefined {
  if (!theme?.text) {
    return undefined;
  }

  const merged: ThemeTextStyle = {};
  let hasValues = false;

  for (const variantName of variantNames) {
    if (!variantName) {
      continue;
    }

    const variant = theme.text[variantName];
    if (!variant) {
      continue;
    }

    Object.assign(merged, variant);
    hasValues = true;
  }

  return hasValues ? merged : undefined;
}