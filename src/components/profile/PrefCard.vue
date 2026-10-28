<script setup>
import './theme.css'

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  invalid: { type: Boolean, default: false },
  tag: { type: String, default: 'section' },
})
</script>

<template>
  <component :is="tag" class="pref-card" :class="{ 'is-invalid': invalid }">
    <header v-if="title || $slots.aside" class="pref-card__header">
      <div class="pref-card__heading">
        <h2 v-if="title" class="pref-card__title">{{ title }}</h2>
        <p v-if="subtitle" class="pref-card__subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.aside" class="pref-card__aside">
        <slot name="aside" />
      </div>
    </header>
    <slot />
  </component>
</template>

<style scoped>
.pref-card {
  background: var(--cr-surface);
  backdrop-filter: var(--cr-glass-blur);
  border: 1px solid var(--cr-border);
  border-radius: var(--cr-radius-card);
  box-shadow: var(--cr-shadow-card);
  padding: 16px 18px;
  font-family: var(--cr-font);
  color: var(--cr-text);
  transition: border-color 0.15s ease;
}
.pref-card.is-invalid {
  border-color: var(--cr-error);
}
.pref-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.pref-card__header:last-child {
  margin-bottom: 0;
}
.pref-card__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}
.pref-card__subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--cr-muted);
}
.pref-card__aside {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
