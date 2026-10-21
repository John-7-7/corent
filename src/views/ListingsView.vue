<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import {
  formatRent,
  listings,
  suitabilityStatusClass,
  suitabilityStatusText,
} from '@/services/listingsService'
import { useShortlist } from '@/services/shortlistService'

const { listingIds, storageError, toggleShortlist } = useShortlist()
const selectedArea = ref('Any')
const selectedType = ref('Any')
const selectedBedrooms = ref('Any')
const maximumRent = ref('')
const sortBy = ref('match')
const selectedListing = ref(null)
const actionError = ref('')

const areas = [...new Set(listings.map((listing) => listing.area))].sort()
const filteredListings = computed(() => {
  const filtered = listings.filter((listing) => {
    if (selectedArea.value !== 'Any' && listing.area !== selectedArea.value) return false
    if (selectedType.value !== 'Any' && listing.type !== selectedType.value) return false
    if (selectedBedrooms.value === '5+' && listing.beds < 5) return false
    if (
      selectedBedrooms.value !== 'Any' &&
      selectedBedrooms.value !== '5+' &&
      listing.beds !== Number(selectedBedrooms.value)
    ) {
      return false
    }
    return !maximumRent.value || listing.price <= Number(maximumRent.value)
  })

  return filtered.sort((a, b) => {
    if (sortBy.value === 'rent-asc') return a.price - b.price
    if (sortBy.value === 'rent-desc') return b.price - a.price
    return b.match - a.match
  })
})

function clearFilters() {
  selectedArea.value = 'Any'
  selectedType.value = 'Any'
  selectedBedrooms.value = 'Any'
  maximumRent.value = ''
  sortBy.value = 'match'
}

function toggleSaved(listing) {
  actionError.value = ''
  try {
    if (!listing.available && !listingIds.value.includes(listing.id)) return
    toggleShortlist(listing.id)
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Unable to update your shortlist.'
  }
}
</script>

<template>
  <div>
    <header class="page-head">
      <h1>Browse</h1>
      <p>Browse listings and compare sample suitability scores</p>
    </header>

    <div class="content">
      <div class="stack-wide">
        <!-- Browsing as + filters -->
        <section class="card" aria-label="Filters">
          <div class="between wrap">
            <span class="pill">Sample group suitability scores</span>
            <RouterLink class="link" to="/shortlist">Shortlist ({{ listingIds.length }})</RouterLink>
          </div>

          <div class="filters">
            <div class="field">
              <label for="f-area">Area</label>
              <select id="f-area" v-model="selectedArea" class="input">
                <option>Any</option>
                <option v-for="area in areas" :key="area">{{ area }}</option>
              </select>
            </div>
            <div class="field">
              <label for="f-type">Type</label>
              <select id="f-type" v-model="selectedType" class="input">
                <option>Any</option><option>HDB</option><option>Condo</option><option>Landed</option>
              </select>
            </div>
            <div class="field">
              <label for="f-beds">Bedrooms</label>
              <select id="f-beds" v-model="selectedBedrooms" class="input">
                <option value="Any">Any</option>
                <option value="1">1</option><option value="2">2</option>
                <option value="3">3</option><option value="4">4</option>
                <option value="5+">5 or more</option>
              </select>
            </div>
            <div class="field">
              <label for="f-rent">Max rent</label>
              <input id="f-rent" v-model="maximumRent" class="input" type="number" min="0" placeholder="$ / month" />
            </div>
            <div class="field">
              <label for="f-sort">Sort by</label>
              <select id="f-sort" v-model="sortBy" class="input">
                <option value="match">Best match</option>
                <option value="rent-asc">Rent: low to high</option>
                <option value="rent-desc">Rent: high to low</option>
              </select>
            </div>
          </div>
        </section>

        <div class="between">
          <p class="small muted">{{ filteredListings.length }} listings</p>
          <button class="link" type="button" @click="clearFilters">Clear filters</button>
        </div>
        <p v-if="storageError || actionError" class="listing-error" role="alert">
          {{ actionError || storageError }}
        </p>

        <!-- Listing grid -->
        <div class="listing-grid">
          <article v-for="l in filteredListings" :key="l.id" class="listing" :class="{ gone: !l.available }">
            <div class="listing-img thumb" :class="l.tone">
              <span v-if="l.available" class="pill badge">{{ l.match }}% match</span>
              <span v-else class="tag badge">Unavailable</span>
              <button
                class="save-btn"
                :class="{ saved: listingIds.includes(l.id) }"
                type="button"
                :disabled="!l.available && !listingIds.includes(l.id)"
                :aria-pressed="listingIds.includes(l.id)"
                :aria-label="listingIds.includes(l.id) ? 'Remove from shortlist' : 'Add to shortlist'"
                @click="toggleSaved(l)"
              >
                <AppIcon name="bookmark" :size="15" :fill="listingIds.includes(l.id)" />
              </button>
            </div>

            <div class="listing-body">
              <h3>{{ l.title }}</h3>
              <p class="price">{{ formatRent(l.price) }}<span class="muted">/mo</span></p>
              <p class="small muted row-inline"><AppIcon name="pin" :size="11" /> {{ l.area }}</p>
              <p class="small muted">{{ l.type }} · {{ l.beds }} bedrooms · From {{ l.from }}</p>

              <div class="row actions">
                <button class="btn btn-sm" type="button" style="flex: 1" @click="selectedListing = l">
                  View details
                </button>
                <button
                  class="btn btn-sm"
                  :class="{ 'btn-primary': !listingIds.includes(l.id) }"
                  type="button"
                  :disabled="!l.available && !listingIds.includes(l.id)"
                  style="flex: 1"
                  @click="toggleSaved(l)"
                >
                  {{ listingIds.includes(l.id) ? 'Remove' : 'Add to shortlist' }}
                </button>
              </div>
            </div>
          </article>
        </div>
        <p v-if="!filteredListings.length" class="empty-state">
          No listings match these filters.
        </p>
      </div>
    </div>

    <!-- Property details dialog -->
    <div v-if="selectedListing" class="modal-backdrop" @click.self="selectedListing = null" @keydown.esc="selectedListing = null">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div class="between" style="align-items: flex-start">
          <div>
            <h2 id="detail-title" style="font-size: 17px">{{ selectedListing.title }}</h2>
            <p class="small muted row-inline" style="margin-top: 2px">
              <AppIcon name="pin" :size="11" />
              {{ selectedListing.area }} · {{ selectedListing.type }} · {{ selectedListing.beds }} bedrooms
            </p>
          </div>
          <button class="icon-btn" type="button" aria-label="Close details" @click="selectedListing = null">
            <AppIcon name="x" :size="16" />
          </button>
        </div>

        <div class="between" style="margin: 0.9rem 0">
          <p class="price big">{{ formatRent(selectedListing.price) }}<span class="muted">/mo</span></p>
          <div class="row">
            <span class="tag" :class="selectedListing.available ? 'tag-ok' : 'tag-warn'">
              {{ selectedListing.available ? 'Available' : 'Unavailable' }}
            </span>
            <span class="pill">{{ selectedListing.match }}% match</span>
          </div>
        </div>

        <h3>Amenities</h3>
        <div class="chips" style="margin-bottom: 1rem">
          <span v-for="amenity in selectedListing.amenities" :key="amenity" class="tag">{{ amenity }}</span>
        </div>

        <h3>How it fits your group</h3>
        <ul class="breakdown">
          <li v-for="b in selectedListing.breakdown" :key="b.label">
            <span class="tag" :class="suitabilityStatusClass[b.status]">{{ suitabilityStatusText[b.status] }}</span>
            <strong>{{ b.label }}</strong>
            <span class="small muted">{{ b.detail }}</span>
          </li>
        </ul>

        <div class="row" style="justify-content: flex-end">
          <button
            class="btn"
            :class="{ 'btn-primary': !listingIds.includes(selectedListing.id) }"
            type="button"
            :disabled="!selectedListing.available && !listingIds.includes(selectedListing.id)"
            @click="toggleSaved(selectedListing)"
          >
            {{ listingIds.includes(selectedListing.id) ? 'Remove from shortlist' : 'Add to shortlist' }}
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
.listing {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
}
.listing.gone { opacity: 0.8; }
.listing-img { position: relative; height: 140px; }
.badge { position: absolute; top: 10px; left: 10px; background: #fff; }
.save-btn {
  position: absolute; top: 8px; right: 8px; display: grid; place-items: center;
  width: 30px; height: 30px; border-radius: 50%; border: 0; background: #fff;
  color: var(--muted); cursor: pointer; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.save-btn.saved { color: var(--red); }
.listing-body { padding: 0.8rem; display: grid; gap: 3px; flex: 1; align-content: start; }
.price { color: var(--red); font-weight: 700; font-size: 14px; }
.price span { font-weight: 400; font-size: 11px; }
.price.big { font-size: 22px; }
.price.big span { font-size: 12px; }
.actions { margin-top: 0.6rem; }

.listing-error,
.empty-state {
  color: var(--red);
  font-size: 13px;
}

.empty-state {
  padding: 24px;
  border: 1px dashed var(--chip-line);
  border-radius: 12px;
  background: #fff;
  color: var(--muted);
  text-align: center;
}

.save-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.breakdown { list-style: none; padding: 0; margin: 0.6rem 0 0; display: grid; gap: 0.55rem; }
.breakdown li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.6rem; font-size: 13px; }
</style>