<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

/**
 * Editorial home layout in the repo's paper/ink style: wordmark, serif
 * display headline, deck line, lede, action buttons, and a hairline card
 * grid with numbered eyebrows. Content comes from the `layout: home`
 * frontmatter in docs/index.md (hero + features); OpenLayout.vue routes
 * `layout: home` here instead of the default VitePress home. No docs nav —
 * the cards navigate. Hero mapping: name → display headline, text → serif
 * deck line, tagline → lede.
 */

interface HeroAction {
  theme?: 'brand' | 'alt'
  text: string
  link: string
}

interface Hero {
  name?: string
  text?: string
  tagline?: string
  actions?: HeroAction[]
}

interface Feature {
  title: string
  details?: string
  link?: string
}

const { frontmatter } = useData()

const hero = computed<Hero>(() => (frontmatter.value as { hero?: Hero }).hero ?? {})
const actions = computed(() => hero.value.actions ?? [])
const features = computed<Feature[]>(() => (frontmatter.value as { features?: Feature[] }).features ?? [])
</script>

<template>
  <div class="min-h-screen bg-paper font-mono text-[#292524] dark:bg-night dark:text-[#d6d3d1]">
    <main class="mx-auto w-[min(880px,calc(100vw_-_48px))] pb-[88px] pt-[72px]">
      <div class="mb-14 flex items-baseline gap-2.5">
        <span class="text-xs tracking-[0.02em] text-ink dark:text-bone">{{ hero.name }}</span>
        <span class="text-faint dark:text-muted">/</span>
        <span class="text-xs font-mono text-ink dark:text-bone">docs</span>
      </div>

      <h1 class="mb-2.5 font-serif text-orange-800 text-[clamp(2.2rem,5.5vw,3.6rem)] font-medium leading-[1.02] tracking-[-0.02em] text-ink dark:text-bone">
        {{ hero.name }}.
      </h1>

      <!-- <p class="mb-3.5 font-serif text-[1.35rem] font-medium leading-[1.3] tracking-[-0.01em] text-ink dark:text-bone">
        {{ hero.text }}
      </p> -->

      <p class="m-0 max-w-[560px] text-[0.95rem] leading-[1.7] text-muted dark:text-faint">
        {{ hero.tagline }}
      </p>

      <div v-if="actions.length" class="mt-7 flex flex-wrap items-center gap-2.5">
        <a
          v-for="action in actions"
          :key="action.text"
          :href="withBase(action.link)"
          class="rounded-md border border-solid px-2.5 py-1.5 text-xs uppercase tracking-[0.2em] no-underline transition-colors duration-150"
          :class="action.theme === 'brand'
            ? 'border-ink bg-ink text-paper hover:border-accent hover:bg-accent hover:text-white dark:border-bone dark:bg-bone dark:text-night dark:hover:border-[#f59e0b] dark:hover:bg-[#f59e0b] dark:hover:text-night'
            : 'border-ink/15 text-ink hover:border-ink hover:bg-ink hover:text-paper dark:border-[rgba(231,229,228,0.2)] dark:text-bone dark:hover:border-bone dark:hover:bg-bone dark:hover:text-night'"
        >{{ action.text }}</a>
      </div>

      <section class="mt-14 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] border-l border-t border-hairline dark:border-nightline">
        <component
          :is="feature.link ? 'a' : 'div'"
          v-for="(feature, i) in features"
          :key="feature.title"
          :href="feature.link ? withBase(feature.link) : undefined"
          class="border-b border-r border-hairline px-6 pb-[30px] pt-[26px] no-underline transition-colors duration-150 hover:bg-paper2 dark:border-nightline dark:hover:bg-night2"
        >
          <div class="mb-[18px] flex items-center gap-[9px] text-[10px] uppercase tracking-[0.14em] text-muted dark:text-faint">
            <span class="h-[7px] w-[7px] bg-accent dark:bg-[#d97706]"></span>
            {{ String(i + 1).padStart(2, '0') }}
          </div>
          <h2 class="mb-2 font-serif text-[1.35rem] font-medium tracking-[-0.01em] text-ink dark:text-bone">
            {{ feature.title }}
          </h2>
          <p class="m-0 text-[0.85rem] leading-[1.65] text-muted dark:text-faint">{{ feature.details }}</p>
          <div v-if="feature.link" class="mt-[18px] text-[10.5px] tracking-[0.06em] text-faint dark:text-muted">
            {{ feature.link }}
          </div>
        </component>
      </section>

      <footer class="mt-14 flex flex-wrap items-baseline gap-2 text-[10.5px] tracking-[0.06em] text-faint dark:text-muted">
        <span>MIT licensed · Copyright © 2026 A Laypanov</span>
        <a
          href="https://github.com/alaypanov/pdf-kalem"
          class="text-muted no-underline transition-colors hover:text-accent dark:text-faint dark:hover:text-[#f59e0b]"
        >GitHub</a>
      </footer>
    </main>
  </div>
</template>
