import { createRouter, createWebHistory } from 'vue-router'
import TournamentView from '@/views/TournamentView.vue'
import GroupView from '@/views/GroupView.vue'
import ProfileView from '@/views/ProfileView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: TournamentView },
    { path: '/group', component: GroupView },
    { path: '/profile', component: ProfileView },
  ],
})
