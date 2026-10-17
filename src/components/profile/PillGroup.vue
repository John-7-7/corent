<script setup>
import { computed } from 'vue'
import BaseIcon from './BaseIcon.vue'
import './theme.css'

const props = defineProps({
  // Single value, or an array when `multiple` is set.
  modelValue: { default: null },
  // [{ value, label, icon?, disabled? }]
  options: { type: Array, required: true },
  multiple: { type: Boolean, default: false },
  // 'accent' (red) or 'dark' (black) selected style.
  variant: { type: String, default: 'accent' },
  // Multiple mode only: adds a leading pill that is selected when nothing is
  // chosen, and clears the selection when clicked (e.g. "Any location").
  anyLabel: { type: String, default: '' },
  // Single mode only: clicking the selected pill clears it (emits null).
  deselectable: { type: Boolean, default: false },
  // Shows a spinner on the pill with this value (e.g. while it is resolving).
  loadingValue: { default: null },
  label: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const selectedValues = computed(() => (props.multiple ? (props.modelValue ?? []) : []))
const isAnySelected = computed(() => props.multiple && selectedValues.value.length === 0)

function isSelected(value) {
  return props.multiple ? selectedValues.value.includes(value) : props.modelValue === value
}

function select(value) {
  if (!props.multiple) {
    if (props.modelValue !== value) emit('update:modelValue', value)
    else if (props.deselectable) emit('update:modelValue', null)
    return
  }
  const current = selectedValues.value
  emit(
    'update:modelValue',
    current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
  )
}
</script>

<template>
  <div class="pill-group" role="group" :aria-label="label || undefined">
    <button
      v-if="multiple && anyLabel"
      type="button"
      class="pill"
      :class="[`pill--${variant}`, { 'is-selected': isAnySelected }]"
      :aria-pressed="isAnySelected"
      @click="emit('update:modelValue', [])"
    >
      {{ anyLabel }}
    </button>
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      class="pill"
      :class="[`pill--${variant}`, { 'is-selected': isSelected(option.value) }]"
      :aria-pressed="isSelected(option.value)"
      :aria-busy="loadingValue === option.value"
      :disabled="option.disabled"
      @click="select(option.value)"
    >
      <span v-if="loadingValue === option.value" class="pill__spinner" aria-hidden="true" />
      <BaseIcon v-else-if="option.icon" :name="option.icon" :size="12" />
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.pill-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 13px;
  border: 1px solid var(--cr-border-strong);
  border-radius: 999px;
  background: var(--cr-surface);
  color: var(--cr-text);
  font: 500 12px/1 var(--cr-font);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}
.pill:hover:not(:disabled, .is-selected) {
  border-color: var(--cr-subtle);
  background: #fafafa;
}
.pill:focus-visible {
  outline: none;
  box-shadow: var(--cr-focus-ring);
}
.pill:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.pill.is-selected {
  font-weight: 600;
  color: #fff;
}
.pill--accent.is-selected {
  background: var(--cr-accent);
  border-color: var(--cr-accent);
}
.pill--accent.is-selected:hover {
  background: var(--cr-accent-hover);
}
.pill__spinner {
  width: 11px;
  height: 11px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: pill-spin 0.7s linear infinite;
}
@keyframes pill-spin {
  to {
    transform: rotate(360deg);
  }
}
.pill--dark.is-selected {
  background: var(--cr-dark);
  border-color: var(--cr-dark);
}
</style>
