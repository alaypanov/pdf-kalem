/**
 * Shared playground plumbing — extracted when the forms playground became
 * the third copy of the same shell. The CodeMirror themes, the docs theme
 * object injected into sandbox code, and the Inter font loader.
 */
import { HighlightStyle } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { createTheme, useFonts, type FontSet } from '../../../src/index'
import { fromHex } from '../../../src/lib/utils/color-utils'

/** Light syntax theme tuned to the docs palette (shared by all playgrounds). */
export const playgroundSyntaxTheme = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.self, t.null], color: '#b45309' },
  { tag: [t.string, t.special(t.string)], color: '#0f766e' },
  { tag: [t.number, t.bool, t.atom], color: '#9a3412' },
  { tag: [t.lineComment, t.blockComment, t.docComment], color: '#a8a29e', fontStyle: 'italic' },
  { tag: [t.propertyName, t.attributeName], color: '#1c1917' },
  { tag: [t.heading], color: '#1c1917', fontWeight: '600' },
  { tag: [t.link, t.url], color: '#b45309', textDecoration: 'underline' },
  { tag: [t.emphasis], fontStyle: 'italic' },
  { tag: [t.strong], fontWeight: '600' },
  { tag: [t.monospace], color: '#0f766e' },
  { tag: [t.invalid], color: '#b91c1c' },
])

/** Editor chrome theme (shared by all playgrounds). */
export const playgroundEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    background: 'transparent',
    color: '#292524',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace",
    lineHeight: '1.6',
  },
  '.cm-content': {
    padding: '14px 16px 16px 6px',
    caretColor: '#b45309',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#b45309',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    background: 'rgba(180, 83, 9, 0.15)',
  },
  '.cm-gutters': {
    background: 'transparent',
    borderRight: 'none',
    color: '#a8a29e',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    paddingLeft: '14px',
    paddingRight: '10px',
    minWidth: '2em',
    textAlign: 'right',
  },
})

/**
 * The theme object injected into sandbox code as `theme` (and used to build
 * the playground PDFs) — the same tokens the sample code paints with.
 */
export const playgroundTheme = createTheme({
  fonts: {
    body: 'inter',
    heading: 'inter',
    mono: 'inter',
  },
  colors: {
    primary: fromHex('#0f172a'),
    ink: fromHex('#0f172a'),
    muted: fromHex('#64748b'),
    line: fromHex('#dbe3ef'),
    panel: fromHex('#f8fafc'),
    accent: fromHex('#0f766e'),
    accentSoft: fromHex('#e6fffb'),
    brand: fromHex('#0b3b66'),
    white: fromHex('#ffffff'),
  },
  text: {
    body: { font: 'body', size: 11.5, lineHeight: 12, color: 'ink' },
    h1: { font: 'heading', size: 28, lineHeight: 32, color: 'brand' },
    h2: { font: 'heading', size: 16, lineHeight: 20, color: 'ink' },
    label: { font: 'body', size: 9.5, lineHeight: 11, color: 'muted' },
    caption: { font: 'body', size: 10, lineHeight: 12, color: 'muted' },
    link: { font: 'body', size: 11.5, lineHeight: 14, color: 'accent', underline: true },
  },
  container: { bgColor: 'white' },
  table: {
    borderColor: 'line',
    borderWidth: 1,
    cellPadding: 8,
    headBgColor: 'brand',
    rowBgColor: 'white',
    alternateRowBgColor: 'panel',
  },
})

/**
 * Inter loads from the docs site's static assets (docs/public/fonts) and
 * binds to the theme's font tokens at doc construction. BASE_URL keeps this
 * correct under the GitHub Pages subpath. Failure falls back to the builtin
 * aliases (with a console note) instead of breaking the playground.
 */
export async function loadPlaygroundFonts(
  families: Record<string, string>,
  label = 'playground',
): Promise<FontSet | undefined> {
  try {
    const face = (name: string) => fetch(`${import.meta.env.BASE_URL}fonts/${name}`).then((r) => r.arrayBuffer())
    return await useFonts(families, {
      files: {
        inter: {
          regular: await face('Inter-Regular.ttf'),
          bold: await face('Inter-Bold.ttf'),
          italic: await face('Inter-Italic.ttf'),
          boldItalic: await face('Inter-BoldItalic.ttf'),
        },
      },
    })
  } catch (err) {
    console.error(`${label}: font loading failed, falling back to builtins`, err)
    return undefined
  }
}
