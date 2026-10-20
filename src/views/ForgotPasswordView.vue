<script setup>
import AppIcon from '@/components/AppIcon.vue'
</script>

<template>
  <main class="auth-page">
    <div class="auth-box">
      <div class="auth-logo">
        <AppIcon name="logo" :size="34" />
        <p class="auth-brand"><span>Co</span>Rent</p>
      </div>

      <h1 class="auth-title">Reset your password</h1>
      <p class="auth-sub">Enter your email and we'll send you a link to choose a new password.</p>

      <form class="auth-form" novalidate @submit.prevent>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" class="input" type="email" placeholder="you@example.com" autocomplete="email" />
        </div>

        <button class="btn btn-primary btn-block" type="submit">Send Reset Link</button>
      </form>

      <p class="auth-foot">
        <router-link class="link" to="/login">Back to log in</router-link>
      </p>
    </div>
  </main>
</template>