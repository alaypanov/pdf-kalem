<script setup lang="ts">
import { PageSize, PdfDoc, type FontSet } from '../../../src/index'
import { evalPages, widgetSandbox } from './sandbox'
import { loadPlaygroundFonts, playgroundTheme } from './workbench'
import CodePdfWorkbench from './CodePdfWorkbench.vue'

/**
 * Live form-building workbench for the docs playground — the same sandbox
 * contract as the widget playground (a function body returning Page[]), with
 * the form field factories in scope. Fields become real AcroForm fields in
 * the rendered PDF: open the proof in a browser tab or reader and type into
 * it. The shell (editor, preview, debounce, status) lives in
 * {@link CodePdfWorkbench}. Mount inside <ClientOnly> — rendering touches
 * browser APIs.
 */

const SAMPLE_CODE = `// Forms playground — edit the code; the PDF re-renders as you type.
//
// This is the body of a function: \`return\` an array of Page widgets.
// The form factories (TextField, CheckBox, Dropdown, RadioGroup + Radio,
// Button, Signature) join the regular widgets — every field takes a unique
// \`name\` (the AcroForm field name) and lands in the PDF as a real, fillable
// form field. \`theme\` and \`fromHex\` are in scope too; labels are plain
// Text widgets you compose yourself — wrap label + field in a Column with
// \`width: '100%'\` so the field fills the page (Columns shrink-wrap by
// default).

function labeled(label, widget) {
  // width: '100%' — Columns shrink-wrap their children by default, so the
  // field's own '100%' would resolve against the wrapped width and collapse.
  return Column({
    width: '100%',
    gap: 4,
    children: [
      Text(label, { variant: 'label' }),
      widget,
    ],
  });
}

return [
  Page({
    padding: 48,
    children: [
      Column({
        gap: 16,
        children: [
          Text('Workshop registration', { variant: 'h1' }),
          Text('The boxes are real AcroForm fields — download the PDF and type into them.', {
            variant: 'caption',
          }),

          labeled('FULL NAME', TextField('full-name', { height: 28 })),
          labeled('EMAIL', TextField('email', { height: 28 })),
          labeled('COUNTRY', Dropdown('country', {
            options: ['Germany', 'Kazakhstan', 'United Kingdom', 'United States'],
            height: 28,
          })),

          Column({
            gap: 8,
            children: [
              Text('PLAN', { variant: 'label' }),
              RadioGroup('plan', {
                gap: 8,
                children: [
                  Row({ gap: 8, crossAxisAlignment: 'center', children: [Radio('basic'), Text('Basic — free', { variant: 'body' })] }),
                  Row({ gap: 8, crossAxisAlignment: 'center', children: [Radio('pro'), Text('Pro — €120', { variant: 'body' })] }),
                ],
              }),
            ],
          }),

          Row({
            gap: 8,
            crossAxisAlignment: 'center',
            children: [
              CheckBox('consent'),
              Text('I agree to the code of conduct', { variant: 'body' }),
            ],
          }),

          Row({
            gap: 12,
            children: [
              Button('submit', {
                label: 'Register',
                width: 140,
                height: 36,
                backgroundColor: 'accent',
                textColor: 'white',
              }),
              Signature({ label: 'Signature', height: 40 }),
            ],
          }),
        ],
      }),
    ],
  }),
];
`

async function renderCode(code: string, fonts: FontSet | undefined) {
  const pages = evalPages(code, widgetSandbox({ theme: playgroundTheme }))

  const doc = new PdfDoc({
    size: PageSize.LETTER,
    theme: playgroundTheme,
    fonts,
    meta: {
      title: 'pdf-kalem forms playground',
      creator: 'pdf-kalem',
      producer: 'pdf-lib',
    },
    children: pages,
  })

  const blob = await doc.getBlob()
  const pageCount = await doc.getPageCount()
  return { blob, pageCount }
}
</script>

<template>
  <CodePdfWorkbench
    :sample-code="SAMPLE_CODE"
    breadcrumbs="forms"
    source-label="Source"
    download-name="forms.pdf"
    :load-fonts="() => loadPlaygroundFonts({ body: 'inter', heading: 'inter', mono: 'inter' }, 'forms playground')"
    :render-code="renderCode"
  />
</template>
