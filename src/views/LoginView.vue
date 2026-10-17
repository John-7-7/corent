<script setup>
import AppIcon from '@/components/AppIcon.vue'
// TODO: Firebase Auth sign-in logic
</script>

<template>
  <main class="auth-page">
    <div class="auth-box">
      <div class="auth-logo">
        <AppIcon name="logo" :size="34" />
        <p class="auth-brand"><span>Co</span>Rent</p>
      </div>

      <h1 class="auth-title">Welcome back</h1>
      <p class="auth-sub">Log in to continue your flat hunt.</p>

      <form class="auth-form" novalidate @submit.prevent>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" class="input" type="email" placeholder="you@example.com" autocomplete="email" />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input id="password" class="input" type="password" placeholder="Your password" autocomplete="current-password" />
        </div>

        <router-link class="link" to="/forgot-password">Forgot password?</router-link>

        <button class="btn btn-primary btn-block" type="submit">Log In</button>
      </form>

      <p class="auth-foot">
        Don't have an account?
        <router-link class="link" to="/register">Sign up</router-link>
      </p>
    </div>
  </main>
</template>