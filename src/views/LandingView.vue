<script setup>
import AppIcon from '@/components/AppIcon.vue'

const steps = [
  {
    n: '01',
    title: 'Set your preferences',
    body: 'Budget, commute time, location, and amenities. Your profile powers every recommendation.',
  },
  {
    n: '02',
    title: 'Match as a group',
    body: 'Invite housemates, compare individual preferences, and browse listings scored for everyone.',
  },
  {
    n: '03',
    title: 'Find your home',
    body: 'Shortlist, react, discuss, and lock in the property your whole group agrees on.',
  },
]
</script>

<template>
  <div class="landing">
    <header class="top">
      <router-link to="/" class="brand">
        <AppIcon name="logo" :size="22" />
        <span class="word">Co<span class="red">Rent</span></span>
      </router-link>
      <router-link class="btn btn-sm btn-outline" to="/login">Log in</router-link>
    </header>

    <main class="hero">
      <p class="kicker">Singapore collaborative rental platform</p>
      <h1>
        Find your perfect home,
        <span class="red">together.</span>
      </h1>
      <p class="lead">
        Set preferences, match as a group, and find a place everyone loves. Built for student
        tenants and co-renters across Singapore.
      </p>
      <div class="cta">
        <router-link class="btn btn-primary" to="/register">Create an account</router-link>
        <router-link class="btn btn-outline" to="/login">Log in</router-link>
      </div>
    </main>

    <section class="how" aria-labelledby="how-title">
      <h2 id="how-title" class="eyebrow">How it works</h2>
      <ol class="steps">
        <li v-for="s in steps" :key="s.n">
          <span class="num">{{ s.n }}</span>
          <h3>{{ s.title }}</h3>
          <p>{{ s.body }}</p>
        </li>
      </ol>
      <p class="terms">By continuing, you agree to our Terms of Service.</p>
    </section>
  </div>
</template>

<style scoped>
.landing { min-height: 100vh; display: flex; flex-direction: column; background: #fff; }

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 1.5rem;
  border-bottom: 1px solid var(--line);
}
.brand { display: flex; align-items: center; gap: 0.5rem; color: var(--red); text-decoration: none; font-size: 13px; font-weight: 700; }
.word { color: var(--text); }

.btn-outline { background: #fff; border-color: var(--red); color: var(--red); }
.btn-outline:hover { background: var(--red-tint); }

.hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem 1.25rem;
}
.kicker {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--red);
  margin-bottom: 1rem;
}
.hero h1 {
  font-size: clamp(2.1rem, 5vw, 2.9rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
}
.hero h1 span { display: block; }
.lead { max-width: 34ch; margin: 1.25rem 0 1.75rem; color: #666; font-size: 14px; line-height: 1.6; }
.cta { display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center; }
.cta .btn { padding: 0.8rem 1.4rem; }

.how { background: #f7f7f7; padding: 2rem 1.25rem 1.5rem; }
.how .eyebrow { text-align: center; }
.steps {
  list-style: none;
  margin: 1.5rem auto;
  padding: 0;
  max-width: 540px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}
.num {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--red-tint);
  color: var(--red);
  font-size: 9px;
  font-weight: 700;
  margin-bottom: 0.6rem;
}
.steps h3 { font-size: 12px; margin-bottom: 0.3rem; }
.steps p { font-size: 11.5px; color: var(--muted); line-height: 1.5; }
.terms { text-align: center; font-size: 10.5px; color: var(--muted); }

@media (max-width: 640px) {
  .steps { grid-template-columns: 1fr; }
}
</style>