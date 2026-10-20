<script setup>
import { ref } from 'vue'
import BaseIcon from './BaseIcon.vue'
import DeleteAccountDialog from './DeleteAccountDialog.vue'
import './theme.css'

defineProps({
  email: { type: String, default: '' },
  requiresPassword: { type: Boolean, default: true },
  deleting: { type: Boolean, default: false },
  deleteError: { type: String, default: '' },
  signingOut: { type: Boolean, default: false },
})

// delete-account carries the password (empty for non-password sign-in).
const emit = defineEmits(['sign-out', 'delete-account', 'dismiss-error'])

const dialogOpen = ref(false)

function closeDialog() {
  dialogOpen.value = false
  emit('dismiss-error')
}
</script>

<template>
  <section class="account" aria-labelledby="account-title">
    <h2 id="account-title" class="account__title">Account</h2>
    <p class="account__label">Signed in as</p>
    <p class="account__email">{{ email || 'Unknown email' }}</p>

    <div class="account__actions">
      <button type="button" class="link-btn" :disabled="signingOut" @click="emit('sign-out')">
        <BaseIcon name="log-out" :size="14" />
        {{ signingOut ? 'Signing out…' : 'Sign out' }}
      </button>
      <button type="button" class="link-btn link-btn--danger" @click="dialogOpen = true">
        <BaseIcon name="trash" :size="14" />
        Delete account
      </button>
    </div>

    <DeleteAccountDialog
      :open="dialogOpen"
      :busy="deleting"
      :error="deleteError"
      :requires-password="requiresPassword"
      @close="closeDialog"
      @confirm="emit('delete-account', $event)"
    />
  </section>
</template>

<style scoped>
.account {
  background: var(--cr-surface);
  border: 1px solid var(--cr-border);
  border-radius: var(--cr-radius-card);
  box-shadow: var(--cr-shadow-card);
  padding: 16px 18px;
  font-family: var(--cr-font);
  color: var(--cr-text);
}
.account__title {
  margin: 0 0 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--cr-muted);
}
.account__label {
  margin: 0;
  font-size: 12px;
  color: var(--cr-muted);
}
.account__email {
  margin: 2px 0 14px;
  font-size: 13px;
  font-weight: 600;
  word-break: break-all;
}
.account__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--cr-border);
}
.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--cr-border-strong);
  border-radius: 8px;
  background: var(--cr-surface);
  font: 600 12px var(--cr-font);
  color: var(--cr-text);
  cursor: pointer;
}
.link-btn:hover:not(:disabled) {
  background: #f7f7f7;
}
.link-btn:disabled {
  opacity: 0.6;
  cursor: progress;
}
.link-btn:focus-visible {
  outline: none;
  box-shadow: var(--cr-focus-ring);
}
.link-btn--danger {
  border-color: transparent;
  color: var(--cr-error);
}
.link-btn--danger:hover {
  background: var(--cr-error-soft);
}
</style>
