/**
 * MarkdownStyles with defaults applied — the concrete values the renderers
 * consume. Resolved once per conversion.
 */
import type { ThemeColorValue } from '../Theme';
import type { TableFromRowsOptions } from '../Table';
import type { YogaStyleValue } from '../Widget';
import type { MarkdownStyles } from './types';

export interface ResolvedMarkdownStyles {
  headingVariantPrefix: string;
  codeFont: string;
  codeColor?: ThemeColorValue;
  codeBgColor?: ThemeColorValue;
  codePadding: number;
  blockquoteColor?: ThemeColorValue;
  blockquoteBorderColor: ThemeColorValue;
  blockquoteItalic: boolean;
  blockquoteIndent: number;
  listIndent: number;
  bullet: string;
  linkColor?: ThemeColorValue;
  linkUnderline: boolean;
  hrColor?: ThemeColorValue;
  hrThickness: number;
  spacing: number;
  imageWidth?: YogaStyleValue;
  table?: TableFromRowsOptions;
}

export function resolveMarkdownStyles(styles?: MarkdownStyles): ResolvedMarkdownStyles {
  const s = styles ?? {};
  return {
    headingVariantPrefix: s.headingVariantPrefix ?? 'h',
    codeFont: s.code?.font ?? 'mono',
    codeColor: s.code?.color,
    codeBgColor: s.code?.bgColor === null ? undefined : s.code?.bgColor ?? '#F6F8FA',
    codePadding: s.code?.padding ?? 8,
    blockquoteColor: s.blockquote?.color,
    blockquoteBorderColor: s.blockquote?.borderColor ?? '#DDDDDD',
    blockquoteItalic: s.blockquote?.italic ?? true,
    blockquoteIndent: s.blockquote?.indent ?? 10,
    listIndent: s.list?.indent ?? 16,
    bullet: s.list?.bullet ?? '•',
    linkColor: s.link?.color ?? 'link',
    linkUnderline: s.link?.underline ?? true,
    hrColor: s.hr?.color,
    hrThickness: s.hr?.thickness ?? 1,
    spacing: s.spacing ?? 8,
    imageWidth: s.imageWidth,
    table: s.table,
  };
}
