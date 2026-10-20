<script setup>
import { ref, computed, onMounted } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import ListingCard from '@/components/listings/ListingCard.vue'
import { getListings } from '@/services/listings'

const listings = ref([])
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    listings.value = await getListings()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

/* ---------- filters ---------- */
// Options come from the data, so we never offer a filter that returns nothing.
const region = ref('Any')
const type = ref('Any')
const beds = ref('Any')
const maxRent = ref(null)
const sort = ref('rent-asc')

const uniq = (key) => computed(() =>
  [...new Set(listings.value.map((l) => l[key]).filter(Boolean))].sort(),
)
const regions = uniq('Region')
const types = uniq('PropertyType')
const bedOptions = computed(() =>
  [...new Set(listings.value.map((l) => l.Bedrooms).filter(Boolean))].sort((a, b) => a - b),
)

const filtersActive = computed(() =>
  region.value !== 'Any' || type.value !== 'Any' || beds.value !== 'Any' || maxRent.value,
)

function clearFilters() {
  region.value = 'Any'
  type.value = 'Any'
  beds.value = 'Any'
  maxRent.value = null
}

const filtered = computed(() => {
  const out = listings.value.filter(
    (l) =>
      (region.value === 'Any' || l.Region === region.value) &&
      (type.value === 'Any' || l.PropertyType === type.value) &&
      (beds.value === 'Any' || l.Bedrooms === Number(beds.value)) &&
      (!maxRent.value || l.MonthlyRent <= Number(maxRent.value)),
  )
  const by = {
    'rent-asc': (a, b) => a.MonthlyRent - b.MonthlyRent,
    'rent-desc': (a, b) => b.MonthlyRent - a.MonthlyRent,
    mrt: (a, b) => (a.MrtWalkingMinutes ?? 99) - (b.MrtWalkingMinutes ?? 99),
  }
  return [...out].sort(by[sort.value] ?? by['rent-asc'])
})

/* ---------- shortlist (F-REQ-016) ---------- */
// Local only for now. Swap for services/shortlist.js against Selected_Listing
// once groups exist — the component API below does not change.
const savedIds = ref(new Set())
const isSaved = (l) => savedIds.value.has(l.ListingID)
function toggleSave(l) {
  const next = new Set(savedIds.value)
  next.has(l.ListingID) ? next.delete(l.ListingID) : next.add(l.ListingID)
  savedIds.value = next
}

/* ---------- details dialog ---------- */
const selected = ref(null)

// F-REQ-015: no GroupSummary yet, so every criterion reports "Insufficient data"
// rather than a fabricated score. Replace once listingMatchScore() is real.
const statusText = { met: 'Met', unmet: 'Not met', unknown: 'Insufficient data' }
const statusClass = { met: 'tag-ok', unmet: 'tag-red', unknown: 'tag-warn' }
const breakdown = computed(() => {
  if (!selected.value) return []
  return [
    { label: 'Budget', detail: 'Needs the group budget ceiling', status: 'unknown' },
    { label: 'Area', detail: selected.value.Neighbourhood ?? '—', status: 'unknown' },
    { label: 'Bedrooms', detail: `${selected.value.Bedrooms} bedrooms`, status: 'unknown' },
    { label: 'Amenities', detail: selected.value.Amenities?.join(', ') || 'None listed', status: 'unknown' },
  ]
})
</script>

<template>
  <div>
    <header class="page-head">
      <h1>Browse</h1>
      <p>Listings scored against your preferences</p>
    </header>

    <div class="content">
      <div class="stack-wide">
        <section class="card" aria-label="Filters">
          <div class="between wrap">
            <div class="segmented" role="group" aria-label="Browse as">
              <button type="button" class="on" aria-pressed="true">Just me</button>
              <button type="button" aria-pressed="false" disabled title="Needs a group (F-REQ-008)">
                My group
              </button>
            </div>
            <p class="small muted">Scores use your group's combined preferences.</p>
          </div>

          <div class="filters">
            <div class="field">
              <label for="f-region">Region</label>
              <select id="f-region" class="input" v-model="region">
                <option>Any</option>
                <option v-for="r in regions" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>
            <div class="field">
              <label for="f-type">Type</label>
              <select id="f-type" class="input" v-model="type">
                <option>Any</option>
                <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="field">
              <label for="f-beds">Bedrooms</label>
              <select id="f-beds" class="input" v-model="beds">
                <option>Any</option>
                <option v-for="b in bedOptions" :key="b" :value="b">{{ b }}</option>
              </select>
            </div>
            <div class="field">
              <label for="f-rent">Max rent</label>
              <input id="f-rent" class="input" type="number" v-model="maxRent" placeholder="$ / month" />
            </div>
            <div class="field">
              <label for="f-sort">Sort by</label>
              <select id="f-sort" class="input" v-model="sort">
                <option value="" disabled>Best match (needs F-REQ-015)</option>
                <option value="rent-asc">Rent: low to high</option>
                <option value="rent-desc">Rent: high to low</option>
                <option value="mrt">Nearest MRT</option>
              </select>
            </div>
          </div>
        </section>

        <div class="between">
          <p class="small muted">{{ filtered.length }} of {{ listings.length }} listings</p>
          <button v-if="filtersActive" class="link" type="button" @click="clearFilters">Clear filters</button>
        </div>

        <p v-if="loading" class="small muted">Loading listings…</p>
        <p v-else-if="error" class="small" style="color: var(--red)">Could not load listings: {{ error }}</p>
        <p v-else-if="!filtered.length" class="small muted">No listings match your filters.</p>

        <div v-else class="listing-grid">
          <ListingCard
            v-for="l in filtered"
            :key="l.ListingID"
            :listing="l"
            :saved="isSaved(l)"
            @toggle-save="toggleSave"
            @view-details="selected = $event"
          />
        </div>
      </div>
    </div>

    <div v-if="selected" class="modal-backdrop" @click.self="selected = null">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div class="between" style="align-items: flex-start">
          <div>
            <h2 id="detail-title" style="font-size: 17px">{{ selected.Title }}</h2>
            <p class="small muted row-inline" style="margin-top: 2px">
              <AppIcon name="pin" :size="11" />
              {{ selected.Neighbourhood }} · {{ selected.PropertyType }} · {{ selected.Bedrooms }} bedrooms
            </p>
          </div>
          <button class="icon-btn" type="button" aria-label="Close details" @click="selected = null">
            <AppIcon name="x" :size="16" />
          </button>
        </div>

        <div class="between" style="margin: 0.9rem 0">
          <p class="price big">${{ selected.MonthlyRent.toLocaleString() }}<span class="muted">/mo</span></p>
          <div class="row">
            <span class="tag" :class="selected.IsAvailable ? 'tag-ok' : 'tag-red'">
              {{ selected.IsAvailable ? 'Available' : 'Unavailable' }}
            </span>
          </div>
        </div>

        <p class="small muted">{{ selected.Address }}<span v-if="selected.PostalCode"> · {{ selected.PostalCode }}</span></p>
        <p v-if="selected.NearestMrt" class="small muted" style="margin-bottom: 0.9rem">
          {{ selected.MrtWalkingMinutes }} min walk to {{ selected.NearestMrt }}
          <span v-if="selected.AreaSqm"> · {{ selected.AreaSqm }} sqm</span>
        </p>

        <h3>Amenities</h3>
        <div class="chips" style="margin-bottom: 1rem">
          <span v-for="a in selected.Amenities" :key="a" class="tag">{{ a }}</span>
          <span v-if="!selected.Amenities?.length" class="small muted">None listed</span>
        </div>

        <h3>How it fits your group</h3>
        <ul class="breakdown">
          <li v-for="b in breakdown" :key="b.label">
            <span class="tag" :class="statusClass[b.status]">{{ statusText[b.status] }}</span>
            <strong>{{ b.label }}</strong>
            <span class="small muted">{{ b.detail }}</span>
          </li>
        </ul>

        <p v-if="selected.OriginalSourceURL" class="small" style="margin: 0.9rem 0">
          <a class="link" :href="selected.OriginalSourceURL" target="_blank" rel="noopener noreferrer">
            View the original listing
          </a>
        </p>

        <div class="row" style="justify-content: flex-end; margin-top: 0.9rem">
          <button class="btn btn-primary" type="button" @click="toggleSave(selected)">
            {{ isSaved(selected) ? 'Remove from shortlist' : 'Add to shortlist' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { flex-wrap: wrap; }
.row-inline { display: inline-flex; align-items: center; gap: 0.25rem; }
.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0 0.75rem;
  margin-top: 1rem;
}
.filters .field { margin-bottom: 0; }
.listing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.9rem;
}
.price { color: var(--red); font-weight: 700; }
.price.big { font-size: 22px; }
.price.big span { font-size: 12px; font-weight: 400; }
.breakdown { list-style: none; padding: 0; margin: 0.6rem 0 0; display: grid; gap: 0.55rem; }
.breakdown li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.6rem; font-size: 13px; }
</style>
