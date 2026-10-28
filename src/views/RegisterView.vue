<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import FlowTopBar from '@/components/FlowTopBar.vue'
import { registerAccount, signInWithGoogle } from '@/services/authService'

const router = useRouter()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const emailRegistration = ref(false)
const submitAttempted = ref(false)
const submitting = ref(false)
const googleSignInPending = ref(false)
const submitError = ref('')

const isEmailValid = computed(() => {
  const emailValue = email.value.trim()

  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailValue)
})

const passwordCriteria = computed(() => [
  {
    label: 'At least 8 characters',
    met: password.value.length >= 8,
  },
  {
    label: 'At least 1 uppercase letter',
    met: /[A-Z]/.test(password.value),
  },
  {
    label: 'At least 1 number',
    met: /\d/.test(password.value),
  },
])

const isPasswordValid = computed(() =>
  passwordCriteria.value.every(({ met }) => met)
)

const passwordsMatch = computed(() =>
  password.value === confirmPassword.value
)

async function onSubmit() {
  submitAttempted.value = true
  submitError.value = ''
  name.value = name.value.trim()
  email.value = email.value.trim()

  if (
    !name.value ||
    !isEmailValid.value ||
    !isPasswordValid.value ||
    !passwordsMatch.value
  ) {
    return
  }

  submitting.value = true
  try {
    await registerAccount(name.value, email.value, password.value)
    await router.push('/preferences')
  } catch (error) {
    switch (error?.code) {
      case 'auth/email-already-in-use':
        submitError.value = 'An account already exists for this email. Log in instead.'
        break
      case 'auth/invalid-email':
        submitError.value = 'Enter a valid email address.'
        break
      case 'auth/weak-password':
        submitError.value = 'Choose a stronger password.'
        break
      case 'auth/network-request-failed':
        submitError.value = 'Network error. Check your connection and try again.'
        break
      default:
        submitError.value = error?.message || 'Unable to create your account. Please try again.'
    }
  } finally {
    submitting.value = false
  }
}

async function onGoogleSignIn() {
  submitError.value = ''
  submitting.value = true
  googleSignInPending.value = true
  try {
    await signInWithGoogle()
    await router.push('/preferences')
  } catch (error) {
    switch (error?.code) {
      case 'auth/popup-closed-by-user':
        submitError.value = 'Google sign-in was cancelled. Please try again.'
        break
      case 'auth/popup-blocked':
        submitError.value = 'Allow pop-ups to sign in with Google, then try again.'
        break
      case 'auth/account-exists-with-different-credential':
        submitError.value = 'An account already exists for this email. Log in with your existing method.'
        break
      case 'auth/operation-not-allowed':
        submitError.value = 'Google sign-in is not enabled for this app yet.'
        break
      case 'auth/network-request-failed':
        submitError.value = 'Network error. Check your connection and try again.'
        break
      default:
        submitError.value = error?.message || 'Unable to sign in with Google. Please try again.'
    }
  } finally {
    submitting.value = false
    googleSignInPending.value = false
  }
}
</script>

<template>
  <div class="flow">
    <FlowTopBar title="Create Account" back-to="/" />

    <main class="flow-body">
      <form class="narrow" novalidate @submit.prevent="onSubmit">
        <div class="logo">
          <AppIcon name="logo" :size="20" />
          <span class="word">
            Co<span class="red">Rent</span>
          </span>
        </div>

        <template v-if="!emailRegistration">
          <div class="auth-heading">
            <h1>Create Account</h1>
            <p>Choose how you’d like to get started.</p>
          </div>

          <div class="auth-methods">
            <button
              class="btn auth-provider auth-provider-google"
              type="button"
              :disabled="submitting"
              @click="onGoogleSignIn"
            >
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.65 5.93c4.47-4.13 7.13-10.2 7.13-17.58Z" />
                <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.87l-7.65-5.93c-2.13 1.43-4.86 2.3-8.25 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
              </svg>
              {{ submitting ? 'Connecting…' : 'Sign in with Google' }}
            </button>
            <button
              class="btn btn-primary auth-provider"
              type="button"
              :disabled="submitting"
              @click="emailRegistration = true"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 5h18v14H3z M3 6l9 7 9-7" />
              </svg>
              Sign in with email
            </button>
          </div>

          <p v-if="submitError" class="field-error" role="alert">{{ submitError }}</p>
          <p class="auth-foot">
            Already have an account?
            <router-link class="link" to="/login">
              Log in
            </router-link>
          </p>
        </template>

        <template v-else>
          <button
            class="link back-link"
            type="button"
            :disabled="submitting"
            @click="emailRegistration = false; submitError = ''; submitAttempted = false"
          >
            ← Choose another method
          </button>
          <h1 class="email-heading">Create account with email</h1>

          <div class="field">
            <label for="name">Name</label>

            <input
              id="name"
              v-model="name"
              class="input"
              type="text"
              placeholder="e.g. Alice Tan"
              autocomplete="name"
              required
            />
            <p v-if="submitAttempted && !name" class="field-error" role="alert">
              Enter your name.
            </p>
          </div>

          <div class="field">
            <label for="email">Email</label>

            <input
              id="email"
              v-model="email"
              class="input"
              :class="{ invalid: submitAttempted && !isEmailValid }"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
              :aria-describedby="submitAttempted && !isEmailValid ? 'email-error' : undefined"
              :aria-invalid="submitAttempted && !isEmailValid"
            />

            <p
              v-if="submitAttempted && !isEmailValid"
              id="email-error"
              class="field-error"
              role="alert"
            >
              Please enter a valid email address, such as you@example.com.
            </p>
          </div>

          <div class="field">
            <label for="password">Password</label>

            <input
              id="password"
              v-model="password"
              class="input"
              :class="{ invalid: submitAttempted && !isPasswordValid }"
              type="password"
              placeholder="Create a strong password"
              autocomplete="new-password"
              :aria-describedby="submitAttempted && !isPasswordValid ? 'password-criteria password-error' : 'password-criteria'"
              :aria-invalid="submitAttempted && !isPasswordValid"
            />

            <ul id="password-criteria" class="password-criteria" aria-label="Password requirements">
              <li
                v-for="criterion in passwordCriteria"
                :key="criterion.label"
                :class="{ 'criterion-met': criterion.met }"
              >
                {{ criterion.met ? 'Met' : 'Required' }}:
                {{ criterion.label }}
              </li>
            </ul>

            <p
              v-if="submitAttempted && !isPasswordValid"
              id="password-error"
              class="field-error"
              role="alert"
            >
              Meet all password requirements before continuing.
            </p>
          </div>

          <div class="field">
            <label for="confirm">Confirm password</label>

            <input
              id="confirm"
              v-model="confirmPassword"
              class="input"
              :class="{ invalid: submitAttempted && isPasswordValid && !passwordsMatch }"
              type="password"
              placeholder="Re-enter your password"
              autocomplete="new-password"
              :aria-describedby="submitAttempted && isPasswordValid && !passwordsMatch ? 'confirm-error' : undefined"
              :aria-invalid="submitAttempted && isPasswordValid && !passwordsMatch"
            />

            <p
              v-if="submitAttempted && isPasswordValid && !passwordsMatch"
              id="confirm-error"
              class="field-error"
              role="alert"
            >
              Passwords do not match.
            </p>
          </div>

          <p v-if="submitError" class="field-error" role="alert">{{ submitError }}</p>
          <button class="btn btn-primary btn-block" type="submit" :disabled="submitting">
            <span v-if="submitting" class="loading-spinner" aria-hidden="true" />
            {{ submitting ? 'Creating account…' : 'Create Account' }}
          </button>

          <p class="auth-foot">
            Already have an account?
            <router-link class="link" to="/login">
              Log in
            </router-link>
          </p>
        </template>
      </form>
    </main>

    <div v-if="googleSignInPending" class="auth-loading-overlay" role="status" aria-live="polite">
      <div class="auth-loading-card">
        <span class="loading-spinner loading-spinner-large" aria-hidden="true" />
        <p>Signing in with Google…</p>
        <span class="sr-only">Complete sign-in in the Google window.</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow {
  min-height: 100vh;
}

.flow-body {
  display: flex;
  justify-content: center;
  padding: 1.5rem 1.25rem 3rem;
}

.narrow {
  width: min(320px, 100%);
}

.auth-heading {
  margin-bottom: 1.2rem;
  text-align: center;
}

.auth-heading h1,
.email-heading {
  font-size: 18px;
}

.auth-heading p {
  margin-top: 0.35rem;
  color: var(--muted);
  font-size: 12px;
}

.auth-methods {
  display: grid;
  gap: 0.6rem;
}

.auth-provider {
  width: 100%;
  min-height: 44px;
  border-radius: 6px;
}

.auth-provider-google {
  --spinner-surface: #fff;
  background: #fff;
  border-color: var(--chip-line);
}

.auth-provider-google:hover {
  background: var(--soft);
}

.auth-provider svg {
  width: 17px;
  height: 17px;
}

.auth-provider-google svg {
  stroke: none;
}

.auth-provider:not(.auth-provider-google) svg {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.auth-provider:disabled,
button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.loading-spinner {
  display: inline-block;
  flex: none;
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-radius: 50%;
  background:
    linear-gradient(var(--spinner-surface, var(--red)), var(--spinner-surface, var(--red))) padding-box,
    conic-gradient(#4285f4, #34a853, #fbbc05, #ea4335, #4285f4) border-box;
  animation: loading-spin 0.8s linear infinite;
}

.auth-loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(22 22 22 / 42%);
}

.auth-loading-card {
  display: grid;
  justify-items: center;
  gap: 0.8rem;
  min-width: 220px;
  padding: 1.5rem;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--card);
  box-shadow: 0 8px 32px rgb(0 0 0 / 16%);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.loading-spinner-large {
  width: 36px;
  height: 36px;
  border-width: 4px;
  --spinner-surface: var(--card);
}

@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation: none;
  }
}

.back-link {
  margin-bottom: 0.9rem;
}

.email-heading {
  margin-bottom: 1rem;
}

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

.word {
  color: var(--text);
}

.password-criteria {
  margin: 0.45rem 0 0;
  padding-left: 1rem;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}

.password-criteria .criterion-met {
  color: #36734b;
}

.field-error {
  margin: 0.35rem 0 0;
  color: var(--red);
  font-size: 11px;
  line-height: 1.4;
}

.input.invalid {
  border-color: var(--red);
}
</style>