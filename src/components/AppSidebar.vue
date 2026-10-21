<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { signOutUser } from '@/services/authService'

const router = useRouter()
const confirmSignOut = ref(false)
const signingOut = ref(false)
const signOutError = ref('')

const links = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/listings', label: 'Browse', icon: 'search' },
  { to: '/group-summary', label: 'Group Summary', icon: 'users' },
  { to: '/shortlist', label: 'Shortlist', icon: 'bookmark' },
  { to: '/profile', label: 'Profile', icon: 'user' },
]

async function onSignOut() {
  signingOut.value = true
  signOutError.value = ''
  try {
    await signOutUser()
    confirmSignOut.value = false
    await router.replace({ name: 'login' })
  } catch (error) {
    signOutError.value = error?.message || 'Unable to sign out. Please try again.'
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <AppIcon name="logo" :size="22" />
      <span class="brand-name">Co<span>Rent</span></span>
    </div>

    <nav aria-label="Main navigation">
      <ul>
        <li v-for="l in links" :key="l.to">
          <router-link :to="l.to" class="nav-item" exact-active-class="active">
            <AppIcon :name="l.icon" :size="16" />
            <span>{{ l.label }}</span>
          </router-link>
        </li>
        <li>
          <button class="nav-item sign-out" type="button" @click="confirmSignOut = true">
            <AppIcon name="logOut" :size="16" />
            <span>Log out</span>
          </button>
        </li>
      </ul>
    </nav>

    <Teleport to="body">
      <div
        v-if="confirmSignOut"
        class="sign-out-overlay"
        @click.self="!signingOut && (confirmSignOut = false)"
        @keydown.esc="!signingOut && (confirmSignOut = false)"
      >
        <section
          class="sign-out-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="sign-out-title"
          aria-describedby="sign-out-description"
        >
          <h2 id="sign-out-title">Log out of CoRent?</h2>
          <p id="sign-out-description">You’ll need to log in again to access your group’s shared preferences and decisions.</p>
          <p v-if="signOutError" class="sign-out-error" role="alert">{{ signOutError }}</p>
          <div class="sign-out-actions">
            <button
              class="sign-out-button sign-out-cancel"
              type="button"
              :disabled="signingOut"
              @click="confirmSignOut = false"
            >
              Cancel
            </button>
            <button
              class="sign-out-button sign-out-confirm"
              type="button"
              :disabled="signingOut"
              @click="onSignOut"
            >
              {{ signingOut ? 'Logging out…' : 'Log out' }}
            </button>
          </div>
        </section>
      </div>
    </Teleport>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 220px;
  flex: none;
  background: #fff;
  border-right: 1px solid var(--line);
  padding: 0 0.75rem 1rem;
  position: sticky;
  top: 0;
  height: 100vh;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--red);
  height: 62px;
  padding: 0 0.5rem;
  margin: 0 -0.75rem 0.75rem;
  padding-left: 1.25rem;
  border-bottom: 1px solid var(--line);
}
.brand-name { font-size: 13px; font-weight: 700; color: var(--text); }
.brand-name span { color: var(--red); }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  color: #555;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.sign-out {
  width: 100%;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
}
.sign-out-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(17 17 17 / 45%);
}
.sign-out-dialog {
  width: 100%;
  max-width: 400px;
  padding: 24px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 20px 50px rgb(0 0 0 / 20%);
  color: var(--text);
}
.sign-out-dialog h2 { margin: 0 0 8px; font-size: 17px; }
.sign-out-dialog p { margin: 0; color: #6b6b6b; font-size: 13px; line-height: 1.5; }
.sign-out-error { margin-top: 12px !important; color: #b42318 !important; }
.sign-out-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.sign-out-button {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.sign-out-button:disabled { cursor: wait; opacity: 0.65; }
.sign-out-cancel { background: #fff; color: var(--text); }
.sign-out-confirm { border-color: var(--red); background: var(--red); color: #fff; }
.nav-item:hover { background: var(--soft); }
.nav-item.active { background: var(--red-tint); color: var(--red); }

@media (max-width: 720px) {
  .sidebar {
    position: fixed;
    inset: auto 0 0 0;
    width: auto;
    height: auto;
    z-index: 40;
    padding: 0.35rem 0.5rem;
    border-right: 0;
    border-top: 1px solid var(--line);
  }
  .brand { display: none; }
  ul { grid-auto-flow: column; grid-auto-columns: 1fr; }
  .nav-item { flex-direction: column; gap: 2px; padding: 0.4rem 0.2rem; font-size: 10px; text-align: center; }
}
</style>