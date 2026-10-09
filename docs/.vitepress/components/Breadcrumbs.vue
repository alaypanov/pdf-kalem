<script lang="ts" setup>
const { title } = defineProps<{ title: string }>()
</script>

<template>
   <div class="flex gap-2 items-baseline">
     <a href="/" class="font-mono no-underline text-xs text-ink">pdf-kalem</a>
     <span class="text-[#a8a29e]">/</span>
     <span class="font-mono text-xs text-ink">{{ title }}</span>
   </div>
</template>
