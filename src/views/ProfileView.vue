<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import AccountSettings from '../components/profile/AccountSettings.vue'
import BaseIcon from '../components/profile/BaseIcon.vue'
import PreferenceForm from '../components/profile/PreferenceForm.vue'
import ProfileSummary from '../components/profile/ProfileSummary.vue'
import { normalizePreferences } from '../components/profile/preferenceOptions'
import {
  deleteAccount,
  getCurrentUser,
  onAuthChange,
  signOutUser,
  usesPasswordSignIn,
} from '../services/authService'
import { getPreferences, savePreferences } from '../services/preferencesService'
import '../components/profile/theme.css'

const SAVE_TIMEOUT_MS = 15000
const TOAST_MS = 3500

const router = useRouter()

const user = shallowRef(null)
const status = ref('loading') // 'loading' | 'ready' | 'error'
const loadError = ref('')
const isNew = ref(false)
// What is stored in Firestore; resets the form when it changes.
const savedValues = ref(normalizePreferences(null))
// Latest form snapshot; drives the live summary.
const liveValues = ref(savedValues.value)
// Serialized form state at the last load/save, for unsaved-change detection.
const baseline = ref(null)

const saving = ref(false)
const signingOut = ref(false)
const deleting = ref(false)
const deleteError = ref('')
const toast = ref(null)
let toastTimer = null
let leavingIntentionally = false
let unsubscribeAuth = null
let unmounted = false
// Incremented per load so a slow response for a previous user is ignored.
let loadRequestId = 0

const isDirty = computed(
  () => baseline.value !== null && JSON.stringify(liveValues.value) !== baseline.value,
)

const saveStatus = computed(() => {
  if (status.value !== 'ready') return null
  if (isNew.value) return { tone: 'neutral', text: 'New profile' }
  if (isDirty.value) return { tone: 'warning', text: 'Unsaved changes' }
  return { tone: 'success', text: 'All changes saved' }
})

const requiresPassword = computed(() => usesPasswordSignIn(user.value))

function showToast(type, message) {
  clearTimeout(toastTimer)
  toast.value = { type, message }
  toastTimer = setTimeout(() => (toast.value = null), TOAST_MS)
}

function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function describeError(error) {
  switch (error?.code) {
    case 'permission-denied':
      return "You don't have permission to access these preferences. Please sign in again."
    case 'unavailable':
      return 'You appear to be offline. Check your connection and try again.'
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect password. Please try again.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Re-authentication was cancelled.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    default:
      return error?.message || 'Something went wrong. Please try again.'
  }
}

async function loadPreferences(uid) {
  const requestId = ++loadRequestId
  status.value = 'loading'
  try {
    const preferences = await getPreferences(uid)
    if (requestId !== loadRequestId) return
    isNew.value = preferences === null
    savedValues.value = normalizePreferences(preferences)
    baseline.value = null // captured from the form's first snapshot
    status.value = 'ready'
  } catch (error) {
    if (requestId !== loadRequestId) return
    loadError.value = describeError(error)
    status.value = 'error'
  }
}

function retryLoad() {
  if (user.value) loadPreferences(user.value.uid)
}

// Driven by onAuthStateChanged: (re)loads when the signed-in user changes and
// leaves the page if they sign out (e.g. in another tab).
function onUserChange(nextUser) {
  const previousUid = user.value?.uid
  user.value = nextUser
  if (!nextUser) {
    loadRequestId++
    if (!leavingIntentionally) {
      leavingIntentionally = true
      router.replace({ name: 'login', query: { redirect: '/profile' } })
    }
    return
  }
  if (nextUser.uid !== previousUid) loadPreferences(nextUser.uid)
}

function onFormChange(snapshot) {
  liveValues.value = snapshot
  if (baseline.value === null) baseline.value = JSON.stringify(snapshot)
}

async function onSave(data) {
  saving.value = true
  try {
    await withTimeout(
      savePreferences(user.value.uid, data),
      SAVE_TIMEOUT_MS,
      'Saving is taking too long. Check your connection and try again.',
    )
    const created = isNew.value
    isNew.value = false
    baseline.value = JSON.stringify(data)
    savedValues.value = data
    showToast('success', created ? 'Your preference profile has been created' : 'Preferences saved')
  } catch (error) {
    showToast('error', describeError(error))
  } finally {
    saving.value = false
  }
}

async function onSignOut() {
  if (isDirty.value && !window.confirm('You have unsaved changes. Sign out without saving?')) return
  signingOut.value = true
  leavingIntentionally = true
  try {
    await signOutUser()
    router.replace({ name: 'login' })
  } catch (error) {
    leavingIntentionally = false
    showToast('error', describeError(error))
  } finally {
    signingOut.value = false
  }
}

async function onDeleteAccount(password) {
  deleting.value = true
  deleteError.value = ''
  leavingIntentionally = true
  try {
    await deleteAccount(password)
    router.replace({ name: 'home' })
  } catch (error) {
    leavingIntentionally = false
    deleteError.value = describeError(error)
  } finally {
    deleting.value = false
  }
}

function goBack() {
  if (window.history.state?.back) router.back()
  else router.push({ name: 'home' })
}

function onBeforeUnload(event) {
  if (isDirty.value) event.preventDefault()
}

onBeforeRouteLeave(() => {
  if (leavingIntentionally || !isDirty.value) return true
  return window.confirm('You have unsaved changes. Leave without saving?')
})

onMounted(async () => {
  window.addEventListener('beforeunload', onBeforeUnload)
  // Wait for the restored session (and dev test sign-in) before subscribing,
  // so the first auth event isn't a transient "signed out".
  await getCurrentUser()
  if (unmounted) return
  unsubscribeAuth = onAuthChange(onUserChange)
})

onBeforeUnmount(() => {
  unmounted = true
  unsubscribeAuth?.()
  window.removeEventListener('beforeunload', onBeforeUnload)
  clearTimeout(toastTimer)
})
</script>

<template>
  <div class="profile-page">
    <header class="topbar">
      <div class="topbar__inner">
        <button type="button" class="back-btn" aria-label="Go back" @click="goBack">
          <BaseIcon name="chevron-left" :size="18" />
        </button>
        <h1 class="topbar__title">{{ isNew ? 'Create Your Preferences' : 'My Preferences' }}</h1>
        <span v-if="saveStatus" class="status-chip" :class="`status-chip--${saveStatus.tone}`">
          <span class="status-chip__dot" aria-hidden="true" />
          {{ saveStatus.text }}
        </span>
      </div>
    </header>

    <!-- Loading skeleton -->
    <div
      v-if="status === 'loading'"
      class="layout"
      aria-busy="true"
      aria-label="Loading preferences"
    >
      <div class="column">
        <div v-for="n in 5" :key="n" class="skeleton-card">
          <span class="skeleton skeleton--title" />
          <span class="skeleton skeleton--bar" />
          <span class="skeleton skeleton--short" />
        </div>
      </div>
      <div class="sidebar">
        <div class="skeleton-card skeleton-card--tall">
          <span v-for="n in 7" :key="n" class="skeleton skeleton--row" />
        </div>
      </div>
    </div>

    <!-- Load error -->
    <div v-else-if="status === 'error'" class="layout layout--single">
      <div class="message-card" role="alert">
        <BaseIcon name="alert-circle" :size="22" />
        <h2>We couldn't load your preferences</h2>
        <p>{{ loadError }}</p>
        <button type="button" class="btn-secondary" @click="retryLoad">Try again</button>
      </div>
    </div>

    <div v-else class="layout">
      <div class="column">
        <div v-if="isNew" class="intro">
          <h2>Set up your rental preference profile</h2>
          <p>
            Tell us what you're looking for. Your group uses these preferences to find listings that
            work for everyone, and you can edit them any time.
          </p>
        </div>
        <PreferenceForm
          :initial-values="savedValues"
          :saving="saving"
          :submit-label="isNew ? 'Create Profile' : 'Save Preferences'"
          @change="onFormChange"
          @save="onSave"
        />
      </div>

      <div class="sidebar">
        <ProfileSummary :preferences="liveValues" />
        <AccountSettings
          :email="user?.email ?? ''"
          :requires-password="requiresPassword"
          :deleting="deleting"
          :delete-error="deleteError"
          :signing-out="signingOut"
          @sign-out="onSignOut"
          @delete-account="onDeleteAccount"
          @dismiss-error="deleteError = ''"
        />
      </div>
    </div>

    <Transition name="toast">
      <div
        v-if="toast"
        class="toast"
        :class="`toast--${toast.type}`"
        :role="toast.type === 'error' ? 'alert' : 'status'"
      >
        <BaseIcon :name="toast.type === 'error' ? 'alert-circle' : 'check'" :size="16" />
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: var(--cr-bg);
  font-family: var(--cr-font);
  color: var(--cr-text);
}

/* Top bar */
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--cr-surface);
  border-bottom: 1px solid var(--cr-border);
}
.topbar__inner {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 1080px;
  height: 56px;
  margin: 0 auto;
  padding: 0 24px;
}
.topbar__title {
  flex: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}
.back-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-left: -8px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--cr-text);
  cursor: pointer;
}
.back-btn:hover {
  background: #f2f2f2;
}
.back-btn:focus-visible {
  outline: none;
  box-shadow: var(--cr-focus-ring);
}
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
}
.status-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.status-chip--neutral {
  background: #efefef;
  color: var(--cr-muted);
}
.status-chip--warning {
  background: var(--cr-warning-soft);
  color: var(--cr-warning);
}
.status-chip--success {
  background: var(--cr-success-soft);
  color: var(--cr-success);
}

/* Layout */
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: start;
  gap: 20px;
  max-width: 1080px;
  margin: 0 auto;
  padding: 20px 24px 0;
}
.layout--single {
  grid-template-columns: minmax(0, 520px);
  justify-content: center;
  padding-top: 48px;
}
.column {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sidebar {
  position: sticky;
  top: 76px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
@media (max-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
    padding: 16px 16px 0;
  }
  .sidebar {
    position: static;
    padding-bottom: 24px;
  }
  .topbar__inner {
    padding: 0 16px;
  }
}

.intro {
  padding: 16px 18px;
  border-radius: var(--cr-radius-card);
  background: linear-gradient(135deg, var(--cr-accent) 0%, var(--cr-accent-hover) 100%);
  color: #fff;
}
.intro h2 {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 700;
}
.intro p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  opacity: 0.92;
}

/* Error state */
.message-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 24px;
  border: 1px solid var(--cr-border);
  border-radius: var(--cr-radius-card);
  background: var(--cr-surface);
  text-align: center;
  color: var(--cr-error);
}
.message-card h2 {
  margin: 4px 0 0;
  font-size: 16px;
  color: var(--cr-text);
}
.message-card p {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--cr-muted);
}
.btn-secondary {
  height: 36px;
  padding: 0 18px;
  border: none;
  border-radius: 8px;
  background: var(--cr-accent);
  color: #fff;
  font: 600 13px var(--cr-font);
  cursor: pointer;
}

/* Skeleton */
.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--cr-border);
  border-radius: var(--cr-radius-card);
  background: var(--cr-surface);
}
.skeleton {
  display: block;
  height: 10px;
  border-radius: 6px;
  background: linear-gradient(90deg, #eee 25%, #f6f6f6 50%, #eee 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}
.skeleton--title {
  width: 30%;
  height: 12px;
}
.skeleton--bar {
  width: 100%;
  height: 6px;
}
.skeleton--short {
  width: 18%;
}
.skeleton--row:nth-child(odd) {
  width: 80%;
}
@keyframes shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

/* Toast */
.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 16px;
  border-radius: 10px;
  background: var(--cr-dark);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 8px 24px rgb(0 0 0 / 20%);
  transform: translateX(-50%);
}
.toast--success .base-icon {
  color: #5ee59a;
}
.toast--error {
  background: var(--cr-error);
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
