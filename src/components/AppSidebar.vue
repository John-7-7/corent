<script setup>
import AppIcon from '@/components/AppIcon.vue'

const links = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/listings', label: 'Browse', icon: 'search' },
  { to: '/group-summary', label: 'Group Summary', icon: 'users' },
  { to: '/shortlist', label: 'Shortlist', icon: 'bookmark' },
  { to: '/profile', label: 'Profile', icon: 'user' },
]
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
      </ul>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 220px;
  flex: none;
  background: var(--glass);
  border-right: 1px solid var(--line);
  padding: 0 0.75rem 1rem;
  position: sticky;
  top: 0;
  height: 100vh;
  backdrop-filter: var(--glass-blur);
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
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
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