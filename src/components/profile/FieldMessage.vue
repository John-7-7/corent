<script setup>
import { computed } from 'vue'
import BaseIcon from './BaseIcon.vue'
import './theme.css'

const props = defineProps({
  // 'error' blocks saving; 'warning' is advisory only.
  type: { type: String, default: 'error' },
})

const icon = computed(() => (props.type === 'error' ? 'alert-circle' : 'alert-triangle'))
</script>

<template>
  <p
    class="field-message"
    :class="`field-message--${type}`"
    :role="type === 'error' ? 'alert' : 'status'"
  >
    <BaseIcon :name="icon" :size="14" />
    <span><slot /></span>
  </p>
</template>

<style scoped>
.field-message {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 10px 0 0;
  padding: 8px 10px;
  border-radius: var(--cr-radius-control);
  font: 500 12px/1.4 var(--cr-font);
}
.field-message .base-icon {
  margin-top: 1px;
}
.field-message--error {
  background: var(--cr-error-soft);
  color: var(--cr-error);
}
.field-message--warning {
  background: var(--cr-warning-soft);
  color: var(--cr-warning);
}
</style>
