<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4"
  >
    <div class="w-full max-w-sm bg-[#1a0a2e] border border-yellow-500/60 rounded-2xl p-8 text-center shadow-2xl">
      <!-- 大きな星アイコン -->
      <div class="flex justify-center mb-4">
        <StarIcon :size="56" class="text-yellow-400" />
      </div>

      <h2 class="text-2xl font-bold text-yellow-400 mb-4 tracking-wide">
        スター投票をしよう！
      </h2>
      <p class="text-gray-200 text-sm leading-relaxed mb-3">
        あなたにとってよかったと思うプレイヤーに<br>
        <span class="text-yellow-400 font-bold text-base">3つまでスターを配れます。</span>
      </p>
      <p class="text-gray-300 text-sm leading-relaxed mb-5">
        1人に全部渡す<span class="text-yellow-300 font-bold">全BETもOK！</span>
      </p>

      <div class="bg-white/5 rounded-lg p-3 mb-6 text-xs text-gray-400 text-left space-y-2">
        <!-- タップアイコン -->
        <p class="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400 shrink-0">
            <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/>
            <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"/>
            <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8"/>
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
          </svg>
          プレイヤー名をタップ → スター追加
        </p>
        <!-- スターアイコン -->
        <p class="flex items-center gap-2">
          <StarIcon :size="16" class="text-gray-400 shrink-0" />
          スターをタップ → 取り消し
        </p>
      </div>

      <button
        type="button"
        class="okei-btn w-full py-3 rounded-xl text-black bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 transition-colors"
        @click="$emit('close')"
      >
        おけーーーーーーーーーい‼️
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import StarIcon from './StarIcon.vue'

defineProps<{ visible: boolean }>()
defineEmits<{ close: [] }>()
</script>

<style scoped>
.okei-btn {
  font-family: 'Yuji Syuku', serif;
  font-size: 1.4rem;
}
</style>
