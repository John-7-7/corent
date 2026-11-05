<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import ListingCard from '@/components/listings/ListingCard.vue'
import ListingMap from '@/components/listings/ListingMap.vue'
import ScoreBreakdown from '@/components/listings/ScoreBreakdown.vue'
import { getListings } from '@/services/listings'
import { useShortlist } from '@/services/shortlistService'
import { activeGroup, activeGroupId } from '@/services/activeGroup'
import { watchGroupPreference } from '@/services/groupPreferencesService'
import { getMemberProfiles } from '@/services/groupSummaryService'
import { scoreListings } from '@/services/listingScoring'
import { cachedCommuteMatrix } from '@/services/routingService'

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

/* ---------- group preferences, for the match % (F-REQ-015) ---------- */
const groupPreference = ref(null)
const memberProfiles = ref([])
let unsubscribePreference = null

// Follows the group picked on Home, the same as Browse's shortlist does.
watch(
  activeGroupId,
  async (id) => {
    unsubscribePreference?.()
    unsubscribePreference = null
    groupPreference.value = null
    memberProfiles.value = []
    if (!id) return
    unsubscribePreference = watchGroupPreference(
      id,
      (preference) => (groupPreference.value = preference),
      () => (groupPreference.value = null),
    )
    try {
      memberProfiles.value = await getMemberProfiles(activeGroup.value?.memberIds ?? [])
    } catch {
      memberProfiles.value = []
    }
  },
  { immediate: true },
)
onUnmounted(() => unsubscribePreference?.())

const scoringMembers = computed(() =>
  (activeGroup.value?.memberIds ?? []).map((uid) => ({
    uid,
    name: activeGroup.value?.members?.find((member) => member.id === uid)?.name || 'Group member',
    profile: memberProfiles.value.find((profile) => profile.UserID === uid) || null,
  })),
)

const commuteMembers = computed(() =>
  scoringMembers.value
    .filter((member) => member.profile?.CommuteDestination?.Lat)
    .map((member) => ({
      id: member.uid,
      name: member.name,
      destination: member.profile.CommuteDestination,
      maxCommuteTime: member.profile.MaxCommuteTime ?? null,
    })),
)

// Browse scores every listing, which is far too many to route, so commute is
// read from the cache rather than measured. A listing already routed by the
// Shortlist page therefore shows the same percentage on both pages.
const scoredById = computed(() => {
  if (!activeGroupId.value || !groupPreference.value) return new Map()
  const matrix = cachedCommuteMatrix(listings.value, commuteMembers.value)
  return new Map(
    scoreListings(listings.value, groupPreference.value, scoringMembers.value, matrix).map(
      (entry) => [entry.listingId, entry],
    ),
  )
})

const scoreOf = (listing) => scoredById.value.get(listing.ListingID)?.score ?? null
const canScore = computed(() => scoredById.value.size > 0)

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
    // Unscored listings sort last rather than as a zero (AC4).
    match: (a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1),
    'rent-asc': (a, b) => a.MonthlyRent - b.MonthlyRent,
    'rent-desc': (a, b) => b.MonthlyRent - a.MonthlyRent,
    mrt: (a, b) => (a.MrtWalkingMinutes ?? 99) - (b.MrtWalkingMinutes ?? 99),
  }
  return [...out].sort(by[sort.value] ?? by['rent-asc'])
})

/* ---------- list / map (F-REQ-017 AC4) ---------- */
const view = ref('list')

// Group members' own saved commute destinations (F-REQ-017.3). Empty until
// members set one, which is better than plotting a pin nobody chose.
const destinations = computed(() =>
  scoringMembers.value
    .filter((member) => member.profile?.CommuteDestination?.Lat)
    .map((member) => ({
      MemberName: member.name,
      Address: member.profile.CommuteDestination.Address,
      Lat: member.profile.CommuteDestination.Lat,
      Lng: member.profile.CommuteDestination.Lng,
    })),
)

/* ---------- shortlist (F-REQ-016) ---------- */
// Persisted in localStorage and shared with ShortlistView. Swap shortlistService
// for Selected_Listing once groups exist — the component API below does not change.
const { listingIds, storageError, toggleShortlist, isShortlisted } = useShortlist()
const actionError = ref('')
const isSaved = (l) => isShortlisted(l.ListingID)
async function toggleSave(l) {
  actionError.value = ''
  try {
    if (!l.IsAvailable && !isSaved(l)) return
    await toggleShortlist(l.ListingID)
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Unable to update your shortlist.'
  }
}

/* ---------- details dialog ---------- */
const selected = ref(null)

// The scored result for the open listing, or null when there is nothing to
// score against (no group, or the group has not agreed any preferences yet).
const selectedScore = computed(() =>
  selected.value ? (scoredById.value.get(selected.value.ListingID) ?? null) : null,
)
</script>

<template>
  <div>
    <header class="page-head">
      <h1>Browse</h1>
      <p>Browse listings and compare sample suitability scores</p>
    </header>

    <div class="content">
      <div class="stack-wide">
        <section class="card" aria-label="Filters">
          <div class="between wrap">
            <RouterLink class="link" to="/shortlist">Shortlist ({{ listingIds.length }})</RouterLink>
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
                <option value="match" :disabled="!canScore">
                  {{ canScore ? 'Best match for your group' : 'Best match (needs group preferences)' }}
                </option>
                <option value="rent-asc">Rent: low to high</option>
                <option value="rent-desc">Rent: high to low</option>
                <option value="mrt">Nearest MRT</option>
              </select>
            </div>
          </div>
        </section>

        <div class="between">
          <p class="small muted">
            {{ filtered.length }} of {{ listings.length }} listings
            <button v-if="filtersActive" class="link" type="button" @click="clearFilters">Clear filters</button>
          </p>
          <div class="segmented" role="group" aria-label="View as">
            <button type="button" :class="{ on: view === 'list' }" :aria-pressed="view === 'list'" @click="view = 'list'">
              List
            </button>
            <button type="button" :class="{ on: view === 'map' }" :aria-pressed="view === 'map'" @click="view = 'map'">
              Map
            </button>
          </div>
        </div>
        <p v-if="storageError || actionError" class="listing-error" role="alert">
          {{ actionError || storageError }}
        </p>

        <p v-if="loading" class="small muted">Loading listings…</p>
        <p v-else-if="error" class="small" style="color: var(--red)">Could not load listings: {{ error }}</p>
        <p v-else-if="!filtered.length" class="small muted">No listings match your filters.</p>

        <ListingMap
          v-else-if="view === 'map'"
          :listings="filtered"
          :destinations="destinations"
          @select="selected = $event"
        />

        <div v-else class="listing-grid">
          <ListingCard
            v-for="l in filtered"
            :key="l.ListingID"
            :listing="l"
            :match-score="scoreOf(l)"
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
        <ScoreBreakdown v-if="selectedScore" :result="selectedScore" />
        <p v-else class="small muted">
          <template v-if="!activeGroupId">
            Join or create a group to see how this listing fits everyone.
          </template>
          <template v-else>
            Your group has not agreed any preferences yet. Settle them on the Group
            Summary page and a match score appears here.
          </template>
        </p>

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
.listing-error { color: var(--red); font-size: 13px; }
</style>
