<script setup>
import AppIcon from '@/components/AppIcon.vue'

defineProps({
  title: { type: String, required: true },
  backTo: { type: String, default: '/' },
})
</script>

<template>
  <header class="flow-bar">
    <router-link class="back" :to="backTo" aria-label="Go back">
      <AppIcon name="chevron" :size="18" />
    </router-link>
    <h1>{{ title }}</h1>
  </header>
</template>

<style scoped>
.flow-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  height: 56px;
  padding: 0 1.25rem;
  background: #fff;
  border-bottom: 1px solid var(--line);
}
.back {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--text);
}
.back:hover { background: var(--soft); }
.back :deep(svg) { transform: rotate(180deg); }
h1 { font-size: 14px; font-weight: 700; }
</style>