<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import Home from './Home.vue'

/**
 * The theme's Layout wraps EVERY page, so this component switches:
 * frontmatter `layout: home` renders the editorial home (no docs nav, the
 * cards navigate); frontmatter `layout: open` renders the bare, open shell
 * (no docs nav/sidebar — the workbench is the page); everything else
 * delegates to the default theme untouched.
 *
 * `<Content />` is a VitePress global component (registered alongside
 * ClientOnly) that renders the page's markdown body. No `.vp-doc` wrapper:
 * these pages are pure workbench (utility-styled), so the default theme's
 * markdown typography is intentionally not applied. Re-add the class if an
 * open-layout page ever carries markdown prose.
 */
const { frontmatter } = useData()
const Default = DefaultTheme.Layout
</script>

<template>
  <Home v-if="frontmatter.layout === 'home'" />
  <div v-else-if="frontmatter.layout === 'open'" class="flex h-screen flex-col overflow-hidden bg-paper">
    <Content />
  </div>
  <Default v-else />
</template>
