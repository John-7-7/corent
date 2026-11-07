<script setup>
import { ref, watch } from 'vue'

/**
 * Hover and keyboard-focus readout shared by the shortlist comparison charts.
 *
 * Extracted rather than repeated: the three charts answer different questions,
 * but the reader wants the same context off each of them — which property is
 * this, what does it cost, and what does it look like.
 */
const props = defineProps({
  item: { type: Object, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  // The number this chart is about; it leads, because the reader already knows
  // which bar they are pointing at and wants the value.
  value: { type: [String, Number], required: true },
  unit: { type: String, default: '' },
  // Set when there is not room above the bar, so the readout drops below the
  // column instead of being clipped by the top of the chart card.
  below: { type: Boolean, default: false },
})

// 99.co photo URLs are signed and expire. A broken image in a tooltip is worse
// than no image, so a failed load drops the thumbnail and keeps the text.
const broken = ref(false)
watch(() => props.item?.image, () => (broken.value = false))
</script>

<template>
  <div
    class="chart-tip"
    :class="{ 'chart-tip--below': below }"
    :style="{ left: `${x}px`, top: `${y}px` }"
    role="status"
  >
    <img
      v-if="item.image && !broken"
      class="tip-photo"
      :src="item.image"
      alt=""
      loading="lazy"
      @error="broken = true"
    />
    <div class="tip-body">
      <p class="tip-value">{{ value }}<span v-if="unit"> {{ unit }}</span></p>
      <p class="tip-title">{{ item.title }}</p>
      <p class="tip-meta">
        {{ item.area || 'Area not listed' }}
        <template v-if="item.region"> · {{ item.region }}</template>
      </p>
      <p class="tip-meta">
        ${{ item.price.toLocaleString('en-SG') }}/mo ·
        {{ item.votes }} {{ item.votes === 1 ? 'vote' : 'votes' }}
      </p>
      <p v-if="item.worstCommute" class="tip-meta">
        Longest commute {{ item.worstCommute }} min
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Anchored to the top-centre of the hovered column; the translate lifts it
   clear of the bar and centres it without measuring its own width. */
.chart-tip {
  position: absolute;
  z-index: 5;
  transform: translate(-50%, calc(-100% - 8px));
}
.chart-tip--below {
  transform: translate(-50%, 0);
  width: 212px;
  overflow: hidden;
  border: 1px solid var(--chip-line);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  pointer-events: none;
}
.tip-photo {
  display: block;
  width: 100%;
  height: 84px;
  object-fit: cover;
  background: var(--chip-line);
}
.tip-body { padding: 8px 10px; }
.chart-tip p { margin: 0; }
.tip-value { font-size: 15px; font-weight: 700; color: var(--text); }
.tip-value span { font-size: 11px; font-weight: 400; color: var(--muted); }
.tip-title { margin-top: 2px; font-size: 11px; font-weight: 600; color: var(--text); }
.tip-meta { margin-top: 2px; font-size: 11px; color: var(--muted); }
</style>
