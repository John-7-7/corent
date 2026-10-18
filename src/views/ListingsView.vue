<script setup>
import { ref, computed, onMounted } from 'vue'
import { getListings } from '../services/listings'
import ListingCard from '../components/listings/ListingCard.vue'
import ListingMap from '../components/listings/ListingMap.vue'

const listings = ref([])
const loading = ref(true)
const error = ref(null)

const view = ref('list')       // 'list' | 'map'   (F-REQ-017 AC4)
const maxRent = ref(16000)
const minBeds = ref(0)
const region = ref('all')

onMounted(async () => {
  try {
    listings.value = await getListings()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

const regions = computed(() => [...new Set(listings.value.map((l) => l.Region).filter(Boolean))].sort())

const filtered = computed(() =>
  listings.value.filter(
    (l) =>
      l.MonthlyRent <= maxRent.value &&
      l.Bedrooms >= minBeds.value &&
      (region.value === 'all' || l.Region === region.value),
  ),
)

// Placeholder until User_Preferences.CommuteDestination is available.
const destinations = ref([
  { MemberName: 'NUS (demo)', Address: '21 Lower Kent Ridge Rd', Lat: 1.2966, Lng: 103.7764 },
])
</script>

<template>
  <h1>Listings</h1>

  <div class="bar">
    <label>
      Max rent: S${{ maxRent.toLocaleString() }}
      <input v-model.number="maxRent" type="range" min="2500" max="16000" step="250" />
    </label>

    <label>
      Bedrooms
      <select v-model.number="minBeds">
        <option :value="0">Any</option>
        <option :value="2">2+</option>
        <option :value="3">3+</option>
      </select>
    </label>

    <label>
      Region
      <select v-model="region">
        <option value="all">All</option>
        <option v-for="r in regions" :key="r" :value="r">{{ r }}</option>
      </select>
    </label>

    <span class="count">{{ filtered.length }} of {{ listings.length }}</span>

    <div class="toggle">
      <button :class="{ on: view === 'list' }" @click="view = 'list'">List</button>
      <button :class="{ on: view === 'map' }" @click="view = 'map'">Map</button>
    </div>
  </div>

  <p v-if="loading">Loading listings…</p>
  <p v-else-if="error" class="err">Could not load listings: {{ error }}</p>
  <p v-else-if="!filtered.length" class="empty">No listings match your filters.</p>

  <div v-else-if="view === 'list'" class="grid">
    <ListingCard v-for="l in filtered" :key="l.ListingID" :listing="l" />
  </div>

  <ListingMap v-else :listings="filtered" :destinations="destinations" />
</template>

<style scoped>
.bar { display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
.bar label { display: flex; flex-direction: column; font-size: .8rem; color: #5a6675; gap: .2rem; }
.count { font-size: .85rem; color: #5a6675; }
.toggle { margin-left: auto; display: flex; }
.toggle button { padding: .45rem 1rem; border: 1px solid #c9d3df; background: #fff; cursor: pointer; font-size: .88rem; }
.toggle button:first-child { border-radius: 6px 0 0 6px; }
.toggle button:last-child { border-radius: 0 6px 6px 0; border-left: 0; }
.toggle button.on { background: #1f4e79; color: #fff; border-color: #1f4e79; }
.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(255px, 1fr)); }
.err { color: #b00020; }
.empty { color: #5a6675; }
</style>
