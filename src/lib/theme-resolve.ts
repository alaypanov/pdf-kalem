/**
 * The theme-resolution policy in one home.
 *
 * Every styled widget answers the same question — does the caller's override
 * win, or the theme's default, and what happens when neither resolves? — and
 * used to answer it with a private `override ?? theme ?? fallback` method.
 * Eighteen copies later the precedence had drifted (per-widget fallback
 * colors) and testing it required instantiating widgets with a wired context
 * (ARCHITECTURE.md #6).
 *
 * These pure functions are the single seam for that policy: no widget, no
 * context, no Yoga. Fallbacks stay at call sites — they are widget semantics
 * (containers are white, rules are black), not resolver policy. Package
 * internal: not re-exported from the package root.
 */
import { resolveThemeColor, resolveThemeFont, type Theme, type ThemeColorValue } from './Theme';
import type { ColorValue } from './utils/color-utils';

/**
 * `override ?? themeDefault`, resolved through the theme (tokens, hex), then
 * `fallback`. Without `fallback`, resolves to `undefined` when neither layer
 * supplies a value — for widgets where "unset" is meaningful (e.g. no stroke).
 */
export function resolveColor(
  theme: Theme | undefined,
  override: ThemeColorValue | undefined,
  themeDefault?: ThemeColorValue,
): ColorValue | undefined;
export function resolveColor(
  theme: Theme | undefined,
  override: ThemeColorValue | undefined,
  themeDefault: ThemeColorValue | undefined,
  fallback: ColorValue,
): ColorValue;
export function resolveColor(
  theme: Theme | undefined,
  override: ThemeColorValue | undefined,
  themeDefault?: ThemeColorValue,
  fallback?: ColorValue,
): ColorValue | undefined {
  return resolveThemeColor(theme, override ?? themeDefault) ?? fallback;
}

/** Same precedence as {@link resolveColor} for font family names. */
export function resolveFont(
  theme: Theme | undefined,
  override: string | undefined,
  themeDefault?: string,
): string | undefined {
  return resolveThemeFont(theme, override ?? themeDefault);
}
