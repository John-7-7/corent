<script setup>
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import FlowTopBar from '@/components/FlowTopBar.vue'

const router = useRouter()

// Prototype navigation only. Logic layer replaces this with saving preferences.
function onSave() {
  router.push('/home')
}

// Static sample data for the hardcoded version.
const choicesTop = [
  { title: 'Property Type', options: ['HDB', 'Condo', 'Landed', 'Any'], selected: 'Condo' },
  { title: 'Lease Duration', options: ['6 months', '12 months', '24 months', 'Flexible'], selected: '12 months' },
]
const choicesBottom = [
  { title: 'Furnishing Level', options: ['Unfurnished', 'Partially Furnished', 'Fully Furnished', 'Any'], selected: 'Fully Furnished' },
  { title: 'Cooking Access', options: ['Kitchen Access Required', 'No Cooking Needed', 'No Preference'], selected: 'Kitchen Access Required' },
  { title: 'Aircon Coverage', options: ['Aircon in All Rooms', 'Common Areas Only', 'Not Required'], selected: 'Aircon in All Rooms' },
  { title: 'Smoking Preference', options: ['Smoking Allowed', 'Non-Smoking Only', 'No Preference'], selected: 'Non-Smoking Only' },
  { title: 'Study Environment', options: ['Quiet Study Space Needed', 'Sociable Household OK', 'No Preference'], selected: 'Quiet Study Space Needed' },
  { title: 'Guest Policy', options: ['Guests Welcome', 'Limited Guests', 'No Guests Preferred'], selected: 'Limited Guests' },
]
const amenities = [
  { label: 'WiFi', icon: 'wifi', on: true },
  { label: 'Aircon', icon: 'aircon', on: true },
  { label: 'Pet-friendly', icon: 'paw', on: false },
  { label: 'Gym', icon: 'gym', on: false },
  { label: 'Pool', icon: 'pool', on: false },
  { label: 'Parking', icon: 'car', on: false },
  { label: 'Laundry', icon: 'laundry', on: false },
  { label: 'Balcony', icon: 'sun', on: false },
]
const locations = [
  { label: 'Any location', on: false, any: true },
  { label: 'Tampines', on: false },
  { label: 'Bukit Timah', on: false },
  { label: 'Queenstown', on: true },
  { label: 'Bugis', on: false },
  { label: 'Clementi', on: true },
  { label: 'Bishan', on: false },
  { label: 'Jurong', on: false },
  { label: 'Punggol', on: false },
]
</script>

<template>
  <div>
    <FlowTopBar title="My Preferences" back-to="/register" />

    <div class="prefs-grid">
      <!-- ===== Left: form ===== -->
      <form class="forms" novalidate @submit.prevent="onSave">
        <!-- Budget -->
        <section class="card" aria-labelledby="budget-title">
          <div class="between">
            <h2 id="budget-title">Budget Range</h2>
            <strong class="red value-text">$1,500 to $3,200<span>/mo</span></strong>
          </div>
          <div class="slider" role="img" aria-label="Budget from $1,500 to $3,200 per month">
            <span class="slider-fill" style="left: 13.3%; width: 22.7%"></span>
            <span class="slider-thumb" style="left: 13.3%"></span>
            <span class="slider-thumb" style="left: 36%"></span>
          </div>
          <div class="slider-scale"><span>$500</span><span>$8,000</span></div>
        </section>

        <!-- Commute -->
        <section class="card" aria-labelledby="commute-title">
          <div class="between">
            <h2 id="commute-title">Max Commute</h2>
            <strong class="red value-text">30 min</strong>
          </div>
          <div class="slider" role="img" aria-label="Maximum commute 30 minutes">
            <span class="slider-fill" style="left: 0; width: 29.4%"></span>
            <span class="slider-thumb" style="left: 29.4%"></span>
          </div>
          <div class="slider-scale"><span>5 min</span><span>90 min</span></div>
        </section>

        <!-- Bedrooms -->
        <section class="card" aria-labelledby="beds-title">
          <div class="between" style="align-items: flex-start">
            <div>
              <h2 id="beds-title">Bedrooms</h2>
              <p class="card-sub">Min to max bedrooms required</p>
            </div>
            <button class="chip" type="button">Any</button>
          </div>
          <div class="beds">
            <div>
              <p class="eyebrow">Min</p>
              <div class="stepper">
                <button class="step-btn" type="button" aria-label="Decrease minimum"><AppIcon name="minus" :size="12" /></button>
                <span class="value">3</span>
                <button class="step-btn plus" type="button" aria-label="Increase minimum"><AppIcon name="plus" :size="12" /></button>
              </div>
            </div>
            <div class="beds-divider" aria-hidden="true"></div>
            <div>
              <p class="eyebrow">Max</p>
              <div class="stepper">
                <button class="step-btn" type="button" aria-label="Decrease maximum"><AppIcon name="minus" :size="12" /></button>
                <span class="value">4</span>
                <button class="step-btn plus" type="button" aria-label="Increase maximum"><AppIcon name="plus" :size="12" /></button>
              </div>
            </div>
          </div>
        </section>

        <!-- Move-in -->
        <section class="card" aria-labelledby="move-title">
          <h2 id="move-title">Move-in Date</h2>
          <input class="input" type="date" value="2026-12-01" aria-labelledby="move-title" style="margin-top: 0.7rem" />
        </section>

        <!-- Property type, lease -->
        <section v-for="g in choicesTop" :key="g.title" class="card" :aria-label="g.title">
          <h2>{{ g.title }}</h2>
          <div class="chips">
            <button
              v-for="o in g.options"
              :key="o"
              type="button"
              class="chip"
              :class="{ on: o === g.selected }"
              :aria-pressed="o === g.selected"
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
            <button class="step-btn" type="button" aria-label="Fewer co-tenants"><AppIcon name="minus" :size="12" /></button>
            <span class="value">3</span>
            <button class="step-btn plus" type="button" aria-label="More co-tenants"><AppIcon name="plus" :size="12" /></button>
          </div>
        </section>

        <!-- Furnishing, cooking, aircon, smoking, study, guests -->
        <section v-for="g in choicesBottom" :key="g.title" class="card" :aria-label="g.title">
          <h2>{{ g.title }}</h2>
          <div class="chips">
            <button
              v-for="o in g.options"
              :key="o"
              type="button"
              class="chip"
              :class="{ on: o === g.selected }"
              :aria-pressed="o === g.selected"
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
              v-for="a in amenities"
              :key="a.label"
              type="button"
              class="chip"
              :class="{ on: a.on }"
              :aria-pressed="a.on"
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
              v-for="l in locations"
              :key="l.label"
              type="button"
              class="chip"
              :class="{ 'on-dark': l.on }"
              :aria-pressed="l.on"
            >
              <AppIcon v-if="!l.any" name="pin" :size="11" />
              {{ l.label }}
            </button>
          </div>
        </section>

        <button class="btn btn-primary btn-block" type="submit">Save Preferences</button>
      </form>

      <!-- ===== Right: summary ===== -->
      <aside class="card summary" aria-label="Profile summary">
        <p class="eyebrow">Profile summary</p>
        <dl>
          <div><dt>Budget</dt><dd>$1,500 to $3,200/mo</dd></div>
          <div><dt>Commute</dt><dd>up to 30 min</dd></div>
          <div><dt>Bedrooms</dt><dd>3 to 4</dd></div>
          <div><dt>Property</dt><dd>Condo</dd></div>
          <div><dt>Lease</dt><dd>12 months</dd></div>
          <div><dt>Co-tenants</dt><dd>3 people</dd></div>
        </dl>
        <p class="summary-label">Amenities</p>
        <div class="chips tight">
          <span class="tag tag-red">WiFi</span>
          <span class="tag tag-red">Aircon</span>
        </div>
        <p class="summary-label">Locations</p>
        <div class="chips tight">
          <span class="tag">Clementi</span>
          <span class="tag">Queenstown</span>
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

.beds { display: flex; align-items: center; gap: 1.25rem; margin-top: 0.8rem; }
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