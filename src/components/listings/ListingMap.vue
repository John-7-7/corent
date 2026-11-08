<script setup>
import { ref, onMounted, onUnmounted, watch, markRaw } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { haversineKm, formatDistance } from '../../services/geo'

const props = defineProps({
  listings: { type: Array, default: () => [] },
  // [{ MemberName, Address, Lat, Lng, uid? }], from User_Preferences.CommuteDestination
  destinations: { type: Array, default: () => [] },
  /**
   * Commute routes to draw, one per member, from the selected listing:
   * [{ memberId, memberName, listingTitle, minutes, estimated,
   *    legs: [{ mode, label, minutes, points: [[lat, lng], ...] }] }]
   */
  routes: { type: Array, default: () => [] },
  // Highlights that listing's pin and measures bearings from it.
  selectedListingId: { type: String, default: '' },
  // The recenter button goes to this member's destination when they have one.
  currentUserId: { type: String, default: '' },
})

const emit = defineEmits(['select'])

const mapEl = ref(null)
let map = null          // deliberately NOT a ref, see notes
let layer = null
let routeLayer = null
let legendControl = null

const SG_CENTRE = [1.3521, 103.8198]

// Colour by mode of transport. MRT and LRT share one colour: both are rail.
const MODE_STYLES = {
  WALK: { label: 'Walk', color: '#7c8196', dashArray: '2 8' },
  BUS: { label: 'Bus', color: '#1f9d55' },
  RAIL: { label: 'MRT / LRT', color: '#2b59c3' },
  ESTIMATE: { label: 'Estimate (straight line)', color: '#a3a7bd', dashArray: '6 8' },
}
const styleFor = (mode) =>
  MODE_STYLES[mode] ??
  (['SUBWAY', 'RAIL', 'TRAM', 'MONORAIL'].includes(mode) ? MODE_STYLES.RAIL : MODE_STYLES.BUS)

onMounted(() => {
  map = markRaw(L.map(mapEl.value).setView(SG_CENTRE, 11))
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)
  routeLayer = L.layerGroup().addTo(map)
  layer = L.layerGroup().addTo(map)
  addCompass()
  addRecenter()
  draw()
  drawRoutes()
})

/* ---------------- geometry ---------------- */

/** Initial compass bearing from a to b, in degrees clockwise from north. */
function bearingDegrees(a, b) {
  const rad = Math.PI / 180
  const lat1 = a.lat * rad
  const lat2 = b.lat * rad
  const dLng = (b.lng - a.lng) * rad
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (Math.atan2(y, x) / rad + 360) % 360
}
const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const compassPoint = (degrees) => POINTS[Math.round(degrees / 45) % 8]

/* ---------------- markers ---------------- */

// Under $1,000 in plain dollars (S$850); from $1,000 in thousands to one
// decimal place (S$4.2k).
const priceText = (rent) =>
  rent < 1000 ? `S$${Math.round(rent)}` : `S$${(rent / 1000).toFixed(1)}k`

function priceIcon(rent, active) {
  return L.divIcon({
    className: `price-pin${active ? ' price-pin--active' : ''}`,
    html: `<span>${priceText(rent)}</span>`,
    iconSize: [54, 24],
    iconAnchor: [27, 24],
  })
}

// A red location pin with the member's name beside it.
function destinationIcon(name, minutes) {
  const label = `${escapeHtml(name)}${minutes ? ` · ${minutes} min` : ''}`
  return L.divIcon({
    className: 'dest-pin',
    html: `
      <svg viewBox="0 0 24 32" width="30" height="40" aria-hidden="true">
        <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.4 12 32 12 32s12-11.6 12-20.3C24 5.2 18.6 0 12 0z" fill="#e5484d"/>
        <circle cx="12" cy="11.5" r="4.6" fill="#fff"/>
      </svg>
      <span class="dest-pin-label">${label}</span>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
  })
}

// Listing titles and neighbourhoods come from an imported corpus, not from us,
// and Leaflet popups take an HTML string, so everything interpolated here is
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
      const to = { lat: d.Lat, lng: d.Lng }
      const km = haversineKm(l.Coordinates, to)
      return `<li>${escapeHtml(d.MemberName ?? d.Address)}: ${formatDistance(km)} ${compassPoint(bearingDegrees(l.Coordinates, to))}</li>`
    })
    .join('')

  return `
    <div class="pop">
      <strong>${escapeHtml(l.Title)}</strong>
      <div class="pop-meta">
        S$${l.MonthlyRent.toLocaleString()}/mo &middot; ${bedroomText(l.Bedrooms)} &middot; ${escapeHtml(l.PropertyType)}
      </div>
      <div class="pop-meta">${escapeHtml(l.Neighbourhood ?? '')}${l.NearestMrt ? ` &middot; ${escapeHtml(l.MrtWalkingMinutes)} min to ${escapeHtml(l.NearestMrt)}` : ''}</div>
      ${dists ? `<ul class="pop-dist">${dists}</ul><small>straight-line distance and direction</small>` : ''}
    </div>`
}

const selectedListing = () =>
  props.listings.find((l) => (l.ListingID ?? l.id) === props.selectedListingId && l.Coordinates)

function destinationPopup(d) {
  const from = selectedListing()
  let bearing = ''
  if (from) {
    const to = { lat: d.Lat, lng: d.Lng }
    const degrees = bearingDegrees(from.Coordinates, to)
    bearing = `<div class="pop-meta">${formatDistance(haversineKm(from.Coordinates, to))} ${compassPoint(degrees)} of ${escapeHtml(from.Title)} &middot; bearing ${Math.round(degrees)}&deg;</div>`
  }
  return `<div class="pop"><strong>${escapeHtml(d.MemberName ?? 'Commute destination')}</strong><div class="pop-meta">${escapeHtml(d.Address)}</div>${bearing}</div>`
}

function draw() {
  if (!layer || !map) return
  layer.clearLayers()

  props.listings.forEach((l) => {
    const c = l.Coordinates
    if (!c || typeof c.lat !== 'number') return
    const active = (l.ListingID ?? l.id) === props.selectedListingId
    L.marker([c.lat, c.lng], { icon: priceIcon(l.MonthlyRent, active), zIndexOffset: active ? 1000 : 0 })
      .bindPopup(popupHtml(l))
      .on('click', () => emit('select', l))
      .addTo(layer)
  })

  props.destinations.forEach((d) => {
    const route = props.routes.find((r) => (d.uid ? r.memberId === d.uid : r.memberName === d.MemberName))
    const minutes = route ? `${route.estimated ? '~' : ''}${route.minutes}` : null
    L.marker([d.Lat, d.Lng], { icon: destinationIcon(d.MemberName ?? 'Destination', minutes), zIndexOffset: 500 })
      .bindPopup(destinationPopup(d))
      .addTo(layer)
  })
}

function fitAll() {
  if (!map) return
  const pts = props.listings
    .filter((l) => l.Coordinates)
    .map((l) => [l.Coordinates.lat, l.Coordinates.lng])
  props.destinations.forEach((d) => pts.push([d.Lat, d.Lng]))
  if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 })
}

/* ---------------- routes ---------------- */

function legLabel(leg, estimated = false) {
  return `${escapeHtml(leg.label)}${leg.minutes ? ` · ${estimated ? '~' : ''}${leg.minutes} min` : ''}`
}

function drawRoutes() {
  if (!routeLayer || !map) return
  routeLayer.clearLayers()
  const bounds = []

  props.routes.forEach((route) => {
    route.legs.forEach((leg) => {
      if (!leg.points?.length) return
      const style = leg.mode === 'ESTIMATE' ? MODE_STYLES.ESTIMATE : styleFor(leg.mode)
      // Estimated rides keep their mode colour but are dashed, so they never
      // pass for a route OneMap actually planned.
      const dashArray =
        route.estimated && leg.mode !== 'WALK' && leg.mode !== 'ESTIMATE' ? '12 8' : style.dashArray
      // A white casing under every line keeps it readable over the map tiles.
      L.polyline(leg.points, { color: '#fff', weight: 8, opacity: 0.9, interactive: false }).addTo(routeLayer)
      const line = L.polyline(leg.points, {
        color: style.color,
        weight: 5,
        opacity: 0.95,
        dashArray,
        lineCap: 'round',
      }).addTo(routeLayer)

      const label = legLabel(leg, route.estimated)
      const title = `${escapeHtml(route.memberName)}: ${label}`
      const transit = leg.mode !== 'WALK' && leg.mode !== 'ESTIMATE'
      // Transit legs are labelled on the map; walking legs on hover only, to
      // keep the map readable.
      line.bindTooltip(transit ? label : title, {
        permanent: transit,
        direction: 'center',
        className: `route-label route-label--${transit ? 'transit' : 'hover'}`,
      })
      leg.points.forEach((p) => bounds.push(p))
    })
  })

  if (props.routes.length) {
    updateLegend(true)
    if (bounds.length) map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 15 })
  } else {
    updateLegend(false)
  }
}

function updateLegend(show) {
  if (!map) return
  if (!show) {
    legendControl?.remove()
    legendControl = null
    return
  }
  if (legendControl) return
  legendControl = L.control({ position: 'bottomleft' })
  legendControl.onAdd = () => {
    const box = L.DomUtil.create('div', 'map-legend')
    const rows = ['WALK', 'BUS', 'RAIL'].map((key) => {
      const s = MODE_STYLES[key]
      return { color: s.color, label: s.label, dash: s.dashArray ? '1 4' : '' }
    })
    rows.push({ color: MODE_STYLES.RAIL.color, label: 'Estimated (dashed)', dash: '5 3' })
    box.innerHTML = rows
      .map(
        (row) =>
          `<span><svg width="22" height="8"><line x1="1" y1="4" x2="21" y2="4" stroke="${row.color}" stroke-width="4" stroke-linecap="round" ${row.dash ? `stroke-dasharray="${row.dash}"` : ''}/></svg>${row.label}</span>`,
      )
      .join('')
    return box
  }
  legendControl.addTo(map)
}

/* ---------------- controls ---------------- */

// Leaflet maps do not rotate, so north is always up; the bearing to each
// destination is in the pin and listing popups.
function addCompass() {
  const compass = L.control({ position: 'topright' })
  compass.onAdd = () => {
    const box = L.DomUtil.create('div', 'map-compass')
    box.title = 'North is up. Open a pin for the compass bearing.'
    box.setAttribute('role', 'img')
    box.setAttribute('aria-label', 'Compass: north is up')
    box.innerHTML = `
      <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true">
        <circle cx="24" cy="24" r="22" fill="#fff" stroke="rgba(0,0,0,.12)"/>
        <g fill="#6b6e85" font-size="7" font-weight="700" text-anchor="middle" font-family="system-ui,sans-serif">
          <text x="24" y="44.5">S</text><text x="43.5" y="26.5">E</text><text x="4.5" y="26.5">W</text>
        </g>
        <text x="24" y="10" fill="#e5484d" font-size="8" font-weight="800" text-anchor="middle" font-family="system-ui,sans-serif">N</text>
        <path d="M24 12 L28 24 L24 22 L20 24 Z" fill="#e5484d"/>
        <path d="M24 36 L28 24 L24 26 L20 24 Z" fill="#9ca0b5"/>
      </svg>`
    return box
  }
  compass.addTo(map)
}

/**
 * Where the recenter button goes: your own destination, else (if you have not
 * set one) a teammate's, picked at random once and kept, so repeated presses go
 * to the same place.
 */
let fallbackPick = null
function recenterTarget() {
  const own = props.destinations.find((d) => props.currentUserId && d.uid === props.currentUserId)
  if (own) return { dest: own, own: true }
  if (!props.destinations.length) return null
  if (!fallbackPick || !props.destinations.includes(fallbackPick)) {
    fallbackPick = props.destinations[Math.floor(Math.random() * props.destinations.length)]
  }
  return { dest: fallbackPick, own: false }
}

let recenterButton = null
function recenterTitle() {
  const target = recenterTarget()
  if (!target) return 'Show all of Singapore'
  return target.own
    ? 'Back to your destination'
    : `Back to ${target.dest.MemberName ?? 'a teammate'}'s destination`
}

function addRecenter() {
  const control = L.control({ position: 'topleft' })
  control.onAdd = () => {
    const box = L.DomUtil.create('div', 'leaflet-bar map-recenter')
    recenterButton = L.DomUtil.create('a', '', box)
    recenterButton.href = '#'
    recenterButton.setAttribute('role', 'button')
    recenterButton.title = recenterTitle()
    recenterButton.setAttribute('aria-label', recenterButton.title)
    recenterButton.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>
        <path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>
      </svg>`
    L.DomEvent.disableClickPropagation(box)
    L.DomEvent.on(recenterButton, 'click', (event) => {
      L.DomEvent.preventDefault(event)
      recenter()
    })
    return box
  }
  control.addTo(map)
}

function refreshRecenterTitle() {
  if (!recenterButton) return
  recenterButton.title = recenterTitle()
  recenterButton.setAttribute('aria-label', recenterButton.title)
}

function recenter() {
  if (!map) return
  const target = recenterTarget()
  if (!target) {
    map.flyTo(SG_CENTRE, 11, { duration: 0.8 })
    return
  }
  map.flyTo([target.dest.Lat, target.dest.Lng], 15, { duration: 0.8 })
}

watch(
  () => [props.listings, props.destinations],
  () => {
    draw()
    refreshRecenterTitle()
    // Routes have their own framing; otherwise frame everything as before.
    if (!props.routes.length) fitAll()
  },
  { deep: true },
)
watch(() => props.selectedListingId, draw)
watch(
  () => props.routes,
  () => {
    drawRoutes()
    draw()
  },
  { deep: true },
)
watch(() => props.currentUserId, refreshRecenterTitle)

onMounted(() => {
  if (!props.routes.length) fitAll()
})

onUnmounted(() => {
  if (map) {
    // A zoom animation still running when the page changes leaves a 250 ms
    // timer behind that touches the removed map (_leaflet_pos errors).
    // Leaflet's handler bails out when no zoom is animating, so say so.
    map._animatingZoom = false
    map.remove()
  }
  map = null
  layer = null
  routeLayer = null
  legendControl = null
  recenterButton = null
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
.price-pin--active span {
  background: #11284a;
  outline: 3px solid #fff;
  transform: scale(1.12);
}
.pop { font: 13px/1.45 system-ui, sans-serif; min-width: 190px; }
.pop-meta { color: #5a6675; margin-top: 2px; }
.pop-dist { margin: 6px 0 2px; padding-left: 16px; }

.dest-pin { position: relative; }
.dest-pin svg { display: block; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35)); }
.dest-pin-label {
  position: absolute;
  top: 6px;
  left: 30px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #e5484d;
  color: #fff;
  font: 700 11.5px/1.5 system-ui, sans-serif;
  white-space: nowrap;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.route-label {
  padding: 1px 7px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  color: #2a2d3e;
  font: 700 11px/1.5 system-ui, sans-serif;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}
.route-label::before { display: none; }

.map-compass { pointer-events: auto; cursor: help; filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.2)); }
.map-compass svg { display: block; }
.map-recenter a { display: grid !important; place-items: center; color: #2a2d3e; }
.map-recenter a:hover { color: #e5484d; }

.map-legend {
  display: grid;
  gap: 3px;
  padding: 7px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  font: 600 11px/1.4 system-ui, sans-serif;
  color: #2a2d3e;
}
.map-legend span { display: flex; gap: 6px; align-items: center; }
</style>
