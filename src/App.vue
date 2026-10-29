<script setup>

import { computed, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
// Routes marked meta.bare render full screen, with no sidebar.
const bare = computed(() => !!route.meta.bare)
const sidebarCollapsed = ref(false)
</script>

<template>
  <RouterView v-if="bare" />
  <div v-else class="shell">
    <AppSidebar :collapsed="sidebarCollapsed" @toggle="sidebarCollapsed = !sidebarCollapsed" />
    <button
      v-if="sidebarCollapsed"
      class="sidebar-reopen"
      type="button"
      aria-label="Open sidebar"
      aria-expanded="false"
      @click="sidebarCollapsed = false"
    >
      <AppIcon name="chevron" :size="18" />
    </button>
    <main class="shell-main">
      <RouterView />
    </main>
  </div>
</template>

<style>
.sidebar-reopen {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 45;
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--glass);
  color: var(--text);
  box-shadow: 0 4px 16px rgb(42 45 62 / 12%);
  backdrop-filter: var(--glass-blur);
  cursor: pointer;
}

.sidebar-reopen:hover {
  background: #fff;
  color: var(--red);
}

@media (max-width: 720px) {
  .sidebar-reopen {
    top: auto;
    bottom: 76px;
    left: 14px;
  }
}
</style>