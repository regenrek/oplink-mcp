<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <div class="grid gap-8 md:grid-cols-2 items-start">
    <div>
      <h2 class="text-xl font-semibold mb-2">{{ title }}</h2>
      <p class="text-muted" v-html="description"></p>
    </div>
    <div>
      <slot />
    </div>
  </div>
</template>

