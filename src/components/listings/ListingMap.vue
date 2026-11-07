<script setup>
import { ref, onMounted, onUnmounted, watch, markRaw } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { haversineKm, formatDistance } from '../../services/geo'

const props = defineProps({
  listings: { type: Array, default: () => [] },
  // [{ MemberName, Address, Lat, Lng }] — from User_Preferences.CommuteDestination
  destinations: { type: Array, default: () => [] },
})

const emit = defineEmits(['select'])

const mapEl = ref(null)
let map = null          // deliberately NOT a ref — see notes
let layer = null

const SG_CENTRE = [1.3521, 103.8198]

onMounted(() => {
  map = markRaw(L.map(mapEl.value).setView(SG_CENTRE, 11))
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)
  layer = L.layerGroup().addTo(map)
  draw()
})

function priceIcon(rent) {
  return L.divIcon({
    className: 'price-pin',
    html: `<span>S$${(rent / 1000).toFixed(1)}k</span>`,
    iconSize: [54, 24],
    iconAnchor: [27, 24],
  })
}

// Listing titles and neighbourhoods come from an imported corpus, not from us,
// and Leaflet popups take an HTML string — so everything interpolated here is
// escaped rather than trusted.
const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

// Most of the corpus has no bedroom count; "null bed" is worse than saying so.
function bedroomText(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? `${n} bed` : 'Bedrooms not listed'
}

function popupHtml(l) {
  const dists = props.destinations
    .map((d) => {
      const km = haversineKm(l.Coordinates, { lat: d.Lat, lng: d.Lng })
      return `<li>${escapeHtml(d.MemberName ?? d.Address)}: ${formatDistance(km)}</li>`
    })
    .join('')

  return `
    <div class="pop">
      <strong>${escapeHtml(l.Title)}</strong>
      <div class="pop-meta">
        S$${l.MonthlyRent.toLocaleString()}/mo &middot; ${bedroomText(l.Bedrooms)} &middot; ${escapeHtml(l.PropertyType)}
      </div>
      <div class="pop-meta">${escapeHtml(l.Neighbourhood ?? '')}${l.NearestMrt ? ` &middot; ${escapeHtml(l.MrtWalkingMinutes)} min to ${escapeHtml(l.NearestMrt)}` : ''}</div>
      ${dists ? `<ul class="pop-dist">${dists}</ul><small>straight-line distance</small>` : ''}
    </div>`
}

function draw() {
  if (!layer || !map) return
  layer.clearLayers()

  props.listings.forEach((l) => {
    const c = l.Coordinates
    if (!c || typeof c.lat !== 'number') return
    L.marker([c.lat, c.lng], { icon: priceIcon(l.MonthlyRent) })
      .bindPopup(popupHtml(l))
      .on('click', () => emit('select', l))
      .addTo(layer)
  })

  props.destinations.forEach((d) => {
    L.circleMarker([d.Lat, d.Lng], {
      radius: 8,
      color: '#fff',
      weight: 2,
      fillColor: '#e67e22',
      fillOpacity: 1,
    })
      .bindPopup(
        `<strong>${escapeHtml(d.MemberName ?? 'Commute destination')}</strong><br>${escapeHtml(d.Address)}`,
      )
      .addTo(layer)
  })

  const pts = props.listings
    .filter((l) => l.Coordinates)
    .map((l) => [l.Coordinates.lat, l.Coordinates.lng])
  props.destinations.forEach((d) => pts.push([d.Lat, d.Lng]))
  if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 })
}

watch(() => [props.listings, props.destinations], draw, { deep: true })
onUnmounted(() => {
  map?.remove()
  map = null
  layer = null
})
</script>

<template>
  <div ref="mapEl" class="map"></div>
</template>

<style scoped>
.map {
  height: 540px;
  width: 100%;
  border-radius: 8px;
  z-index: 0;
}
</style>

<style>
/* Unscoped on purpose: Leaflet injects divIcon/popup HTML outside component scope. */
.price-pin span {
  display: inline-block;
  background: #1f4e79;
  color: #fff;
  padding: 3px 8px;
  border-radius: 12px;
  font: 600 12px/1.4 system-ui, sans-serif;
  white-space: nowrap;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
.pop { font: 13px/1.45 system-ui, sans-serif; min-width: 190px; }
.pop-meta { color: #5a6675; margin-top: 2px; }
.pop-dist { margin: 6px 0 2px; padding-left: 16px; }
</style>
