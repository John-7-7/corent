<script setup>
import BaseIcon from './BaseIcon.vue'
import './theme.css'

const props = defineProps({
  // null renders as "–" (e.g. when "Any" is chosen).
  modelValue: { type: Number, default: null },
  min: { type: Number, default: 0 },
  max: { type: Number, default: Infinity },
  step: { type: Number, default: 1 },
  // Small caption above the controls, e.g. "MIN".
  label: { type: String, default: '' },
  // Used in button aria-labels, e.g. "minimum bedrooms".
  ariaLabel: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

function change(delta) {
  const current = props.modelValue ?? props.min
  emit('update:modelValue', Math.min(props.max, Math.max(props.min, current + delta)))
}
</script>

<template>
  <div class="stepper" :class="{ 'is-disabled': disabled }">
    <span v-if="label" class="stepper__label">{{ label }}</span>
    <div class="stepper__controls">
      <button
        type="button"
        class="stepper__btn"
        :disabled="disabled || (modelValue ?? min) <= min"
        :aria-label="`Decrease ${ariaLabel || label}`"
        @click="change(-step)"
      >
        <BaseIcon name="minus" :size="14" />
      </button>
      <output class="stepper__value" aria-live="polite">{{ modelValue ?? '–' }}</output>
      <button
        type="button"
        class="stepper__btn stepper__btn--accent"
        :disabled="disabled || (modelValue ?? min) >= max"
        :aria-label="`Increase ${ariaLabel || label}`"
        @click="change(step)"
      >
        <BaseIcon name="plus" :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.stepper {
  font-family: var(--cr-font);
}
.stepper__label {
  display: block;
  margin-bottom: 6px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--cr-muted);
}
.stepper__controls {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.stepper__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #ededed;
  color: var(--cr-text);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    opacity 0.15s ease;
}
.stepper__btn:hover:not(:disabled) {
  background: #e0e0e0;
}
.stepper__btn--accent {
  background: var(--cr-accent-soft);
  color: var(--cr-accent);
}
.stepper__btn--accent:hover:not(:disabled) {
  background: #fbd3db;
}
.stepper__btn:focus-visible {
  outline: none;
  box-shadow: var(--cr-focus-ring);
}
.stepper__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.stepper__value {
  min-width: 20px;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.is-disabled .stepper__value {
  color: var(--cr-subtle);
}
</style>
