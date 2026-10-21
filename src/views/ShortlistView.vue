<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { formatRent, listings } from '@/services/listingsService'
import { useShortlist } from '@/services/shortlistService'

const { listingIds, storageError, removeFromShortlist } = useShortlist()
const savedListings = computed(() =>
  listingIds.value
    .map((id) => listings.find((listing) => listing.id === id))
    .filter(Boolean),
)

function removeListing(id) {
  try {
    removeFromShortlist(id)
  } catch (error) {
    storageError.value =
      error instanceof Error ? error.message : 'Unable to update your shortlist.'
  }
}
</script>

<template>
  <div>
    <header class="page-head">
      <h1>Shortlist</h1>
      <p>Listings you’ve saved to consider</p>
    </header>

    <main class="content">
      <section class="shortlist-content">
        <p v-if="storageError" class="error-message" role="alert">{{ storageError }}</p>
        <p class="small muted">{{ savedListings.length }} saved listings</p>

        <div v-if="savedListings.length" class="listing-grid">
          <article
            v-for="listing in savedListings"
            :key="listing.id"
            class="listing"
            :class="{ gone: !listing.available }"
          >
            <div class="listing-img thumb" :class="listing.tone">
              <span class="pill badge">{{ listing.match }}% match</span>
              <span v-if="!listing.available" class="tag availability">Unavailable</span>
            </div>

            <div class="listing-body">
              <h2>{{ listing.title }}</h2>
              <p class="price">{{ formatRent(listing.price) }}<span class="muted">/mo</span></p>
              <p class="small muted row-inline">
                <AppIcon name="pin" :size="11" /> {{ listing.area }}
              </p>
              <p class="small muted">
                {{ listing.type }} · {{ listing.beds }} bedrooms · From {{ listing.from }}
              </p>
              <button
                class="btn btn-danger btn-sm remove-button"
                type="button"
                @click="removeListing(listing.id)"
              >
                <AppIcon name="bookmark" :size="14" :fill="true" />
                Remove from shortlist
              </button>
            </div>
          </article>
        </div>

        <section v-else class="empty-state">
          <span class="empty-icon"><AppIcon name="bookmark" :size="22" /></span>
          <h2>Your shortlist is empty</h2>
          <p>Save listings from Browse to keep them together here.</p>
          <RouterLink class="btn btn-primary" to="/listings">Browse listings</RouterLink>
        </section>
      </section>
    </main>
  </div>
</template>

<style scoped>
.shortlist-content {
  display: grid;
  max-width: 900px;
  gap: 14px;
  margin: 0 auto;
}

.listing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.9rem;
}

.listing {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
}

.listing.gone {
  opacity: 0.8;
}

.listing-img {
  position: relative;
  height: 140px;
}

.badge,
.availability {
  position: absolute;
  top: 10px;
  left: 10px;
  background: #fff;
}

.availability {
  top: 40px;
}

.listing-body {
  display: grid;
  flex: 1;
  align-content: start;
  gap: 5px;
  padding: 0.8rem;
}

.listing-body h2 {
  font-size: 14px;
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

.row-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.remove-button {
  justify-self: start;
  margin-top: 8px;
}

.empty-state {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 48px 20px;
  border: 1px dashed var(--chip-line);
  border-radius: 12px;
  background: #fff;
  text-align: center;
}

.empty-icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 50%;
  background: var(--red-tint);
  color: var(--red);
}

.empty-state p {
  color: var(--muted);
  font-size: 13px;
}

.error-message {
  color: var(--red);
  font-size: 13px;
}
</style>
