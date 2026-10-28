import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '../views/LandingView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'
import PreferencesView from '../views/PreferencesView.vue'
import HomeView from '../views/HomeView.vue'
import ProfileView from '../views/ProfileView.vue'
import ListingsView from '../views/ListingsView.vue'
import { getCurrentUser } from '../services/authService'
import GroupSummaryView from '../views/GroupSummaryView.vue' 
import ShortlistView from '../views/ShortlistView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Full-screen pages (no sidebar)
    { path: '/', name: 'landing', component: LandingView, meta: { bare: true } },
    { path: '/login', name: 'login', component: LoginView, meta: { bare: true } },
    { path: '/register', name: 'register', component: RegisterView, meta: { bare: true } },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: ForgotPasswordView,
      meta: { bare: true },
    },
    {
      path: '/preferences',
      name: 'preferences',
      component: PreferencesView,
      meta: { bare: true, requiresAuth: true },
    },

    // App pages (with sidebar)
    { path: '/home', name: 'home', component: HomeView },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
      meta: { requiresAuth: true },
    },
    { path: '/listings', name: 'listings', component: ListingsView },
    { path: '/group-summary', name: 'group summary', component: GroupSummaryView},
    { path: '/shortlist', name: 'shortlist', component: ShortlistView} //i removed the meta: { requiresAuth: true } from this route to allow access without authentication for now so we can see the layout for all
    //later we can add it back in once we have the authentication flow set up -yp
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
