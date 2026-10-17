<script setup>
import AppIcon from '@/components/AppIcon.vue'

const picks = [
  { title: 'Clementi Ave 2 Condo', price: '$2,800', area: 'Clementi', match: 94, tone: '' },
  { title: 'Tampines St 86 HDB', price: '$2,200', area: 'Tampines', match: 87, tone: 'alt' },
]
</script>

<template>
  <div>
    <header class="page-head">
      <h1>Home</h1>
      <p>Welcome back, Alice</p>
    </header>

    <div class="content">
      <div class="stack">
        <!-- Quick actions -->
        <div class="actions">
          <button class="action action-primary" type="button">
            <AppIcon name="plus" :size="16" />
            <strong>Create Group</strong>
            <span>Start a new hunt</span>
          </button>
          <router-link class="action" to="/listings">
            <span class="red"><AppIcon name="search" :size="16" /></span>
            <strong>Browse Solo</strong>
            <span>Explore listings</span>
          </router-link>
        </div>

        <!-- Preferences summary -->
        <section class="card between" aria-label="My preferences">
          <div>
            <p class="eyebrow">My preferences</p>
            <p class="pref-line">Budget: $1,500 to $3,200 · 30 min · 3+ rooms</p>
          </div>
          <router-link class="link edit" to="/profile">
            <AppIcon name="edit" :size="13" /> Edit
          </router-link>
        </section>

        <!-- My group -->
        <h2 class="section-title">My Group</h2>
        <article class="card between group-row">
          <div>
            <h3>Flat Hunt 2025</h3>
            <p class="small muted meta">
              <span class="row-inline"><AppIcon name="users" :size="12" /> 4 members</span>
              <span>Browsing listings</span>
            </p>
          </div>
          <div class="row">
            <div class="match">
              <strong>91%</strong>
              <span>match</span>
            </div>
            <span class="muted"><AppIcon name="chevron" :size="14" /></span>
            <button class="icon-btn" type="button" aria-label="Group options">
              <AppIcon name="dots" :size="16" />
            </button>
          </div>
        </article>

        <!-- Join via link -->
        <form class="card" aria-labelledby="join-title" @submit.prevent>
          <h3 id="join-title">Join via Invite Link</h3>
          <div class="join-row">
            <label for="invite" class="sr-only">Invite link</label>
            <input id="invite" class="input" type="text" placeholder="Paste invite link here" />
            <button class="btn btn-primary" type="submit">Join</button>
          </div>
        </form>

        <!-- Top picks -->
        <div class="between">
          <h2 class="section-title">Top Picks for You</h2>
          <router-link class="link" to="/listings">See all</router-link>
        </div>
        <article v-for="p in picks" :key="p.title" class="pick">
          <div class="thumb" :class="p.tone" aria-hidden="true"></div>
          <div class="pick-body">
            <div class="between" style="align-items: flex-start">
              <h3>{{ p.title }}</h3>
              <span class="pill">{{ p.match }}%</span>
            </div>
            <p class="price">{{ p.price }}<span class="muted">/mo</span></p>
            <p class="small muted row-inline"><AppIcon name="pin" :size="11" /> {{ p.area }}</p>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.action {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left;
  background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 0.9rem;
  color: var(--text); font: inherit; cursor: pointer; text-decoration: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.action strong { font-size: 13px; margin-top: 0.5rem; }
.action span { font-size: 11px; color: var(--muted); }
.action-primary { background: var(--red); border-color: var(--red); color: #fff; }
.action-primary span { color: #f6d3d3; }
.action-primary:hover { background: var(--red-dark); }

.pref-line { font-size: 12.5px; margin-top: 0.3rem; }
.edit { display: inline-flex; align-items: center; gap: 0.25rem; }
.row-inline { display: inline-flex; align-items: center; gap: 0.25rem; }

.group-row .meta { display: flex; gap: 0.8rem; margin-top: 0.3rem; }
.match { text-align: right; line-height: 1.1; color: var(--red); }
.match strong { display: block; font-size: 14px; }
.match span { font-size: 10px; }

.join-row { display: flex; gap: 0.5rem; margin-top: 0.7rem; }
.join-row .input { flex: 1; min-width: 0; padding: 0.55rem 0.8rem; }

.pick {
  display: flex; background: #fff; border: 1px solid var(--line); border-radius: 12px;
  overflow: hidden; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.pick .thumb { width: 64px; min-height: 64px; }
.pick-body { flex: 1; min-width: 0; padding: 0.65rem 0.8rem; display: grid; gap: 2px; }
.price { color: var(--red); font-weight: 700; font-size: 13px; }
.price span { font-weight: 400; font-size: 11px; }
</style>