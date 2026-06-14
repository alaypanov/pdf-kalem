import type { ColorValue } from './utils/color-utils';
import { fromHex } from './utils/color-utils';

export type ThemeColorValue = ColorValue | string;

export interface ThemeTextStyle {
  size?: number;
  color?: ThemeColorValue;
  align?: 'left' | 'center' | 'right';
  font?: string;
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