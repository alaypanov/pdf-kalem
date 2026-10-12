<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Breadcrumbs from './Breadcrumbs.vue'
import { EditorState } from '@codemirror/state'
import { drawSelection, dropCursor, EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { javascript as javascriptMode } from '@codemirror/lang-javascript'
import type { FontSet } from '../../../src/index'
import { captureWarnings } from './sandbox'
import { playgroundEditorTheme, playgroundSyntaxTheme } from './workbench'
import PlaygroundStrip from './PlaygroundStrip.vue'

/**
 * The shared two-pane workbench shell behind the playgrounds: CodeMirror
 * editor left, PDF proof right, debounced re-render, status badge, reset +
 * download. Everything mechanical lives here; a playground supplies the
 * `renderCode` callback (editor text + loaded fonts → blob + page count),
 * its sample code, and its labels. Extra header controls go in the
 * `actions` slot. Mount inside <ClientOnly> — rendering touches browser APIs.
 */

const props = defineProps<{
  /** Starter code — the editor content on mount and after Reset. */
  sampleCode: string
  /** Breadcrumbs label (also used in render-failure console notes). */
  breadcrumbs: string
  /** Left pane strip label ('Source', 'Overlay code', …). */
  sourceLabel: string
  /** Download link's file name. */
  downloadName: string
  /** Right pane strip badge ('PDF', a loaded file's name, …). */
  proofBadge?: string
  /** Loads fonts once on mount; the result feeds every `renderCode` call. */
  loadFonts?: () => Promise<FontSet | undefined>
  /** The playground-specific render: code (+ fonts) in, PDF blob out. */
  renderCode: (code: string, fonts: FontSet | undefined) => Promise<{ blob: Blob; pageCount: number }>
}>()

// --- State -------------------------------------------------------------------

const editorEl = ref<HTMLDivElement>()
const frameEl = ref<HTMLIFrameElement>()
const badge = ref('…')
const error = ref('')
const warning = ref('')
const downloadHref = ref('')

let view: EditorView | undefined
let objectUrl: string | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let fonts: FontSet | undefined

// --- Rendering ---------------------------------------------------------------

async function render(): Promise<void> {
  if (!view) return
  badge.value = 'rendering…'
  try {
    const { result, warnings } = await captureWarnings(() =>
      props.renderCode(view!.state.doc.toString(), fonts),
    )

    const { blob, pageCount } = result

    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrl = URL.createObjectURL(blob)
    if (frameEl.value) frameEl.value.src = objectUrl
    downloadHref.value = objectUrl
    error.value = ''
    warning.value = warnings.join('\n')
    badge.value = `${pageCount} page${pageCount === 1 ? '' : 's'}`
  } catch (err) {
    console.error(`${props.breadcrumbs} playground: render failed`, err)
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
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: props.sampleCode } })
  void render()
}

/** Immediate re-render, bypassing the debounce (e.g. after a file swap). */
defineExpose({ render })

// --- Editor --------------------------------------------------------------------

onMounted(async () => {
  view = new EditorView({
    parent: editorEl.value!,
    state: EditorState.create({
      doc: props.sampleCode,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        syntaxHighlighting(playgroundSyntaxTheme, { fallback: true }),
        EditorView.lineWrapping,
        playgroundEditorTheme,
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

  if (props.loadFonts) {
    fonts = await props.loadFonts()
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
     <Breadcrumbs :title="breadcrumbs" />
     <div class="flex items-center gap-2  py-2">
       <span
         class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] whitespace-nowrap"
         :class="error
           ? 'border-[rgba(185,28,28,0.35)] bg-[rgba(185,28,28,0.05)] text-[#b91c1c]'
           : warning
             ? 'border-[rgba(180,83,9,0.35)] bg-[rgba(180,83,9,0.05)] text-[#b45309]'
             : 'border-ink/15 text-muted'"
         :title="warning || error"
       >
         <span class="h-1.5 w-1.5 rounded-full" :class="error ? 'bg-red-500' : warning ? 'bg-[#b45309]' : 'bg-green-500'"></span>
         {{ warning ? "⚠ warning" : badge }}
       </span>
       <slot name="actions" />
       <button
         type="button"
         class="cursor-pointer rounded-md border border-solid border-ink/15 px-2.5 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-ink no-underline transition-colors duration-120 hover:border-ink hover:bg-ink hover:text-paper"
         @click="reset"
       >Reset</button>
       <a
         class="rounded-md border border-solid border-ink bg-ink px-2.5 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-paper no-underline transition-colors duration-120 hover:border-black hover:bg-black"
         :href="downloadHref"
         :download="downloadName"
       >Download PDF</a>
     </div>
    </header>

    <main class="relative flex min-h-0 flex-1">
      <div class="relative flex min-h-0 flex-1">
        <div class="flex w-1/2 min-w-0 flex-col border-r border-ink/10">
          <PlaygroundStrip dot="accent" :label="sourceLabel" badge="JavaScript" :error="error" :warning="warning" />
          <div
            ref="editorEl"
            class="min-h-0 flex-1 focus-within:shadow-[inset_0_0_0_1px_rgba(180,83,9,0.3)]"
          ></div>
        </div>
        <div class="flex w-1/2 bg-paper2 min-w-0 flex-col">
          <PlaygroundStrip dot="ink" label="Proof" :badge="proofBadge ?? 'PDF'" />
          <iframe
            ref="frameEl"
            class="min-h-0 flex-1 bg-paper2"
            title="PDF preview"
          ></iframe>
        </div>
      </div>
    </main>
  </div>
</template>
