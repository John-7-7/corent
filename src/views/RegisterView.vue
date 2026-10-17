<script setup>
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import FlowTopBar from '@/components/FlowTopBar.vue'

const router = useRouter()

// Prototype navigation only. Logic layer replaces this with real account creation.
function onSubmit() {
  router.push('/preferences')
}
</script>

<template>
  <div class="flow">
    <FlowTopBar title="Create Account" back-to="/" />

    <main class="flow-body">
      <form class="narrow" novalidate @submit.prevent="onSubmit">
        <div class="logo">
          <AppIcon name="logo" :size="20" />
          <span class="word">Co<span class="red">Rent</span></span>
        </div>

        <div class="field">
          <label for="username">Username</label>
          <input id="username" class="input" type="text" placeholder="e.g. alice_tan" autocomplete="username" />
        </div>

        <div class="field">
          <label for="email">Email</label>
          <input id="email" class="input" type="email" placeholder="you@example.com" autocomplete="email" />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input id="password" class="input" type="password" placeholder="Create a strong password" autocomplete="new-password" />
        </div>

        <div class="field">
          <label for="confirm">Confirm password</label>
          <input id="confirm" class="input" type="password" placeholder="Re-enter your password" autocomplete="new-password" />
        </div>

        <button class="btn btn-primary btn-block" type="submit">Create Account</button>

        <p class="auth-foot">
          Already have an account?
          <router-link class="link" to="/login">Log in</router-link>
        </p>
      </form>
    </main>
  </div>
</template>

<style scoped>
.flow { min-height: 100vh; }
.flow-body { display: flex; justify-content: center; padding: 1.5rem 1.25rem 3rem; }
.narrow { width: min(320px, 100%); }
.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-bottom: 1.5rem;
  color: var(--red);
  font-size: 11px;
  font-weight: 700;
}
.word { color: var(--text); }
</style>