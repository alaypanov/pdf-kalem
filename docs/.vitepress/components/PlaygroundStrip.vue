<script setup lang="ts">
/**
 * The pane header strip shared by the playgrounds: dot + label on the left,
 * state on the right. Everything the user needs to notice renders here, on
 * top of the source where the fix happens — errors (red) take precedence
 * over warnings (amber); the plain badge label shows when both are clear.
 */
defineProps<{
  /** Dot color: the editor pane uses the accent, the proof pane ink. */
  dot: 'accent' | 'ink'
  label: string
  /** Right-side label shown when there is no error/warning ("JavaScript", "PDF", …). */
  badge: string
  error?: string
  warning?: string
}>()
</script>

<template>
  <div class="flex h-9 flex-none items-center gap-2 border-b border-ink/10 px-4">
    <span class="h-1.5 w-1.5" :class="dot === 'accent' ? 'bg-accent' : 'bg-ink'"></span>
    <span class="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{{ label }}</span>
    <span
      v-if="error"
      class="ml-auto min-w-0 truncate rounded bg-[rgba(185,28,28,0.08)] px-2 py-0.5 font-mono text-[10px] text-[#b91c1c]"
      :title="error"
    >✕ {{ error }}</span>
    <span
      v-else-if="warning"
      class="ml-auto min-w-0 truncate rounded bg-[rgba(180,83,9,0.08)] px-2 py-0.5 font-mono text-[10px] text-[#b45309]"
      :title="warning"
    >⚠ {{ warning }}</span>
    <span v-else class="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-[#a8a29e]">{{ badge }}</span>
  </div>
</template>
