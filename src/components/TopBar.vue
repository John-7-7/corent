<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AccountBadge from '@/components/AccountBadge.vue'
import GroupSwitcher from '@/components/GroupSwitcher.vue'
import NotificationCenter from '@/components/NotificationCenter.vue'
import { startActiveGroupTracking } from '@/services/activeGroup'
import { onAuthChange } from '@/services/authService'

// The top-right cluster on every page: the active group, notifications and the
// signed-in account. Tracking is started here too, so the group list is live
// on pages that never load the shortlist.
startActiveGroupTracking()

const signedIn = ref(false)
const stopAuth = onAuthChange((user) => (signedIn.value = !!user))
onUnmounted(() => stopAuth?.())

// Profile already shows who you are, so the account badge is left out there.
const route = useRoute()
const onProfile = computed(() => route.path.startsWith('/profile'))
</script>

<template>
  <div v-if="signedIn" class="top-bar">
    <GroupSwitcher />
    <NotificationCenter />
    <AccountBadge v-if="!onProfile" />
  </div>
</template>

<style scoped>
.top-bar {
  position: absolute;
  top: 8px;
  right: 20px;
  z-index: 10;
  display: flex;
  gap: 10px;
  align-items: center;
}
</style>
