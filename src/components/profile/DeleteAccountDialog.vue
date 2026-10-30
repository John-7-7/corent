<script setup>
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import BaseIcon from './BaseIcon.vue'
import FieldMessage from './FieldMessage.vue'
import './theme.css'

const props = defineProps({
  open: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
  // Email/password users must re-enter their password; others re-auth via popup.
  requiresPassword: { type: Boolean, default: true },
})

const emit = defineEmits(['confirm', 'close'])

const password = ref('')
const acknowledged = ref(false)
const dialogEl = useTemplateRef('dialogEl')

const canConfirm = computed(
  () => acknowledged.value && (!props.requiresPassword || password.value.length > 0) && !props.busy,
)

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    password.value = ''
    acknowledged.value = false
    await nextTick()
    dialogEl.value?.querySelector('input')?.focus()
  },
)

function close() {
  if (!props.busy) emit('close')
}

function confirm() {
  if (canConfirm.value) emit('confirm', password.value)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="open" class="overlay" @click.self="close" @keydown.esc="close">
        <div
          ref="dialogEl"
          class="dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          aria-describedby="delete-desc"
        >
          <div class="dialog__icon"><BaseIcon name="trash" :size="18" /></div>
          <h2 id="delete-title" class="dialog__title">Delete your account?</h2>
          <p id="delete-desc" class="dialog__text">
            This permanently deletes your CoRent account and personal rental preferences. Your
            groups and their shared decisions will remain available to other members. This cannot
            be undone.
          </p>

          <form class="dialog__form" @submit.prevent="confirm">
            <label v-if="requiresPassword" class="pw-field">
              <span class="pw-field__label">Confirm your password</span>
              <input
                v-model="password"
                type="password"
                class="pw-field__input"
                autocomplete="current-password"
                :disabled="busy"
              />
            </label>
            <label class="check">
              <input v-model="acknowledged" type="checkbox" :disabled="busy" />
              <span>I understand my account and personal preferences will be deleted.</span>
            </label>

            <FieldMessage v-if="error">{{ error }}</FieldMessage>

            <div class="dialog__actions">
              <button type="button" class="dlg-btn dlg-btn--ghost" :disabled="busy" @click="close">
                Cancel
              </button>
              <button type="submit" class="dlg-btn dlg-btn--danger" :disabled="!canConfirm">
                <span v-if="busy" class="spinner" aria-hidden="true" />
                {{ busy ? 'Deleting…' : 'Delete account' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(17 17 17 / 45%);
  font-family: var(--cr-font);
}
.dialog {
  width: 100%;
  max-width: 400px;
  padding: 24px;
  border-radius: 14px;
  background: var(--cr-surface);
  backdrop-filter: var(--cr-glass-blur);
  box-shadow: 0 20px 50px rgb(0 0 0 / 20%);
  color: var(--cr-text);
}
.dialog__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-bottom: 12px;
  border-radius: 50%;
  background: var(--cr-error-soft);
  color: var(--cr-error);
}
.dialog__title {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 700;
}
.dialog__text {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cr-muted);
}
.dialog__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pw-field__label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
}
.pw-field__input {
  box-sizing: border-box;
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--cr-border-strong);
  border-radius: var(--cr-radius-control);
  font: 400 13px var(--cr-font);
}
.pw-field__input:focus {
  outline: none;
  border-color: var(--cr-accent);
  box-shadow: var(--cr-focus-ring);
}
.check {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12.5px;
  cursor: pointer;
}
.check input {
  margin-top: 2px;
  accent-color: var(--cr-accent);
}
.dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}
.dlg-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  font: 600 13px var(--cr-font);
  cursor: pointer;
}
.dlg-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.dlg-btn:focus-visible {
  outline: none;
  box-shadow: var(--cr-focus-ring);
}
.dlg-btn--ghost {
  border: 1px solid var(--cr-border-strong);
  background: var(--cr-surface);
  color: var(--cr-text);
}
.dlg-btn--danger {
  border: none;
  background: var(--cr-error);
  color: #fff;
}
.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgb(255 255 255 / 45%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.15s ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>
