<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { signInUser } from '@/services/authService'

const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

function describeError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email or password is incorrect.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait and try again.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    default:
      return 'Unable to log in. Please try again.'
  }
}

async function onSubmit() {
  error.value = ''
  submitting.value = true
  try {
    await signInUser(email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/home'
    await router.replace(redirect)
  } catch (err) {
    error.value = describeError(err?.code)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <div class="auth-box">
      <div class="auth-logo">
        <AppIcon name="logo" :size="34" />
        <p class="auth-brand">Co<span>Rent</span></p>
      </div>

      <h1 class="auth-title">Welcome back</h1>
      <p class="auth-sub">Log in to continue your flat hunt.</p>

      <form class="auth-form" novalidate @submit.prevent="onSubmit">
        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            class="input"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
          />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            class="input"
            type="password"
            placeholder="Your password"
            autocomplete="current-password"
            required
          />
        </div>

        <router-link class="link" to="/forgot-password">Forgot password?</router-link>

        <p v-if="error" class="field-error" role="alert">{{ error }}</p>
        <button class="btn btn-primary btn-block" type="submit" :disabled="submitting">
          {{ submitting ? 'Logging in…' : 'Log In' }}
        </button>
      </form>

      <p class="auth-foot">
        Don't have an account?
        <router-link class="link" to="/register">Sign up</router-link>
      </p>
    </div>
  </main>
</template>

<style scoped>
.field-error {
  margin: 0;
  color: var(--red);
  font-size: 12px;
}

button:disabled {
  cursor: wait;
  opacity: 0.7;
}
</style>
