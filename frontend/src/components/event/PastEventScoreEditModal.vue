<template>
  <BottomSheet :visible="visible" title="スコア修正" @close="emit('close')">
    <div class="px-4 py-4 space-y-4">
      <p class="text-white font-bold">{{ playerName }}</p>

      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <label class="text-gray-400 text-sm w-16 shrink-0">対戦数</label>
          <input
            v-model.number="matchesInput"
            type="number"
            min="0"
            class="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-center text-lg focus:outline-none focus:border-brand"
          />
        </div>
        <div class="flex items-center gap-3">
          <label class="text-gray-400 text-sm w-16 shrink-0">勝利数</label>
          <input
            v-model.number="winsInput"
            type="number"
            min="0"
            class="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-center text-lg focus:outline-none focus:border-brand"
          />
        </div>
      </div>
      <p class="text-gray-500 text-xs text-center">負け数: {{ matchesInput >= winsInput && matchesInput >= 0 ? matchesInput - winsInput : '-' }}</p>

      <p v-if="errorMsg" class="text-red-400 text-sm text-center">{{ errorMsg }}</p>

      <button
        type="button"
        :disabled="isSubmitting || !isValid"
        class="w-full py-3 rounded-lg font-bold text-sm transition-colors"
        :class="isSubmitting || !isValid ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-brand text-dark'"
        @click="submit"
      >
        {{ isSubmitting ? '保存中...' : '保存する' }}
      </button>
    </div>
  </BottomSheet>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { client } from '@/api/client'
import BottomSheet from '@/components/ui/BottomSheet.vue'

const props = defineProps<{
  visible: boolean
  eventId: string
  playerId: string
  playerName: string
  initialWins: number
  initialLosses: number
}>()

const emit = defineEmits<{
  close: []
  updated: [{ wins: number; losses: number }]
}>()

const matchesInput = ref(props.initialWins + props.initialLosses)
const winsInput = ref(props.initialWins)
const isSubmitting = ref(false)
const errorMsg = ref<string | null>(null)

const isValid = computed(
  () =>
    Number.isInteger(matchesInput.value) &&
    Number.isInteger(winsInput.value) &&
    matchesInput.value >= 0 &&
    winsInput.value >= 0 &&
    matchesInput.value >= winsInput.value,
)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      matchesInput.value = props.initialWins + props.initialLosses
      winsInput.value = props.initialWins
      errorMsg.value = null
    }
  },
)

async function submit() {
  if (!isValid.value || isSubmitting.value) return
  isSubmitting.value = true
  errorMsg.value = null
  const wins = winsInput.value
  const losses = matchesInput.value - winsInput.value
  try {
    const res = await client.api.events[':id'].scores[':playerId'].$patch({
      param: { id: props.eventId, playerId: props.playerId },
      json: { wins, losses },
    })
    if (!res.ok) {
      errorMsg.value = 'スコアの更新に失敗しました'
      return
    }
    emit('updated', { wins, losses })
    emit('close')
  } catch {
    errorMsg.value = 'ネットワークエラーが発生しました'
  } finally {
    isSubmitting.value = false
  }
}
</script>
