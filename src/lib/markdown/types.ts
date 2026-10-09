/**
 * Markdown conversion styles and options.
 *
 * `MarkdownStyles` shapes the generated widgets; everything visual resolves
 * against the *rendering* doc's theme at layout time (variants like `h1`,
 * color tokens like `link`), so styles stay theme-driven without owning a
 * theme. `markdownToPdf` merges {@link markdownThemeDefaults} under the
 * user's theme so bare conversions look right out of the box.
 */
import type { Theme, ThemeColorValue } from '../Theme';
import type { TableFromRowsOptions } from '../Table';
import type { FontSet } from '../fonts/types';
import type { YogaStyleValue } from '../Widget';
import type { PageSize } from '../types/doc-sizes';
import type { PdfDocMeta } from '../PdfDoc';
import { fromHex } from '../utils/color-utils';

/** Inline code spans and fenced/indented code blocks. */
export interface MarkdownCodeStyle {
  /** Font family for code (default `mono`). */
  font?: string;
  /** Text color for code (default: the surrounding text color). */
  color?: ThemeColorValue;
  /** Fenced-block background (default `#F6F8FA`; `null` disables). */
  bgColor?: ThemeColorValue | null;
  /** Fenced-block padding in points (default 8). */
  padding?: number;
}

/** Blockquotes: a left rule with italic body text. */
export interface MarkdownBlockquoteStyle {
  /** Body text color (default: the surrounding text color). */
  color?: ThemeColorValue;
  /** Left rule color (default `#DDDDDD`). */
  borderColor?: ThemeColorValue;
  /** Italicize body text (default true). */
  italic?: boolean;
  /** Gap between the rule and the text (default 10). */
  indent?: number;
}

export interface MarkdownListStyle {
  /** Indent per nesting level in points (default 16). */
  indent?: number;
  /** Unordered marker glyph (default `•`). */
  bullet?: string;
}

export interface MarkdownLinkStyle {
  /** Run color; a theme token name works (default `link`). */
  color?: ThemeColorValue;
  /** Underline link runs (default true). */
  underline?: boolean;
}

export interface MarkdownHrStyle {
  color?: ThemeColorValue;
  thickness?: number;
}

export interface MarkdownStyles {
  /** Inline code + code blocks. */
  code?: MarkdownCodeStyle;
  /** Blockquotes. */
  blockquote?: MarkdownBlockquoteStyle;
  /** Lists. */
  list?: MarkdownListStyle;
  /** Links. */
  link?: MarkdownLinkStyle;
  /** Horizontal rules. */
  hr?: MarkdownHrStyle;
  /** Vertical gap between blocks in points (default 8). */
  spacing?: number;
  /**
   * Heading variant prefix; the depth is appended (`h1`..`h6`). Themes style
   * headings through these variants; `markdownThemeDefaults` ships sizes.
   */
  headingVariantPrefix?: string;
  /** Image width (default: natural size). */
  imageWidth?: YogaStyleValue;
  /** Extra options passed through to `Table.fromRows` for GFM tables. */
  table?: TableFromRowsOptions;
}

export interface MarkdownToWidgetsOptions {
  styles?: MarkdownStyles;
}

export interface MarkdownToPdfOptions {
  styles?: MarkdownStyles;
  /** Theme for the generated document (user values win over the defaults). */
  theme?: Theme;
  /** Font families for the generated document (see `useFonts`). */
  fonts?: FontSet;
  /** PDF metadata for the generated document. */
  meta?: PdfDocMeta;
  /** Page geometry (default: `Page` size defaults, 48pt padding). */
  page?: {
    dimensions?: [number, number];
    size?: PageSize;
    padding?: number;
  };
}

/**
 * Theme fragment merged under the user's theme by `markdownToPdf`: heading
 * sizes for the `h1`..`h6` variants, a classic link color, and table cell
 * padding (markdown tables would otherwise have none). Every key loses to
 * the user's theme.
 */
export const markdownThemeDefaults: Theme = {
  colors: {
    link: fromHex('#0000EE'),
  },
  text: {
    h1: { size: 26 },
    h2: { size: 21 },
    h3: { size: 17 },
    h4: { size: 14 },
    h5: { size: 12 },
    h6: { size: 12 },
  },
  table: {
    cellPadding: 6,
  },
};

/**
 * Merges {@link markdownThemeDefaults} under `theme` (user wins per key).
 * Returns a new object; neither input is mutated.
 */
export function mergeMarkdownTheme(theme?: Theme): Theme {
  return {
    ...theme,
    colors: { ...markdownThemeDefaults.colors, ...theme?.colors },
    text: { ...markdownThemeDefaults.text, ...theme?.text },
    table: { ...markdownThemeDefaults.table, ...theme?.table },
  };
}
