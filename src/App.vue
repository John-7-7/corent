<script setup>
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'

const route = useRoute()
// Routes marked meta.bare render full screen, with no sidebar.
const bare = computed(() => !!route.meta.bare)
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