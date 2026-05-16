<template>
  <div class="bg-dark border border-main rounded-lg p-4 text-white">
    <h2 class="text-lg font-bold text-main mb-4">スコア入力</h2>

    <SubmissionProgressBar
      :completed-count="progressUpdate?.completedCount ?? 0"
      :total-count="progressUpdate?.totalCount ?? 0"
      class="mb-4"
    />

    <!-- 欠席 -->
    <div v-if="isAbsent" data-testid="absent-message" class="text-center py-6 text-gray-400">
      <p class="text-base">欠席として登録されています</p>
      <p class="text-sm mt-1">スコアの入力は不要です</p>
    </div>

    <!-- 送信完了 -->
    <div v-else-if="view === 'submitted'" data-testid="submitted-message" class="text-center py-6">
      <p class="text-base font-bold text-green-400">送信完了しました</p>
      <p class="text-sm mt-1 text-gray-400">{{ matches }}戦 {{ wins }}勝</p>
      <button
        type="button"
        data-testid="edit-button"
        class="mt-4 w-full py-2 rounded border border-main text-main text-sm font-bold hover:bg-main hover:text-white transition-colors"
        @click="editScore"
      >
        修正して再送信
      </button>
    </div>

    <!-- 確認ステップ -->
    <div v-else-if="view === 'confirming'" data-testid="confirm-view" class="py-2">
      <p class="text-sm text-gray-300 mb-4 text-center">以下の内容で送信します</p>
      <div class="bg-gray-800 rounded-lg p-4 mb-6 flex justify-around text-center">
        <div>
          <p class="text-xs text-gray-400 mb-1">対戦数</p>
          <p class="text-3xl font-bold text-white">{{ matches }}</p>
        </div>
        <div class="border-l border-gray-600" />
        <div>
          <p class="text-xs text-gray-400 mb-1">勝利数</p>
          <p class="text-3xl font-bold text-accent">{{ wins }}</p>
        </div>
      </div>
      <div class="flex gap-3">
        <button
          type="button"
          data-testid="cancel-confirm-button"
          class="flex-1 py-3 rounded border border-gray-600 text-gray-300 font-bold hover:border-gray-400 transition-colors"
          :disabled="isSubmitting"
          @click="cancelConfirm"
        >
          戻る
        </button>
        <button
          type="button"
          data-testid="confirm-submit-button"
          :disabled="isSubmitting"
          class="flex-1 py-3 rounded font-bold text-white transition-colors"
          :class="!isSubmitting ? 'bg-main hover:opacity-90' : 'bg-gray-700 cursor-not-allowed opacity-50'"
          @click="submitScore"
        >
          {{ isSubmitting ? '送信中...' : 'この内容で送信' }}
        </button>
      </div>
    </div>

    <!-- 入力フォーム -->
    <form v-else data-testid="score-form" @submit.prevent="confirmScore">
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
        :disabled="!isValid || isAbsent"
        data-testid="submit-button"
        class="w-full py-3 rounded font-bold text-white transition-colors"
        :class="isValid && !isAbsent
          ? 'bg-main hover:opacity-90'
          : 'bg-gray-700 cursor-not-allowed opacity-50'"
      >
        確認する
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

const { matches, wins, view, isValid, isSubmitting, isAbsent, error, confirmScore, cancelConfirm, submitScore, editScore } =
  useScoreEntry()
</script>
