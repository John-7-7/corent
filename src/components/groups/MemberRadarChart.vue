<script setup>
import { computed, ref } from 'vue'

// Each corner compares one preference with mine: the outer edge is me.
const props = defineProps({
  comparisons: { type: Array, default: () => [] },
  axes: { type: Array, default: () => [] },
})
defineEmits(['compare'])

const CENTRE = 50
const RADIUS = 30
const RINGS = [25, 50, 75, 100]
// A score of 0 still sits this far out, so the shape never collapses to a spike.
const FLOOR = 22
const reach = (score) => FLOOR + ((100 - FLOOR) * (score ?? 0)) / 100

const band = (score) =>
  score == null
    ? { word: 'Not shared', tone: 'unknown' }
    : score === 100
      ? { word: 'Full match', tone: 'match' }
      : score >= 60
        ? { word: 'Good match', tone: 'match' }
        : score > 0
          ? { word: 'Partial', tone: 'partial' }
          : { word: 'No match', tone: 'none' }

const angleAt = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / props.axes.length
const pointAt = (i, score) => ({
  x: CENTRE + (RADIUS * score * Math.cos(angleAt(i))) / 100,
  y: CENTRE + (RADIUS * score * Math.sin(angleAt(i))) / 100,
})
const toPoints = (scores) =>
  scores
    .map((score, i) => pointAt(i, score))
    .map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ')
const rings = computed(() =>
  [...RINGS].reverse().map((ring) => toPoints(props.axes.map(() => ring))),
)
const axisLines = computed(() =>
  props.axes.map((axis, i) => {
    const at = pointAt(i, 130)
    return {
      ...axis,
      end: pointAt(i, 100),
      at,
      anchor: Math.abs(at.x - CENTRE) < 2 ? 'middle' : at.x > CENTRE ? 'start' : 'end',
    }
  }),
)

const selectedUid = ref(null)
const member = computed(
  () =>
    props.comparisons.find((comparison) => comparison.uid === selectedUid.value) ||
    props.comparisons[0] ||
    null,
)
const rowOf = (key) => member.value?.rows.find((row) => row.key === key)
const corners = computed(() =>
  props.axes.map((axis, i) => {
    const row = rowOf(axis.key)
    const score = row?.score ?? null
    return {
      ...axis,
      score,
      ...band(score),
      brief: row?.brief || '',
      at: axisLines.value[i].at,
      anchor: axisLines.value[i].anchor,
    }
  }),
)
// Unknown corners sit at the floor with dashed edges, so they don't read as "No match".
const unknownKeys = computed(() =>
  corners.value.filter((corner) => corner.score == null).map((corner) => corner.key),
)
const hasScores = computed(() => unknownKeys.value.length < corners.value.length)
const points = computed(() => corners.value.map((corner, i) => pointAt(i, reach(corner.score))))
const shape = computed(() => toPoints(corners.value.map((corner) => reach(corner.score))))
const edges = computed(() =>
  points.value.map((from, i) => {
    const next = (i + 1) % points.value.length
    return {
      key: corners.value[i].key,
      from,
      to: points.value[next],
      unknown: corners.value[i].score == null || corners.value[next].score == null,
    }
  }),
)
const known = (value) =>
  value && value !== 'Not provided' && value !== 'Preferences unavailable' ? value : null
const areas = computed(() => known(rowOf('PreferredLocations')?.theirs)?.split(', ') || [])
const home = computed(() => {
  const bedrooms = known(rowOf('bedrooms')?.theirs)
  const type = known(rowOf('PropertyType')?.theirs)
  return [
    bedrooms && `${bedrooms} bedroom${bedrooms === '1' ? '' : 's'}`,
    type && (type === 'Any' ? 'Any property type' : type),
  ]
    .filter(Boolean)
    .join(' · ')
})
</script>

<template>
  <div class="radar">
    <p v-if="!comparisons.length" class="radar-empty">
      There are no other members to compare with yet.
    </p>
    <template v-else>
      <div v-if="comparisons.length > 1" class="tabs" role="tablist" aria-label="Choose a member">
        <button
          v-for="comparison in comparisons"
          :key="comparison.uid"
          type="button"
          role="tab"
          class="tab"
          :aria-selected="comparison.uid === member.uid"
          @click="selectedUid = comparison.uid"
        >
          <span class="dot" :style="{ background: comparison.color }" aria-hidden="true"></span>
          <span class="tab-name">{{ comparison.name }}</span>
        </button>
      </div>

      <div class="head">
        <span class="avatar" :style="{ '--member': member.color }" aria-hidden="true">
          {{ member.initials }}
        </span>
        <strong class="name">{{ member.name }}</strong>
        <span class="match" :class="{ 'is-unknown': member.score == null }">
          {{ member.score == null ? 'No match data' : `${member.score}% match` }}
        </span>
      </div>

      <svg
        class="radar-svg"
        viewBox="2 8 96 84"
        role="img"
        :aria-label="`How ${member.name} matches you on ${corners.map((corner) => `${corner.label}: ${corner.word}`).join(', ')}`"
        :style="{ '--member': member.color }"
      >
        <polygon
          v-for="(ring, i) in rings"
          :key="ring"
          :points="ring"
          class="ring"
          :class="{ 'ring-you': i === 0 }"
        />
        <line
          v-for="axis in axisLines"
          :key="`axis-${axis.key}`"
          :x1="CENTRE"
          :y1="CENTRE"
          :x2="axis.end.x"
          :y2="axis.end.y"
          class="axis"
          :class="{ 'is-unknown': unknownKeys.includes(axis.key) }"
        />
        <template v-if="hasScores">
          <polygon :points="shape" class="them" />
          <line
            v-for="edge in edges"
            :key="`edge-${edge.key}`"
            :x1="edge.from.x"
            :y1="edge.from.y"
            :x2="edge.to.x"
            :y2="edge.to.y"
            class="edge"
            :class="{ 'is-unknown': edge.unknown }"
          />
        </template>
        <text
          v-for="corner in corners"
          :key="`label-${corner.key}`"
          :x="corner.at.x"
          :y="corner.at.y - 2"
          :text-anchor="corner.anchor"
          class="axis-label"
        >
          <title>
            {{ corner.label }}: {{ corner.word }}{{ corner.brief ? ` — ${corner.brief}` : '' }}
          </title>
          {{ corner.label }}
          <tspan :x="corner.at.x" dy="4.2" class="axis-word" :class="`tone-${corner.tone}`">
            {{ corner.word }}
          </tspan>
        </text>
      </svg>

      <ul class="legend">
        <li><span class="key key-you" aria-hidden="true"></span>You</li>
        <li>
          <span class="key" :style="{ background: member.color }" aria-hidden="true"></span>
          <span class="legend-name">{{ member.name }}</span>
        </li>
      </ul>

      <dl class="facts">
        <div>
          <dt>Budget</dt>
          <dd>
            <span v-if="known(rowOf('budget')?.theirs)" class="pill">
              {{ known(rowOf('budget')?.theirs) }}
            </span>
            <span v-else class="none">Not set</span>
          </dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>
            <span v-for="area in areas" :key="area" class="pill pill-soft">{{ area }}</span>
            <span v-if="!areas.length" class="none">Not set</span>
          </dd>
        </div>
        <div>
          <dt>Home</dt>
          <dd>
            <span v-if="home" class="pill pill-soft">{{ home }}</span>
            <span v-else class="none">Not set</span>
          </dd>
        </div>
        <div>
          <dt>Shared picks</dt>
          <dd>
            <span v-for="pick in member.sharedPicks" :key="pick" class="pill pill-soft">
              ✓ {{ pick }}
            </span>
            <span v-if="!member.sharedPicks?.length" class="none">None in common</span>
          </dd>
        </div>
      </dl>

      <button type="button" class="compare" @click="$emit('compare')">
        View full comparison <span aria-hidden="true">›</span>
      </button>

      <!-- Wrapped: .sr-only alone does not shrink a table, which then widens the page. -->
      <div class="sr-only">
        <table>
          <caption>
            {{
              member.name
            }}'s match with you by preference
          </caption>
          <tbody>
            <tr v-for="corner in corners" :key="corner.key">
              <th scope="row">{{ corner.label }}</th>
              <td>{{ corner.word }}: {{ corner.brief }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.radar {
  margin-top: 8px;
}
.radar-empty {
  color: #737373;
  font-size: 13px;
}
.tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  flex-wrap: wrap;
  border-radius: 20px;
  background: var(--soft, #efeeec);
}
.tab {
  display: inline-flex;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: #6d6863;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.tab[aria-selected='true'] {
  background: #fff;
  color: var(--text, #161616);
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}
.tab:focus-visible,
.compare:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgb(200 41 47 / 25%);
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 4px;
}
.avatar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--member) 14%, #fff);
  color: var(--member);
  font-size: 17px;
  font-weight: 700;
}
.name {
  min-width: 0;
  overflow: hidden;
  font-size: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.match {
  flex: none;
  margin-left: auto;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--ok-tint, #e2f3ea);
  color: var(--ok, #2e7d5b);
  font-size: 13px;
  font-weight: 700;
}
.match.is-unknown {
  background: var(--soft, #efeeec);
  color: #6d6863;
}
.radar-svg {
  display: block;
  width: 100%;
  max-width: 320px;
  margin: 14px auto 0;
  overflow: visible;
}
.ring {
  fill: none;
  stroke: #ebe8e4;
  stroke-width: 0.3;
}
.ring-you {
  fill: #faf9f7;
  stroke: #c9c4bd;
  stroke-width: 0.45;
  stroke-dasharray: 1.4 1;
}
.axis {
  stroke: #ebe8e4;
  stroke-width: 0.3;
}
.axis.is-unknown {
  stroke: #b4aea6;
  stroke-width: 0.4;
  stroke-dasharray: 1 1;
}
.axis-label {
  fill: var(--text, #161616);
  font-size: 3.3px;
  font-weight: 700;
  dominant-baseline: middle;
}
.axis-word {
  font-size: 2.8px;
  font-weight: 600;
}
.tone-match {
  fill: var(--ok, #2e7d5b);
}
.tone-partial {
  fill: #9a6a00;
}
.tone-none {
  fill: #b4232f;
}
.tone-unknown {
  fill: #8c8883;
}
.them {
  fill: var(--member);
  fill-opacity: 0.16;
}
.edge {
  stroke: var(--member);
  stroke-width: 1.1;
  stroke-linecap: round;
}
.edge.is-unknown {
  stroke: #a39d95;
  stroke-width: 0.6;
  stroke-dasharray: 1.2 1.2;
}
.legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin: 10px 0 0;
  padding: 0;
  color: #6d6863;
  font-size: 13px;
  list-style: none;
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.legend-name,
.tab-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.key {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.key-you {
  border: 1px dashed #a39d95;
  background: #faf9f7;
}
.facts {
  display: grid;
  gap: 10px;
  margin: 16px -24px 0;
  padding: 14px 24px;
  border-top: 1px solid var(--line, #ebe8e6);
  border-bottom: 1px solid var(--line, #ebe8e6);
  background: #faf9f6;
  font-size: 13px;
}
.facts div {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.facts dt {
  flex: none;
  padding-top: 4px;
  color: #6d6863;
}
.facts dd {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  margin: 0;
}
.pill {
  padding: 4px 10px;
  border-radius: 8px;
  background: var(--soft, #efeeec);
  color: #3f3c39;
  font-size: 12px;
  font-weight: 700;
}
.pill-soft {
  background: var(--ok-tint, #e2f3ea);
  color: var(--ok, #2e7d5b);
}
.none {
  padding-top: 4px;
  color: #8c8883;
  font-size: 12px;
}
.compare {
  display: block;
  margin: 12px auto 0;
  padding: 6px 12px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--text, #161616);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
</style>
