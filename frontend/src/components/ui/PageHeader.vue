<template>
  <div class="flex items-center justify-between px-4 pt-4 pb-2">
    <RouterLink
      v-if="currentPlayer?.isAdmin && !isAdminPage"
      to="/admin"
      class="text-xs font-bold text-red-400 w-14 text-left"
    >
      管理
    </RouterLink>
    <div v-else class="w-14" />

    <h1 class="text-lg font-bold text-white tracking-wide">{{ title }}</h1>

    <button
      type="button"
      data-testid="help-button"
      aria-label="ヘルプ"
      class="w-8 h-8 rounded-full border border-yellow-500/60 text-yellow-400 text-sm font-bold flex items-center justify-center shrink-0"
      @click="$emit('help')"
    >
      ?
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

defineProps<{ title: string }>()
defineEmits<{ help: [] }>()

const { currentPlayer } = useAuth()
const route = useRoute()
const isAdminPage = computed(() => route.path === '/admin')
</script>
