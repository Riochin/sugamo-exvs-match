<template>
  <BottomSheet :visible="visible" title="スコア入力" @close="emit('close')">
    <div class="px-4 py-4">
      <ScoreEntryPanel :event-id="eventId" :progress-update="progressUpdate" />
    </div>
  </BottomSheet>
</template>

<script setup lang="ts">
import BottomSheet from '@/components/ui/BottomSheet.vue'
import ScoreEntryPanel from '@/components/score/ScoreEntryPanel.vue'
import type { ProgressUpdatePayload } from '@/composables/useEventStream'

defineProps<{
  eventId: string
  visible: boolean
  progressUpdate: ProgressUpdatePayload | null
}>()

const emit = defineEmits<{
  close: []
}>()
</script>
