<script setup>
import BaseIcon from './BaseIcon.vue'
import './theme.css'

defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <label class="toggle" :class="{ 'is-on': modelValue, 'is-disabled': disabled }">
    <input
      type="checkbox"
      role="switch"
      class="toggle__input"
      :checked="modelValue"
      :disabled="disabled"
      @change="emit('update:modelValue', $event.target.checked)"
    />
    <span class="toggle__track" aria-hidden="true"><span class="toggle__thumb" /></span>
    <span class="toggle__text">
      <span class="toggle__label">
        <BaseIcon v-if="icon" :name="icon" :size="13" />
        {{ label }}
      </span>
      <span v-if="description" class="toggle__description">{{ description }}</span>
    </span>
  </label>
</template>

<style scoped>
.toggle {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-family: var(--cr-font);
  cursor: pointer;
  user-select: none;
}
.toggle.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.toggle__input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}
.toggle__track {
  position: relative;
  flex-shrink: 0;
  width: 32px;
  height: 18px;
  margin-top: 1px;
  border-radius: 999px;
  background: var(--cr-border-strong);
  transition: background-color 0.2s ease;
}
.toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 25%);
  transition: transform 0.2s ease;
}
.is-on .toggle__track {
  background: var(--cr-accent);
}
.is-on .toggle__thumb {
  transform: translateX(14px);
}
.toggle__input:focus-visible + .toggle__track {
  box-shadow: var(--cr-focus-ring);
}
.toggle__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.toggle__label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 500;
  color: var(--cr-text);
}
.toggle__description {
  font-size: 12px;
  color: var(--cr-muted);
}
</style>
