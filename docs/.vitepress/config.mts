import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitepress'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  lang: 'en-US',
  title: 'pdf-kalem',
  description: 'A PDF-focused widget-tree UI library for document generation.',
  // GitHub Pages project site: https://alaypanov.github.io/pdf-kalem/
  base: '/pdf-kalem/',
  // Sitemap generation (docs/.vitepress/dist/sitemap.xml) — spiders find the
  // pages through robots.txt's Sitemap line. VitePress 1.x builds sitemap
  // URLs without `base` (relative paths resolved against the hostname), so
  // transformItems prepends the GitHub Pages subpath; transformPageData adds
  // a matching canonical link per page.
  sitemap: {
    hostname: 'https://alaypanov.github.io',
    transformItems: (items) =>
      items.map((item) => ({ ...item, url: `/pdf-kalem/${item.url}` })),
  },
  head: [
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'pdf-kalem' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
  ],
  transformPageData(pageData) {
    const canonicalUrl = `https://alaypanov.github.io/pdf-kalem/${pageData.relativePath}`
      .replace(/index\.md$/, '')
      .replace(/\.md$/, '.html')
    pageData.frontmatter.head ??= []
    pageData.frontmatter.head.push(['link', { rel: 'canonical', href: canonicalUrl }])
  },
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
