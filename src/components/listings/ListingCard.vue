<script setup>
import AppIcon from '@/components/AppIcon.vue'
import { formatRent } from '@/services/listingsService'

defineProps({
  listing: {
    type: Object,
    required: true,
  },

  isShortlisted: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['view-details', 'toggle-shortlist'])
</script>

<template>
  <article
    class="listing"
    :class="{ gone: !listing.available }"
  >
    <div
      class="listing-img thumb"
      :class="listing.tone"
    >
      <span
        v-if="listing.available"
        class="pill badge"
      >
        {{ listing.match }}% match
      </span>

      <span
        v-else
        class="tag badge"
      >
        Unavailable
      </span>

      <button
        class="save-btn"
        :class="{ saved: isShortlisted }"
        type="button"
        :disabled="!listing.available && !isShortlisted"
        :aria-pressed="isShortlisted"
        :aria-label="
          isShortlisted
            ? 'Remove from shortlist'
            : 'Add to shortlist'
        "
        @click="$emit('toggle-shortlist', listing)"
      >
        <AppIcon
          name="bookmark"
          :size="15"
          :fill="isShortlisted"
        />
      </button>
    </div>

    <div class="listing-body">
      <h3>{{ listing.title }}</h3>

      <p class="price">
        {{ formatRent(listing.price) }}
        <span class="muted">/mo</span>
      </p>

      <p class="small muted row-inline">
        <AppIcon
          name="pin"
          :size="11"
        />
        {{ listing.area }}
      </p>

      <p class="small muted">
        {{ listing.type }} ·
        {{ listing.beds }} bedrooms ·
        From {{ listing.from }}
      </p>

      <div class="row actions">
        <button
          class="btn btn-sm"
          type="button"
          style="flex: 1"
          @click="$emit('view-details', listing)"
        >
          View details
        </button>

        <button
          class="btn btn-sm"
          :class="{ 'btn-primary': !isShortlisted }"
          type="button"
          :disabled="!listing.available && !isShortlisted"
          style="flex: 1"
          @click="$emit('toggle-shortlist', listing)"
        >
          {{ isShortlisted ? 'Remove' : 'Add to shortlist' }}
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.row-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.listing {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.listing.gone {
  opacity: 0.8;
}

.listing-img {
  position: relative;
  height: 140px;
}

.badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: #ffffff;
}

.save-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  color: var(--muted);
  cursor: pointer;
  background: #ffffff;
  border: 0;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.save-btn.saved {
  color: var(--red);
}

.save-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.listing-body {
  display: grid;
  flex: 1;
  gap: 3px;
  align-content: start;
  padding: 0.8rem;
}

.price {
  color: var(--red);
  font-size: 14px;
  font-weight: 700;
}

.price span {
  font-size: 11px;
  font-weight: 400;
}

.actions {
  margin-top: 0.6rem;
}
</style>