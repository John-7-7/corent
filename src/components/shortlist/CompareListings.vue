<script setup>
import { computed, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { commuteKey } from '@/services/routingService'
import { money } from './groupFilters'

/**
 * Side-by-side comparison of up to four shortlisted listings, one column each,
 * in the style of a product comparison page. The best value in each row is
 * marked, and "Only differences" hides rows where every listing is the same.
 * Reads only data the Shortlist page has already loaded.
 */
const props = defineProps({
  // Shortlisted Housing_Listing records, in ranked order.
  listings: { type: Array, default: () => [] },
  // Map<ListingID, scoreListing() result>
  scoredById: { type: Map, default: () => new Map() },
  // Map from routingService.commuteMatrix()
  commutes: { type: Map, default: () => new Map() },
  // [{ id, name, maxCommuteTime }], members with a commute destination.
  commuteMembers: { type: Array, default: () => [] },
  voteCounts: { type: Object, default: () => ({}) },
  enquiredIds: { type: Array, default: () => [] },
  commentCounts: { type: Object, default: () => ({}) },
  people: { type: Number, default: 1 },
})

const MAX_COLUMNS = 4
const selectedIds = ref([])

// Start with the top three, and drop anything that leaves the shortlist.
watch(
  () => props.listings.map((listing) => listing.ListingID).join('|'),
  () => {
    const ids = props.listings.map((listing) => listing.ListingID)
    const kept = selectedIds.value.filter((id) => ids.includes(id))
    selectedIds.value = kept.length ? kept : ids.slice(0, 3)
  },
  { immediate: true },
)

function toggle(id) {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((value) => value !== id)
  } else if (selectedIds.value.length < MAX_COLUMNS) {
    selectedIds.value = [...selectedIds.value, id]
  }
}

const columns = computed(() =>
  selectedIds.value
    .map((id) => props.listings.find((listing) => listing.ListingID === id))
    .filter(Boolean),
)

const onlyDifferences = ref(false)
const brokenImages = ref(new Set())

const amenity = (listing, name) => (listing.Amenities || []).includes(name)
function furnishing(listing) {
  if (amenity(listing, 'Fully furnished')) return 'Fully furnished'
  if (amenity(listing, 'Partially furnished')) return 'Partially furnished'
  if (amenity(listing, 'Unfurnished')) return 'Unfurnished'
  return null
}
const positive = (value) => (Number(value) > 0 ? Number(value) : null)

/**
 * Each row: label, one { value, text } per column, and which end is best.
 * `value` is numeric for comparison; `text` is what is shown.
 */
const sections = computed(() => {
  const cols = columns.value
  const cell = (value, text = value ?? '-') => ({ value, text: value === null || value === undefined ? '-' : text })

  const overview = [
    { label: 'Monthly rent', best: 'min', cells: cols.map((l) => cell(positive(l.MonthlyRent), money(l.MonthlyRent))) },
    {
      label: `Per person (${props.people})`,
      best: 'min',
      cells: cols.map((l) => cell(positive(l.MonthlyRent) && l.MonthlyRent / props.people, money(l.MonthlyRent / props.people))),
    },
    {
      label: 'Rent per m²',
      best: 'min',
      cells: cols.map((l) => {
        const value = positive(l.AreaSqm) ? l.MonthlyRent / l.AreaSqm : null
        return cell(value, value !== null ? `$${value.toFixed(2)}` : '-')
      }),
    },
    {
      label: 'Group fit',
      best: 'max',
      cells: cols.map((l) => {
        const score = props.scoredById.get(l.ListingID)?.score
        return cell(typeof score === 'number' ? score : null, `${score}%`)
      }),
    },
    { label: 'Votes', best: 'max', cells: cols.map((l) => cell(props.voteCounts[l.ListingID] ?? 0)) },
    { label: 'Comments', best: null, cells: cols.map((l) => cell(props.commentCounts[l.ListingID] ?? 0)) },
    {
      label: 'Enquiry',
      best: null,
      cells: cols.map((l) => cell(props.enquiredIds.includes(l.ListingID) ? 'Sent' : 'Not yet')),
    },
  ]

  const home = [
    { label: 'Property type', best: null, cells: cols.map((l) => cell(l.PropertyType || null)) },
    { label: 'Bedrooms', best: null, cells: cols.map((l) => cell(positive(l.Bedrooms))) },
    { label: 'Bathrooms', best: null, cells: cols.map((l) => cell(positive(l.Bathrooms))) },
    { label: 'Floor area', best: 'max', cells: cols.map((l) => cell(positive(l.AreaSqm), `${l.AreaSqm} m²`)) },
    { label: 'Furnishing', best: null, cells: cols.map((l) => cell(furnishing(l))) },
    { label: 'Availability', best: null, cells: cols.map((l) => cell(l.IsAvailable === false ? 'Unavailable' : 'Available')) },
  ]

  const location = [
    { label: 'Region', best: null, cells: cols.map((l) => cell(l.Region || null)) },
    { label: 'Neighbourhood', best: null, cells: cols.map((l) => cell(l.Neighbourhood || null)) },
    { label: 'Nearest MRT', best: null, cells: cols.map((l) => cell(l.NearestMrt || null)) },
    {
      label: 'Walk to MRT',
      best: 'min',
      cells: cols.map((l) => cell(Number.isFinite(Number(l.MrtWalkingMinutes)) && l.MrtWalkingMinutes !== null ? Number(l.MrtWalkingMinutes) : null, `${l.MrtWalkingMinutes} min`)),
    },
  ]

  const commute = props.commuteMembers.map((member) => ({
    label: member.name,
    best: 'min',
    cells: cols.map((l) => {
      const trip = props.commutes.get(commuteKey(l.ListingID, member.id))
      if (!trip) return cell(null)
      const estimated = trip.source !== 'onemap'
      const flag = trip.withinLimit === false ? ' · over limit' : trip.withinLimit ? ' ✓' : ''
      return {
        value: trip.minutes,
        text: `${estimated ? '~' : ''}${trip.minutes} min${flag}`,
        warn: trip.withinLimit === false,
      }
    }),
  }))

  const memberFit = (() => {
    const first = cols.map((l) => props.scoredById.get(l.ListingID)).find(Boolean)
    if (!first) return []
    return first.perMember.map((member) => ({
      label: member.name || 'Member',
      best: 'max',
      cells: cols.map((l) => {
        const score = props.scoredById.get(l.ListingID)?.perMember.find((m) => m.uid === member.uid)?.score
        return cell(typeof score === 'number' ? score : null, `${score}%`)
      }),
    }))
  })()

  const allAmenities = [...new Set(cols.flatMap((l) => l.Amenities || []))].sort()
  const amenities = allAmenities.map((name) => ({
    label: name,
    best: null,
    check: true,
    cells: cols.map((l) => ({ value: amenity(l, name), text: amenity(l, name) ? '✓' : '-' })),
  }))

  return [
    { title: 'Overview', rows: overview },
    { title: 'The home', rows: home },
    { title: 'Location', rows: location },
    { title: 'Commute, weekday 08:30', rows: commute, empty: 'No member has set a commute destination yet.' },
    { title: 'Fit for each member', rows: memberFit, empty: 'Agree your group preferences to see member fit.' },
    { title: 'Amenities', rows: amenities, empty: 'No amenities listed.' },
  ]
})

function decorate(row) {
  const numbers = row.cells.map((c) => (typeof c.value === 'number' ? c.value : null))
  const known = numbers.filter((n) => n !== null)
  const target =
    row.best && known.length > 1 && new Set(known).size > 1
      ? row.best === 'min'
        ? Math.min(...known)
        : Math.max(...known)
      : null
  return {
    ...row,
    cells: row.cells.map((c, index) => ({ ...c, best: target !== null && numbers[index] === target })),
    same: new Set(row.cells.map((c) => String(c.text))).size <= 1,
  }
}

const visibleSections = computed(() =>
  sections.value
    .map((section) => {
      const rows = section.rows.map(decorate)
      return { ...section, total: rows.length, rows: onlyDifferences.value ? rows.filter((r) => !r.same) : rows }
    })
    .filter((section) => !onlyDifferences.value || section.rows.length),
)

const gridStyle = computed(() => ({
  gridTemplateColumns: `minmax(130px, 170px) repeat(${Math.max(columns.value.length, 1)}, minmax(150px, 1fr))`,
}))
</script>

<template>
  <section class="cmp" aria-labelledby="cmp-title">
    <div class="cmp-head">
      <div>
        <h2 id="cmp-title">Compare side by side</h2>
        <p>Pick up to {{ MAX_COLUMNS }} shortlisted listings. The best value in each row is highlighted.</p>
      </div>
      <label class="cmp-toggle">
        <input v-model="onlyDifferences" type="checkbox" />
        Only show differences
      </label>
    </div>

    <div v-if="!listings.length" class="cmp-empty">Shortlist some listings to compare them here.</div>

    <template v-else>
      <div class="cmp-picker" role="group" aria-label="Listings to compare">
        <button
          v-for="listing in listings"
          :key="listing.ListingID"
          type="button"
          :aria-pressed="selectedIds.includes(listing.ListingID)"
          :disabled="!selectedIds.includes(listing.ListingID) && selectedIds.length >= MAX_COLUMNS"
          :class="{ 'cmp-chip--on': selectedIds.includes(listing.ListingID) }"
          @click="toggle(listing.ListingID)"
        >
          <AppIcon :name="selectedIds.includes(listing.ListingID) ? 'check' : 'plus'" :size="12" />
          <span>{{ listing.Title }}</span>
        </button>
      </div>

      <p v-if="columns.length < 2" class="cmp-empty">Select at least two listings to compare.</p>

      <div v-else class="cmp-scroll">
        <div class="cmp-grid" :style="gridStyle">
          <!-- Sticky product header -->
          <div class="cmp-corner"></div>
          <div v-for="listing in columns" :key="listing.ListingID" class="cmp-product">
            <div class="cmp-photo">
              <img
                v-if="listing.ImageURL && !brokenImages.has(listing.ListingID)"
                :src="listing.ImageURL"
                alt=""
                loading="lazy"
                @error="brokenImages.add(listing.ListingID)"
              />
            </div>
            <strong class="cmp-title">{{ listing.Title }}</strong>
            <span class="cmp-price">{{ money(listing.MonthlyRent) }}<small>/mo</small></span>
            <button type="button" class="cmp-remove" :aria-label="`Remove ${listing.Title} from the comparison`" @click="toggle(listing.ListingID)">
              <AppIcon name="x" :size="12" />
            </button>
          </div>

          <template v-for="section in visibleSections" :key="section.title">
            <h3 class="cmp-section" :style="{ gridColumn: '1 / -1' }">{{ section.title }}</h3>
            <p v-if="!section.total && section.empty" class="cmp-section-empty" :style="{ gridColumn: '1 / -1' }">
              {{ section.empty }}
            </p>
            <template v-for="row in section.rows" :key="section.title + row.label">
              <div class="cmp-label">{{ row.label }}</div>
              <div
                v-for="(cellItem, index) in row.cells"
                :key="index"
                class="cmp-cell"
                :class="{
                  'cmp-cell--best': cellItem.best,
                  'cmp-cell--warn': cellItem.warn,
                  'cmp-cell--yes': row.check && cellItem.value,
                  'cmp-cell--no': row.check && !cellItem.value,
                }"
              >
                {{ cellItem.text }}
                <span v-if="cellItem.best" class="cmp-badge">Best</span>
              </div>
            </template>
          </template>
        </div>
      </div>
      <p class="cmp-note">~ marks a straight-line estimate where OneMap routing was unavailable.</p>
    </template>
  </section>
</template>

<style scoped>
.cmp {
  display: grid;
  gap: 14px;
  padding: 20px;
  border: 1px solid var(--chip-line);
  border-radius: 14px;
  background: #fff;
}
.cmp-head {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
  justify-content: space-between;
}
.cmp-head h2 {
  font-size: 16px;
}
.cmp-head p,
.cmp-note {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}
.cmp-toggle {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.cmp-toggle input {
  accent-color: var(--red);
}
.cmp-empty {
  padding: 28px;
  border: 1px dashed var(--chip-line);
  border-radius: 12px;
  color: var(--muted);
  text-align: center;
}
.cmp-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cmp-picker button {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  max-width: 260px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--chip-line);
  border-radius: 999px;
  background: #fff;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.cmp-picker button span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cmp-picker button.cmp-chip--on {
  border-color: var(--red);
  background: var(--red-tint);
  color: var(--red-dark);
}
.cmp-picker button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.cmp-scroll {
  max-height: 72vh;
  overflow: auto;
  border: 1px solid #f1f0ef;
  border-radius: 12px;
}
.cmp-grid {
  display: grid;
  min-width: min-content;
}
.cmp-corner,
.cmp-product {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #fff;
  border-bottom: 1px solid var(--line);
}
.cmp-product {
  position: sticky;
  display: grid;
  gap: 4px;
  align-content: start;
  padding: 12px;
  text-align: center;
}
.cmp-photo {
  height: 92px;
  overflow: hidden;
  border-radius: 10px;
  background: linear-gradient(135deg, #dfe3fb, #f3e6f7);
}
.cmp-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cmp-title {
  display: -webkit-box;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.cmp-price {
  font-family: var(--font-heading);
  font-size: 16px;
  font-weight: 800;
}
.cmp-price small {
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}
.cmp-remove {
  position: absolute;
  top: 16px;
  right: 16px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 90%);
  box-shadow: 0 1px 3px rgb(0 0 0 / 20%);
  color: var(--text);
  cursor: pointer;
}
.cmp-section {
  margin: 0;
  padding: 16px 12px 6px;
  border-bottom: 1px solid var(--line);
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--red-dark);
}
.cmp-section-empty {
  padding: 8px 12px;
  color: var(--muted);
  font-size: 12px;
}
.cmp-label,
.cmp-cell {
  padding: 10px 12px;
  border-bottom: 1px solid #f4f3f2;
  font-size: 12.5px;
}
.cmp-label {
  position: sticky;
  left: 0;
  z-index: 1;
  background: #fff;
  color: var(--muted);
  font-weight: 600;
}
.cmp-cell {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.cmp-cell--best {
  background: var(--ok-tint);
  color: var(--ok);
  font-weight: 800;
}
.cmp-cell--warn {
  color: var(--error);
  font-weight: 700;
}
.cmp-cell--yes {
  color: var(--ok);
  font-weight: 800;
}
.cmp-cell--no {
  color: #c3c5d3;
}
.cmp-badge {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--ok);
  color: #fff;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
</style>
