<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

// A small info button on a vote option. Clicking it opens a card that shows who
// the option works for, each member with a tick or a cross and why.
defineProps({
  title: { type: String, required: true },
  summary: { type: String, default: '' },
  // [{ uid, name, ok, note }]
  rows: { type: Array, default: () => [] },
})

const open = ref(false)
const root = ref(null)
const closeOutside = (event) => {
  if (!root.value?.contains(event.target)) open.value = false
}
watch(open, (isOpen) =>
  isOpen
    ? document.addEventListener('pointerdown', closeOutside)
    : document.removeEventListener('pointerdown', closeOutside),
)
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOutside))
// Escape closes only this card, not the whole preference popup.
function closeOnEscape(event) {
  if (event.key !== 'Escape' || !open.value) return
  event.preventDefault()
  event.stopPropagation()
  open.value = false
}
</script>

<template>
  <span ref="root" class="option-info" @keydown="closeOnEscape">
    <button
      type="button"
      class="info-button"
      :class="{ 'is-open': open }"
      :aria-expanded="open"
      aria-label="Learn more about this option"
      data-tip="Click to learn more"
      @click="open = !open"
    >
      i
    </button>
    <span v-if="open" class="info-card" role="group" :aria-label="title">
      <strong class="info-title">{{ title }}</strong>
      <span v-if="summary" class="info-summary">{{ summary }}</span>
      <span v-for="row in rows" :key="row.uid" class="info-row">
        <span class="info-mark" :class="row.ok ? 'is-ok' : 'is-no'" aria-hidden="true">{{
          row.ok ? '✓' : '✕'
        }}</span>
        <span class="info-name">{{ row.name }}</span>
        <span class="info-note">{{ row.note }}</span>
      </span>
    </span>
  </span>
</template>
