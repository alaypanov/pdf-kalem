import type { MarkdownStyles } from 'pdf-kalem/markdown';

/**
 * Converter-level style overrides (everything the theme's text variants
 * don't cover): code font, blockquote rule, list indent, spacing, images,
 * tables.
 */
export const styles: MarkdownStyles = {
  code: { font: 'code' },
  spacing: 10,
};