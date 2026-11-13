<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { signInUser } from '@/services/authService'

const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
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
  <main class="login-page">
    <div class="login-shell">
      <section class="login-visual" aria-label="Find a home to share">
        <img
          class="login-photo"
          src="/images/login-bedroom.png"
          alt="A bright bedroom with a blue duvet, large windows, and a desk"
        />
        <div class="visual-shade" />
        <router-link to="/" class="visual-brand" aria-label="CoRent home">
          <AppIcon name="logo" :size="28" />
          <span>CoRent</span>
        </router-link>
        <div class="visual-copy">
          <p class="visual-kicker">A place for everyone</p>
          <h2>Find a home<br />that feels like yours.</h2>
          <p>Good things start with finding the right place, together.</p>
        </div>
        <span class="visual-mark visual-mark-one" aria-hidden="true" />
        <span class="visual-mark visual-mark-two" aria-hidden="true" />
      </section>

      <section class="login-panel">
        <div class="login-form-wrap">
          <router-link to="/" class="mobile-brand" aria-label="CoRent home">
            <AppIcon name="logo" :size="24" />
            <span>CoRent</span>
          </router-link>
          <p class="form-kicker">Welcome back</p>
          <h1>Log in to CoRent</h1>
          <p class="form-subtitle">Pick up where you left off in your home search.</p>

          <form class="login-form" novalidate @submit.prevent="onSubmit">
            <div class="field">
              <label for="email">Email address</label>
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
              <div class="password-label">
                <label for="password">Password</label>
                <router-link class="link" to="/forgot-password">Forgot password?</router-link>
              </div>
              <div class="password-input-wrap">
                <input
                  id="password"
                  v-model="password"
                  class="input"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Enter your password"
                  autocomplete="current-password"
                  required
                />
                <button
                  class="password-visibility"
                  type="button"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  :aria-pressed="showPassword"
                  @click="showPassword = !showPassword"
                >
                  <AppIcon :name="showPassword ? 'eye-off' : 'eye'" :size="18" />
                </button>
              </div>
            </div>

            <p v-if="error" class="field-error" role="alert">{{ error }}</p>
            <button class="btn btn-primary btn-block login-submit" type="submit" :disabled="submitting">
              {{ submitting ? 'Logging in…' : 'Log in' }}
            </button>
          </form>

          <p class="auth-foot">
            New to CoRent?
            <router-link class="link" to="/register">Create an account</router-link>
          </p>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: clamp(16px, 4vw, 48px);
  background:
    radial-gradient(ellipse at 12% 18%, rgb(123 140 240 / 19%), transparent 34rem),
    radial-gradient(ellipse at 88% 84%, rgb(245 196 107 / 18%), transparent 30rem),
    var(--bg);
}

.login-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(390px, 0.95fr);
  width: min(1120px, 100%);
  min-height: min(690px, calc(100vh - 64px));
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 80%);
  border-radius: 30px;
  background: rgb(255 255 255 / 82%);
  box-shadow: 0 28px 80px rgb(42 45 62 / 13%);
  backdrop-filter: var(--glass-blur);
}

.login-visual {
  position: relative;
  display: flex;
  min-height: 560px;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  padding: clamp(28px, 4vw, 52px);
  color: #fff;
  background: var(--red-dark);
}

.login-photo,
.visual-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.login-photo {
  object-fit: cover;
}

.visual-shade {
  background:
    linear-gradient(180deg, rgb(38 32 91 / 35%) 0%, rgb(45 37 113 / 20%) 42%, rgb(35 31 82 / 80%) 100%),
    linear-gradient(120deg, rgb(90 70 198 / 25%), transparent 70%);
}

.visual-brand,
.visual-copy,
.visual-mark {
  position: relative;
  z-index: 1;
}

.visual-brand,
.mobile-brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  width: fit-content;
  color: inherit;
  font-size: 17px;
  font-weight: 800;
  text-decoration: none;
}

.visual-copy {
  max-width: 430px;
}

.visual-kicker,
.form-kicker {
  margin: 0 0 12px;
  color: var(--highlight);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.visual-copy h2 {
  margin: 0;
  font-size: clamp(32px, 4vw, 48px);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.04em;
}

.visual-copy > p:last-child {
  max-width: 31ch;
  margin: 16px 0 0;
  color: rgb(255 255 255 / 84%);
  font-size: 14px;
  line-height: 1.65;
}

.visual-mark {
  position: absolute;
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 50%;
}

.visual-mark-one {
  top: 24%;
  right: -72px;
  width: 220px;
  height: 220px;
}

.visual-mark-two {
  right: 12%;
  bottom: 10%;
  width: 76px;
  height: 76px;
  background: rgb(245 196 107 / 18%);
}

.login-panel {
  display: grid;
  place-items: center;
  padding: clamp(32px, 6vw, 76px);
}

.login-form-wrap {
  width: min(100%, 390px);
}

.mobile-brand {
  display: none;
  margin-bottom: 36px;
  color: var(--red);
}

.form-kicker {
  margin-bottom: 8px;
  color: var(--red-dark);
}

.login-panel h1 {
  margin: 0;
  color: var(--text);
  font-size: clamp(28px, 3vw, 36px);
  font-weight: 700;
  letter-spacing: -0.04em;
}

.form-subtitle {
  margin: 10px 0 34px;
  color: #777b91;
  font-size: 14px;
  line-height: 1.6;
}

.login-form .field {
  margin-bottom: 22px;
}

.login-form .field label {
  margin-bottom: 8px;
  color: #55596f;
  font-size: 12px;
  letter-spacing: 0.01em;
  text-transform: none;
}

.login-form .input {
  min-height: 48px;
  border-color: rgb(93 103 151 / 20%);
  border-radius: 12px;
  background: rgb(255 255 255 / 72%);
}

.login-form .input:focus {
  border-color: var(--red);
  outline: none;
  box-shadow: 0 0 0 3px rgb(123 140 240 / 16%);
}

.password-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.password-label .link {
  margin: 0;
  font-size: 12px;
}

.password-input-wrap {
  position: relative;
}

.password-input-wrap .input {
  padding-right: 48px;
}

.password-visibility {
  position: absolute;
  top: 50%;
  right: 10px;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #777b91;
  cursor: pointer;
  transform: translateY(-50%);
}

.password-visibility:hover {
  color: var(--red);
}

.password-visibility:focus-visible {
  outline: 2px solid var(--red);
  outline-offset: 1px;
}

.field-error {
  margin: -6px 0 14px;
  color: var(--error);
  font-size: 12px;
}

.login-submit {
  min-height: 48px;
  margin-top: 4px;
  border-radius: 12px;
  box-shadow: 0 8px 18px rgb(123 140 240 / 23%);
}

.auth-foot {
  margin-top: 24px;
  font-size: 13px;
  color: #777b91;
}

.auth-foot .link {
  margin-left: 3px;
  font-size: 13px;
}

button:disabled {
  cursor: wait;
  opacity: 0.7;
}

@media (max-width: 760px) {
  .login-page {
    padding: 14px;
  }

  .login-shell {
    grid-template-columns: 1fr;
    min-height: 0;
    max-width: 520px;
    border-radius: 24px;
  }

  .login-visual {
    display: none;
  }

  .login-panel {
    padding: clamp(28px, 8vw, 48px);
  }

  .mobile-brand {
    display: inline-flex;
  }

  .form-subtitle {
    margin-bottom: 28px;
  }
}
</style>
