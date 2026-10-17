<script setup>
import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import FlowTopBar from '@/components/FlowTopBar.vue'

const route = useRoute()
const router = useRouter()

// /preferences?edit=1 reopens this page for returning users.
const editing = computed(() => route.query.edit === '1')

// Prototype navigation only. Logic layer replaces this with saving preferences.
function onSave() {
  router.push('/home')
}

/* ---- Option labels ---- */
const LIMITS = { budgetMin: 500, budgetMax: 8000, commuteMin: 5, commuteMax: 90 }

const choicesTop = [
  { key: 'propertyType', title: 'Property Type', options: ['HDB', 'Condo', 'Landed', 'Any'] },
  { key: 'leaseDuration', title: 'Lease Duration', options: ['6 months', '12 months', '24 months', 'Flexible'] },
]
const choicesBottom = [
  { key: 'furnishing', title: 'Furnishing Level', options: ['Unfurnished', 'Partially Furnished', 'Fully Furnished', 'Any'] },
  { key: 'cooking', title: 'Cooking Access', options: ['Kitchen Access Required', 'No Cooking Needed', 'No Preference'] },
  { key: 'aircon', title: 'Aircon Coverage', options: ['Aircon in All Rooms', 'Common Areas Only', 'Not Required'] },
  { key: 'smoking', title: 'Smoking Preference', options: ['Smoking Allowed', 'Non-Smoking Only', 'No Preference'] },
  { key: 'study', title: 'Study Environment', options: ['Quiet Study Space Needed', 'Sociable Household OK', 'No Preference'] },
  { key: 'guests', title: 'Guest Policy', options: ['Guests Welcome', 'Limited Guests', 'No Guests Preferred'] },
]
const amenityOptions = [
  { label: 'WiFi', icon: 'wifi' },
  { label: 'Aircon', icon: 'aircon' },
  { label: 'Pet-friendly', icon: 'paw' },
  { label: 'Gym', icon: 'gym' },
  { label: 'Pool', icon: 'pool' },
  { label: 'Parking', icon: 'car' },
  { label: 'Laundry', icon: 'laundry' },
  { label: 'Balcony', icon: 'sun' },
]
const locationOptions = ['Any location', 'Tampines', 'Bukit Timah', 'Queenstown', 'Bugis', 'Clementi', 'Bishan', 'Jurong', 'Punggol']

/* ---- Editable state (starting values are sample data) ---- */
const prefs = reactive({
  budgetMin: 1500,
  budgetMax: 3200,
  maxCommute: 30,
  anyBedrooms: false,
  bedroomsMin: 3,
  bedroomsMax: 4,
  moveInDate: '2026-12-01',
  coTenants: 3,
  propertyType: 'Condo',
  leaseDuration: '12 months',
  furnishing: 'Fully Furnished',
  cooking: 'Kitchen Access Required',
  aircon: 'Aircon in All Rooms',
  smoking: 'Non-Smoking Only',
  study: 'Quiet Study Space Needed',
  guests: 'Limited Guests',
  amenities: ['WiFi', 'Aircon'],
  locations: ['Queenstown', 'Clementi'],
})

/* ---- Interaction helpers (UI only) ---- */
const money = (n) => `$${Number(n).toLocaleString('en-SG')}`
const pct = (v, min, max) => ((v - min) / (max - min)) * 100

const budgetFill = computed(() => ({
  left: `${pct(prefs.budgetMin, LIMITS.budgetMin, LIMITS.budgetMax)}%`,
  width: `${pct(prefs.budgetMax, LIMITS.budgetMin, LIMITS.budgetMax) - pct(prefs.budgetMin, LIMITS.budgetMin, LIMITS.budgetMax)}%`,
}))
const commuteFill = computed(() => ({
  left: '0%',
  width: `${pct(prefs.maxCommute, LIMITS.commuteMin, LIMITS.commuteMax)}%`,
}))

// Keep the two budget thumbs from crossing.
function onBudgetMin(e) {
  prefs.budgetMin = Math.min(Number(e.target.value), prefs.budgetMax - 50)
  e.target.value = prefs.budgetMin
}
function onBudgetMax(e) {
  prefs.budgetMax = Math.max(Number(e.target.value), prefs.budgetMin + 50)
  e.target.value = prefs.budgetMax
}

function stepBeds(which, delta) {
  prefs.anyBedrooms = false
  if (which === 'min') prefs.bedroomsMin = Math.min(Math.max(1, prefs.bedroomsMin + delta), prefs.bedroomsMax)
  else prefs.bedroomsMax = Math.min(Math.max(prefs.bedroomsMin, prefs.bedroomsMax + delta), 6)
}
function stepCoTenants(delta) {
  prefs.coTenants = Math.min(Math.max(1, prefs.coTenants + delta), 5)
}

function toggle(list, value) {
  const i = list.indexOf(value)
  if (i === -1) list.push(value)
  else list.splice(i, 1)
}
function toggleLocation(value) {
  if (value === 'Any location') {
    prefs.locations = prefs.locations.includes(value) ? [] : [value]
    return
  }
  const without = prefs.locations.filter((l) => l !== 'Any location')
  prefs.locations = without.includes(value) ? without.filter((l) => l !== value) : [...without, value]
}

const summaryRows = computed(() => [
  ['Budget', `${money(prefs.budgetMin)} to ${money(prefs.budgetMax)}/mo`],
  ['Commute', `up to ${prefs.maxCommute} min`],
  ['Bedrooms', prefs.anyBedrooms ? 'Any' : `${prefs.bedroomsMin} to ${prefs.bedroomsMax}`],
  ['Property', prefs.propertyType],
  ['Lease', prefs.leaseDuration],
  ['Co-tenants', `${prefs.coTenants} ${prefs.coTenants === 1 ? 'person' : 'people'}`],
])
</script>

<template>
  <div>
    <FlowTopBar
      :title="editing ? 'Edit Preferences' : 'My Preferences'"
      :back-to="editing ? '/home' : '/register'"
    />

    <div class="prefs-grid">
      <!-- ===== Left: form ===== -->
      <form class="forms" novalidate @submit.prevent="onSave">
        <!-- Budget -->
        <section class="card" aria-labelledby="budget-title">
          <div class="between">
            <h2 id="budget-title">Budget Range</h2>
            <strong class="red value-text">
              {{ money(prefs.budgetMin) }} to {{ money(prefs.budgetMax) }}<span>/mo</span>
            </strong>
          </div>
          <div class="range">
            <span class="track"></span>
            <span class="fill" :style="budgetFill"></span>
            <input
              type="range"
              :min="LIMITS.budgetMin"
              :max="LIMITS.budgetMax"
              step="50"
              :value="prefs.budgetMin"
              aria-label="Minimum budget"
              @input="onBudgetMin"
            />
            <input
              type="range"
              :min="LIMITS.budgetMin"
              :max="LIMITS.budgetMax"
              step="50"
              :value="prefs.budgetMax"
              aria-label="Maximum budget"
              @input="onBudgetMax"
            />
          </div>
          <div class="slider-scale"><span>{{ money(LIMITS.budgetMin) }}</span><span>{{ money(LIMITS.budgetMax) }}</span></div>
        </section>

        <!-- Commute -->
        <section class="card" aria-labelledby="commute-title">
          <div class="between">
            <h2 id="commute-title">Max Commute</h2>
            <strong class="red value-text">{{ prefs.maxCommute }} min</strong>
          </div>
          <div class="range">
            <span class="track"></span>
            <span class="fill" :style="commuteFill"></span>
            <input
              v-model.number="prefs.maxCommute"
              type="range"
              :min="LIMITS.commuteMin"
              :max="LIMITS.commuteMax"
              step="5"
              aria-label="Maximum commute in minutes"
            />
          </div>
          <div class="slider-scale"><span>{{ LIMITS.commuteMin }} min</span><span>{{ LIMITS.commuteMax }} min</span></div>
        </section>

        <!-- Bedrooms -->
        <section class="card" aria-labelledby="beds-title">
          <div class="between" style="align-items: flex-start">
            <div>
              <h2 id="beds-title">Bedrooms</h2>
              <p class="card-sub">Min to max bedrooms required</p>
            </div>
            <button
              class="chip"
              :class="{ on: prefs.anyBedrooms }"
              type="button"
              :aria-pressed="prefs.anyBedrooms"
              @click="prefs.anyBedrooms = !prefs.anyBedrooms"
            >
              Any
            </button>
          </div>
          <div class="beds" :class="{ dim: prefs.anyBedrooms }">
            <div>
              <p class="eyebrow">Min</p>
              <div class="stepper">
                <button class="step-btn" type="button" aria-label="Decrease minimum" @click="stepBeds('min', -1)"><AppIcon name="minus" :size="12" /></button>
                <span class="value">{{ prefs.bedroomsMin }}</span>
                <button class="step-btn plus" type="button" aria-label="Increase minimum" @click="stepBeds('min', 1)"><AppIcon name="plus" :size="12" /></button>
              </div>
            </div>
            <div class="beds-divider" aria-hidden="true"></div>
            <div>
              <p class="eyebrow">Max</p>
              <div class="stepper">
                <button class="step-btn" type="button" aria-label="Decrease maximum" @click="stepBeds('max', -1)"><AppIcon name="minus" :size="12" /></button>
                <span class="value">{{ prefs.bedroomsMax }}</span>
                <button class="step-btn plus" type="button" aria-label="Increase maximum" @click="stepBeds('max', 1)"><AppIcon name="plus" :size="12" /></button>
              </div>
            </div>
          </div>
        </section>

        <!-- Move-in -->
        <section class="card" aria-labelledby="move-title">
          <h2 id="move-title">Move-in Date</h2>
          <input v-model="prefs.moveInDate" class="input" type="date" aria-labelledby="move-title" style="margin-top: 0.7rem" />
        </section>

        <!-- Property type, lease -->
        <section v-for="g in choicesTop" :key="g.key" class="card" :aria-label="g.title">
          <h2>{{ g.title }}</h2>
          <div class="chips">
            <button
              v-for="o in g.options"
              :key="o"
              type="button"
              class="chip"
              :class="{ on: prefs[g.key] === o }"
              :aria-pressed="prefs[g.key] === o"
              @click="prefs[g.key] = o"
            >
              {{ o }}
            </button>
          </div>
        </section>

        <!-- Co-tenants -->
        <section class="card between" aria-labelledby="co-title">
          <div>
            <h2 id="co-title">Co-tenants</h2>
            <p class="card-sub">Number of people you expect to share with</p>
          </div>
          <div class="stepper">
            <button class="step-btn" type="button" aria-label="Fewer co-tenants" @click="stepCoTenants(-1)"><AppIcon name="minus" :size="12" /></button>
            <span class="value">{{ prefs.coTenants }}</span>
            <button class="step-btn plus" type="button" aria-label="More co-tenants" @click="stepCoTenants(1)"><AppIcon name="plus" :size="12" /></button>
          </div>
        </section>

        <!-- Furnishing, cooking, aircon, smoking, study, guests -->
        <section v-for="g in choicesBottom" :key="g.key" class="card" :aria-label="g.title">
          <h2>{{ g.title }}</h2>
          <div class="chips">
            <button
              v-for="o in g.options"
              :key="o"
              type="button"
              class="chip"
              :class="{ on: prefs[g.key] === o }"
              :aria-pressed="prefs[g.key] === o"
              @click="prefs[g.key] = o"
            >
              {{ o }}
            </button>
          </div>
        </section>

        <!-- Amenities -->
        <section class="card" aria-labelledby="amen-title">
          <h2 id="amen-title">Amenities</h2>
          <div class="chips">
            <button
              v-for="a in amenityOptions"
              :key="a.label"
              type="button"
              class="chip"
              :class="{ on: prefs.amenities.includes(a.label) }"
              :aria-pressed="prefs.amenities.includes(a.label)"
              @click="toggle(prefs.amenities, a.label)"
            >
              <AppIcon :name="a.icon" :size="11" />
              {{ a.label }}
            </button>
          </div>
        </section>

        <!-- Locations -->
        <section class="card" aria-labelledby="loc-title">
          <h2 id="loc-title">Preferred Locations</h2>
          <p class="card-sub">Select all neighbourhoods you'd consider</p>
          <div class="chips">
            <button
              v-for="l in locationOptions"
              :key="l"
              type="button"
              class="chip"
              :class="{ 'on-dark': prefs.locations.includes(l) }"
              :aria-pressed="prefs.locations.includes(l)"
              @click="toggleLocation(l)"
            >
              <AppIcon v-if="l !== 'Any location'" name="pin" :size="11" />
              {{ l }}
            </button>
          </div>
        </section>

        <button class="btn btn-primary btn-block" type="submit">
          {{ editing ? 'Save Changes' : 'Save Preferences' }}
        </button>
      </form>

      <!-- ===== Right: live summary ===== -->
      <aside class="card summary" aria-label="Profile summary">
        <p class="eyebrow">Profile summary</p>
        <dl>
          <div v-for="[label, value] in summaryRows" :key="label">
            <dt>{{ label }}</dt>
            <dd>{{ value }}</dd>
          </div>
        </dl>
        <p class="summary-label">Amenities</p>
        <div class="chips tight">
          <span v-for="a in prefs.amenities" :key="a" class="tag tag-red">{{ a }}</span>
          <span v-if="!prefs.amenities.length" class="small muted">None selected</span>
        </div>
        <p class="summary-label">Locations</p>
        <div class="chips tight">
          <span v-for="l in prefs.locations" :key="l" class="tag">{{ l }}</span>
          <span v-if="!prefs.locations.length" class="small muted">None selected</span>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.prefs-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 230px;
  gap: 1rem;
  max-width: 720px;
  margin: 1.25rem auto 3rem;
  padding: 0 1rem;
  align-items: start;
}
.forms { display: flex; flex-direction: column; gap: 0.75rem; }
.value-text { font-size: 13px; }
.value-text span { font-weight: 500; font-size: 10px; color: var(--muted); }

/* Native range sliders drawn in the CoRent style */
.range { position: relative; height: 16px; margin: 0.9rem 0 0.2rem; }
.track { position: absolute; left: 0; right: 0; top: 6px; height: 4px; border-radius: 4px; background: #e5e2df; }
.fill { position: absolute; top: 6px; height: 4px; border-radius: 4px; background: var(--red); }
.range input[type='range'] {
  position: absolute; inset: 0; width: 100%; height: 16px; margin: 0;
  background: none; pointer-events: none; -webkit-appearance: none; appearance: none;
}
.range input[type='range']::-webkit-slider-runnable-track { background: transparent; height: 16px; }
.range input[type='range']::-moz-range-track { background: transparent; }
.range input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; pointer-events: auto; cursor: pointer;
  width: 16px; height: 16px; border-radius: 50%; background: var(--red);
  border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.range input[type='range']::-moz-range-thumb {
  pointer-events: auto; cursor: pointer; width: 12px; height: 12px; border-radius: 50%;
  background: var(--red); border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.beds { display: flex; align-items: center; gap: 1.25rem; margin-top: 0.8rem; }
.beds.dim { opacity: 0.45; }
.beds .eyebrow { margin-bottom: 0.4rem; }
.beds-divider { width: 1px; align-self: stretch; background: var(--line); }

.summary { position: sticky; top: 72px; }
.summary dl { margin: 0.7rem 0 0.9rem; display: grid; gap: 0.5rem; }
.summary dl div { display: flex; justify-content: space-between; gap: 0.75rem; font-size: 12px; }
.summary dt { color: var(--muted); }
.summary dd { margin: 0; font-weight: 600; text-align: right; }
.summary-label { font-size: 11px; color: var(--muted); margin-top: 0.75rem; }
.chips.tight { margin-top: 0.4rem; }

@media (max-width: 860px) {
  .prefs-grid { grid-template-columns: 1fr; }
  .summary { position: static; order: -1; }
}
</style>