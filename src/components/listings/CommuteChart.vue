<script setup>
import { computed, ref } from 'vue'
import { commuteKey } from '../../services/routingService'

/**
 * Commute time from each shortlisted listing to every member's destination,
 * against that member's own limit (F-REQ-017.5).
 *
 * Each member sets a different maximum, so raw minutes are not comparable
 * across members. Every bar is drawn as a share of that member's own limit,
 * which puts one reference line at 100% for everyone and makes "who does this
 * not work for" readable at a glance. The minutes are printed on each bar, so
 * the real value is never hidden behind the normalisation.
 */

const props = defineProps({
  // Listing records with ListingID and Title.
  listings: { type: Array, default: () => [] },
  // [{ uid, name, profile: { MaxCommuteTime } }]
  members: { type: Array, default: () => [] },
  // Map from routingService.commuteMatrix()
  matrix: { type: Map, default: () => new Map() },
})

const showTable = ref(false)

const groups = computed(() =>
  props.listings.map((listing) => ({
    id: listing.ListingID,
    title: listing.Title,
    bars: props.members.map((member) => {
      const entry = props.matrix.get(commuteKey(listing.ListingID, member.uid))
      const limit = Number(member.profile?.MaxCommuteTime) || null
      const minutes = entry?.minutes ?? null
      return {
        uid: member.uid,
        name: member.name || 'Member',
        minutes,
        limit,
        estimated: entry?.source === 'estimate',
        // Share of this member's own limit. Null when either value is missing.
        ratio: minutes != null && limit ? minutes / limit : null,
        over: minutes != null && limit ? minutes > limit : false,
      }
    }),
  })),
)

// One shared scale so bars are comparable between listings, with headroom so a
// bar at the limit does not touch the right edge.
const scaleMax = computed(() => {
  const worst = groups.value.flatMap((g) => g.bars.map((b) => b.ratio ?? 0))
  return Math.max(1.35, ...worst) * 1.02
})

const limitPct = computed(() => (1 / scaleMax.value) * 100)
const widthPct = (ratio) => `${Math.min(100, (ratio / scaleMax.value) * 100)}%`

const anyOver = computed(() => groups.value.some((g) => g.bars.some((b) => b.over)))
const label = (bar) =>
  bar.minutes == null
    ? 'No data'
    : `${bar.minutes} min${bar.limit ? ` · limit ${bar.limit}` : ''}${bar.estimated ? ' · estimated' : ''}`
</script>

<template>
  <figure class="cc">
    <figcaption class="cc-head">
      <div>
        <h3>Commute by member</h3>
        <p class="cc-sub">
          Each bar is that member's travel time as a share of their own limit.
          The line marks the limit.
        </p>
      </div>
      <button type="button" class="cc-toggle" @click="showTable = !showTable">
        {{ showTable ? 'Show chart' : 'Show table' }}
      </button>
    </figcaption>

    <div v-if="!showTable" class="cc-plot">
      <div v-for="group in groups" :key="group.id" class="cc-group">
        <p class="cc-title">{{ group.title }}</p>

        <div class="cc-rows">
          <div v-for="bar in group.bars" :key="bar.uid" class="cc-row">
            <span class="cc-name">{{ bar.name }}</span>
            <span class="cc-track">
              <span class="cc-limit" :style="{ left: `${limitPct}%` }" aria-hidden="true"></span>
              <span
                v-if="bar.ratio != null"
                class="cc-bar"
                :class="{ over: bar.over, est: bar.estimated }"
                :style="{ width: widthPct(bar.ratio) }"
                :title="`${bar.name}: ${label(bar)}`"
              ></span>
              <span v-else class="cc-none">Insufficient data</span>
            </span>
            <span class="cc-val" :class="{ over: bar.over }">
              <template v-if="bar.minutes != null">
                <span aria-hidden="true">{{ bar.over ? '!' : '✓' }}</span>
                {{ bar.minutes }} min
                <span v-if="bar.limit" class="cc-dim">/ {{ bar.limit }}</span>
                <span v-if="bar.estimated" class="cc-dim">est.</span>
              </template>
              <template v-else>-</template>
            </span>
          </div>
        </div>
      </div>
      <p v-if="!groups.length" class="cc-empty">Shortlist some listings to compare commutes.</p>
    </div>

    <div v-else class="cc-tablewrap">
      <table class="cc-table">
        <thead>
          <tr>
            <th>Listing</th>
            <th v-for="m in members" :key="m.uid">{{ m.name || 'Member' }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="group in groups" :key="group.id">
            <th scope="row">{{ group.title }}</th>
            <td v-for="bar in group.bars" :key="bar.uid" :class="{ over: bar.over }">
              {{ bar.minutes != null ? `${bar.minutes} min` : '-' }}
              <span v-if="bar.limit" class="cc-dim">/ {{ bar.limit }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="anyOver" class="cc-foot">
      <span class="cc-key over"></span> over that member's limit
      <span class="cc-key"></span> within it
    </p>
  </figure>
</template>

<style scoped>
/* Validated against the chart surface: within/over separate at ΔE 7.8 for
   deuteranopia, which is legal with the direct labels every bar carries. */
.cc {
  --within: #12916a;
  --over: #c8292f;
  --track: rgb(93 103 151 / 10%);
  --rule: rgb(93 103 151 / 30%);
  margin: 0;
}
.cc-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.cc-head h3 { margin: 0; font-size: 15px; }
.cc-sub { margin: 2px 0 0; font-size: 12px; color: var(--muted, #9a9db5); max-width: 46ch; }
.cc-toggle {
  border: 1px solid var(--line, rgb(93 103 151 / 16%));
  background: transparent;
  color: var(--text, #2a2d3e);
  border-radius: 999px;
  padding: 4px 12px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.cc-toggle:hover { background: var(--soft, rgb(123 140 240 / 9%)); }

.cc-group + .cc-group { margin-top: 1.1rem; }
.cc-title { margin: 0 0 0.4rem; font-size: 13px; font-weight: 600; }
.cc-rows { position: relative; display: grid; gap: 2px; }
/* Sits inside the track, so it marks exactly 100% of that member's own limit.
   Every track is the same width, so the ticks line up into one column. */
.cc-limit {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  background: var(--rule);
  z-index: 2;
  pointer-events: none;
}
.cc-row { display: grid; grid-template-columns: 100px 1fr auto; align-items: center; gap: 8px; }
.cc-name {
  font-size: 12px;
  color: var(--muted, #9a9db5);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cc-track { position: relative; height: 14px; background: var(--track); border-radius: 3px; }
.cc-rows { --tick: 1; }
.cc-bar {
  display: block;
  height: 100%;
  background: var(--within);
  border-radius: 3px 4px 4px 3px;
  min-width: 3px;
}
.cc-bar.over { background: var(--over); }
.cc-bar.est { opacity: 0.55; }
.cc-none { font-size: 11px; color: var(--muted, #9a9db5); padding-left: 6px; line-height: 14px; }
.cc-val {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--within);
  white-space: nowrap;
  min-width: 108px;
}
.cc-val.over { color: var(--over); }
.cc-dim { color: var(--muted, #9a9db5); }
.cc-empty { font-size: 13px; color: var(--muted, #9a9db5); }

.cc-tablewrap { overflow-x: auto; }
.cc-table { border-collapse: collapse; width: 100%; font-size: 13px; }
.cc-table th, .cc-table td {
  text-align: left;
  padding: 6px 12px 6px 0;
  border-bottom: 1px solid var(--line, rgb(93 103 151 / 16%));
  font-variant-numeric: tabular-nums;
}
.cc-table thead th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted, #9a9db5); }
.cc-table td.over { color: var(--over); font-weight: 600; }

.cc-foot { margin: 0.9rem 0 0; font-size: 11px; color: var(--muted, #9a9db5); display: flex; align-items: center; gap: 6px; }
.cc-key { width: 14px; height: 8px; border-radius: 2px; background: var(--within); display: inline-block; }
.cc-key.over { background: var(--over); }
.cc-foot .cc-key:not(.over) { margin-left: 10px; }

@media (max-width: 520px) {
  .cc-row { grid-template-columns: 76px 1fr; }
  .cc-val { grid-column: 2; min-width: 0; padding-left: 2px; }
}
</style>
