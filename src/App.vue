<script setup>
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'

const route = useRoute()
// Auth pages use the full screen with no sidebar.
const bare = computed(() => ['/login', '/register', '/forgot-password'].includes(route.path))
</script>

<template>
  <RouterView v-if="bare" />
  <div v-else class="shell">
    <AppSidebar />
    <main class="shell-main">
      <RouterView />
    </main>
  </div>
</template>