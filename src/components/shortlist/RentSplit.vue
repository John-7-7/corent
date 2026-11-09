<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { getPreferences } from '@/services/preferencesService'
import { money } from './groupFilters'

/**
 * Rent split calculator for one shortlisted listing. A calculator only: nothing
 * is saved, so trying different splits never changes anything for the group.
 *
 * Budget feedback is shown for the signed-in member alone, read from their own
 * profile (including a private budget, which only they can read). Teammates'
 * budgets are never shown here, private or not.
 */
const props = defineProps({
  // Shortlisted Housing_Listing records.
  listings: { type: Array, default: () => [] },
  // [{ uid, name }], the group's members; empty outside a group.
  members: { type: Array, default: () => [] },
  currentUserId: { type: String, default: '' },
  initialListingId: { type: String, default: '' },
})

const MODES = [
  { key: 'equal', label: 'Equal', hint: 'Everyone pays the same.' },
  { key: 'size', label: 'By room size', hint: 'Shared spaces split equally, bedrooms by floor area.' },
  { key: 'room', label: 'By room type', hint: 'A master bedroom with its own bathroom pays a premium.' },
  { key: 'custom', label: 'Custom', hint: 'Type each person’s amount.' },
]
const COLOURS = ['#7b8cf0', '#f29e4c', '#4cb38a', '#e5677a', '#5bb3d6', '#a77fe0', '#c9a227', '#6b7a99']

const listingId = ref(props.initialListingId || props.listings[0]?.ListingID || '')
watch(
  () => props.listings.map((listing) => listing.ListingID).join('|'),
  () => {
    if (!props.listings.some((listing) => listing.ListingID === listingId.value)) {
      listingId.value = props.listings[0]?.ListingID ?? ''
    }
  },
)
const listing = computed(() => props.listings.find((l) => l.ListingID === listingId.value) ?? null)
const rent = computed(() => Number(listing.value?.MonthlyRent) || 0)

const mode = ref('equal')
const utilities = ref(0)
const sharedPercent = ref(40)
const masterPremium = ref(20)

// Outside a group there is nobody to name, so the calculator asks how many.
const soloCount = ref(3)
const people = computed(() => {
  if (props.members.length) {
    return props.members.map((member, index) => ({
      uid: member.uid,
      name: member.uid === props.currentUserId ? `${member.name} (you)` : member.name,
      isMe: member.uid === props.currentUserId,
      colour: COLOURS[index % COLOURS.length],
    }))
  }
  return Array.from({ length: soloCount.value }, (_, index) => ({
    uid: index === 0 ? props.currentUserId || 'you' : `housemate-${index}`,
    name: index === 0 ? 'You' : `Housemate ${index}`,
    isMe: index === 0,
    colour: COLOURS[index % COLOURS.length],
  }))
})

// Per-person inputs, keyed by uid so they survive members joining or leaving.
const inputs = reactive({})
watch(
  people,
  (list) => {
    list.forEach((person, index) => {
      inputs[person.uid] ??= { size: 12, room: index === 0 ? 'master' : 'common', custom: null }
    })
  },
  { immediate: true },
)

/**
 * Splits `total` dollars by `weights` into whole dollars that add up exactly
 * (largest remainder), so the shares never come to $1 more or less than the rent.
 */
function apportion(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (!sum || !total) return weights.map(() => 0)
  const exact = weights.map((w) => (total * w) / sum)
  const floors = exact.map(Math.floor)
  let left = Math.round(total - floors.reduce((a, b) => a + b, 0))
  exact
    .map((value, index) => ({ index, rest: value - floors[index] }))
    .sort((a, b) => b.rest - a.rest)
    .forEach(({ index }) => {
      if (left > 0) {
        floors[index] += 1
        left -= 1
      }
    })
  return floors
}

const rentShares = computed(() => {
  const list = people.value
  const total = rent.value
  if (!list.length) return []
  if (mode.value === 'custom') {
    return list.map((person) => Math.max(Number(inputs[person.uid]?.custom) || 0, 0))
  }
  if (mode.value === 'size') {
    const shared = apportion(Math.round((total * sharedPercent.value) / 100), list.map(() => 1))
    const rooms = apportion(
      total - shared.reduce((a, b) => a + b, 0),
      list.map((person) => Math.max(Number(inputs[person.uid]?.size) || 0, 0)),
    )
    return shared.map((value, index) => value + rooms[index])
  }
  if (mode.value === 'room') {
    const premium = 1 + Math.max(Number(masterPremium.value) || 0, 0) / 100
    return apportion(total, list.map((person) => (inputs[person.uid]?.room === 'master' ? premium : 1)))
  }
  return apportion(total, list.map(() => 1))
})

const utilityShares = computed(() =>
  apportion(Math.max(Math.round(Number(utilities.value) || 0), 0), people.value.map(() => 1)),
)

const rows = computed(() =>
  people.value.map((person, index) => {
    const share = rentShares.value[index] ?? 0
    const extra = utilityShares.value[index] ?? 0
    return {
      ...person,
      rent: share,
      utilities: extra,
      total: share + extra,
      percent: rent.value ? (share / rent.value) * 100 : 0,
    }
  }),
)

const allocated = computed(() => rentShares.value.reduce((a, b) => a + b, 0))
const unallocated = computed(() => rent.value - allocated.value)
const customBalanced = computed(() => mode.value !== 'custom' || unallocated.value === 0)

function fillRemainingEqually() {
  const empty = people.value.filter((person) => !Number(inputs[person.uid]?.custom))
  const targets = empty.length ? empty : people.value
  const extra = apportion(Math.max(unallocated.value, 0), targets.map(() => 1))
  targets.forEach((person, index) => {
    inputs[person.uid].custom = (Number(inputs[person.uid].custom) || 0) + extra[index]
  })
}

// Custom starts from the equal split rather than from zero, so there is
// something sensible to adjust.
watch([mode, listingId], ([next]) => {
  if (next !== 'custom') return
  const equal = apportion(rent.value, people.value.map(() => 1))
  people.value.forEach((person, index) => {
    inputs[person.uid].custom = equal[index]
  })
})

/* ---------- my own budget only ---------- */
const myBudgetMax = ref(null)
watch(
  () => props.currentUserId,
  async (uid) => {
    myBudgetMax.value = null
    if (!uid) return
    try {
      const prefs = await getPreferences(uid)
      myBudgetMax.value = Number(prefs?.BudgetMax) || null
    } catch {
      myBudgetMax.value = null
    }
  },
  { immediate: true },
)
const myRow = computed(() => rows.value.find((row) => row.isMe) ?? null)

const modeHint = computed(() => MODES.find((m) => m.key === mode.value)?.hint ?? '')
</script>

<template>
  <section class="rs" aria-labelledby="rs-title">
    <div class="rs-head">
      <h2 id="rs-title">Rent split calculator</h2>
      <p>Try different ways of sharing the rent before you commit. Nothing here is saved or shared.</p>
    </div>

    <div v-if="!listings.length" class="rs-empty">
      Shortlist a listing first, then come back to work out who pays what.
    </div>

    <template v-else>
      <div class="rs-controls">
        <label class="rs-field rs-field--wide">
          <span>Listing</span>
          <select v-model="listingId">
            <option v-for="item in listings" :key="item.ListingID" :value="item.ListingID">
              {{ item.Title }} · {{ money(item.MonthlyRent) }}/mo
            </option>
          </select>
        </label>
        <label class="rs-field">
          <span>Utilities &amp; Wi-Fi / month</span>
          <span class="rs-money">
            <i>$</i>
            <input v-model.number="utilities" type="number" min="0" step="10" inputmode="numeric" />
          </span>
        </label>
        <label v-if="!members.length" class="rs-field">
          <span>People sharing</span>
          <input v-model.number="soloCount" type="number" min="2" max="8" />
        </label>
      </div>

      <div class="rs-modes" role="radiogroup" aria-label="How to split the rent">
        <button
          v-for="option in MODES"
          :key="option.key"
          type="button"
          role="radio"
          :aria-checked="mode === option.key"
          :class="{ 'rs-mode--on': mode === option.key }"
          @click="mode = option.key"
        >
          {{ option.label }}
        </button>
      </div>
      <p class="rs-hint">{{ modeHint }}</p>

      <label v-if="mode === 'size'" class="rs-slider">
        <span>Shared spaces (living room, kitchen) split equally: <strong>{{ sharedPercent }}%</strong> of rent</span>
        <input v-model.number="sharedPercent" type="range" min="0" max="80" step="5" />
      </label>
      <label v-if="mode === 'room'" class="rs-slider">
        <span>Master bedroom premium: <strong>+{{ masterPremium }}%</strong></span>
        <input v-model.number="masterPremium" type="range" min="0" max="60" step="5" />
      </label>

      <!-- Stacked bar: each person's slice of the rent. -->
      <div class="rs-stack" role="img" :aria-label="rows.map((r) => `${r.name} ${money(r.rent)}`).join(', ')">
        <span
          v-for="row in rows"
          :key="row.uid"
          :style="{ width: `${Math.min(row.percent, 100)}%`, background: row.colour }"
          :title="`${row.name}: ${money(row.rent)}`"
        ></span>
      </div>

      <table class="rs-table">
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th v-if="mode === 'size'" scope="col">Bedroom size</th>
            <th v-if="mode === 'room'" scope="col">Room</th>
            <th scope="col">{{ mode === 'custom' ? 'Pays' : 'Rent' }}</th>
            <th scope="col">Utilities</th>
            <th scope="col">Total / month</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.uid" :class="{ 'rs-me': row.isMe }">
            <th scope="row">
              <span class="rs-swatch" :style="{ background: row.colour }"></span>
              {{ row.name }}
            </th>
            <td v-if="mode === 'size'">
              <span class="rs-unit">
                <input v-model.number="inputs[row.uid].size" type="number" min="0" step="1" :aria-label="`${row.name}'s bedroom size`" />
                <i>m²</i>
              </span>
            </td>
            <td v-if="mode === 'room'">
              <select v-model="inputs[row.uid].room" :aria-label="`${row.name}'s room`">
                <option value="master">Master (en-suite)</option>
                <option value="common">Common room</option>
              </select>
            </td>
            <td>
              <span v-if="mode === 'custom'" class="rs-money">
                <i>$</i>
                <input v-model.number="inputs[row.uid].custom" type="number" min="0" step="10" :aria-label="`${row.name} pays`" />
              </span>
              <template v-else>
                {{ money(row.rent) }} <small>{{ row.percent.toFixed(0) }}%</small>
              </template>
            </td>
            <td>{{ money(row.utilities) }}</td>
            <td class="rs-total">{{ money(row.total) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td v-if="mode === 'size' || mode === 'room'"></td>
            <td>{{ money(allocated) }} <small>of {{ money(rent) }}</small></td>
            <td>{{ money(utilities || 0) }}</td>
            <td class="rs-total">{{ money(allocated + (Number(utilities) || 0)) }}</td>
          </tr>
        </tfoot>
      </table>

      <div v-if="!customBalanced" class="rs-warning" role="status">
        <span>
          <template v-if="unallocated > 0">{{ money(unallocated) }} of the rent is still unassigned.</template>
          <template v-else>The amounts add up to {{ money(-unallocated) }} more than the rent.</template>
        </span>
        <button v-if="unallocated > 0" type="button" class="link" @click="fillRemainingEqually">
          Split the rest equally
        </button>
      </div>

      <p v-if="myRow && myBudgetMax" class="rs-budget" :class="myRow.rent <= myBudgetMax ? 'rs-budget--ok' : 'rs-budget--over'">
        <template v-if="myRow.rent <= myBudgetMax">
          Your share of {{ money(myRow.rent) }} is within your {{ money(myBudgetMax) }} budget.
        </template>
        <template v-else>
          Your share is {{ money(myRow.rent - myBudgetMax) }} over your {{ money(myBudgetMax) }} budget.
        </template>
        <small>Only you can see this. Teammates' budgets are never shown.</small>
      </p>
    </template>
  </section>
</template>

<style scoped>
.rs {
  display: grid;
  gap: 14px;
  padding: 20px;
  border: 1px solid var(--chip-line);
  border-radius: 14px;
  background: #fff;
}
.rs-head h2 {
  font-size: 16px;
}
.rs-head p,
.rs-hint {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}
.rs-hint {
  margin-top: -6px;
}
.rs-empty {
  padding: 32px;
  border: 1px dashed var(--chip-line);
  border-radius: 12px;
  color: var(--muted);
  text-align: center;
}
.rs-controls {
  display: grid;
  grid-template-columns: 1fr 180px auto;
  gap: 10px;
}
.rs-field {
  display: grid;
  gap: 4px;
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 600;
}
.rs-field select,
.rs-field input,
.rs-table select,
.rs-table input {
  height: 36px;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid var(--chip-line);
  border-radius: 9px;
  background: #fff;
  color: var(--text);
  font-size: 13px;
}
.rs-table select,
.rs-table input {
  height: 32px;
}
.rs-money,
.rs-unit {
  display: flex;
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--chip-line);
  border-radius: 9px;
  background: #fff;
}
.rs-money i,
.rs-unit i {
  padding: 0 8px;
  color: var(--muted);
  font-style: normal;
}
.rs-money input,
.rs-unit input {
  width: 100%;
  border: 0 !important;
}
.rs-unit {
  max-width: 110px;
}
.rs-table .rs-money {
  max-width: 130px;
}
.rs-modes {
  display: flex;
  gap: 6px;
  padding: 5px;
  border-radius: 10px;
  background: #f7f6f4;
}
.rs-modes button {
  flex: 1;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.rs-modes button.rs-mode--on {
  background: #fff;
  color: var(--red);
  box-shadow: 0 1px 4px rgb(0 0 0 / 8%);
}
.rs-slider {
  display: grid;
  gap: 6px;
  font-size: 12px;
}
.rs-slider input {
  accent-color: var(--red);
}
.rs-stack {
  display: flex;
  height: 16px;
  overflow: hidden;
  border-radius: 999px;
  background: #eef0f7;
}
.rs-stack span {
  height: 100%;
  border-right: 2px solid #fff;
  transition: width 0.25s ease;
}
.rs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.rs-table th,
.rs-table td {
  padding: 9px 8px;
  border-bottom: 1px solid #f1f0ef;
  text-align: left;
}
.rs-table thead th {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.rs-table tbody th {
  font-weight: 600;
}
.rs-table small {
  color: var(--muted);
  font-size: 11px;
}
.rs-table tfoot th,
.rs-table tfoot td {
  border-bottom: 0;
  font-weight: 700;
}
.rs-total {
  font-weight: 800;
}
.rs-me {
  background: var(--soft);
}
.rs-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 3px;
  vertical-align: -1px;
}
.rs-warning {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--warn-tint);
  color: var(--warn);
  font-size: 12.5px;
  font-weight: 600;
}
.rs-budget {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 700;
}
.rs-budget small {
  font-weight: 500;
  opacity: 0.85;
}
.rs-budget--ok {
  background: var(--ok-tint);
  color: var(--ok);
}
.rs-budget--over {
  background: var(--error-tint);
  color: var(--error);
}
@media (max-width: 640px) {
  .rs-controls {
    grid-template-columns: 1fr;
  }
  .rs-modes {
    flex-wrap: wrap;
  }
}
</style>
