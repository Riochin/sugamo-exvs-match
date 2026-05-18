<template>
  <AppLayout v-if="route.meta.layout !== 'plain'">
    <RouterView />
  </AppLayout>
  <RouterView v-else />
  <DevImpersonatePanel v-if="isDev" />
  <DevUIPanel v-if="isDev" />
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import DevImpersonatePanel from '@/components/dev/DevImpersonatePanel.vue'
import DevUIPanel from '@/components/dev/DevUIPanel.vue'

const route = useRoute()
const isDev = import.meta.env.DEV
</script>
