<script setup>
import { computed, ref } from 'vue'
import { PENDING_GROUP_DECISION } from '../../services/listingScoring'

/**
 * Why a listing scored what it scored (F-REQ-015.4 and AC2).
 *
 * One bar per criterion rather than a stacked reconstruction of the headline
 * number: the group score is an average of per-member scores computed with
 * different weights, so stacked segments would not actually add up to it.
 * Showing each criterion's own score with its weight beside it answers the same
 * question without the false precision.
 *
 * Criteria with no data are rendered as "insufficient data" and carry no bar,
 * because AC4 says they are not failures and they are excluded from the score.
 */

const props = defineProps({
  // One entry from scoreListings(): { listingId, score, rows, perMember, unknownCriteria }
  result: { type: Object, required: true },
  // Rank among the shortlist, when shown inside a ranked list.
  rank: { type: Number, default: null },
  votes: { type: Number, default: null },
})

// 'group' or a member uid: the same listing seen through one member's ranking.
const view = ref('group')

const rows = computed(() => {
  if (view.value === 'group') return props.result.rows || []
  const member = (props.result.perMember || []).find((m) => m.uid === view.value)
  return (member?.rows || []).map((row) => ({
    ...row,
    status: row.score == null ? 'unknown' : row.score >= 60 ? 'met' : 'unmet',
  }))
})

const headline = computed(() => {
  if (view.value === 'group') return props.result.score
  return (props.result.perMember || []).find((m) => m.uid === view.value)?.score ?? null
})

const unknownCount = computed(() => rows.value.filter((r) => r.score == null).length)
const pendingKeys = new Set(PENDING_GROUP_DECISION.map((p) => p.key))
const isPending = (key) => pendingKeys.has(key)
</script>

<template>
  <figure class="sb">
    <figcaption class="sb-head">
      <div class="sb-score">
        <span class="sb-num">{{ headline != null ? `${headline}%` : '—' }}</span>
        <span class="sb-cap">
          {{ view === 'group' ? 'group fit' : 'fit for this member' }}
          <template v-if="rank"> · ranked #{{ rank }}</template>
          <template v-if="votes != null"> · {{ votes }} {{ votes === 1 ? 'vote' : 'votes' }}</template>
        </span>
      </div>

      <div v-if="(result.perMember || []).length > 1" class="sb-view">
        <label class="sb-vlabel" :for="`sb-${result.listingId}`">View as</label>
        <select :id="`sb-${result.listingId}`" v-model="view" class="sb-select">
          <option value="group">Whole group</option>
          <option v-for="m in result.perMember" :key="m.uid" :value="m.uid">
            {{ m.name || 'Member' }}
          </option>
        </select>
      </div>
    </figcaption>

    <ul class="sb-rows">
      <li v-for="row in rows" :key="row.key" class="sb-row" :class="row.status">
        <span class="sb-label">
          {{ row.label }}
          <span v-if="isPending(row.key)" class="sb-chip" title="No agreed group value yet">
            not agreed
          </span>
        </span>

        <span class="sb-track">
          <span
            v-if="row.score != null"
            class="sb-bar"
            :style="{ width: `${row.score}%` }"
            :title="`${row.label}: ${row.score}% — ${row.detail}`"
          ></span>
          <span v-else class="sb-unknown" aria-label="Insufficient data"></span>
        </span>

        <span class="sb-val">{{ row.score != null ? `${row.score}%` : 'No data' }}</span>
        <span class="sb-detail">{{ row.detail }}</span>
      </li>
    </ul>

    <p v-if="unknownCount" class="sb-foot">
      {{ unknownCount }} of {{ rows.length }} criteria could not be evaluated and are left out of
      the score rather than counted against this listing.
    </p>
  </figure>
</template>

<style scoped>
.sb {
  --fill: var(--red, #7b8cf0);
  --track: rgb(93 103 151 / 10%);
  margin: 0;
}
.sb-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.9rem;
}
.sb-score { display: flex; align-items: baseline; gap: 0.5rem; }
.sb-num { font-size: 30px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.sb-cap { font-size: 12px; color: var(--muted, #9a9db5); }
.sb-view { display: flex; align-items: center; gap: 6px; }
.sb-vlabel { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted, #9a9db5); }
.sb-select {
  font: inherit;
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--line, rgb(93 103 151 / 16%));
  background: transparent;
  color: var(--text, #2a2d3e);
}

.sb-rows { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
.sb-row {
  display: grid;
  grid-template-columns: 118px 1fr 56px;
  align-items: center;
  gap: 4px 10px;
}
.sb-label { font-size: 12.5px; display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.sb-chip {
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 1px 5px;
  border-radius: 999px;
  border: 1px dashed var(--warn, #8a5a00);
  color: var(--warn, #8a5a00);
}
.sb-track { position: relative; height: 12px; background: var(--track); border-radius: 3px; overflow: hidden; }
.sb-bar { display: block; height: 100%; background: var(--fill); border-radius: 3px 4px 4px 3px; min-width: 3px; }
.sb-row.unmet .sb-bar { background: rgb(123 140 240 / 45%); }
.sb-unknown {
  display: block;
  height: 100%;
  background: repeating-linear-gradient(
    135deg,
    var(--track) 0 5px,
    transparent 5px 10px
  );
}
.sb-val {
  font-size: 12px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--text, #2a2d3e);
}
.sb-row.unknown .sb-val { color: var(--muted, #9a9db5); }
.sb-detail {
  grid-column: 2 / -1;
  font-size: 11px;
  color: var(--muted, #9a9db5);
  margin-top: -2px;
}
.sb-foot {
  margin: 0.9rem 0 0;
  font-size: 11px;
  color: var(--muted, #9a9db5);
  max-width: 60ch;
}

@media (max-width: 520px) {
  .sb-row { grid-template-columns: 1fr 52px; }
  .sb-label { grid-column: 1 / -1; }
  .sb-track { grid-column: 1; }
  .sb-detail { grid-column: 1 / -1; }
}
</style>
