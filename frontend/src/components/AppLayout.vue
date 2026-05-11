<template>
  <div class="min-h-screen bg-bg flex justify-center">
    <div
      data-testid="layout-container"
      class="relative w-full max-w-[430px] min-h-screen pb-16"
    >
      <slot />
      <BottomNav />
    </div>
  </div>
</template>

<script setup lang="ts">
import BottomNav from './BottomNav.vue'
</script>
