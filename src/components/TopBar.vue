<script setup>
import { onUnmounted, ref } from 'vue'
import AccountBadge from '@/components/AccountBadge.vue'
import EnquiryNotifications from '@/components/EnquiryNotifications.vue'
import GroupSwitcher from '@/components/GroupSwitcher.vue'
import { startActiveGroupTracking } from '@/services/activeGroup'
import { onAuthChange } from '@/services/authService'

// The top-right cluster on every page: the active group, enquiry
// notifications and the signed-in account. Tracking is started here too, so
// the group list is live on pages that never load the shortlist.
startActiveGroupTracking()

const signedIn = ref(false)
const stopAuth = onAuthChange((user) => (signedIn.value = !!user))
onUnmounted(() => stopAuth?.())
</script>

<template>
  <div v-if="signedIn" class="top-bar">
    <GroupSwitcher />
    <EnquiryNotifications />
    <AccountBadge />
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
