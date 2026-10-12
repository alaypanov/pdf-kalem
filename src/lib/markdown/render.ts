/**
 * Block markdown → widgets. Walks marked's block token tree and composes
 * the existing widget primitives (Text runs, Container, Row/Column, Table,
 * HLine, Image). Images are fetched once here so the format can be sniffed
 * from the bytes; the widget renders from those bytes without a re-fetch.
 */
import type { Token, Tokens } from 'marked';
import { Text, type Run } from '../Text';
import { Container } from '../Container';
import { Column } from '../Column';
import { Row } from '../Row';
import { HLine } from '../HLine';
import { Image, fetchImageBytes, type ImageWidget } from '../Image';
import { Table } from '../Table';
import type { Widget } from '../Widget';
import { coalesceRuns, inlineToRuns } from './inline';
import { sniffImageFormat } from './format';
import type { ResolvedMarkdownStyles } from './styles';

/** Inherited render context (blockquote italics/color, list nesting depth). */
interface RenderContext {
  italic: boolean;
  listLevel: number;
  /** Blockquote text color, inherited by the quote's content (B20). */
  color?: ResolvedMarkdownStyles['blockquoteColor'];
}

const INITIAL_CONTEXT: RenderContext = { italic: false, listLevel: 0 };

export async function renderBlockTokens(
  tokens: Token[],
  styles: ResolvedMarkdownStyles,
  context: RenderContext = INITIAL_CONTEXT,
): Promise<Widget[]> {
  const widgets: Widget[] = [];
  for (const token of tokens) {
    widgets.push(...(await renderBlock(token, styles, context)));
  }
  return widgets;
}

async function renderBlock(
  token: Token,
  styles: ResolvedMarkdownStyles,
  context: RenderContext,
): Promise<Widget[]> {
  switch (token.type) {
    case 'heading': {
      const heading = token as Tokens.Heading;
      return renderHeading(heading, styles);
    }

    case 'paragraph':
    case 'text':
      return renderParagraphish(token as Tokens.Paragraph, styles, context);

    case 'code':
      return [renderCodeBlock(token as Tokens.Code, styles)];

    case 'blockquote': {
      const quote = token as Tokens.Blockquote;
      const content = await renderBlockTokens(quote.tokens ?? [], styles, {
        ...context,
        italic: styles.blockquoteItalic,
        color: styles.blockquoteColor,
      });
      return [renderBlockquote(content, styles)];
    }

    case 'list':
      return [await renderList(token as Tokens.List, styles, context)];

    case 'table':
      return [await renderTable(token as Tokens.Table, styles)];

    case 'hr':
      return [
        HLine({ color: styles.hrColor, thickness: styles.hrThickness }),
      ];

    // Vertical space, link reference definitions, raw HTML blocks, and
    // anything unknown produce no widgets (v1 limitation for HTML).
    default:
      return [];
  }
}

async function renderHeading(heading: Tokens.Heading, styles: ResolvedMarkdownStyles): Promise<Widget[]> {
  const { runs, images } = inlineToRuns(heading.tokens, styles);
  const widgets: Widget[] = [
    Text(withBold(coalesceRuns(runs)), {
      variant: `${styles.headingVariantPrefix}${heading.depth}`,
    }),
  ];
  // Hoisted images render after the heading text, like paragraphs do (B20).
  for (const image of images) {
    const widget = await renderImage(image, styles);
    if (widget) {
      widgets.push(widget);
    }
  }
  return widgets;
}

async function renderParagraphish(
  token: Tokens.Paragraph,
  styles: ResolvedMarkdownStyles,
  context: RenderContext,
): Promise<Widget[]> {
  const { runs, images } = inlineToRuns(inlineTokensOf(token), styles, {
    fontStyle: context.italic ? 'italic' : undefined,
    color: context.color,
  });

  const widgets: Widget[] = [];
  if (runs.length > 0) {
    widgets.push(Text(coalesceRuns(runs)));
  }
  for (const image of images) {
    const widget = await renderImage(image, styles);
    if (widget) {
      widgets.push(widget);
    }
  }
  return widgets;
}

function renderCodeBlock(code: Tokens.Code, styles: ResolvedMarkdownStyles): Widget {
  // Fenced content always ends with \n; pre-wrap would turn that into a
  // trailing blank line, making the block's bottom padding look larger than
  // the top. Trim it so the padding is symmetric.
  const text = Text(
    [{ text: code.text.replace(/\n+$/, ''), font: styles.codeFont, color: styles.codeColor }],
    { whiteSpace: 'pre-wrap' }
  );

  if (styles.codeBgColor === undefined) {
    return text;
  }
  return Container({
    bgColor: styles.codeBgColor,
    padding: styles.codePadding,
    child: text,
  });
}

function renderBlockquote(content: Widget[], styles: ResolvedMarkdownStyles): Widget {
  return Row({
    crossAxisAlignment: 'stretch',
    children: [
      Container({ width: 3, bgColor: styles.blockquoteBorderColor }),
      Column({
        crossAxisAlignment: 'stretch',
        style: { flexGrow: 1, paddingLeft: styles.blockquoteIndent },
        children: content,
      }),
    ],
  });
}

async function renderList(list: Tokens.List, styles: ResolvedMarkdownStyles, context: RenderContext): Promise<Widget> {
  const itemContext: RenderContext = { ...context, listLevel: context.listLevel + 1 };
  const items = await Promise.all(
    list.items.map((item, index) => renderListItem(list, item, index, styles, itemContext))
  );

  return Column({
    crossAxisAlignment: 'stretch',
    gap: 3,
    children: items,
  });
}

async function renderListItem(
  list: Tokens.List,
  item: Tokens.ListItem,
  index: number,
  styles: ResolvedMarkdownStyles,
  context: RenderContext,
): Promise<Widget> {
  const marker = Text(listMarkerText(list, item, index, styles));
  const content: Widget[] = [];

  for (const token of item.tokens ?? []) {
    if (token.type === 'paragraph' || token.type === 'text') {
      // The item's own inline content; task checkboxes render in the marker.
      const { runs, images } = inlineToRuns(inlineTokensOf(token as Tokens.Paragraph), styles, {
        fontStyle: context.italic ? 'italic' : undefined,
        color: context.color,
      });
      if (runs.length > 0) {
        content.push(Text(coalesceRuns(runs)));
      }
      // Hoisted images render after the item text, like paragraphs do (B20).
      for (const image of images) {
        const widget = await renderImage(image, styles);
        if (widget) {
          content.push(widget);
        }
      }
      continue;
    }
    // Nested lists, fenced code, blockquotes… render as full blocks.
    content.push(...(await renderBlock(token, styles, context)));
  }

  return Row({
    style: { paddingLeft: (context.listLevel - 1) * styles.listIndent },
    children: [
      marker,
      Column({
        crossAxisAlignment: 'stretch',
        style: { flexGrow: 1, paddingLeft: 4 },
        children: content,
      }),
    ],
  });
}

function listMarkerText(
  list: Tokens.List,
  item: Tokens.ListItem,
  index: number,
  styles: ResolvedMarkdownStyles,
): string {
  // No trailing space: the plain-text fallback trims it; the content column
  // carries the gap instead. ✓ (U+2713) / □ (U+25A1) — the shipped `inter`
  // family has these glyphs; builtin WinAnsi aliases do not (see CONTEXT.md).
  if (item.task) {
    return item.checked ? '✓' : '□';
  }
  if (list.ordered) {
    const start = typeof list.start === 'number' ? list.start : 1;
    return `${start + index}.`;
  }
  return styles.bullet;
}

async function renderTable(table: Tokens.Table, styles: ResolvedMarkdownStyles): Promise<Widget> {
  const cellWidget = async (cell: Tokens.TableCell, column: number, bold: boolean): Promise<Widget> => {
    const { runs, images } = inlineToRuns(cell.tokens, styles);
    const text = Text(withBold(coalesceRuns(runs), bold), {
      align: cell.align ?? table.align[column] ?? undefined,
    });
    if (images.length === 0) {
      return text;
    }
    // A cell with hoisted images composes them under its text (B20).
    const parts: Widget[] = [text];
    for (const image of images) {
      const widget = await renderImage(image, styles);
      if (widget) {
        parts.push(widget);
      }
    }
    return Column({ children: parts });
  };

  const rows: Widget[][] = [
    await Promise.all(table.header.map((cell, column) => cellWidget(cell, column, true))),
    ...await Promise.all(table.rows.map((row) => Promise.all(row.map((cell, column) => cellWidget(cell, column, false))))),
  ];

  return Table.fromRows(rows, {
    header: true,
    width: '100%',
    ...styles.table,
  });
}

async function renderImage(
  image: Tokens.Image,
  styles: ResolvedMarkdownStyles,
): Promise<ImageWidget | undefined> {
  try {
    // Same source resolution as Image widgets: bare paths and file:// URLs
    // read from disk in Node (B20).
    const bytes = new Uint8Array(await fetchImageBytes(image.href));
    const format = sniffImageFormat(bytes);
    if (!format) {
      console.warn(`markdown: skipping image '${image.href}' — only png/jpeg can be embedded`);
      return undefined;
    }
    return Image.fromBytes(bytes, format, {
      width: styles.imageWidth,
    });
  } catch (err) {
    console.warn(`markdown: failed to load image '${image.href}'`, err);
    return undefined;
  }
}

function withBold(runs: Run[], bold = true): Run[] {
  if (!bold) {
    return runs;
  }
  return runs.map((run) => ({ ...run, fontWeight: 700 }));
}

/**
 * Inline tokens of a paragraph-ish block. Tight-list `text` tokens can lack
 * sub-tokens; their raw text still renders.
 */
function inlineTokensOf(token: Tokens.Paragraph | Tokens.Text): Token[] {
  if (token.tokens && token.tokens.length > 0) {
    return token.tokens;
  }
  return [{ type: 'text', raw: token.text, text: token.text } as Tokens.Text];
}
