import { createRouter, createWebHistory } from 'vue-router'
import TournamentView from '@/views/TournamentView.vue'
import GroupView from '@/views/GroupView.vue'
import ProfileView from '@/views/ProfileView.vue'
import LoginView from '@/views/LoginView.vue'
import AdminView from '@/views/AdminView.vue'
import { useAuth } from '@/composables/useAuth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresAdmin?: boolean
    layout?: 'default' | 'plain'
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { requiresAuth: false, layout: 'plain' } },
    { path: '/', component: TournamentView, meta: { requiresAuth: true } },
    { path: '/group', component: GroupView, meta: { requiresAuth: true } },
    { path: '/profile/:id', component: ProfileView, meta: { requiresAuth: true } },
    { path: '/admin', component: AdminView, meta: { requiresAuth: true, requiresAdmin: true } },
  ],
})

let sessionRestored = false

router.beforeEach(async (to) => {
  const { isAuthenticated, isLoading, currentPlayer, restoreSession } = useAuth()

  if (!sessionRestored) {
    sessionRestored = true
    await restoreSession()
    while (isLoading.value) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }

  if (to.meta.requiresAuth === true && !isAuthenticated.value) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresAdmin === true && !currentPlayer.value?.isAdmin) {
    return { path: '/' }
  }

  if (to.path === '/login' && isAuthenticated.value) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/'
    return { path: redirect }
  }
})
