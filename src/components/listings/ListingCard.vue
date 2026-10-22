<script setup>
import AppIcon from '@/components/AppIcon.vue'
import { formatRent } from '@/services/listingsService'

// The parent supplies the existing listing object.
defineProps({
  listing: {
    type: Object,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <article
    class="listing-card"
    :class="{
      'listing-card--selected': selected,
      'listing-card--unavailable': listing.available === false,
    }"
  >
    <div class="listing-main">
      <!-- Property photo.
           Supply an actual photo through the optional imageUrl field. -->
      <div class="listing-photo">
        <img
          v-if="listing.imageUrl"
          :src="listing.imageUrl"
          :alt="listing.title || 'Rental property'"
        />
        <span v-else class="photo-placeholder">Photo unavailable</span>

        <span
          v-if="listing.available === false"
          class="availability"
        >
          Unavailable
        </span>
      </div>

      <div class="listing-info">
        <!-- Property title and match percentage.
             The parent calculates/provides the match value. -->
        <div class="listing-title-row">
          <h3>{{ listing.title || 'Property name unavailable' }}</h3>

          <div class="listing-title-actions">
            <span v-if="listing.match != null" class="match-pill">
              {{ listing.match }}%
            </span>

            <!-- Parent supplies a shortlist/remove button if needed. -->
            <slot name="title-actions" />
          </div>
        </div>

        <!-- Rent and basic property information. -->
        <p class="rent">
          {{ listing.price != null ? formatRent(listing.price) : '—' }}
          <span>/mo</span>
        </p>

        <p class="listing-meta">
          <AppIcon name="pin" :size="12" />
          {{ listing.area || 'Location unavailable' }}
          · {{ listing.beds ?? '—' }} rooms
        </p>

        <!-- Parent supplies voting, member avatars or other controls.
             Their behaviour remains in the parent page. -->
        <div v-if="$slots.actions" class="card-actions">
          <slot name="actions" />
        </div>
      </div>
    </div>

    <!-- Parent supplies comments or additional information below the card. -->
    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </div>
  </article>
</template>

<style scoped>
/* Card container and selection/availability states. */
.listing-card {
  overflow: hidden;
  min-width: 0;
  border: 1px solid var(--line, #e7e5e2);
  border-radius: 15px;
  background: #fff;
  color: var(--text, #242424);
  box-shadow: 0 2px 5px rgb(0 0 0 / 7%);
}

.listing-card--selected {
  border-color: var(--red, #ed003b);
  box-shadow: 0 0 0 2px rgb(200 41 47 / 13%);
}

.listing-card--unavailable {
  opacity: 0.78;
}

/* Horizontal photo-and-details arrangement. */
.listing-main {
  display: flex;
  min-height: 112px;
}

.listing-photo {
  position: relative;
  display: grid;
  flex: 0 0 112px;
  place-items: center;
  overflow: hidden;
  background: #f1efec;
}

.listing-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-placeholder {
  padding: 10px;
  color: #737373;
  text-align: center;
  font-size: 10px;
}

.availability {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 3px 6px;
  border-radius: 20px;
  background: #fff;
  color: #626262;
  font-size: 9px;
  font-weight: 700;
}

/* Property heading and page-specific action area. */
.listing-info {
  flex: 1;
  min-width: 0;
  padding: 12px;
}

.listing-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.listing-title-row h3 {
  min-width: 0;
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.listing-title-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 5px;
}

.match-pill {
  padding: 3px 8px;
  border-radius: 20px;
  background: var(--red-tint, #fff0f3);
  color: var(--red, #ed003b);
  font-size: 10px;
  font-weight: 700;
}

/* Rent and location details. */
.rent {
  margin: 5px 0 0;
  color: var(--red, #ed003b);
  font-size: 14px;
  font-weight: 700;
}

.rent span {
  color: var(--muted, #737373);
  font-size: 10px;
  font-weight: 400;
}

.listing-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin: 5px 0 0;
  color: var(--muted, #737373);
  font-size: 10px;
}

/* Slots hold controls supplied and styled by the parent page. */
.card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.card-footer {
  border-top: 1px solid var(--line, #f1f0ef);
}

/* Smaller image on narrow screens. */
@media (max-width: 560px) {
  .listing-photo {
    flex-basis: 82px;
  }

  .listing-info {
    padding: 9px;
  }
}
</style>