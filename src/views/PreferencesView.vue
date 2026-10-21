<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseIcon from '@/components/profile/BaseIcon.vue'
import FieldMessage from '@/components/profile/FieldMessage.vue'
import PreferenceForm from '@/components/profile/PreferenceForm.vue'
import { normalizePreferences } from '@/components/profile/preferenceOptions'
import FlowTopBar from '@/components/FlowTopBar.vue'
import { getCurrentUser, onAuthChange } from '@/services/authService'
import { getPreferences, savePreferences } from '@/services/preferencesService'
import '@/components/profile/theme.css'

const route = useRoute()
const router = useRouter()
const editing = computed(() => route.query.edit === '1')
const loading = ref(true)
const saving = ref(false)
const loadFailed = ref(false)
const error = ref('')
const saved = ref(false)
const isNew = ref(false)
const userId = ref('')
const preferences = ref(normalizePreferences(null))
let unsubscribeAuth = null

const pageTitle = computed(() => (editing.value ? 'Edit Preferences' : 'My Preferences'))
const backTo = computed(() => (editing.value ? '/profile' : '/register'))

async function loadPreferences(uid) {
  loading.value = true
  loadFailed.value = false
  error.value = ''
  saved.value = false
  try {
    const existing = await getPreferences(uid)
    isNew.value = existing === null
    preferences.value = normalizePreferences(existing)
  } catch (loadError) {
    loadFailed.value = true
    error.value = loadError?.message || 'Unable to load your preferences. Please try again.'
  } finally {
    loading.value = false
  }
}

async function retryLoad() {
  const user = await getCurrentUser()
  if (!user) {
    router.replace({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  userId.value = user.uid
  await loadPreferences(user.uid)
}

async function onSave(values) {
  if (!userId.value) {
    error.value = 'Your session has expired. Please sign in again.'
    return
  }

  saving.value = true
  error.value = ''
  saved.value = false
  try {
    await savePreferences(userId.value, values)
    preferences.value = normalizePreferences(values)
    isNew.value = false
    saved.value = true
    if (!editing.value) await router.replace('/home')
  } catch (saveError) {
    error.value = saveError?.message || 'Unable to save your preferences. Please try again.'
  } finally {
    saving.value = false
  }
}

function onAuthChangeHandler(user) {
  if (!user) {
    userId.value = ''
    router.replace({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  if (user.uid !== userId.value) {
    userId.value = user.uid
    loadPreferences(user.uid)
  }
}

onMounted(async () => {
  const user = await getCurrentUser()
  if (!user) {
    router.replace({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  userId.value = user.uid
  await loadPreferences(user.uid)
  unsubscribeAuth = onAuthChange(onAuthChangeHandler)
})

onBeforeUnmount(() => unsubscribeAuth?.())
</script>

<template>
  <div class="preferences-page">
    <FlowTopBar :title="pageTitle" :back-to="backTo" />

    <main class="preferences-content">
      <p v-if="loading" class="page-status" role="status">Loading your preferences…</p>
      <section v-else-if="loadFailed" class="load-error" role="alert">
        <p>{{ error }}</p>
        <button type="button" class="btn" @click="retryLoad">Try again</button>
      </section>
      <template v-else>
        <p v-if="!editing && isNew" class="page-intro">
          Tell us what you’re looking for. Your group uses these preferences to find listings that
          work for everyone.
        </p>
        <div v-if="saved && editing" class="success-message" role="status">
          <span class="success-icon"><BaseIcon name="check" :size="16" /></span>
          <span>Updated!</span>
        </div>
        <FieldMessage v-if="error">{{ error }}</FieldMessage>
        <PreferenceForm
          :key="userId"
          :initial-values="preferences"
          :saving="saving"
          :submit-label="isNew ? 'Create Profile' : 'Update Preferences'"
          @save="onSave"
        />
      </template>
    </main>
  </div>
</template>

<style scoped>
.preferences-page {
  min-height: 100vh;
  background: var(--cr-bg);
}

.preferences-content {
  width: min(100% - 32px, 1080px);
  margin: 0 auto;
  padding: 20px 0 48px;
}

.page-intro,
.page-status {
  margin: 0 0 16px;
  color: var(--cr-muted);
  font-size: 13px;
}

.success-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  width: fit-content;
  margin: 0 auto 18px;
  padding: 10px 22px;
  border: 1px solid #a8d8bd;
  border-radius: 12px;
  background: var(--cr-success-soft);
  color: var(--cr-success);
  box-shadow: 0 2px 8px rgb(46 125 91 / 14%);
  font-size: 15px;
  font-weight: 700;
}

.success-icon {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--cr-success);
  color: #fff;
}

.load-error {
  display: grid;
  justify-items: start;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--cr-border);
  border-radius: var(--cr-radius-card);
  background: var(--cr-surface);
  color: var(--cr-error);
}

@media (max-width: 560px) {
  .preferences-content {
    width: min(100% - 24px, 1080px);
    padding-top: 14px;
  }
}
</style>
