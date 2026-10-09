<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Breadcrumbs from './Breadcrumbs.vue'
import { EditorState } from '@codemirror/state'
import { drawSelection, dropCursor, EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { markdown as markdownMode } from '@codemirror/lang-markdown'
import { createTheme, useFonts } from '../../../src/index'
import { markdownToPdf } from '../../../src/markdown'
import type { MarkdownStyles } from '../../../src/lib/markdown'
import { fromHex } from '../../../src/lib/utils/color-utils'

/**
 * Live markdown → PDF workbench for the docs playground.
 *
 * The markdown example's logic as a Vue component: a CodeMirror editor over
 * a debounced `markdownToPdf` preview, with a page-count badge, download,
 * and an error strip. Uses the shipped `inter` family; code renders in the
 * builtin `mono` alias (Courier).
 * Mount inside <ClientOnly> — rendering touches browser APIs.
 */

const SAMPLE_MD = `# pdf-kalem Markdown

This page was converted to PDF with **pdf-kalem** — a widget-tree UI library
for document generation. Everything you see is laid out with *Yoga flexbox*
and painted with pdf-lib. Edit the markdown on the left; the preview
re-renders as you type.

## Inline styles

Text can be **bold**, *italic*, ***both***, ~~struck through~~, or
\`inline code\`. Links stay clickable on every line fragment they wrap onto —
try [this one](https://github.com/alaypanov/pdf-kalem).

## Lists

1. Ordered lists number themselves
2. Nested lists indent under their parent
   - bullets at the first level
   - and another
3. Task lists track state
   - [x] pagination
   - [x] rich runs
   - [ ] your feature here

## Code

Fenced blocks render in the mono family on a soft background:

\`\`\`ts
const doc = await markdownToPdf(md, { fonts, theme });
await doc.save();
\`\`\`

## Quotes and rules

> Blockquotes get a left rule and italic text — good for asides and
> callouts that span more than one line.

---

## Tables

| Feature    | Status  | Notes                                    |
|:-----------|:-------:|-----------------------------------------:|
| Pagination | shipped | text splits by line, headers repeat      |
| Rich runs  | shipped | per-fragment links, strike, mono         |
| Markdown   | shipped | this very document                       |
`

const theme = createTheme({
  fonts: {
    body: 'inter',
    code: 'mono',
  },
  colors: {
    ink: fromHex('#1f2937'),
    muted: fromHex('#6b7280'),
    link: fromHex('#1d4ed8'),
  },
  text: {
    body: { font: 'body', size: 11, color: 'ink' },
    h1: { font: 'body', size: 26, color: 'ink' },
    h2: { font: 'body', size: 19, color: 'ink' },
    h3: { font: 'body', size: 15, color: 'ink' },
  },
})

const styles: MarkdownStyles = {
  code: { font: 'code' },
  spacing: 10,
}

// --- State -------------------------------------------------------------------

const editorEl = ref<HTMLDivElement>()
const frameEl = ref<HTMLIFrameElement>()
const badge = ref('…')
const error = ref('')
const downloadHref = ref('')

let view: EditorView | undefined
let objectUrl: string | undefined
let timer: ReturnType<typeof setTimeout> | undefined
// Assigned after useFonts resolves; undefined keeps builtin fonts.
let fonts: Awaited<ReturnType<typeof useFonts>> | undefined

// --- Rendering ---------------------------------------------------------------

async function render(): Promise<void> {
  if (!view) return
  badge.value = 'rendering…'
  try {
    const doc = await markdownToPdf(view.state.doc.toString(), {
      theme,
      fonts,
      styles,
      meta: {
        title: 'pdf-kalem markdown playground',
        creator: 'pdf-kalem',
        producer: 'pdf-lib',
      },
    })

    const blob = await doc.getBlob()
    const pageCount = await doc.getPageCount()

    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrl = URL.createObjectURL(blob)
    if (frameEl.value) frameEl.value.src = objectUrl
    downloadHref.value = objectUrl
    error.value = ''
    badge.value = `${pageCount} page${pageCount === 1 ? '' : 's'}`
  } catch (err) {
    console.error('markdown playground: render failed', err)
    error.value = err instanceof Error ? err.message : String(err)
    badge.value = 'render failed'
  }
}

function schedule(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    void render()
  }, 400)
}

function reset(): void {
  if (!view) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: SAMPLE_MD } })
  void render()
}

// --- Editor ------------------------------------------------------------------

// Light syntax theme tuned to the docs palette (same as the examples).
const syntaxTheme = HighlightStyle.define([
  { tag: [t.heading], color: '#1c1917', fontWeight: '600' },
  { tag: [t.link, t.url], color: '#b45309', textDecoration: 'underline' },
  { tag: [t.emphasis], fontStyle: 'italic' },
  { tag: [t.strong], fontWeight: '600' },
  { tag: [t.strikethrough], textDecoration: 'line-through' },
  { tag: [t.monospace], color: '#0f766e' },
  { tag: [t.processingInstruction], color: '#a8a29e' },
  { tag: [t.invalid], color: '#b91c1c' },
])

const editorTheme = EditorView.theme({
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

onMounted(async () => {
  view = new EditorView({
    parent: editorEl.value!,
    state: EditorState.create({
      doc: SAMPLE_MD,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        syntaxHighlighting(syntaxTheme, { fallback: true }),
        EditorView.lineWrapping,
        editorTheme,
        markdownMode(),
        keymap.of([
          // Cmd/Ctrl+Enter renders immediately instead of waiting for the debounce.
          {
            key: 'Mod-Enter',
            run: () => {
              void render()
              return true
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) schedule()
        }),
      ],
    }),
  })

  try {
    // Shipped families — no font files or network needed.
    fonts = await useFonts({ body: 'inter' })
  } catch (err) {
    console.error('markdown playground: font loading failed, falling back to builtins', err)
  }
  await render()
})

onBeforeUnmount(() => {
  view?.destroy()
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div class="flex min-h-0 w-full h-screen flex-1 flex-col overflow-hidden bg-paper">
    <header class="flex w-full items-center border-b border-ink/10 justify-between px-4">
     <Breadcrumbs :title="'markdown'" />
     <div class="flex items-center gap-2  py-2">
       <span
         class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] whitespace-nowrap"
         :class="error
           ? 'border-[rgba(185,28,28,0.35)] bg-[rgba(185,28,28,0.05)] text-[#b91c1c]'
           : 'border-ink/15 text-muted'"
         :title="error"
       >
         <span class="h-1.5 w-1.5 rounded-full" :class="error ? 'bg-red-500' : 'bg-green-500'"></span>
         {{ badge }}
       </span>
        <!-- <span class="flex-1"></span> -->
       <button
         type="button"
         class="cursor-pointer rounded-md border border-solid border-ink/15 px-2.5 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-ink no-underline transition-colors duration-120 hover:border-ink hover:bg-ink hover:text-paper"
         @click="reset"
       >Reset</button>
       <a
         class="rounded-md border border-solid border-ink bg-ink px-2.5 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-paper no-underline transition-colors duration-120 hover:border-black hover:bg-black"
         :href="downloadHref"
         download="markdown.pdf"
       >Download PDF</a>
     </div>
    </header>

    <main class="relative flex min-h-0 flex-1">
      <div class="relative flex min-h-0 flex-1">
        <div class="flex w-1/2 min-w-0 flex-col border-r border-ink/10">
          <div class="flex h-9 flex-none items-center gap-2 border-b border-ink/10 px-4">
            <span class="h-[7px] w-[7px] bg-accent"></span>
            <span class="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Source</span>
            <span class="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-[#a8a29e]">Markdown</span>
          </div>
          <div
            ref="editorEl"
            class="min-h-0 flex-1 focus-within:shadow-[inset_0_0_0_1px_rgba(180,83,9,0.3)]"
          ></div>
        </div>
        <div class="flex w-1/2 bg-paper2 min-w-0 flex-col">
          <div class="flex h-9 flex-none  items-center gap-2 border-b border-ink/10 px-4">
            <span class="h-[7px] w-[7px] bg-ink"></span>
            <span class="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Proof</span>
            <span class="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-[#a8a29e]">PDF</span>
          </div>
          <iframe
            ref="frameEl"
            class="min-h-0 flex-1 bg-paper2"
            title="PDF preview"
          ></iframe>
        </div>
        <p
          v-if="error"
          class="absolute bottom-0 left-0 z-10 m-0 w-1/2 overflow-hidden whitespace-nowrap border-t border-[rgba(185,28,28,0.3)] bg-[rgba(185,28,28,0.05)] px-3.5 py-2 font-mono text-xs text-ellipsis text-[#b91c1c]"
          :title="error"
        >{{ error.split('\n')[0] }}</p>
      </div>
    </main>
  </div>
</template>
