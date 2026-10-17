<script setup>
// TODO: Firebase Auth sign-up logic
import AppIcon from '@/components/AppIcon.vue'
</script>

<template>
  <main class="auth-page">
    <div class="auth-box">
      <div class="auth-logo">
        <AppIcon name="logo" :size="34" />
        <p class="auth-brand"><span>Co</span>Rent</p>
      </div>

      <h1 class="auth-title">Create your account</h1>
      <p class="auth-sub">Set your preferences once and find a flat your group agrees on.</p>

      <form class="auth-form" novalidate @submit.prevent>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" class="input" type="email" placeholder="you@example.com" autocomplete="email" />
          <!-- On error: add class "invalid" to the input and show <p class="field-error">…</p> -->
        </div>

        <div class="field">
          <label for="username">Username</label>
          <input id="username" class="input" type="text" placeholder="Choose a username" autocomplete="username" />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input id="password" class="input" type="password" placeholder="Create a password" autocomplete="new-password" />
          <p class="hint">At least 8 characters, one uppercase letter and one number.</p>
        </div>

        <div class="field">
          <label for="confirm">Confirm password</label>
          <input id="confirm" class="input" type="password" placeholder="Re-enter your password" autocomplete="new-password" />
        </div>

        <button class="btn btn-primary btn-block" type="submit">Create Account</button>
      </form>

      <p class="auth-foot">
        Already have an account?
        <router-link class="link" to="/login">Log in</router-link>
      </p>
    </div>
  </main>
</template>