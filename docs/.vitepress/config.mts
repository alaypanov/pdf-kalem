import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitepress'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  lang: 'en-US',
  title: 'pdf-kalem',
  description: 'A PDF-focused widget-tree UI library for document generation.',
  vite: {
    plugins: [
      UnoCSS({ configFile: fileURLToPath(new URL('../uno.config.ts', import.meta.url)) }),
    ],
    // The playground imports the library, and yoga-layout's ESM entry loads
    // its WASM with top-level await. VitePress's defaults (chrome87/es2020)
    // reject TLA — raise every esbuild target VitePress touches (build,
    // source transform, dev dep pre-bundle). Modern browsers support TLA.
    build: { target: 'es2022' },
    esbuild: { target: 'es2022' },
    optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      {
        text: 'Playgrounds',
        items: [
          { text: 'Widget tree', link: '/playground/widgets' },
          { text: 'Markdown converter', link: '/playground/markdown' },
          { text: 'PDF editing', link: '/playground/editing' },
        ],
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Widgets', link: '/guide/widgets' },
            { text: 'Theming', link: '/guide/theming' },
            { text: 'Fonts', link: '/guide/fonts' },
            { text: 'Pagination', link: '/guide/pagination' },
            { text: 'Markdown', link: '/guide/markdown' },
            { text: 'Editing existing PDFs', link: '/guide/editing' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/alaypanov/pdf-kalem' }],
    footer: {
      message: 'MIT licensed',
      copyright: 'Copyright © 2026 A Laypanov',
    },
  },
})
