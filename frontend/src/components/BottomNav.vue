<template>
  <nav class="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 bg-dark border-t border-main flex justify-around">
    <RouterLink
      to="/"
      data-testid="nav-tournament"
      :class="['nav-link', route.path === '/' ? 'active' : '']"
    >
      <span class="text-xs mt-1">大会</span>
    </RouterLink>
    <RouterLink
      to="/group"
      data-testid="nav-group"
      :class="['nav-link', route.path === '/group' ? 'active' : '']"
    >
      <span class="text-xs mt-1">グループ</span>
    </RouterLink>
    <RouterLink
      to="/profile"
      data-testid="nav-profile"
      :class="['nav-link', route.path === '/profile' ? 'active' : '']"
    >
      <span class="text-xs mt-1">プロフィール</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<style scoped>
.nav-link {
  @apply flex flex-col items-center py-2 px-4 text-gray-400 transition-colors;
}
.nav-link.active {
  @apply text-main;
}
</style>
