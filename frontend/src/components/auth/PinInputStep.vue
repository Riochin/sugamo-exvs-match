<template>
  <div class="flex flex-col gap-6 p-4">
    <div class="text-center">
      <p class="text-sm text-gray-400">プレイヤー</p>
      <p class="text-xl font-bold text-white">{{ playerName }}</p>
    </div>

    <div class="flex justify-center gap-3">
      <input
        v-for="(_, i) in pins"
        :key="i"
        :ref="(el) => setInputRef(el as HTMLInputElement | null, i)"
        :value="pins[i]"
        :disabled="isSubmitting"
        inputmode="numeric"
        pattern="\d"
        maxlength="1"
        autocomplete="off"
        class="h-14 w-12 rounded-lg border border-base-600 bg-base-800 text-center text-2xl text-white focus:border-accent focus:outline-none disabled:opacity-50"
        @input="onInput(i, $event)"
        @keydown="onKeydown(i, $event)"
      />
    </div>

    <div v-if="isSubmitting" data-testid="submitting-indicator" class="flex justify-center">
      <div class="h-6 w-6 animate-spin rounded-full border-4 border-accent border-t-transparent" />
    </div>

    <p
      v-if="error !== null"
      data-testid="error-message"
      class="text-center text-sm text-red-400"
    >
      {{ error }}
    </p>

    <button
      data-testid="back-button"
      class="w-full rounded-lg border border-base-600 py-3 text-gray-300"
      @click="emit('back')"
    >
      戻る
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  playerName: string
  isSubmitting: boolean
  error: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  submit: [pin: string]
  back: []
}>()

const pins = ref<string[]>(['', '', '', ''])
const inputRefs: (HTMLInputElement | null)[] = [null, null, null, null]

function setInputRef(el: HTMLInputElement | null, i: number) {
  inputRefs[i] = el
}

function onInput(index: number, event: Event) {
  const target = event.target as HTMLInputElement
  const val = target.value.replace(/\D/g, '').slice(-1)
  pins.value[index] = val
  target.value = val

  if (val && index < 3) {
    inputRefs[index + 1]?.focus()
  }

  if (pins.value.every((p) => p.length === 1)) {
    emit('submit', pins.value.join(''))
  }
}

function onKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !pins.value[index] && index > 0) {
    inputRefs[index - 1]?.focus()
  }
}

// error が変わった（非null になった）ときにPINをリセット
watch(
  () => props.error,
  (newError) => {
    if (newError !== null) {
      pins.value = ['', '', '', '']
      inputRefs.forEach((el) => {
        if (el) el.value = ''
      })
      inputRefs[0]?.focus()
    }
  },
)
</script>
