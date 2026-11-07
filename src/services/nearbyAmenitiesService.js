import { haversineKm } from './geo'
import { getToken, resetToken } from './onemapToken'

/**
 * Neighbourhood amenities near a listing, from OneMap's Themes service.
 *
 * SCOPE — read this before wiring it into scoring. These are amenities *around*
 * a listing: the nearest hawker centre, the park down the road. They are
 * NOT the eight amenity preferences in the member profile (wifi, aircon,
 * pet-friendly, gym, pool, parking, laundry, balcony), which are features of
 * the unit and exist in no mapping dataset. F-REQ-015's amenity criterion asks
 * for those, so this does not satisfy it and deliberately does not feed the
 * match percentage. It is context shown beside a listing, nothing more.
 * Scoring on it would mean the group first agreeing which amenities matter and
 * what counts as near — a decision nobody has made.
 *
 * COST — a theme is fetched ONCE for the whole island and the distances are
 * worked out locally, so adding a category costs one request no matter how
 * many listings are on screen. This is the opposite of routingService, where
 * every (listing, member) pair is its own request.
 */

const BASE = 'https://www.onemap.gov.sg/api/public/themesvc'
const TIMEOUT_MS = 12000

// Singapore's bounding box, as retrieveTheme wants it:
// latMin,lngMin,latMax,lngMax.
const SG_EXTENTS = '1.144,103.535,1.494,104.502'

/**
 * The categories shown, by OneMap queryName.
 *
 * Verified against getAllThemesInfo on 2026-11-07 (166 themes); re-check with
 * `node scripts/onemap-themes.mjs <token>`. These were matched by name
 * pattern before, which silently picked "Park Facilities" — a layer of park
 * fixtures whose rows are called NOTICEBOARD — instead of parks. Explicit
 * names cannot drift like that; a name that disappears is skipped, not faked.
 */
export const AMENITY_CATEGORIES = [
  { key: 'hawker', label: 'Hawker centre', queryName: 'ssot_hawkercentres' },
  { key: 'park', label: 'Park', queryName: 'nationalparks' },
  { key: 'sport', label: 'Sports centre', queryName: 'sportsg_sport_facilities' },
  { key: 'cc', label: 'Community club', queryName: 'communityclubs' },
  { key: 'library', label: 'Library', queryName: 'libraries' },
  { key: 'pharmacy', label: 'Pharmacy', queryName: 'registered_pharmacy' },
]

/**
 * Asked for and not available. Recorded so nobody spends an afternoon looking
 * again, and so the report can say what the data does and does not cover.
 *
 *   supermarket — OneMap has no supermarket or grocery theme at all.
 *   clinic      — no general GP theme. The closest are moh_hospitals,
 *                 vaccination_polyclinics and votg_phpc (PHPC clinics, a
 *                 pandemic-response subset, not every GP). A pharmacy is the
 *                 honest everyday proxy, so that is what is shown.
 */
export const UNAVAILABLE_CATEGORIES = ['supermarket', 'clinic']

/* ---------------- theme catalogue ---------------- */

let cataloguePromise = null

async function fetchJson(url, token) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      // OneMap wants the raw token, with no "Bearer " prefix.
      headers: { Authorization: token },
      signal: controller.signal,
    })
    if (response.status === 401 || response.status === 403) {
      // The token expires every few days; drop it so the next page load
      // re-reads config/onemap instead of reusing a dead one.
      resetToken()
      return null
    }
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Every theme the account can see, as [{ queryName, name }]. */
export async function themeCatalogue() {
  if (cataloguePromise) return cataloguePromise
  cataloguePromise = (async () => {
    const token = await getToken()
    if (!token) return []
    const payload = await fetchJson(`${BASE}/getAllThemesInfo`, token)
    const themes = payload?.Theme_Names ?? payload?.themes ?? []
    return themes
      .map((theme) => ({
        queryName: theme.QUERYNAME ?? theme.queryName ?? null,
        name: theme.THEMENAME ?? theme.themeName ?? theme.name ?? '',
      }))
      .filter((theme) => theme.queryName)
  })()
  return cataloguePromise
}

/**
 * The categories whose theme the account can actually see right now.
 *
 * Checked against the live catalogue rather than assumed: OneMap can retire a
 * theme, and a retired one should drop off the list quietly instead of
 * costing a request that returns nothing. An empty catalogue (no token, or
 * the call failed) is not evidence a theme is gone, so everything is kept.
 */
async function resolveCategories() {
  const catalogue = await themeCatalogue()
  if (!catalogue.length) return AMENITY_CATEGORIES
  const available = new Set(catalogue.map((entry) => entry.queryName))
  return AMENITY_CATEGORIES.filter((category) => available.has(category.queryName))
}

/* ---------------- points ---------------- */

const pointCache = new Map() // queryName -> [{ lat, lng, name }]

/**
 * A label worth showing.
 *
 * Some themes put a feature type in NAME rather than a place name — the parks
 * layer returns rows called "NOTICEBOARD" — which tells the reader nothing.
 * A name earns its place only if it reads like one, meaning it has lower-case
 * letters in it; otherwise fall through, and failing that show no name at all
 * rather than shouting a field value.
 */
function placeName(result) {
  const candidates = [
    result.NAME,
    result.DESCRIPTION,
    result.ADDRESSBUILDINGNAME,
    result.ADDRESSSTREETNAME,
  ]
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim()
    if (value.length > 3 && /[a-z]/.test(value)) return value
  }
  return null
}

async function themePoints(queryName, token) {
  if (pointCache.has(queryName)) return pointCache.get(queryName)
  const payload = await fetchJson(
    `${BASE}/retrieveTheme?queryName=${encodeURIComponent(queryName)}&extents=${SG_EXTENTS}`,
    token,
  )
  // The first element of SrchResults is a summary row, not a place; anything
  // without coordinates is dropped rather than guessed at.
  const points = (payload?.SrchResults ?? [])
    .map((result) => {
      const [lat, lng] = String(result.LatLng ?? '').split(',').map(Number)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return { lat, lng, name: placeName(result) }
    })
    .filter(Boolean)
  pointCache.set(queryName, points)
  return points
}

/* ---------------- public API ---------------- */

/**
 * Nearest amenity of each category to one listing.
 *
 * @returns [{ key, label, name, km }] — only categories with a real match.
 *          An empty array means no token, no themes, or no coordinates; it
 *          never means "nothing nearby", so the UI must not phrase it that way.
 */
export async function nearbyAmenities(listing) {
  const coords = listing?.Coordinates
  if (!coords || typeof coords.lat !== 'number') return []
  const token = await getToken()
  if (!token) return []

  const categories = await resolveCategories()
  const results = await Promise.all(
    categories.map(async (category) => {
      const points = await themePoints(category.queryName, token)
      let best = null
      for (const point of points) {
        const km = haversineKm(coords, point)
        if (best === null || km < best.km) best = { km, name: point.name }
      }
      return best ? { key: category.key, label: category.label, ...best } : null
    }),
  )
  return results.filter(Boolean).sort((a, b) => a.km - b.km)
}

/** Clears the cached catalogue and points, e.g. after rotating the token. */
export function clearAmenityCache() {
  cataloguePromise = null
  pointCache.clear()
}
