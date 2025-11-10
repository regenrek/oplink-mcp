<script setup lang="ts">
const { footer } = useAppConfig()
</script>

<template>
  <UFooter>
    <template #left>
      {{ footer.credits }} <ULink
        class="text-red-400"
        href="https://github.com/regenrek/oplink"
        target="_blank"
        color="primary"
      >Kevin Kern</ULink> and <ULink
        class="text-red-400"
        href="https://www.oplink.ai"
        target="_blank"
        color="primary"
      >oplink.ai</ULink>
    </template>

    <template #right>
      <UColorModeButton v-if="footer?.colorMode" />

      <template v-if="footer?.links">
        <UButton
          v-for="(link, index) of footer?.links"
          :key="index"
          v-bind="{ color: 'neutral', variant: 'ghost', ...link }"
        />
      </template>
    </template>
  </UFooter>
</template>
