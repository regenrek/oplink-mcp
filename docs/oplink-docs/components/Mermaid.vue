<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'

const props = defineProps<{ code: string }>()
const decoded = computed(() => atob(props.code))
const block = ref<HTMLElement | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    // Load mermaid ESM from CDN client-side
    // @ts-ignore
    const mermaid = await import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs')
    mermaid.initialize({ startOnLoad: false })
    await mermaid.run({ nodes: [block.value!], suppressErrors: true })
  } catch (e) {
    console.warn('Mermaid render failed', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <figure class="mermaid-container not-prose">
    <pre ref="block" :class="{ 'opacity-0': loading }" v-text="decoded" />
    <div v-if="loading" class="mermaid-placeholder">Rendering diagram…</div>
  </figure>
  
</template>

<style scoped>
.mermaid-container { position: relative; }
.mermaid-placeholder { position: absolute; inset: 0; display:flex; align-items:center; justify-content:center; color: #888; }
.opacity-0 { opacity: 0; }
</style>

