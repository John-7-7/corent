import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { getCurrentUser } from '../services/authService'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/listings',
      name: 'listings',
      component: () => import('../views/ListingsView.vue'),
    },
  ],
})

// Shared auth guard: add `meta: { requiresAuth: true }` to any route that needs
// a signed-in user. Waits for Firebase to restore the session before deciding.
router.beforeEach(async (to) => {
  if (!to.matched.some((record) => record.meta.requiresAuth)) return true
  const user = await getCurrentUser()
  if (user) return true
  return { name: 'login', query: { redirect: to.fullPath } }
})

export default router
