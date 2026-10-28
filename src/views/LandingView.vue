<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'

const slides = [
  {
    image: '/images/landing-twin-room.png',
    alt: 'Bright shared bedroom with two single beds and a sunny window',
    label: 'Room to grow together',
    detail: 'Find a shared space that makes everyday living feel easy.',
  },
  {
    image: '/images/landing-bedroom.png',
    alt: 'Calm modern bedroom with a blue bedspread and warm lighting',
    label: 'Your own kind of comfort',
    detail: 'Discover places that feel like home from the moment you arrive.',
  },
  {
    image: '/images/landing-workspace.png',
    alt: 'Warm bedroom and workspace with a desk beside the bed',
    label: 'Space for every routine',
    detail: 'Make room for work, rest, and everything in between.',
  },
  {
    image: '/images/landing-brick-lounge.png',
    alt: 'Cosy living room with brick walls and a comfortable sofa',
    label: 'Make room for connection',
    detail: 'Find a place where the best parts of home are shared.',
  },
  {
    image: '/images/landing-dark-study.png',
    alt: 'Quiet home office with a desk, books, and large windows',
    label: 'A place to focus',
    detail: 'Search for a home that fits your study and work life.',
  },
  {
    image: '/images/landing-bookshelf-lounge.png',
    alt: 'Open-plan living room with a blue sofa and a wall of bookshelves',
    label: 'Bring everyone together',
    detail: 'Turn a shortlist into a home your whole group loves.',
  },
  {
    image: '/images/landing-entertaining.png',
    alt: 'Spacious lounge with a pool table and warm ambient lighting',
    label: 'Find your shared space',
    detail: 'Compare homes with the people you plan to live with.',
  },
  {
    image: '/images/landing-window-bedroom.png',
    alt: 'Light-filled bedroom with large windows and a reading desk',
    label: 'A brighter way to rent',
    detail: 'Explore homes that match your budget and daily commute.',
  },
  {
    image: '/images/landing-city-bedroom.png',
    alt: 'Bedroom with a large window overlooking the city',
    label: 'Your next chapter starts here',
    detail: 'Find a home in Singapore that works for everyone.',
  },
]

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

const activeIndex = ref(0)
const activeSlide = computed(() => slides[activeIndex.value])
const titleLineOne = 'Find a home'
const titleLineTwo = 'that feels '
const titleHighlight = 'right.'
const titleLength = titleLineOne.length + titleLineTwo.length + titleHighlight.length
const typedCharacters = ref(0)
let slideshowTimer
let typewriterTimer

function showSlide(index) {
  activeIndex.value = (index + slides.length) % slides.length
}

function nextSlide() {
  showSlide(activeIndex.value + 1)
}

function previousSlide() {
  showSlide(activeIndex.value - 1)
}

function typeNextCharacter() {
  if (typedCharacters.value < titleLength) {
    typedCharacters.value += 1
    typewriterTimer = window.setTimeout(typeNextCharacter, 75)
    return
  }

  typewriterTimer = window.setTimeout(eraseNextCharacter, 1600)
}

function eraseNextCharacter() {
  if (typedCharacters.value > 0) {
    typedCharacters.value -= 1
    typewriterTimer = window.setTimeout(eraseNextCharacter, 40)
    return
  }

  typewriterTimer = window.setTimeout(typeNextCharacter, 500)
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    typedCharacters.value = titleLength
  } else {
    typewriterTimer = window.setTimeout(typeNextCharacter, 350)
  }

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    slideshowTimer = window.setInterval(nextSlide, 6000)
  }
})

onBeforeUnmount(() => {
  window.clearInterval(slideshowTimer)
  window.clearTimeout(typewriterTimer)
})
</script>

<template>
  <div class="landing">
    <div class="landing-frame">
      <header class="top">
        <router-link to="/" class="brand" aria-label="CoRent home">
          <AppIcon name="logo" :size="28" />
          <span class="word">Co<span class="red">Rent</span></span>
        </router-link>

        <nav class="top-nav" aria-label="Main navigation">
          <router-link to="/login">Log in</router-link>
          <router-link class="nav-cta" to="/register">Sign up</router-link>
        </nav>
      </header>

      <main class="hero">
        <div class="hero-copy">
          <p class="kicker">Find your place, together</p>
          <h1 aria-label="Find a home that feels right.">
            <span class="typewriter" aria-hidden="true">
              <span class="typewriter-line">
                <span
                  v-for="(character, index) in titleLineOne"
                  :key="`line-one-${index}`"
                  class="typewriter-character"
                  :class="{
                    'is-visible': typedCharacters > index,
                    'is-cursor': typedCharacters === index + 1,
                  }"
                  >{{ character }}</span
                >
              </span>
              <span class="typewriter-line">
                <span
                  v-for="(character, index) in titleLineTwo"
                  :key="`line-two-${index}`"
                  class="typewriter-character"
                  :class="{
                    'is-visible': typedCharacters > titleLineOne.length + index,
                    'is-cursor':
                      typedCharacters === titleLineOne.length + index + 1,
                  }"
                  >{{ character }}</span
                ><span class="typewriter-highlight">
                  <span
                    v-for="(character, index) in titleHighlight"
                    :key="`highlight-${index}`"
                    class="typewriter-character"
                    :class="{
                      'is-visible':
                        typedCharacters > titleLineOne.length + titleLineTwo.length + index,
                      'is-cursor':
                        typedCharacters === titleLineOne.length + titleLineTwo.length + index + 1,
                    }"
                    >{{ character }}</span
                  >
                </span>
              </span>
            </span>
          </h1>
          <p class="lead">
            Find your perfect home, together. Compare what matters to everyone and discover a place
            your whole group will love.
          </p>
          <div class="cta">
            <router-link class="btn btn-primary" to="/register">Sign up</router-link>
          </div>
          <div class="slide-caption" aria-live="polite" aria-atomic="true">
            <span class="slide-caption-label">{{ activeSlide.label }}</span>
            <span class="slide-caption-detail">{{ activeSlide.detail }}</span>
          </div>
        </div>

        <div class="slideshow" aria-label="Featured homes">
          <Transition name="slide-fade" mode="out-in">
            <img
              :key="activeSlide.image"
              class="slide-image"
              :src="activeSlide.image"
              :alt="activeSlide.alt"
            />
          </Transition>

          <div class="slide-controls" aria-label="Slideshow controls">
            <div class="slide-dots">
              <button
                v-for="(slide, index) in slides"
                :key="slide.image"
                class="slide-dot"
                :class="{ 'slide-dot-active': activeIndex === index }"
                type="button"
                :aria-label="`Show slide ${index + 1}: ${slide.label}`"
                :aria-current="activeIndex === index ? 'true' : undefined"
                @click="showSlide(index)"
              />
            </div>
            <button class="slide-arrow" type="button" aria-label="Previous image" @click="previousSlide">
              <span aria-hidden="true">←</span>
            </button>
            <button class="slide-arrow" type="button" aria-label="Next image" @click="nextSlide">
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </main>
    </div>

    <section id="how-it-works" class="how" aria-labelledby="how-title">
      <div class="how-heading">
        <p class="kicker">A better way to find home</p>
        <h2 id="how-title">Good homes. Better decisions.</h2>
      </div>
      <ol class="steps">
        <li v-for="step in steps" :key="step.n">
          <span class="num">{{ step.n }}</span>
          <h3>{{ step.title }}</h3>
          <p>{{ step.body }}</p>
        </li>
      </ol>
      <p class="terms">By continuing, you agree to our Terms of Service.</p>
    </section>
  </div>
</template>

<style scoped>
.landing {
  min-height: 100vh;
  padding: 12px;
  background: #fff;
}

.landing-frame {
  min-height: min(840px, calc(100vh - 24px));
  padding: 0 clamp(1.25rem, 7vw, 7.5rem);
  border: 6px solid #d88a76;
  border-radius: 48px;
  overflow: hidden;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 104px;
  gap: 1.5rem;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--red);
  text-decoration: none;
  font-size: 15px;
  font-weight: 700;
}

.word {
  color: var(--text);
}

.top-nav {
  display: flex;
  align-items: center;
  gap: clamp(1rem, 3vw, 2.5rem);
}

.top-nav a {
  color: var(--text);
  text-decoration: none;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.top-nav a:hover,
.text-link:hover {
  color: var(--red);
}

.top-nav .nav-cta {
  padding: 0.75rem 1rem;
  border: 1px solid var(--red);
  border-radius: 3px;
  color: var(--red);
}

.top-nav .nav-cta:hover {
  background: var(--red);
  color: #fff;
}

.hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(270px, 0.82fr) minmax(0, 1.7fr);
  align-items: center;
  min-height: min(620px, calc(100vh - 150px));
  padding: 1.5rem 0 3.75rem;
}

.hero-copy {
  z-index: 1;
  grid-column: 1;
  grid-row: 1;
  margin-right: -4rem;
  padding: clamp(1.5rem, 4vw, 3.5rem);
  background: #f7e5dc;
  container-type: inline-size;
}

.kicker {
  margin-bottom: 1rem;
  color: var(--red);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.hero h1 {
  font-family: var(--font-heading);
  padding-left: 1.25rem;
  border-left: 4px solid #d88a76;
  font-size: clamp(1.75rem, 11cqi, 3.5rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.045em;
}

.typewriter-line {
  display: block;
  white-space: normal;
}

.typewriter-character {
  display: inline-block;
  opacity: 0;
  white-space: pre-wrap;
}

.typewriter-character.is-visible {
  opacity: 1;
}

.typewriter-character.is-cursor::after {
  display: inline-block;
  height: 0.85em;
  margin-left: 0.04em;
  border-right: 2px solid currentColor;
  content: '';
  vertical-align: -0.04em;
  animation: typewriter-cursor 0.7s steps(2, start) infinite;
}

.typewriter-highlight {
  color: var(--red);
}

@keyframes typewriter-cursor {
  to {
    visibility: hidden;
  }
}

.lead {
  max-width: 35ch;
  margin: 1.4rem 0 1.5rem;
  color: #5e5752;
  font-size: 13px;
  line-height: 1.7;
}

.cta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.cta .btn {
  min-height: 46px;
  padding: 0.8rem 1.1rem;
  border-radius: 3px;
}

.slide-caption {
  display: grid;
  gap: 0.25rem;
  margin-top: 2rem;
}

.slide-caption-label {
  font-size: 12px;
  font-weight: 700;
}

.slide-caption-detail {
  color: #716963;
  font-size: 10px;
  line-height: 1.5;
}

.slideshow {
  position: relative;
  grid-column: 2;
  grid-row: 1;
  height: clamp(340px, 43vw, 520px);
  overflow: hidden;
  background: #e9e3dd;
}

.slide-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: opacity 0.35s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
}

.slide-controls {
  position: absolute;
  right: 1rem;
  bottom: 1rem;
  left: 4.5rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 48px;
  padding: 0.5rem 0.65rem;
  background: rgb(255 255 255 / 94%);
}

.slide-dots {
  display: flex;
  flex: 1;
  justify-content: center;
  gap: 0.35rem;
}

.slide-dot {
  width: 7px;
  height: 7px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #d3ccc6;
  cursor: pointer;
}

.slide-dot-active {
  width: 20px;
  border-radius: 10px;
  background: var(--red);
}

.slide-arrow {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: #fff;
  color: var(--text);
  cursor: pointer;
}

.slide-arrow:hover {
  border-color: var(--red);
  color: var(--red);
}

.how {
  padding: 5rem 1.5rem 2rem;
}

.how-heading {
  text-align: center;
}

.how-heading .kicker {
  margin-bottom: 0.6rem;
}

.how-heading h2 {
  font-size: clamp(1.5rem, 3vw, 2.2rem);
  letter-spacing: -0.03em;
}

.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  max-width: 900px;
  margin: 2.5rem auto;
  padding: 0;
  list-style: none;
}

.steps li {
  padding: 1.25rem;
  border: 1px solid transparent;
  border-radius: 12px;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    background-color 180ms ease;
}

.steps li:hover,
.steps li:focus-within {
  transform: translateY(-6px);
  border-color: var(--line);
  background: #fff;
  box-shadow: 0 12px 28px rgb(23 23 23 / 9%);
}

.num {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  margin-bottom: 0.8rem;
  border-radius: 50%;
  background: #f7e5dc;
  color: var(--red);
  font-size: 10px;
  font-weight: 700;
}

.steps h3 {
  margin-bottom: 0.4rem;
  font-size: 13px;
}

.steps p {
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.terms {
  color: var(--muted);
  font-size: 10px;
  text-align: center;
}

@media (max-width: 760px) {
  .landing-frame {
    min-height: unset;
    padding: 0 1.25rem;
    border-width: 4px;
    border-radius: 30px;
  }

  .top {
    min-height: 76px;
  }

  .brand {
    gap: 0.35rem;
    font-size: 13px;
  }

  .top-nav {
    gap: 0.8rem;
  }

  .top-nav a {
    font-size: 9px;
  }

  .top-nav .nav-cta {
    padding: 0.6rem 0.7rem;
  }

  .hero {
    grid-template-columns: 1fr;
    min-height: unset;
    padding: 1.25rem 0 1.5rem;
  }

  .slideshow {
    grid-column: 1;
    grid-row: 1;
    height: clamp(260px, 65vw, 430px);
  }

  .hero-copy {
    grid-column: 1;
    grid-row: 2;
    margin: -2rem 1rem 0;
    padding: 1.5rem;
  }

  .hero h1 {
    font-size: clamp(1.75rem, 11cqi, 3.2rem);
  }

  .slide-caption {
    margin-top: 1.5rem;
  }

  .slide-controls {
    left: 1rem;
  }

  .how {
    padding: 3.5rem 1rem 1.5rem;
  }

  .steps {
    grid-template-columns: 1fr;
    gap: 1.25rem;
    max-width: 440px;
    margin: 1.75rem auto;
  }
}

@media (max-width: 420px) {
  .landing {
    padding: 8px;
  }

  .landing-frame {
    padding: 0 0.85rem;
    border-radius: 24px;
  }

  .top-nav {
    gap: 0.55rem;
  }

  .top-nav a {
    font-size: 8px;
    letter-spacing: 0.04em;
  }

  .top-nav .nav-cta {
    padding: 0.55rem;
  }

  .slide-dots {
    gap: 0.25rem;
  }

  .slide-dot {
    width: 6px;
    height: 6px;
  }

  .slide-dot-active {
    width: 15px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .slide-fade-enter-active,
  .slide-fade-leave-active {
    transition: none;
  }

  .steps li {
    transition: none;
  }

  .typewriter-character.is-cursor::after {
    animation: none;
    visibility: hidden;
  }
}
</style>
