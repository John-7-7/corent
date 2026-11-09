<script setup>
import { computed, ref, watch } from 'vue'
import {
  agreedPerPersonBudget,
  householdSize,
  matchesAgreedFilters,
  money,
  shareOf,
} from './groupFilters'

/**
 * "What if we spent a bit more (or less)?" Slides the per-person budget and
 * shows, live, how many listings that buys and where. Purely a calculation over
 * the listings already loaded; it never changes the group's agreed budget.
 */
const props = defineProps({
  // Every Housing_Listing record.
  listings: { type: Array, default: () => [] },
  groupPreference: { type: Object, default: null },
  memberCount: { type: Number, default: 1 },
  // ListingIDs on the shortlist, to show which ones move in or out of budget.
  shortlistedIds: { type: Array, default: () => [] },
})

const DEFAULT_BUDGET = 1500
const STEP = 50
const roundToStep = (value) => Math.round(value / STEP) * STEP

const people = computed(() => householdSize(props.groupPreference, props.memberCount))
const agreed = computed(() => agreedPerPersonBudget(props.groupPreference, props.memberCount))
const baseline = computed(() => roundToStep(agreed.value ?? DEFAULT_BUDGET))

const min = computed(() => Math.max(STEP * 4, roundToStep(baseline.value - 1000)))
const max = computed(() => roundToStep(baseline.value + 1500))

const budget = ref(baseline.value)
// Follow the agreed budget when it changes (a vote settles), unless the user is
// mid-exploration and has moved off it.
watch(baseline, (next, previous) => {
  if (budget.value === previous) budget.value = next
})

const useAgreedFilters = ref(true)
const hasAgreedFilters = computed(() => {
  const pref = props.groupPreference
  return !!(
    pref &&
    ((pref.PropertyType && pref.PropertyType !== 'Any') ||
      pref.PreferredRegions?.length ||
      pref.BedroomsMin ||
      pref.BedroomsMax)
  )
})

const pool = computed(() =>
  props.listings.filter(
    (listing) =>
      listing.IsAvailable !== false &&
      Number(listing.MonthlyRent) > 0 &&
      (!useAgreedFilters.value || matchesAgreedFilters(listing, props.groupPreference)),
  ),
)

const fits = (listing, cap) => shareOf(listing, people.value) <= cap
const countAt = (cap) => pool.value.filter((listing) => fits(listing, cap)).length

const nowCount = computed(() => countAt(budget.value))
const baseCount = computed(() => countAt(baseline.value))
const delta = computed(() => nowCount.value - baseCount.value)
const share = computed(() => (pool.value.length ? Math.round((nowCount.value / pool.value.length) * 100) : 0))

const regions = computed(() => {
  const byRegion = new Map()
  for (const listing of pool.value) {
    const name = listing.Region || 'Region not listed'
    const entry = byRegion.get(name) ?? { name, total: 0, base: 0, now: 0 }
    entry.total += 1
    if (fits(listing, baseline.value)) entry.base += 1
    if (fits(listing, budget.value)) entry.now += 1
    byRegion.set(name, entry)
  }
  return [...byRegion.values()]
    .sort((a, b) => b.total - a.total)
    .map((entry) => ({
      ...entry,
      // Bar segments as % of that region's listings.
      kept: (Math.min(entry.base, entry.now) / entry.total) * 100,
      gained: (Math.max(entry.now - entry.base, 0) / entry.total) * 100,
      lost: (Math.max(entry.base - entry.now, 0) / entry.total) * 100,
    }))
})

const shortlisted = computed(() =>
  props.listings
    .filter((listing) => props.shortlistedIds.includes(listing.ListingID))
    .map((listing) => {
      const each = shareOf(listing, people.value)
      return {
        id: listing.ListingID,
        title: listing.Title,
        each,
        fitsNow: each <= budget.value,
        fitsBase: each <= baseline.value,
        gap: each - budget.value,
      }
    })
    .sort((a, b) => a.each - b.each),
)

const nudges = computed(() => [
  { label: '−$200', value: baseline.value - 200 },
  { label: agreed.value ? 'Agreed' : 'Start', value: baseline.value },
  { label: '+$200', value: baseline.value + 200 },
  { label: '+$500', value: baseline.value + 500 },
].filter((nudge) => nudge.value >= min.value && nudge.value <= max.value))

const deltaText = computed(() => {
  const d = budget.value - baseline.value
  if (d === 0) return agreed.value ? 'the agreed budget' : 'the starting point'
  return `${d > 0 ? '+' : '−'}${money(Math.abs(d))} vs ${agreed.value ? 'agreed' : 'start'}`
})
</script>

<template>
  <section class="wi" aria-labelledby="wi-title">
    <header class="wi-head">
      <div>
        <h3 id="wi-title">What if we changed our budget?</h3>
        <p>
          Slide the rent each person pays and see how many listings it opens up.
          Shares assume {{ people }} {{ people === 1 ? 'person' : 'people' }} split the rent equally.
          <template v-if="!agreed">
            Your group hasn't agreed a budget yet, so this starts at {{ money(DEFAULT_BUDGET) }} each.
          </template>
        </p>
      </div>
    </header>

    <div class="wi-readout" aria-live="polite">
      <p class="wi-budget">
        {{ money(budget) }}<span> each / month</span>
      </p>
      <p class="wi-sub">{{ deltaText }} · {{ money(budget * people) }} total rent</p>
    </div>

    <label class="sr-only" for="wi-range">Budget per person</label>
    <input
      id="wi-range"
      v-model.number="budget"
      class="wi-range"
      type="range"
      :min="min"
      :max="max"
      :step="STEP"
      :aria-valuetext="`${money(budget)} per person`"
      :style="{ '--fill': `${((budget - min) / (max - min)) * 100}%` }"
    />
    <div class="wi-scale" aria-hidden="true">
      <span>{{ money(min) }}</span>
      <span>{{ money(max) }}</span>
    </div>

    <div class="wi-nudges">
      <button
        v-for="nudge in nudges"
        :key="nudge.label"
        type="button"
        :class="{ 'wi-nudge--on': budget === nudge.value }"
        @click="budget = nudge.value"
      >
        {{ nudge.label }}
      </button>
      <label v-if="hasAgreedFilters" class="wi-toggle">
        <input v-model="useAgreedFilters" type="checkbox" />
        Only our agreed type, regions and bedrooms
      </label>
    </div>

    <div class="wi-stats">
      <div class="wi-stat">
        <strong>{{ nowCount }}</strong>
        <span>of {{ pool.length }} listings fit</span>
      </div>
      <div class="wi-stat">
        <strong :class="delta > 0 ? 'wi-up' : delta < 0 ? 'wi-down' : ''">
          {{ delta > 0 ? '+' : delta < 0 ? '−' : '' }}{{ Math.abs(delta) }}
        </strong>
        <span>vs {{ agreed ? 'agreed budget' : 'starting point' }}</span>
      </div>
      <div class="wi-stat">
        <strong>{{ share }}%</strong>
        <span>of the market within reach</span>
      </div>
    </div>

    <h4 class="wi-subhead">By region</h4>
    <ul class="wi-regions">
      <li v-for="region in regions" :key="region.name">
        <span class="wi-region-name">{{ region.name.replace(' Region', '') }}</span>
        <span
          class="wi-bar"
          role="img"
          :aria-label="`${region.name}: ${region.now} of ${region.total} listings fit`"
        >
          <span class="wi-seg wi-seg--kept" :style="{ width: `${region.kept}%` }"></span>
          <span class="wi-seg wi-seg--gained" :style="{ width: `${region.gained}%` }"></span>
          <span class="wi-seg wi-seg--lost" :style="{ width: `${region.lost}%` }"></span>
        </span>
        <span class="wi-region-count">{{ region.now }}<span>/{{ region.total }}</span></span>
      </li>
    </ul>
    <p class="wi-legend">
      <span><i class="wi-seg--kept"></i>Fits at the {{ agreed ? 'agreed' : 'starting' }} budget</span>
      <span><i class="wi-seg--gained"></i>Opened up</span>
      <span><i class="wi-seg--lost"></i>Priced out</span>
    </p>

    <template v-if="shortlisted.length">
      <h4 class="wi-subhead">Your shortlist at {{ money(budget) }} each</h4>
      <ul class="wi-shortlist">
        <li v-for="item in shortlisted" :key="item.id">
          <span class="wi-dot" :class="item.fitsNow ? 'wi-dot--ok' : 'wi-dot--over'" aria-hidden="true"></span>
          <span class="wi-title">{{ item.title }}</span>
          <span class="wi-each">{{ money(item.each) }} each</span>
          <span class="wi-state" :class="item.fitsNow ? 'wi-up' : 'wi-down'">
            <template v-if="item.fitsNow && !item.fitsBase">Now affordable</template>
            <template v-else-if="item.fitsNow">Within budget</template>
            <template v-else>Over by {{ money(item.gap) }}</template>
          </span>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.wi {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--chip-line);
  border-radius: 12px;
  background: #fff;
}
.wi-head h3 {
  font-size: 14px;
}
.wi-head p {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
.wi-readout {
  text-align: center;
}
.wi-budget {
  font-family: var(--font-heading);
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.wi-budget span {
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
}
.wi-sub {
  color: var(--muted);
  font-size: 12px;
}
.wi-range {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(to right, var(--red) var(--fill), #e5e7f3 var(--fill));
  appearance: none;
  cursor: pointer;
}
.wi-range::-webkit-slider-thumb {
  width: 22px;
  height: 22px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: var(--red);
  box-shadow: 0 1px 6px rgb(0 0 0 / 25%);
  appearance: none;
}
.wi-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: var(--red);
  box-shadow: 0 1px 6px rgb(0 0 0 / 25%);
}
.wi-scale {
  display: flex;
  justify-content: space-between;
  margin-top: -6px;
  color: var(--muted);
  font-size: 11px;
}
.wi-nudges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.wi-nudges button {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--chip-line);
  border-radius: 999px;
  background: #fff;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.wi-nudges button.wi-nudge--on {
  border-color: var(--red);
  background: var(--red-tint);
  color: var(--red-dark);
}
.wi-toggle {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  margin-left: auto;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
}
.wi-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.wi-stat {
  display: grid;
  gap: 2px;
  padding: 12px;
  border-radius: 10px;
  background: var(--soft);
  text-align: center;
}
.wi-stat strong {
  font-family: var(--font-heading);
  font-size: 20px;
}
.wi-stat span {
  color: var(--muted);
  font-size: 11.5px;
}
.wi-up {
  color: var(--ok);
}
.wi-down {
  color: var(--error);
}
.wi-subhead {
  margin: 4px 0 0;
  font-size: 12.5px;
}
.wi-regions,
.wi-shortlist {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.wi-regions li {
  display: grid;
  grid-template-columns: 90px 1fr 56px;
  gap: 10px;
  align-items: center;
  font-size: 12px;
}
.wi-region-count {
  font-weight: 700;
  text-align: right;
}
.wi-region-count span {
  color: var(--muted);
  font-weight: 500;
}
.wi-bar {
  display: flex;
  height: 12px;
  overflow: hidden;
  border-radius: 999px;
  background: #eef0f7;
}
.wi-seg {
  height: 100%;
  transition: width 0.2s ease;
}
.wi-seg--kept {
  background: var(--red);
}
.wi-seg--gained {
  background: #9fd8b9;
}
.wi-seg--lost {
  background: repeating-linear-gradient(135deg, #f3b8ba 0 4px, #fbe3e4 4px 8px);
}
.wi-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  color: var(--muted);
  font-size: 11px;
}
.wi-legend span {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}
.wi-legend i {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.wi-shortlist li {
  display: grid;
  grid-template-columns: 10px 1fr auto auto;
  gap: 10px;
  align-items: center;
  font-size: 12px;
}
.wi-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.wi-dot--ok {
  background: var(--ok);
}
.wi-dot--over {
  background: var(--error);
}
.wi-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wi-each {
  color: var(--muted);
}
.wi-state {
  min-width: 96px;
  font-weight: 700;
  text-align: right;
}
@media (max-width: 560px) {
  .wi-stats {
    grid-template-columns: 1fr;
  }
  .wi-toggle {
    margin-left: 0;
  }
}
</style>
