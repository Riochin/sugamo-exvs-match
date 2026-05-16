<template>
  <AppLayout v-if="route.meta.layout !== 'plain'">
    <RouterView />
  </AppLayout>
  <RouterView v-else />
  <DevImpersonatePanel v-if="isDev" />
  <DevUIPanel v-if="isDev" />
  <AdminButton v-if="currentPlayer?.isAdmin" />
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import DevImpersonatePanel from '@/components/dev/DevImpersonatePanel.vue'
import DevUIPanel from '@/components/dev/DevUIPanel.vue'
import AdminButton from '@/components/admin/AdminButton.vue'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const isDev = import.meta.env.DEV
const { currentPlayer } = useAuth()
</script>
