<script setup>
import { computed, ref, watch } from 'vue'
import RangeSlider from '../profile/RangeSlider.vue'
import { formatCurrency } from '../profile/preferenceOptions.js'

// Budget vote: each member slides to the MAXIMUM they will pay per person. The
// slider's own track is shaded light green up to the lowest vote, the amounts
// every voter accepts; hovering or tapping the green shows how many people that
// is. Only counts are shown, never names.
const props = defineProps({
  summary: { type: Object, required: true }, // { total, lowest, highest }
  mine: { type: Number, default: null }, // my current vote
  initial: { type: Number, default: null }, // starting amount when I haven't voted
  scale: { type: Object, required: true }, // { min, max, step }
  memberCount: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['vote'])

const snap = (value) =>
  Math.min(
    props.scale.max,
    Math.max(props.scale.min, Math.round(value / props.scale.step) * props.scale.step),
  )
const start = () => snap(props.mine ?? props.initial ?? (props.scale.min + props.scale.max) / 2)
const draft = ref(start())
watch(
  () => [props.mine, props.scale.min, props.scale.max],
  () => (draft.value = start()),
)

// Same thumb-centre maths as RangeSlider, so markers line up with the thumb.
const THUMB = 18
const percent = (value) =>
  props.scale.max === props.scale.min
    ? 100
    : ((value - props.scale.min) / (props.scale.max - props.scale.min)) * 100
const at = (value) => `calc(${percent(value)}% + ${(0.5 - percent(value) / 100) * THUMB}px)`

const showTip = ref(false)
const sliderEl = ref(null)
// The native slider sits on top of the track, so detect the green part by position.
function trackHover(event) {
  if (agreed.value === null || !sliderEl.value) return (showTip.value = false)
  const box = sliderEl.value.getBoundingClientRect()
  const p = percent(agreed.value) / 100
  const greenEnd = p * box.width + (0.5 - p) * THUMB
  showTip.value = event.clientX - box.left <= greenEnd
}
const agreed = computed(() =>
  props.summary.lowest == null ? null : Math.min(props.summary.lowest, props.scale.max),
)
const changed = computed(() => props.mine !== draft.value)

function setAmount(event) {
  const value = Number(event.target.value)
  if (Number.isFinite(value)) draft.value = snap(value)
  event.target.value = draft.value
}
</script>

<template>
  <div class="budget-vote">
    <div
      ref="sliderEl"
      class="slider-wrap"
      @pointermove="trackHover"
      @pointerdown="trackHover"
      @pointerleave="showTip = false"
    >
      <div class="track" aria-hidden="true">
        <span v-if="agreed !== null" class="agreed" :style="{ width: at(agreed) }"></span>
      </div>
      <span
        v-if="showTip && agreed !== null"
        class="agreed-tip"
        :style="{ left: at(agreed) }"
        role="tooltip"
      >
        <strong
          >{{ summary.total }} {{ summary.total === 1 ? 'person' : 'people' }} picked this</strong
        >
        Up to {{ formatCurrency(agreed) }}
      </span>
      <RangeSlider
        v-model="draft"
        :min="scale.min"
        :max="scale.max"
        :step="scale.step"
        :format-value="formatCurrency"
        label="Your maximum budget per person"
        :disabled="disabled"
      />
    </div>
    <p v-if="agreed !== null" class="sr-only" aria-live="polite">
      {{ summary.total }} {{ summary.total === 1 ? 'person accepts' : 'people accept' }} up to
      {{ formatCurrency(agreed) }}
    </p>

    <div class="amount-row">
      <label>
        <span>Maximum per person</span>
        <input
          type="number"
          inputmode="numeric"
          :min="scale.min"
          :max="scale.max"
          :step="scale.step"
          :value="draft"
          :disabled="disabled"
          @change="setAmount"
        />
      </label>
      <button
        type="button"
        class="btn btn-primary vote-button"
        :disabled="disabled || !changed"
        @click="emit('vote', draft)"
      >
        {{ mine === null ? 'Vote' : 'Update vote' }}
      </button>
    </div>
    <p class="vote-count">{{ summary.total }}/{{ memberCount }} voted</p>
  </div>
</template>

<style scoped>
.budget-vote {
  /* Neutral slider: a budget is a preference, not an error. */
  --cr-accent: var(--text, #161616);
  display: grid;
  gap: 12px;
  margin-top: 16px;
}
.slider-wrap {
  position: relative;
  margin-top: 28px;
}
/* One track: grey, shaded light green up to the amount every voter accepts.
   It replaces RangeSlider's own track and fill, which are hidden below. */
.track {
  position: absolute;
  top: 5px;
  left: 0;
  right: 0;
  height: 8px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--soft, #efeeec);
}
.agreed {
  position: absolute;
  inset: 0 auto 0 0;
  background: #bfe3cc;
}
.slider-wrap :deep(.range-slider__track),
.slider-wrap :deep(.range-slider__fill) {
  display: none;
}
.agreed-tip {
  position: absolute;
  bottom: calc(100% + 6px);
  z-index: 2;
  display: grid;
  gap: 2px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--ink, #171717);
  color: #fff;
  font-size: 11px;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
}
.amount-row {
  display: flex;
  align-items: end;
  gap: 10px;
}
.amount-row label {
  display: grid;
  gap: 4px;
  font-size: 11px;
  color: #6d6863;
}
.amount-row input {
  width: 130px;
  padding: 8px 10px;
  border: 1px solid var(--line, #ebe8e6);
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
}
.vote-button {
  margin-left: auto;
}
.vote-count {
  margin: 0;
  color: #6d6863;
  font-size: 12px;
  text-align: right;
}
</style>
