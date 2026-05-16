<template>
  <RouterLink
    to="/admin"
    class="fixed top-4 right-2 z-50 rounded-full border border-red-500 bg-[#12002b] px-2 py-1 text-xs font-bold text-red-400 shadow-lg"
  >
    管理
  </RouterLink>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>
