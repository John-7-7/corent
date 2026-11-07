<script setup>
import { ref, computed, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'

const props = defineProps({
  listing:  { type: Object, required: true },
  saved:    { type: Boolean, default: false },
  // null until F-REQ-015 can compute a real score — we never invent one.
  matchScore: { type: Number, default: null },
})
defineEmits(['toggle-save', 'view-details'])

// 99.co photo URLs are signed and expire; fall back to the gradient thumb.
const src = ref(props.listing.ImageURL)
watch(() => props.listing.ImageURL, (v) => { src.value = v })

// Deterministic thumb variant so the grid keeps the designed colour rhythm.
const tone = computed(() => {
  const id = String(props.listing.ListingID)
  const n = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 3
  return ['', 'alt', 'cool'][n]
})

const rent = computed(() => `$${props.listing.MonthlyRent.toLocaleString()}`)

// Most of the imported corpus carries no bedroom count and no availability
// date. Printing an empty count ("\u00b7 bedrooms \u00b7") or "From Not listed"
// reads as a broken template, so an unknown field is named as unknown and an
// unknown date simply drops out of the line.
const metaLine = computed(() => {
  const beds = Number(props.listing.Bedrooms)
  const parts = [props.listing.PropertyType || 'Property type not listed']
  parts.push(
    Number.isFinite(beds) && beds > 0
      ? `${beds} bedroom${beds === 1 ? '' : 's'}`
      : 'Bedrooms not listed',
  )
  if (props.listing.AvailableDate) parts.push(`From ${props.listing.AvailableDate}`)
  return parts.join(' \u00b7 ')
})
</script>

<template>
  <article class="listing" :class="{ gone: !listing.IsAvailable }">
    <div class="listing-img thumb" :class="tone">
      <img v-if="src" :src="src" :alt="listing.Title" loading="lazy" @error="src = null" />

      <span v-if="!listing.IsAvailable" class="tag badge">Unavailable</span>
      <span v-else-if="matchScore !== null" class="pill badge">{{ matchScore }}% match</span>

      <button
        class="save-btn"
        :class="{ saved }"
        type="button"
        :disabled="!listing.IsAvailable && !saved"
        :aria-pressed="saved"
        :aria-label="saved ? 'Remove from shortlist' : 'Add to shortlist'"
        @click="$emit('toggle-save', listing)"
      >
        <AppIcon name="bookmark" :size="15" :fill="saved" />
      </button>
    </div>

    <div class="listing-body">
      <h3>{{ listing.Title }}</h3>
      <p class="price">{{ rent }}<span class="muted">/mo</span></p>
      <p class="small muted row-inline">
        <AppIcon name="pin" :size="11" /> {{ listing.Neighbourhood }}
      </p>
      <p class="small muted">
        {{ metaLine }}
      </p>
      <p v-if="listing.NearestMrt" class="small muted">
        {{ listing.MrtWalkingMinutes }} min walk to {{ listing.NearestMrt }}
      </p>

      <slot name="extra" />

      <div class="row actions">
        <button class="btn btn-sm" type="button" style="flex: 1" @click="$emit('view-details', listing)">
          View details
        </button>
        <button
          class="btn btn-sm"
          :class="{ 'btn-primary': !saved }"
          type="button"
          :disabled="!listing.IsAvailable && !saved"
          style="flex: 1"
          @click="$emit('toggle-save', listing)"
        >
          {{ saved ? 'Remove' : 'Add to shortlist' }}
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.listing {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
}
.listing.gone { opacity: 0.8; }
.listing-img { position: relative; height: 140px; }
.listing-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.badge { position: absolute; top: 10px; left: 10px; background: #fff; }
.save-btn {
  position: absolute; top: 8px; right: 8px; display: grid; place-items: center;
  width: 30px; height: 30px; border-radius: 50%; border: 0; background: #fff;
  color: var(--muted); cursor: pointer; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: background-color 150ms ease, color 150ms ease, transform 150ms ease;
}
.save-btn:hover:not(:disabled) { transform: translateY(-1px); }
.save-btn.saved { background: var(--highlight); color: var(--text); }
.save-btn:disabled { cursor: not-allowed; opacity: 0.6; }
.listing-body { padding: 0.8rem; display: grid; gap: 3px; flex: 1; align-content: start; }
.price { color: var(--red); font-weight: 700; font-size: 14px; }
.price span { font-weight: 400; font-size: 11px; }
.row-inline { display: inline-flex; align-items: center; gap: 0.25rem; }
.actions { margin-top: 0.6rem; }
</style>
