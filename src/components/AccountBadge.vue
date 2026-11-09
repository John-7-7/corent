<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { auth } from '@/firebase'
import { onAuthChange } from '@/services/authService'
import { memojiFor } from './avatars'

/**
 * Top-right reminder of which account is signed in: a large avatar, the name
 * and the email. Links to Profile.
 *
 * The avatar is the account's own photo (Google sign-in) when it has one, and
 * otherwise a 3D character picked from the account id, so the same account
 * always gets the same face. Characters are Microsoft Fluent Emoji (MIT), kept
 * in public/avatars so they load without a third-party request.
 */
const user = ref(null)
const name = ref('')
const stopAuth = onAuthChange((next) => {
  user.value = next
  name.value = next?.displayName || next?.email?.split('@')[0] || ''
})
onUnmounted(() => stopAuth?.())

// A name changed on Profile updates Auth without any auth event firing, so
// re-read it whenever the page changes.
const route = useRoute()
watch(
  () => route.fullPath,
  () => {
    const current = auth.currentUser
    if (current) name.value = current.displayName || current.email?.split('@')[0] || ''
  },
)

const photoFailed = ref(false)
watch(user, () => (photoFailed.value = false))

const avatarSrc = computed(() => {
  if (!user.value) return ''
  if (user.value.photoURL && !photoFailed.value) return user.value.photoURL
  return memojiFor(user.value.uid)
})
const usingPhoto = computed(() => !!user.value?.photoURL && !photoFailed.value)

function onImageError() {
  if (usingPhoto.value) photoFailed.value = true
}
</script>

<template>
  <RouterLink
    v-if="user"
    to="/profile"
    class="account-badge"
    :title="`Signed in as ${name}${user.email ? ` (${user.email})` : ''}. Open your profile.`"
  >
    <span class="account-text">
      <strong>{{ name }}</strong>
      <small v-if="user.email">{{ user.email }}</small>
    </span>
    <span class="account-avatar" :class="{ 'account-avatar--photo': usingPhoto }">
      <img :src="avatarSrc" alt="" referrerpolicy="no-referrer" @error="onImageError" />
    </span>
  </RouterLink>
</template>

<style scoped>
.account-badge {
  display: flex;
  gap: 10px;
  align-items: center;
  max-width: 320px;
  padding: 4px 4px 4px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgb(255 255 255 / 80%);
  box-shadow: 0 2px 10px rgb(42 45 62 / 8%);
  color: var(--text);
  text-decoration: none;
  backdrop-filter: var(--glass-blur);
  transition:
    box-shadow 0.15s ease,
    border-color 0.15s ease;
}
.account-badge:hover {
  border-color: var(--red);
  box-shadow: 0 4px 14px rgb(123 140 240 / 25%);
}
.account-text {
  display: grid;
  min-width: 0;
  line-height: 1.25;
  text-align: right;
}
.account-text strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account-text small {
  overflow: hidden;
  color: var(--muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account-avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 46px;
  height: 46px;
  overflow: hidden;
  border-radius: 50%;
  background: linear-gradient(145deg, #e6e9fd, #fbe9f1);
}
.account-avatar img {
  width: 84%;
  height: 84%;
  object-fit: contain;
}
.account-avatar--photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
@media (max-width: 720px) {
  .account-text small {
    display: none;
  }
}
</style>
