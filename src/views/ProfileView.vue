<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseIcon from '../components/profile/BaseIcon.vue'
import DeleteAccountDialog from '../components/profile/DeleteAccountDialog.vue'
import FieldMessage from '../components/profile/FieldMessage.vue'
import {
  changeAccountPassword,
  deleteAccount,
  getCurrentUser,
  onAuthChange,
  signOutUser,
  updateAccountName,
  usesPasswordSignIn,
} from '../services/authService'
import '../components/profile/theme.css'

const router = useRouter()
const user = ref(null)
const profileName = ref('')
const nameDialogOpen = ref(false)
const passwordDialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const signOutDialogOpen = ref(false)
const name = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const nameError = ref('')
const passwordError = ref('')
const deleteError = ref('')
const actionError = ref('')
const savingName = ref(false)
const changingPassword = ref(false)
const deleting = ref(false)
const signingOut = ref(false)
let unsubscribeAuth = null

const displayName = computed(
  () =>
    profileName.value ||
    user.value?.displayName ||
    user.value?.email?.split('@')[0] ||
    'CoRent member',
)
const initials = computed(() => {
  const parts = displayName.value.trim().split(/\s+/).filter(Boolean)
  return parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : displayName.value.slice(0, 2).toUpperCase()
})
const passwordAccount = computed(() => usesPasswordSignIn(user.value))

function describeError(error) {
  switch (error?.code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'The current password is incorrect.'
    case 'auth/weak-password':
      return 'Choose a stronger password and try again.'
    case 'auth/requires-recent-login':
      return 'Please sign out and sign in again before changing this setting.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    case 'permission-denied':
      return "You don't have permission to delete this data. Please sign in again."
    case 'unavailable':
      return 'You appear to be offline. Check your connection and try again.'
    default:
      return error?.message || 'Something went wrong. Please try again.'
  }
}

function openNameDialog() {
  name.value = displayName.value
  nameError.value = ''
  nameDialogOpen.value = true
}

async function saveName() {
  nameError.value = ''
  savingName.value = true
  try {
    await updateAccountName(name.value)
    profileName.value = name.value.trim()
    nameDialogOpen.value = false
  } catch (error) {
    nameError.value = describeError(error)
  } finally {
    savingName.value = false
  }
}

async function savePassword() {
  passwordError.value = ''
  if (newPassword.value.length < 8 || !/[A-Z]/.test(newPassword.value) || !/\d/.test(newPassword.value)) {
    passwordError.value = 'Use at least 8 characters, including an uppercase letter and a number.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'The new passwords do not match.'
    return
  }

  changingPassword.value = true
  try {
    await changeAccountPassword(currentPassword.value, newPassword.value)
    passwordDialogOpen.value = false
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (error) {
    passwordError.value = describeError(error)
  } finally {
    changingPassword.value = false
  }
}

async function onSignOut() {
  actionError.value = ''
  signingOut.value = true
  try {
    await signOutUser()
    signOutDialogOpen.value = false
    await router.replace({ name: 'login' })
  } catch (error) {
    actionError.value = describeError(error)
  } finally {
    signingOut.value = false
  }
}

async function onDeleteAccount(password) {
  deleteError.value = ''
  deleting.value = true
  try {
    await deleteAccount(password)
    await router.replace({ name: 'login' })
  } catch (error) {
    deleteError.value = describeError(error)
  } finally {
    deleting.value = false
  }
}

function onUserChange(nextUser) {
  if (!nextUser) {
    router.replace({ name: 'login', query: { redirect: '/profile' } })
    return
  }
  user.value = nextUser
  profileName.value = nextUser?.displayName || ''
}

onMounted(async () => {
  await getCurrentUser()
  unsubscribeAuth = onAuthChange(onUserChange)
})

onBeforeUnmount(() => unsubscribeAuth?.())
</script>

<template>
  <main class="profile-page">
    <section class="profile-card" aria-label="Profile">
      <div class="avatar" aria-hidden="true">{{ initials }}</div>
      <div class="profile-identity">
        <h1>{{ displayName }}</h1>
        <p>{{ user?.email || 'Signed-in CoRent account' }}</p>
        <span class="account-tag">CoRent account</span>
      </div>
      <button class="edit-profile" type="button" @click="openNameDialog">
        <BaseIcon name="edit" :size="14" />
        Edit
      </button>
    </section>

    <section class="settings-card" aria-labelledby="security-title">
      <h2 id="security-title" class="section-label">Security and preferences</h2>
      <button
        v-if="passwordAccount"
        class="setting-row"
        type="button"
        @click="passwordDialogOpen = true"
      >
        <span class="setting-icon"><BaseIcon name="lock" :size="18" /></span>
        <span class="setting-copy">
          <strong>Change Password</strong>
          <span>Update your account password</span>
        </span>
        <BaseIcon class="row-chevron" name="chevron-right" :size="16" />
      </button>
      <div v-else class="setting-row setting-row--static">
        <span class="setting-icon"><BaseIcon name="lock" :size="18" /></span>
        <span class="setting-copy">
          <strong>Password managed by your sign-in provider</strong>
          <span>Change your password with your provider</span>
        </span>
      </div>
      <button
        class="setting-row"
        type="button"
        @click="router.push({ path: '/preferences', query: { edit: '1' } })"
      >
        <span class="setting-icon"><BaseIcon name="edit" :size="18" /></span>
        <span class="setting-copy">
          <strong>Edit Preferences</strong>
          <span>Update your rental preferences</span>
        </span>
        <BaseIcon class="row-chevron" name="chevron-right" :size="16" />
      </button>
    </section>

    <button
      class="action-card"
      type="button"
      :disabled="signingOut"
      @click="signOutDialogOpen = true; actionError = ''"
    >
      <span class="setting-icon"><BaseIcon name="log-out" :size="18" /></span>
      <span class="setting-copy"><strong>{{ signingOut ? 'Logging out…' : 'Log Out' }}</strong></span>
      <BaseIcon class="row-chevron" name="chevron-right" :size="16" />
    </button>

    <button
      class="action-card action-card--danger"
      type="button"
      @click="deleteDialogOpen = true"
    >
      <span class="setting-icon"><BaseIcon name="trash" :size="18" /></span>
      <span class="setting-copy">
        <strong>Delete Account</strong>
        <span>Permanently remove your account and all data</span>
      </span>
      <BaseIcon class="row-chevron" name="chevron-right" :size="16" />
    </button>

    <DeleteAccountDialog
      :open="deleteDialogOpen"
      :busy="deleting"
      :error="deleteError"
      :requires-password="passwordAccount"
      @close="deleteDialogOpen = false; deleteError = ''"
      @confirm="onDeleteAccount"
    />

    <Teleport to="body">
      <div
        v-if="signOutDialogOpen"
        class="modal-backdrop"
        @click.self="!signingOut && (signOutDialogOpen = false)"
        @keydown.esc="!signingOut && (signOutDialogOpen = false)"
      >
        <section
          class="modal-card confirm-modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="sign-out-title"
          aria-describedby="sign-out-description"
        >
          <h2 id="sign-out-title">Log out of CoRent?</h2>
          <p id="sign-out-description">
            You’ll need to log in again to access your account and preferences.
          </p>
          <FieldMessage v-if="actionError">{{ actionError }}</FieldMessage>
          <div class="modal-actions">
            <button
              type="button"
              class="modal-cancel"
              :disabled="signingOut"
              @click="signOutDialogOpen = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="modal-danger"
              :disabled="signingOut"
              @click="onSignOut"
            >
              {{ signingOut ? 'Logging out…' : 'Log Out' }}
            </button>
          </div>
        </section>
      </div>

      <div v-if="nameDialogOpen" class="modal-backdrop" @click.self="nameDialogOpen = false">
        <form class="modal-card" aria-labelledby="name-title" @submit.prevent="saveName">
          <h2 id="name-title">Edit profile</h2>
          <label for="profile-name">Name</label>
          <input id="profile-name" v-model="name" maxlength="80" autocomplete="name" required />
          <FieldMessage v-if="nameError">{{ nameError }}</FieldMessage>
          <div class="modal-actions">
            <button type="button" class="modal-cancel" :disabled="savingName" @click="nameDialogOpen = false">
              Cancel
            </button>
            <button type="submit" class="modal-save" :disabled="savingName">
              {{ savingName ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </form>
      </div>

      <div v-if="passwordDialogOpen" class="modal-backdrop" @click.self="passwordDialogOpen = false">
        <form class="modal-card" aria-labelledby="password-title" @submit.prevent="savePassword">
          <h2 id="password-title">Change password</h2>
          <label for="current-password">Current password</label>
          <input
            id="current-password"
            v-model="currentPassword"
            type="password"
            autocomplete="current-password"
            required
          />
          <label for="new-password">New password</label>
          <input
            id="new-password"
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            required
          />
          <label for="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            required
          />
          <FieldMessage v-if="passwordError">{{ passwordError }}</FieldMessage>
          <div class="modal-actions">
            <button
              type="button"
              class="modal-cancel"
              :disabled="changingPassword"
              @click="passwordDialogOpen = false"
            >
              Cancel
            </button>
            <button type="submit" class="modal-save" :disabled="changingPassword">
              {{ changingPassword ? 'Updating…' : 'Update password' }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.profile-page {
  display: grid;
  gap: 12px;
  width: min(100% - 32px, 620px);
  margin: 24px auto;
  color: var(--cr-text);
  font-family: var(--cr-font);
}

.profile-card,
.settings-card,
.action-card {
  overflow: hidden;
  border: 1px solid var(--cr-border);
  border-radius: 18px;
  background: var(--cr-surface);
  box-shadow: var(--cr-shadow-card);
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 124px;
  padding: 20px 22px;
  box-sizing: border-box;
}

.avatar {
  display: grid;
  flex: 0 0 70px;
  place-items: center;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: var(--cr-accent);
  color: #fff;
  font-size: 25px;
  font-weight: 700;
}

.profile-identity {
  flex: 1;
  min-width: 0;
}

.profile-identity h1 {
  margin: 0 0 3px;
  font-size: 18px;
  font-weight: 700;
}

.profile-identity p {
  margin: 0 0 10px;
  color: var(--cr-muted);
  font-size: 14px;
  overflow-wrap: anywhere;
}

.account-tag {
  display: inline-block;
  padding: 4px 11px;
  border-radius: 999px;
  background: var(--cr-accent-soft);
  color: var(--cr-accent);
  font-size: 11px;
  font-weight: 700;
}

.edit-profile {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 0 8px 8px;
  border: 0;
  background: transparent;
  color: var(--cr-accent);
  font: 600 13px var(--cr-font);
  cursor: pointer;
}

.settings-card {
  padding-top: 2px;
}

.section-label {
  margin: 0;
  padding: 17px 18px 12px;
  color: #999;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.setting-row,
.action-card {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 70px;
  gap: 14px;
  padding: 12px 18px;
  border: 0;
  border-top: 1px solid #f0efee;
  background: var(--cr-surface);
  color: inherit;
  text-align: left;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}

.setting-row:hover:not(.setting-row--static),
.action-card:hover:not(:disabled) {
  background: #fcfbfb;
}

.setting-row:disabled,
.edit-profile:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.setting-row--static {
  cursor: default;
}

.setting-icon {
  display: grid;
  flex: 0 0 40px;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 13px;
  background: #f4f4f4;
  color: #555;
}

.setting-copy {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 3px;
}

.setting-copy strong {
  font-size: 14px;
  font-weight: 650;
}

.setting-copy > span {
  color: var(--cr-muted);
  font-size: 13px;
}

.row-chevron {
  color: #c7c7c7;
}

.action-card {
  min-height: 72px;
  border: 1px solid var(--cr-border);
  border-radius: 18px;
  box-shadow: var(--cr-shadow-card);
}

.action-card .setting-icon {
  background: #f4f4f4;
}

.action-card--danger {
  border-color: #f1d8d8;
  color: var(--cr-error);
}

.action-card--danger .setting-icon {
  background: var(--cr-error-soft);
  color: var(--cr-error);
}

.action-card--danger .setting-copy > span {
  color: var(--cr-muted);
}

.action-card--danger .row-chevron {
  color: #e79a9a;
}

.action-card:disabled,
.edit-profile:disabled {
  cursor: wait;
  opacity: 0.65;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 110;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(17 17 17 / 45%);
}

.modal-card {
  display: grid;
  width: min(100%, 380px);
  gap: 10px;
  padding: 22px;
  border-radius: 14px;
  background: rgb(255 255 255 / 96%);
  color: var(--cr-text);
  backdrop-filter: var(--cr-glass-blur);
  box-shadow: 0 20px 50px rgb(0 0 0 / 20%);
  font-family: var(--cr-font);
}

.modal-card h2 {
  margin: 0 0 4px;
  font-size: 17px;
}

.modal-card label {
  font-size: 12px;
  font-weight: 600;
}

.modal-card input {
  box-sizing: border-box;
  width: 100%;
  height: 40px;
  padding: 0 11px;
  border: 1px solid var(--cr-border-strong);
  border-radius: 8px;
  font: 13px var(--cr-font);
}

.modal-card input:focus-visible,
button:focus-visible {
  outline: none;
  box-shadow: var(--cr-focus-ring);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.modal-actions button {
  min-height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  font: 600 13px var(--cr-font);
  cursor: pointer;
}

.modal-actions button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.modal-cancel {
  border: 1px solid var(--cr-border-strong);
  background: #fff;
  color: var(--cr-text);
}

.modal-save {
  border: 1px solid var(--cr-accent);
  background: var(--cr-accent);
  color: #fff;
}

.confirm-modal > p {
  margin: 0;
  color: #55596f;
  font-size: 13px;
  line-height: 1.5;
}

.modal-danger {
  border: 1px solid var(--cr-error) !important;
  background: var(--cr-error);
  color: #fff;
}

@media (max-width: 480px) {
  .profile-page {
    width: min(100% - 24px, 620px);
    margin-top: 16px;
    gap: 10px;
  }

  .profile-card {
    gap: 12px;
    min-height: 112px;
    padding: 16px;
  }

  .avatar {
    flex-basis: 58px;
    width: 58px;
    height: 58px;
    font-size: 21px;
  }

  .profile-identity h1 {
    font-size: 16px;
  }

  .profile-identity p {
    font-size: 12px;
  }

  .edit-profile {
    font-size: 12px;
  }

  .setting-row,
  .action-card {
    gap: 11px;
    padding-right: 14px;
    padding-left: 14px;
  }
}
</style>
