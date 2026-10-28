<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

// Overlapping pentagons: one per member, each corner a preference compared with
// MY preferences (compareWithMember). The outer edge is me, so a bigger shape
// means a closer match. Click a name to show only that member and read what
// each corner means; click anywhere else to go back to everyone.
const props = defineProps({
  comparisons: { type: Array, default: () => [] },
  axes: { type: Array, default: () => [] },
})

const CENTRE = 50
const RADIUS = 33
const RINGS = [25, 50, 75, 100]

// Plain-language reading of a 0–100 comparison score.
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
  RINGS.map((ring) => ({ ring, points: toPoints(props.axes.map(() => ring)) })),
)
const axisLines = computed(() =>
  props.axes.map((axis, i) => {
    const end = pointAt(i, 100)
    const at = pointAt(i, 122)
    return {
      ...axis,
      end,
      at,
      anchor: Math.abs(at.x - CENTRE) < 2 ? 'middle' : at.x > CENTRE ? 'start' : 'end',
    }
  }),
)

const shapes = computed(() =>
  props.comparisons.map((comparison) => {
    const values = props.axes.map((axis, i) => {
      const row = comparison.rows.find((item) => item.key === axis.key)
      const score = row?.score ?? null
      // Word labels sit a little inside the corner so they never cover the axis name.
      const at = pointAt(i, Math.max(Math.min(score ?? 0, 88), 22))
      return { key: axis.key, label: axis.label, score, brief: row?.brief, ...band(score), at }
    })
    return { ...comparison, values, points: toPoints(values.map((value) => value.score ?? 0)) }
  }),
)

// Clicking a name shows only that member; clicking it again, or anywhere else, resets.
const soloUid = ref(null)
const hoverUid = ref(null)
const root = ref(null)
function pick(uid) {
  soloUid.value = soloUid.value === uid ? null : uid
}
function resetOnOutsideClick(event) {
  if (!event.target.closest?.('.toggle')) soloUid.value = null
}
onMounted(() => document.addEventListener('click', resetOnOutsideClick))
onBeforeUnmount(() => document.removeEventListener('click', resetOnOutsideClick))

const visibleShapes = computed(() =>
  soloUid.value ? shapes.value.filter((shape) => shape.uid === soloUid.value) : shapes.value,
)
const activeUid = computed(() => soloUid.value || hoverUid.value)
// Draw the active shape last so it sits on top.
const orderedShapes = computed(() => [
  ...visibleShapes.value.filter((shape) => shape.uid !== activeUid.value),
  ...visibleShapes.value.filter((shape) => shape.uid === activeUid.value),
])
const active = computed(() => visibleShapes.value.find((shape) => shape.uid === activeUid.value))
const solo = computed(() => shapes.value.find((shape) => shape.uid === soloUid.value))
</script>

<template>
  <div ref="root" class="radar">
    <p v-if="!comparisons.length" class="radar-empty">
      There are no other members to compare with yet.
    </p>
    <template v-else>
      <svg
        class="radar-svg"
        viewBox="0 0 100 100"
        role="img"
        :aria-label="`How each member matches you on ${axes.map((axis) => axis.label).join(', ')}`"
      >
        <polygon
          v-for="ring in rings"
          :key="ring.ring"
          :points="ring.points"
          class="ring"
          :class="{ 'ring-you': ring.ring === 100 }"
        />
        <line
          v-for="axis in axisLines"
          :key="`axis-${axis.key}`"
          :x1="CENTRE"
          :y1="CENTRE"
          :x2="axis.end.x"
          :y2="axis.end.y"
          class="axis"
        />
        <text
          v-for="axis in axisLines"
          :key="`label-${axis.key}`"
          :x="axis.at.x"
          :y="axis.at.y"
          :text-anchor="axis.anchor"
          class="axis-label"
        >
          {{ axis.label }}
        </text>
        <text :x="CENTRE + 1" :y="CENTRE - RADIUS - 1.5" class="ring-label">You</text>
        <g
          v-for="shape in orderedShapes"
          :key="shape.uid"
          class="shape"
          :class="{ 'is-dim': activeUid && activeUid !== shape.uid }"
          @mouseenter="hoverUid = shape.uid"
          @mouseleave="hoverUid = null"
        >
          <polygon
            :points="shape.points"
            :style="{ fill: shape.color, stroke: shape.color }"
            class="shape-area"
          />
        </g>
        <!-- Words for the active member only, so labels never pile up. -->
        <g v-if="active" class="values">
          <text
            v-for="value in active.values"
            :key="`value-${value.key}`"
            :x="value.at.x"
            :y="value.at.y"
            text-anchor="middle"
            :class="`tone-${value.tone}`"
          >
            {{ value.word }}
          </text>
        </g>
      </svg>

      <div class="toggles" role="group" aria-label="Show one member">
        <button
          v-for="shape in shapes"
          :key="shape.uid"
          type="button"
          class="toggle"
          :class="{ 'is-faded': soloUid && soloUid !== shape.uid }"
          :aria-pressed="soloUid === shape.uid"
          @click="pick(shape.uid)"
          @mouseenter="hoverUid = shape.uid"
          @mouseleave="hoverUid = null"
          @focus="hoverUid = shape.uid"
          @blur="hoverUid = null"
        >
          <span class="dot" :style="{ background: shape.color }" aria-hidden="true"></span>
          {{ shape.name }}
          <strong>{{ shape.score == null ? '—' : `${shape.score}%` }}</strong>
        </button>
      </div>

      <dl v-if="solo" class="details" aria-live="polite">
        <div v-for="value in solo.values" :key="value.key">
          <dt>{{ value.label }}</dt>
          <dd>
            <span class="chip" :class="`tone-${value.tone}`">{{ value.word }}</span>
            <span class="brief">{{ value.brief }}</span>
          </dd>
        </div>
      </dl>
      <p v-else class="hint">Select a name to see how they compare with you.</p>

      <table class="sr-only">
        <caption>
          Match with you by preference
        </caption>
        <thead>
          <tr>
            <th scope="col">Member</th>
            <th v-for="axis in axes" :key="axis.key" scope="col">{{ axis.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="shape in shapes" :key="shape.uid">
            <th scope="row">{{ shape.name }}</th>
            <td v-for="value in shape.values" :key="value.key">
              {{ value.word }}: {{ value.brief }}
            </td>
          </tr>
        </tbody>
      </table>
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
.radar-svg {
  display: block;
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  overflow: visible;
}
.ring {
  fill: none;
  stroke: var(--line, #ebe8e6);
  stroke-width: 0.3;
}
.ring-you {
  stroke: var(--text, #161616);
  stroke-width: 0.45;
  stroke-dasharray: 1.2 0.8;
}
.ring-label {
  fill: var(--text, #161616);
  font-size: 2.6px;
  font-weight: 700;
}
.axis {
  stroke: var(--line, #ebe8e6);
  stroke-width: 0.3;
}
.axis-label {
  fill: #6d6863;
  font-size: 3px;
  font-weight: 600;
  dominant-baseline: middle;
}
.shape {
  transition: opacity 0.15s;
}
.shape.is-dim {
  opacity: 0.2;
}
.shape-area {
  fill-opacity: 0.12;
  stroke-width: 0.6;
  stroke-linejoin: round;
}
.values text {
  fill: var(--text, #161616);
  font-size: 2.9px;
  font-weight: 700;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 0.8px;
}
.toggles {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
}
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--line, #ebe8e6);
  border-radius: 999px;
  background: #fff;
  color: var(--text, #161616);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.toggle strong {
  font-variant-numeric: tabular-nums;
}
.toggle[aria-pressed='true'] {
  border-color: var(--text, #161616);
  box-shadow: inset 0 0 0 1px var(--text, #161616);
}
.toggle.is-faded {
  color: #8c8883;
  background: #fafafa;
}
.toggle.is-faded .dot {
  opacity: 0.3;
}
.values .tone-partial {
  fill: #6b4700;
}
.values .tone-none {
  fill: #9b1c2c;
}
.values .tone-unknown {
  fill: #6d6863;
}
.details {
  display: grid;
  gap: 8px;
  margin: 14px 0 0;
  font-size: 12px;
}
.details div {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 10px;
  align-items: baseline;
}
.details dt {
  color: #6d6863;
}
.details dd {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: baseline;
  margin: 0;
}
.chip {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.chip.tone-match {
  background: var(--ok-tint, #e2f3ea);
  color: var(--ok, #2e7d5b);
}
.chip.tone-partial {
  background: var(--warn-tint, #fdf1d6);
  color: #6b4700;
}
.chip.tone-none {
  background: #fcebec;
  color: #9b1c2c;
}
.chip.tone-unknown {
  background: var(--soft, #efeeec);
  color: #6d6863;
}
.brief {
  color: #6d6863;
}
.hint {
  margin: 12px 0 0;
  color: #8c8883;
  font-size: 12px;
  text-align: center;
}
.toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgb(200 41 47 / 25%);
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
</style>
