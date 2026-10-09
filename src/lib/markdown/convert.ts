/**
 * The markdown conversion entry points.
 *
 * `markdownToWidgets` is the deep seam: markdown → widget blocks you embed
 * in your own Page/doc. `markdownToPdf` is sugar: it wraps the blocks in a
 * paginated Page, merges the markdown theme defaults under your theme, and
 * returns a ready-to-save `PdfDoc`.
 */
import { marked } from 'marked';
import { Column } from '../Column';
import { Page } from '../Page';
import { PdfDoc } from '../PdfDoc';
import type { Widget } from '../Widget';
import { renderBlockTokens } from './render';
import { resolveMarkdownStyles } from './styles';
import {
  mergeMarkdownTheme,
  type MarkdownToPdfOptions,
  type MarkdownToWidgetsOptions,
} from './types';

/**
 * Converts markdown to widget blocks (headings, paragraphs, lists, code,
 * quotes, tables, rules, images). Async because image formats are sniffed
 * from fetched bytes. Blocks carry no spacing — wrap them in a `Column`
 * with a `gap` (as `markdownToPdf` does) when embedding.
 */
export async function markdownToWidgets(
  md: string,
  options: MarkdownToWidgetsOptions = {},
): Promise<Widget[]> {
  const styles = resolveMarkdownStyles(options.styles);
  const tokens = marked.lexer(md, { gfm: true });
  return renderBlockTokens(tokens, styles);
}

/**
 * Converts markdown to a `PdfDoc` with one paginated Page. Returns the doc
 * — call `save()`/`getBuffer()`/`getPageCount()` on it as usual.
 */
export async function markdownToPdf(
  md: string,
  options: MarkdownToPdfOptions = {},
): Promise<PdfDoc> {
  const styles = resolveMarkdownStyles(options.styles);
  const blocks = await markdownToWidgets(md, { styles: options.styles });

  return new PdfDoc({
    theme: mergeMarkdownTheme(options.theme),
    fonts: options.fonts,
    meta: options.meta,
    children: [
      Page({
        dimensions: options.page?.dimensions,
        size: options.page?.size,
        padding: options.page?.padding ?? 48,
        children: [
          Column({
            gap: styles.spacing,
            crossAxisAlignment: 'stretch',
            children: blocks,
          }),
        ],
      }),
    ],
  });
}
