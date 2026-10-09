<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Breadcrumbs from './Breadcrumbs.vue'
import { EditorState } from '@codemirror/state'
import { drawSelection, dropCursor, EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { javascript as javascriptMode } from '@codemirror/lang-javascript'
import { PdfDoc, PageSize, createTheme, useFonts } from '../../../src/index'
import { fromHex } from '../../../src/lib/utils/color-utils'
import { evalPages, widgetSandbox } from './sandbox'
import { mdiAbacus } from '@mdi/js'

/**
 * Live widget-tree workbench for the docs playground.
 *
 * The editor holds the body of a plain-JS function returning an array of
 * Page widgets — widget factories, `theme`, `fromHex`, `PageSize`, and
 * `mdiAbacus` are injected as parameters (same sandbox contract as the
 * standalone examples), evaluated with `new Function` on every debounced
 * render. The starter tree is the invoice example.
 * Mount inside <ClientOnly> — rendering touches browser APIs.
 */

const SAMPLE_CODE = `// Widget playground — edit the code; the PDF re-renders as you type.
//
// This is the body of a function: \`return\` an array of Page widgets.
// Widget factories (Page, Text, Row, Column, Container, Table, …) plus
// \`theme\`, \`fromHex\`, \`PageSize\`, and \`mdiAbacus\` are already in scope —
// plain JavaScript, no imports or types needed. Fonts, theme, and document
// setup are handled by the scaffolding around this editor.
//
// Tip: children of a Container shrink-wrap (alignItems: flex-start) — give
// Rows and Columns \`width: '100%'\` when you want them to fill the panel
// or let \`justifyBetween\` spread their children.

const lineItems = [
  { description: 'Frontend implementation support', quantity: '12', rate: '$85.00', amount: '$1,020.00' },
  { description: 'Design system audit', quantity: '4', rate: '$120.00', amount: '$480.00' },
  { description: 'Performance optimization', quantity: '8', rate: '$120.00', amount: '$960.00' },
];

const totals = {
  subtotal: '$2,460.00',
  tax: '$196.80',
  total: '$2,656.80',
  balanceDue: '$2,656.80',
};

function labelValue(label, value) {
  return Column({
    gap: 3,
    children: [
      Text(label.toUpperCase(), { variant: 'label' }),
      Text(value, { variant: 'body' }),
    ],
  });
}

function summaryRow(label, value, emphasize = false) {
  return Row({
    width: '100%',
    mainAxisAlignment: Row.justifyBetween,
    children: [
      Text(label, { variant: emphasize ? 'label' : 'body' }),
      Text(value, { variant: emphasize ? 'h2' : 'body' }),
    ],
  });
}

return [
  Page({
    padding: 36,
    children: [
      Column({
        gap: 16,
        children: [
          // Header: brand chip + title on the left, summary card on the right.
          Row({
            width: '100%',
            mainAxisAlignment: Row.justifyBetween,
            crossAxisAlignment: Row.alignStart,
            children: [
              Column({
                gap: 10,
                children: [
                  Container({
                    padding: 12,
                    bgColor: 'brand',
                    child: Text('ACME STUDIO', { variant: 'label', color: 'white' }),
                  }),
                  Text('INVOICE', { variant: 'h1' }),
                  Text('Project delivery and implementation support.', {
                    variant: 'caption',
                  }),
                ],
              }),
              Container({
                width: 210,
                padding: 14,
                bgColor: 'panel',
                child: Column({
                  width: '100%',
                  gap: 7,
                  children: [
                    Text('Invoice summary', { variant: 'h2' }),
                    labelValue('Invoice number', 'INV-2026-014'),
                    labelValue('Issue date', 'May 31, 2026'),
                    labelValue('Due date', 'June 14, 2026'),
                  ],
                }),
              }),
            ],
          }),

          HLine({ color: 'line', thickness: 1, width: '100%' }),

          // Parties: equal-height panels (alignStretch), addresses on one line.
          Row({
            width: '100%',
            mainAxisAlignment: Row.justifyBetween,
            crossAxisAlignment: Row.alignStretch,
            children: [
              Container({
                width: '50%',
                padding: 12,
                bgColor: 'panel',
                child: Column({
                  width: '100%',
                  gap: 6,
                  children: [
                    Text('From', { variant: 'h2' }),
                    Text('Acme Studio LLC', { variant: 'body' }),
                    Text('201 Market Street, San Francisco, CA 94105', { variant: 'caption' }),
                    Link('billing@acmestudio.dev', {
                      href: 'mailto:billing@acmestudio.dev',
                      variant: 'link',
                    }),
                  ],
                }),
              }),
              Container({
                width: '49%',
                padding: 12,
                bgColor: 'panel',
                child: Column({
                  width: '100%',
                  gap: 6,
                  children: [
                    Text('Bill to', { variant: 'h2' }),
                    Text('Northwind Labs — Attn: Finance Team', { variant: 'body' }),
                    Text('88 King Street, Toronto, ON M5V 1L7', { variant: 'caption' }),
                    Link('accounts@northwindlabs.com', {
                      href: 'mailto:accounts@northwindlabs.com',
                      variant: 'link',
                    }),
                  ],
                }),
              }),
            ],
          }),

          // Project bar: width 100% so justifyBetween spreads the three groups.
          Container({
            width: '100%',
            padding: 12,
            bgColor: 'accentSoft',
            child: Row({
              width: '100%',
              mainAxisAlignment: Row.justifyBetween,
              children: [
                labelValue('Project', 'Website refresh and launch'),
                labelValue('Terms', 'Net 14'),
                labelValue('Currency', 'USD'),
              ],
            }),
          }),

          // Line items: numeric columns right-aligned.
          Table({
            width: '100%',
            columnWeights: [3.5, 0.8, 1, 1.2],
            head: TableHead({
              rows: [
                TableRow({
                  children: [
                    TableCell({ child: Text('Description', { variant: 'label', color: 'white' }) }),
                    TableCell({ child: Text('Qty', { variant: 'label', color: 'white', align: 'right' }) }),
                    TableCell({ child: Text('Rate', { variant: 'label', color: 'white', align: 'right' }) }),
                    TableCell({ child: Text('Amount', { variant: 'label', color: 'white', align: 'right' }) }),
                  ],
                }),
              ],
            }),
            body: TableBody({
              rows: lineItems.map((item) =>
                TableRow({
                  minHeight: 30,
                  children: [
                    TableCell({ child: Text(item.description, { variant: 'body' }) }),
                    TableCell({ child: Text(item.quantity, { variant: 'body', align: 'right' }) }),
                    TableCell({ child: Text(item.rate, { variant: 'body', align: 'right' }) }),
                    TableCell({ child: Text(item.amount, { variant: 'body', align: 'right' }) }),
                  ],
                }),
              ),
            }),
          }),

          // Notes + totals: equal-height panels.
          Row({
            width: '100%',
            mainAxisAlignment: Row.justifyBetween,
            crossAxisAlignment: Row.alignStretch,
            children: [
              Container({
                width: '50%',
                padding: 12,
                bgColor: 'panel',
                child: Column({
                  width: '100%',
                  gap: 6,
                  children: [
                    Text('Notes', { variant: 'h2' }),
                    Text(
                      'Thank you for your business. Please include the invoice number with your payment reference.',
                      { variant: 'body' },
                    ),
                    Text('Bank transfer preferred. Payment is due within 14 days of receipt.', {
                      variant: 'caption',
                    }),
                  ],
                }),
              }),
              Container({
                width: '49%',
                padding: 12,
                bgColor: 'panel',
                child: Column({
                  width: '100%',
                  gap: 8,
                  children: [
                    summaryRow('Subtotal', totals.subtotal),
                    summaryRow('Tax (8%)', totals.tax),
                    HLine({ color: 'line', thickness: 1, width: '100%' }),
                    summaryRow('Total', totals.total, true),
                    summaryRow('Balance due', totals.balanceDue, true),
                  ],
                }),
              }),
            ],
          }),

          Container({
            width: '100%',
            padding: 12,
            bgColor: 'brand',
            child: Row({
              width: '100%',
              mainAxisAlignment: Row.justifyBetween,
              children: [
                Text('Paid via bank transfer to ACME STUDIO LLC', {
                  variant: 'caption',
                  color: 'white',
                }),
                Text('Thank you', { variant: 'caption', color: 'white' }),
              ],
            }),
          }),
        ],
      }),
    ],
  }),
];
`

const theme = createTheme({
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
    const pages = evalPages(view.state.doc.toString(), widgetSandbox({ theme, mdiAbacus }))

    const doc = new PdfDoc({
      size: PageSize.LETTER,
      theme,
      fonts,
      meta: {
        title: 'pdf-kalem widget playground',
        creator: 'pdf-kalem',
        producer: 'pdf-lib',
      },
      children: pages,
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
    console.error('widget playground: render failed', err)
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
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: SAMPLE_CODE } })
  void render()
}

// --- Editor ------------------------------------------------------------------

// Light syntax theme tuned to the docs palette (same as the examples).
const syntaxTheme = HighlightStyle.define([
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
      doc: SAMPLE_CODE,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        syntaxHighlighting(syntaxTheme, { fallback: true }),
        EditorView.lineWrapping,
        editorTheme,
        javascriptMode(),
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
    // Inter loads from the docs site's static assets (docs/public/fonts) and
    // binds to the theme's font tokens at doc construction (doc-level wins
    // over theme.fonts).
    const face = (name: string) => fetch(`/fonts/${name}`).then((r) => r.arrayBuffer())
    fonts = await useFonts(
      { body: 'inter', heading: 'inter', mono: 'inter' },
      {
        files: {
          inter: {
            regular: await face('Inter-Regular.ttf'),
            bold: await face('Inter-Bold.ttf'),
            italic: await face('Inter-Italic.ttf'),
            boldItalic: await face('Inter-BoldItalic.ttf'),
          },
        },
      },
    )
  } catch (err) {
    console.error('widget playground: font loading failed, falling back to builtins', err)
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
     <Breadcrumbs :title="'widgets'" />
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
         download="widgets.pdf"
       >Download PDF</a>
     </div>
    </header>

    <main class="relative flex min-h-0 flex-1">
      <div class="relative flex min-h-0 flex-1">
        <div class="flex w-1/2 min-w-0 flex-col border-r border-ink/10">
          <div class="flex h-9 flex-none items-center gap-2 border-b border-ink/10 px-4">
            <span class="h-1.5 w-1.5 bg-accent"></span>
            <span class="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Source</span>
            <span class="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-[#a8a29e]">JavaScript</span>
          </div>
          <div
            ref="editorEl"
            class="min-h-0 flex-1 focus-within:shadow-[inset_0_0_0_1px_rgba(180,83,9,0.3)]"
          ></div>
        </div>
        <div class="flex w-1/2 bg-paper2 min-w-0 flex-col">
          <div class="flex h-9 flex-none  items-center gap-2 border-b border-ink/10 px-4">
            <span class="h-1.5 w-1.5 bg-ink"></span>
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
