<script setup>
defineProps({ listing: { type: Object, required: true } })

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260">' +
      '<rect width="100%" height="100%" fill="#e8eef6"/>' +
      '<text x="50%" y="50%" fill="#8a97a8" font-family="system-ui" font-size="15" ' +
      'text-anchor="middle">Image unavailable</text></svg>',
  )
</script>

<template>
  <article class="card">
    <img
      :src="listing.ImageURL || FALLBACK"
      :alt="listing.Title"
      loading="lazy"
      @error="$event.target.src = FALLBACK"
    />
    <div class="body">
      <h3>{{ listing.Title }}</h3>
      <p class="rent">S${{ listing.MonthlyRent.toLocaleString() }}<span>/mo</span></p>
      <p class="meta">
        {{ listing.Bedrooms }} bed &middot; {{ listing.Bathrooms ?? '–' }} bath
        <span v-if="listing.AreaSqm"> &middot; {{ listing.AreaSqm }} sqm</span>
      </p>
      <p class="meta">{{ listing.Address }}<span v-if="listing.Neighbourhood">, {{ listing.Neighbourhood }}</span></p>
      <p v-if="listing.NearestMrt" class="mrt">
        {{ listing.MrtWalkingMinutes }} min walk to {{ listing.NearestMrt }}
      </p>
      <ul class="chips">
        <li v-for="a in listing.Amenities.slice(0, 3)" :key="a">{{ a }}</li>
      </ul>
      <slot name="score" />
    </div>
  </article>
</template>

<style scoped>
.card { border: 1px solid #dfe5ec; border-radius: 10px; overflow: hidden; background: #fff; display: flex; flex-direction: column; }
.card img { width: 100%; height: 170px; object-fit: cover; background: #e8eef6; display: block; }
.body { padding: .75rem .9rem 1rem; }
h3 { font-size: 1rem; margin: 0 0 .35rem; line-height: 1.3; }
.rent { font-size: 1.15rem; font-weight: 700; color: #1f4e79; margin: 0 0 .3rem; }
.rent span { font-size: .8rem; font-weight: 400; color: #5a6675; }
.meta { font-size: .82rem; color: #5a6675; margin: 0 0 .2rem; }
.mrt { font-size: .82rem; color: #2e7d5b; margin: .3rem 0 0; }
.chips { list-style: none; display: flex; flex-wrap: wrap; gap: .3rem; padding: 0; margin: .55rem 0 0; }
.chips li { font-size: .72rem; background: #eef2f7; color: #40506a; padding: .18rem .5rem; border-radius: 10px; }
</style>
