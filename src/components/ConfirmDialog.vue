<script setup>
import { nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import BaseIcon from '@/components/profile/BaseIcon.vue'
import { confirmState, settleConfirm } from '@/composables/useConfirm'

// The app's single confirmation prompt (see composables/useConfirm.js).
//
// A native <dialog> opened with showModal() rather than a positioned overlay:
// some pages already show their own native modal (Group Summary's factor
// panel), which sits in the browser's top layer above any z-index and makes the
// rest of the page inert. A prompt opened from inside it has to join the top
// layer too, where the most recently opened modal is on top.
const dialogEl = useTemplateRef('dialogEl')
const cancelButton = useTemplateRef('cancelButton')

onMounted(() => (confirmState.hostMounted = true))
onBeforeUnmount(() => {
  confirmState.hostMounted = false
  if (confirmState.open) settleConfirm(false)
})

watch(
  () => confirmState.open,
  async (open) => {
    const dialog = dialogEl.value
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      await nextTick()
      // Cancel is the safe default, as in most apps' destructive prompts.
      cancelButton.value?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  },
)

// Esc fires `cancel`; close through our state so the caller gets `false`.
function onCancel(event) {
  event.preventDefault()
  settleConfirm(false)
}

// A click on the dialog element itself, outside the panel, is the backdrop.
function onBackdropClick(event) {
  if (event.target === dialogEl.value) settleConfirm(false)
}
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogEl"
      class="confirm-host"
      role="alertdialog"
      aria-labelledby="confirm-title"
      :aria-describedby="confirmState.message ? 'confirm-message' : undefined"
      @cancel="onCancel"
      @click="onBackdropClick"
    >
      <div v-if="confirmState.open" class="confirm-dialog">
        <span
          class="confirm-icon"
          :class="{ 'confirm-icon--danger': confirmState.tone === 'danger' }"
          aria-hidden="true"
        >
          <BaseIcon :name="confirmState.tone === 'danger' ? 'trash' : 'alert-circle'" :size="18" />
        </span>
        <h2 id="confirm-title" class="confirm-title">{{ confirmState.title }}</h2>
        <p v-if="confirmState.message" id="confirm-message" class="confirm-message">
          {{ confirmState.message }}
        </p>
        <div class="confirm-actions">
          <button
            ref="cancelButton"
            type="button"
            class="confirm-btn confirm-btn--ghost"
            @click="settleConfirm(false)"
          >
            {{ confirmState.cancelLabel }}
          </button>
          <button
            type="button"
            class="confirm-btn"
            :class="confirmState.tone === 'danger' ? 'confirm-btn--danger' : 'confirm-btn--primary'"
            @click="settleConfirm(true)"
          >
            {{ confirmState.confirmLabel }}
          </button>
        </div>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.confirm-host {
  width: calc(100% - 32px);
  max-width: 420px;
  padding: 0;
  border: none;
  border-radius: 16px;
  background: transparent;
  overflow: visible;
}
.confirm-host::backdrop {
  background: rgb(26 29 46 / 45%);
}
.confirm-host[open] {
  animation: confirm-in 0.15s ease;
}
@keyframes confirm-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
.confirm-dialog {
  padding: 24px;
  border-radius: 16px;
  background: var(--modal-surface, #fff);
  box-shadow: 0 24px 60px rgb(0 0 0 / 22%);
  color: var(--text, #2a2d3e);
  font-family: var(--font, system-ui, sans-serif);
}
.confirm-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-bottom: 14px;
  border-radius: 50%;
  background: var(--soft, #eef0fc);
  color: var(--red, #7b8cf0);
}
.confirm-icon--danger {
  background: var(--error-tint, #fbe9e8);
  color: var(--error, #c8292f);
}
.confirm-title {
  margin: 0 0 6px;
  font-family: var(--font-heading, inherit);
  font-size: 17px;
  font-weight: 700;
}
.confirm-message {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--muted, #6b6e85);
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 22px;
}
.confirm-btn {
  height: 38px;
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: 10px;
  font: 600 13.5px var(--font, system-ui, sans-serif);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    filter 0.15s ease;
}
.confirm-btn:focus-visible {
  outline: 2px solid var(--red, #7b8cf0);
  outline-offset: 2px;
}
.confirm-btn--ghost {
  border-color: var(--chip-line, #d4d6e4);
  background: #fff;
  color: var(--text, #2a2d3e);
}
.confirm-btn--ghost:hover {
  background: var(--soft, #f3f4fd);
}
.confirm-btn--danger {
  background: var(--error, #c8292f);
  color: #fff;
}
.confirm-btn--primary {
  background: var(--red, #7b8cf0);
  color: #fff;
}
.confirm-btn--danger:hover,
.confirm-btn--primary:hover {
  filter: brightness(0.93);
}
</style>
