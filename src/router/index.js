import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '../views/LandingView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'
import PreferencesView from '../views/PreferencesView.vue'
import HomeView from '../views/HomeView.vue'
import ProfileView from '../views/ProfileView.vue'
import ListingsView from '../views/ListingsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Full-screen pages (no sidebar)
    { path: '/', name: 'landing', component: LandingView, meta: { bare: true } },
    { path: '/login', name: 'login', component: LoginView, meta: { bare: true } },
    { path: '/register', name: 'register', component: RegisterView, meta: { bare: true } },
    { path: '/forgot-password', name: 'forgot-password', component: ForgotPasswordView, meta: { bare: true } },
    { path: '/preferences', name: 'preferences', component: PreferencesView, meta: { bare: true } },

    // App pages (with sidebar)
    { path: '/home', name: 'home', component: HomeView },
    { path: '/profile', name: 'profile', component: ProfileView },
    { path: '/listings', name: 'listings', component: ListingsView },
  ],
})

export default router