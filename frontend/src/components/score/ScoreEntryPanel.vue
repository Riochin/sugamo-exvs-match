<template>
  <div class="bg-dark border border-main rounded-lg p-4 text-white">
    <h2 class="text-lg font-bold text-main mb-4">スコア入力</h2>

    <SubmissionProgressBar
      :completed-count="progressUpdate?.completedCount ?? 0"
      :total-count="progressUpdate?.totalCount ?? 0"
      class="mb-4"
    />

    <div v-if="isAbsent" data-testid="absent-message" class="text-center py-6 text-gray-400">
      <p class="text-base">欠席として登録されています</p>
      <p class="text-sm mt-1">スコアの入力は不要です</p>
    </div>

    <div v-else-if="submitted" data-testid="submitted-message" class="text-center py-6 text-green-400">
      <p class="text-base font-bold">送信完了しました</p>
      <p class="text-sm mt-1 text-gray-400">結果発表をお待ちください</p>
    </div>

    <form v-else data-testid="score-form" @submit.prevent="submitScore">
      <div v-if="error" data-testid="error-banner" class="mb-3 p-3 bg-red-900 border border-accent rounded text-sm text-red-200">
        {{ error }}
      </div>

      <div class="mb-4">
        <label for="matches" class="block text-sm text-gray-300 mb-1">対戦数</label>
        <input
          id="matches"
          v-model.number="matches"
          type="number"
          inputmode="numeric"
          min="0"
          placeholder="0"
          data-testid="matches-input"
          class="w-full bg-dark border border-main rounded px-3 py-2 text-white text-lg focus:outline-none focus:border-accent"
        />
      </div>

      <div class="mb-6">
        <label for="wins" class="block text-sm text-gray-300 mb-1">勝利数</label>
        <input
          id="wins"
          v-model.number="wins"
          type="number"
          inputmode="numeric"
          min="0"
          placeholder="0"
          data-testid="wins-input"
          class="w-full bg-dark border border-main rounded px-3 py-2 text-white text-lg focus:outline-none focus:border-accent"
        />
      </div>

      <button
        type="submit"
        :disabled="!isValid || submitted || isAbsent || isSubmitting"
        data-testid="submit-button"
        class="w-full py-3 rounded font-bold text-white transition-colors"
        :class="isValid && !submitted && !isAbsent && !isSubmitting
          ? 'bg-main hover:opacity-90'
          : 'bg-gray-700 cursor-not-allowed opacity-50'"
      >
        {{ isSubmitting ? '送信中...' : '送信する' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { useScoreEntry } from '@/composables/useScoreEntry'
import SubmissionProgressBar from './SubmissionProgressBar.vue'
import type { ProgressUpdatePayload } from '@/composables/useEventStream'

defineProps<{
  eventId: string
  progressUpdate: ProgressUpdatePayload | null
}>()

const { matches, wins, isValid, isSubmitting, submitted, isAbsent, error, submitScore } =
  useScoreEntry()
</script>
