/**
 * Inline markdown → runs. Walks marked's inline token tree, folding
 * emphasis flags (`strong`/`em`/`del`), code spans, links, and hard breaks
 * into `Run`s. Images are hoisted out (they are block-level in pdf-kalem)
 * into an `images` side list, in document order.
 */
import type { Run } from '../Text';
import type { Token, Tokens } from 'marked';
import type { ResolvedMarkdownStyles } from './styles';

/** Style inherited while descending the inline token tree. */
interface InlineContext {
  fontWeight?: Run['fontWeight'];
  fontStyle?: Run['fontStyle'];
  strike?: boolean;
  href?: string;
  color?: Run['color'];
  underline?: boolean;
}

export interface InlineResult {
  runs: Run[];
  /** Inline images hoisted out of the flow, in document order. */
  images: Tokens.Image[];
}

export function inlineToRuns(
  tokens: Token[] | undefined,
  styles: ResolvedMarkdownStyles,
  context: InlineContext = {},
): InlineResult {
  const runs: Run[] = [];
  const images: Tokens.Image[] = [];

  const visit = (token: Token, ctx: InlineContext): void => {
    switch (token.type) {
      case 'text': {
        const textToken = token as Tokens.Text;
        if (textToken.tokens && textToken.tokens.length > 0) {
          for (const child of textToken.tokens) {
            visit(child, ctx);
          }
          return;
        }
        if (textToken.text) {
          runs.push({ text: textToken.text, ...ctx });
        }
        return;
      }

      case 'escape': {
        const text = (token as Tokens.Escape).text;
        if (text) {
          runs.push({ text, ...ctx });
        }
        return;
      }

      case 'strong':
        for (const child of (token as Tokens.Strong).tokens ?? []) {
          visit(child, { ...ctx, fontWeight: 700 });
        }
        return;

      case 'em':
        for (const child of (token as Tokens.Em).tokens ?? []) {
          visit(child, { ...ctx, fontStyle: 'italic' });
        }
        return;

      case 'del':
        for (const child of (token as Tokens.Del).tokens ?? []) {
          visit(child, { ...ctx, strike: true });
        }
        return;

      case 'codespan': {
        const code = (token as Tokens.Codespan).text;
        if (code) {
          runs.push({
            text: code,
            ...ctx,
            font: styles.codeFont,
            color: styles.codeColor,
          });
        }
        return;
      }

      case 'link': {
        const link = token as Tokens.Link;
        for (const child of link.tokens ?? []) {
          visit(child, {
            ...ctx,
            href: link.href,
            color: styles.linkColor,
            underline: styles.linkUnderline,
          });
        }
        return;
      }

      case 'image': {
        const image = token as Tokens.Image;
        if (ctx.href) {
          // Images are block-level and can't carry the link annotation (B20).
          console.warn(
            `markdown: an image inside a link (${ctx.href}) renders unlinked — images are block-level and cannot carry the annotation`
          );
        }
        images.push(image);
        return;
      }

      case 'br':
        runs.push({ text: '\n', ...ctx });
        return;

      case 'checkbox':
        // Handled by the list renderer via the item's `task`/`checked`.
        return;

      default:
        // Inline HTML/tags and anything unknown are skipped (v1 limitation).
        return;
    }
  };

  for (const token of tokens ?? []) {
    visit(token, context);
  }

  return { runs, images };
}

/** Merges adjacent runs that would resolve to the same style. */
export function coalesceRuns(runs: Run[]): Run[] {
  const merged: Run[] = [];
  for (const run of runs) {
    const previous = merged[merged.length - 1];
    if (previous && sameStyle(previous, run)) {
      previous.text += run.text;
      continue;
    }
    merged.push({ ...run });
  }
  return merged;
}

function sameStyle(a: Run, b: Run): boolean {
  return (
    a.fontWeight === b.fontWeight &&
    a.fontStyle === b.fontStyle &&
    (a.strike ?? false) === (b.strike ?? false) &&
    (a.underline ?? false) === (b.underline ?? false) &&
    (a.mono ?? false) === (b.mono ?? false) &&
    a.font === b.font &&
    a.href === b.href &&
    a.color === b.color
  );
}
