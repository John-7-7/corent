<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import FlowTopBar from '@/components/FlowTopBar.vue'
import { registerAccount } from '@/services/authService'

const router = useRouter()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const submitAttempted = ref(false)
const submitting = ref(false)
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

function onSubmit() {
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
  registerAccount(name.value, email.value, password.value)
    .then(() => router.push('/preferences'))
    .catch((error) => {
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
    })
    .finally(() => {
      submitting.value = false
    })
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

        <div class="field">
          <label for="username">Name</label>

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
            :aria-describedby="
              submitAttempted && !isEmailValid
                ? 'email-error'
                : undefined
            "
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
            :aria-describedby="
              submitAttempted && !isPasswordValid
                ? 'password-criteria password-error'
                : 'password-criteria'
            "
            :aria-invalid="submitAttempted && !isPasswordValid"
          />

          <ul
            id="password-criteria"
            class="password-criteria"
            aria-label="Password requirements"
          >
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
            :class="{
              invalid:
                submitAttempted &&
                isPasswordValid &&
                !passwordsMatch
            }"
            type="password"
            placeholder="Re-enter your password"
            autocomplete="new-password"
            :aria-describedby="
              submitAttempted &&
              isPasswordValid &&
              !passwordsMatch
                ? 'confirm-error'
                : undefined
            "
            :aria-invalid="
              submitAttempted &&
              isPasswordValid &&
              !passwordsMatch
            "
          />

          <p
            v-if="
              submitAttempted &&
              isPasswordValid &&
              !passwordsMatch
            "
            id="confirm-error"
            class="field-error"
            role="alert"
          >
            Passwords do not match.
          </p>
        </div>

        <p v-if="submitError" class="field-error" role="alert">{{ submitError }}</p>
        <button class="btn btn-primary btn-block" type="submit" :disabled="submitting">
          {{ submitting ? 'Creating account…' : 'Create Account' }}
        </button>

        <p class="auth-foot">
          Already have an account?
          <router-link class="link" to="/login">
            Log in
          </router-link>
        </p>
      </form>
    </main>
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

.invalid {
  border-color: var(--red);
}

button:disabled {
  cursor: wait;
  opacity: 0.7;
}
</style>