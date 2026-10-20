<script setup>
import { computed } from 'vue'
import './theme.css'

const props = defineProps({
  // A number for a single thumb, or [low, high] for a two-thumb range.
  modelValue: { type: [Number, Array], required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  // Smallest allowed distance between the two thumbs.
  minGap: { type: Number, default: 0 },
  formatValue: { type: Function, default: (value) => String(value) },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const THUMB_SIZE = 18

const isRange = computed(() => Array.isArray(props.modelValue))
const low = computed(() => (isRange.value ? props.modelValue[0] : props.min))
const high = computed(() => (isRange.value ? props.modelValue[1] : props.modelValue))

const percent = (value) => ((value - props.min) / (props.max - props.min)) * 100
// Native thumbs travel THUMB_SIZE px less than the track; shift by the same
// amount so the red fill meets the thumb centres exactly.
const thumbCentre = (p) => `calc(${p}% + ${(0.5 - p / 100) * THUMB_SIZE}px)`

const fillStyle = computed(() => ({
  left: isRange.value ? thumbCentre(percent(low.value)) : '0px',
  width: `calc(${thumbCentre(percent(high.value))} - ${
    isRange.value ? thumbCentre(percent(low.value)) : '0px'
  })`,
}))

// When the thumbs overlap near the top of the range, the low thumb must sit on
// top, otherwise neither can be dragged.
const lowOnTop = computed(() => isRange.value && percent(low.value) > 50)

function onLowInput(event) {
  const value = Math.min(Number(event.target.value), high.value - props.minGap)
  event.target.value = value
  emit('update:modelValue', [value, high.value])
}

function onHighInput(event) {
  const raw = Number(event.target.value)
  if (!isRange.value) {
    emit('update:modelValue', raw)
    return
  }
  const value = Math.max(raw, low.value + props.minGap)
  event.target.value = value
  emit('update:modelValue', [low.value, value])
}
</script>

<template>
  <div class="range-slider" :class="{ 'is-disabled': disabled, 'is-single': !isRange }">
    <div class="range-slider__control">
      <div class="range-slider__track" />
      <div class="range-slider__fill" :style="fillStyle" />
      <input
        v-if="isRange"
        type="range"
        class="range-slider__input"
        :class="{ 'is-top': lowOnTop }"
        :min="min"
        :max="max"
        :step="step"
        :value="low"
        :disabled="disabled"
        :aria-label="`${label} minimum`"
        :aria-valuetext="formatValue(low)"
        @input="onLowInput"
      />
      <input
        type="range"
        class="range-slider__input"
        :min="min"
        :max="max"
        :step="step"
        :value="high"
        :disabled="disabled"
        :aria-label="isRange ? `${label} maximum` : label"
        :aria-valuetext="formatValue(high)"
        @input="onHighInput"
      />
    </div>
    <div class="range-slider__bounds">
      <span>{{ formatValue(min) }}</span>
      <span>{{ formatValue(max) }}</span>
    </div>
  </div>
</template>

<style scoped>
.range-slider {
  font-family: var(--cr-font);
}
.range-slider__control {
  position: relative;
  height: 18px;
}
.range-slider__track,
.range-slider__fill {
  position: absolute;
  top: 50%;
  height: 4px;
  border-radius: 2px;
  transform: translateY(-50%);
  pointer-events: none;
}
.range-slider__track {
  left: 0;
  right: 0;
  background: var(--cr-track);
}
.range-slider__fill {
  background: var(--cr-accent);
}
.range-slider__input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 18px;
  margin: 0;
  background: transparent;
  appearance: none;
  -webkit-appearance: none;
  pointer-events: none;
  z-index: 1;
}
.range-slider__input.is-top {
  z-index: 2;
}
/* A single slider can be clicked anywhere on the track. */
.is-single .range-slider__input {
  pointer-events: auto;
  cursor: pointer;
}
.range-slider__input:focus {
  outline: none;
}
.range-slider__input::-webkit-slider-runnable-track {
  height: 18px;
  background: transparent;
}
.range-slider__input::-moz-range-track {
  height: 18px;
  background: transparent;
}
.range-slider__input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  box-sizing: border-box;
  width: 18px;
  height: 18px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--cr-accent);
  box-shadow:
    0 0 0 1px var(--cr-accent),
    0 1px 3px rgb(0 0 0 / 25%);
  cursor: grab;
  pointer-events: auto;
  transition: box-shadow 0.15s ease;
}
.range-slider__input::-moz-range-thumb {
  box-sizing: border-box;
  width: 18px;
  height: 18px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--cr-accent);
  box-shadow:
    0 0 0 1px var(--cr-accent),
    0 1px 3px rgb(0 0 0 / 25%);
  cursor: grab;
  pointer-events: auto;
}
.range-slider__input:active::-webkit-slider-thumb {
  cursor: grabbing;
}
.range-slider__input:focus-visible::-webkit-slider-thumb {
  box-shadow:
    0 0 0 1px var(--cr-accent),
    var(--cr-focus-ring);
}
.range-slider__input:focus-visible::-moz-range-thumb {
  box-shadow:
    0 0 0 1px var(--cr-accent),
    var(--cr-focus-ring);
}
.range-slider__bounds {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: var(--cr-subtle);
}
.is-disabled {
  opacity: 0.5;
}
.is-disabled .range-slider__input::-webkit-slider-thumb {
  cursor: not-allowed;
}
</style>
