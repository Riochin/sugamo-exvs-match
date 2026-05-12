<template>
  <div class="w-full">
    <div class="flex justify-between text-sm text-white mb-1">
      <span>提出進捗</span>
      <span>{{ completedCount }} / {{ totalCount }} 人提出済み</span>
    </div>
    <div class="w-full bg-main rounded-full h-3 overflow-hidden">
      <div
        class="bg-accent h-3 rounded-full transition-all duration-300"
        :style="{ width: `${percentage}%` }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  completedCount: number
  totalCount: number
}>()

const percentage = computed(() =>
  props.totalCount === 0 ? 0 : Math.round((props.completedCount / props.totalCount) * 100),
)
</script>
