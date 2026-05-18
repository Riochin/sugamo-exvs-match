<template>
  <div class="flex items-center justify-between px-4 py-2 bg-dark mb-4">
    <h1 class="text-lg font-bold text-white tracking-wide">{{ title }}</h1>

    <div class="flex items-center gap-3">
      <RouterLink
        v-if="currentPlayer?.isAdmin && !isAdminPage"
        to="/admin"
        class="text-xs font-bold text-white"
      >
        管理
      </RouterLink>

      <button
        type="button"
        data-testid="help-button"
        aria-label="ヘルプ"
        class="w-8 h-8 rounded-full border-2 border-white/60 text-white text-sm font-bold flex items-center justify-center shrink-0"
        @click="$emit('help')"
      >
        ?
      </button>
    </div>
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
