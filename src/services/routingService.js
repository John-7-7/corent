import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { haversineKm } from './geo'

/**
 * Door-to-door public-transport times from OneMap (SLA).
 *
 * Browse uses straight-line distance over all 200 listings because it is free.
 * This module is for the shortlist only: real travel time costs one request per
 * (listing, member) pair, which is affordable for ~8 listings and ~5 members
 * (~40 requests) and is not for 200.
 *
 * Every result carries `source`, so the UI can say whether a number is measured
 * or estimated rather than presenting a guess as fact.
 */

const ROUTE_URL = 'https://www.onemap.gov.sg/api/public/routingsvc/route'
const CACHE_KEY = 'corent-commute-cache'
const TIMEOUT_MS = 12000
const MAX_CONCURRENT = 4

// Straight-line fallback when routing is unavailable. Deliberately crude and
// always labelled as an estimate: a fixed access/egress allowance plus a
// per-kilometre rate that roughly matches Singapore bus + MRT door-to-door.
const ESTIMATE_FIXED_MINUTES = 10
const ESTIMATE_MINUTES_PER_KM = 3.2

/* ---------------- token ---------------- */

// The OneMap routing API needs a token (valid ~3 days). Never put the OneMap
// account password in the client: it would ship in the bundle. Two supported
// sources, in order:
//   1. Firestore config/onemap { token }  — set by hand in the console,
//      readable by signed-in users, writable by nobody. Rotating it needs no
//      redeploy.
//   2. VITE_ONEMAP_TOKEN in .env         — simpler, but the token is bundled.
// Both expose a short-lived, routing-only token rather than credentials.
let tokenPromise = null

async function readToken() {
  try {
    const snap = await getDoc(doc(db, 'config', 'onemap'))
    const token = snap.exists() ? snap.data().token : null
    if (token) return token
  } catch {
    // Unreadable config (rules, offline) just falls through to the env var.
  }
  return import.meta.env.VITE_ONEMAP_TOKEN || null
}

function getToken() {
  if (!tokenPromise) tokenPromise = readToken()
  return tokenPromise
}

/** Call after rotating the token so the next request picks it up. */
export function resetToken() {
  tokenPromise = null
}

/* ---------------- reference departure ---------------- */

/**
 * Public-transport times depend on when you travel, so they are quoted for one
 * fixed moment: the next Monday at 08:30, i.e. a weekday morning peak. Fixing
 * it keeps results comparable between listings and keeps cache keys stable.
 */
export function referenceDeparture(now = new Date()) {
  const date = new Date(now)
  const daysUntilMonday = (8 - date.getDay()) % 7 || 7
  date.setDate(date.getDate() + daysUntilMonday)
  const pad = (n) => String(n).padStart(2, '0')
  return {
    // OneMap wants MM-DD-YYYY here, not ISO.
    date: `${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${date.getFullYear()}`,
    time: '08:30:00',
    label: 'Monday 08:30',
  }
}

/* ---------------- cache ---------------- */

// Commute time between two fixed points does not change, so results persist.
const memoryCache = new Map()
let cacheLoaded = false

function loadCache() {
  if (cacheLoaded) return
  cacheLoaded = true
  try {
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    for (const [key, value] of Object.entries(stored)) memoryCache.set(key, value)
  } catch {
    // A corrupt or blocked cache only costs us repeat requests.
  }
}

function persistCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(memoryCache)))
  } catch {
    // Over quota or blocked — keep serving from memory.
  }
}

const point = (p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
const cacheKey = (from, to, departure) => `${point(from)}|${point(to)}|${departure.date}`

export function clearCommuteCache() {
  memoryCache.clear()
  cacheLoaded = true
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
}

/* ---------------- estimate fallback ---------------- */

function estimate(from, to, reason) {
  const km = haversineKm(from, to)
  return {
    minutes: Math.round(ESTIMATE_FIXED_MINUTES + km * ESTIMATE_MINUTES_PER_KM),
    straightLineKm: Number(km.toFixed(2)),
    walkMinutes: null,
    transitMinutes: null,
    transfers: null,
    source: 'estimate',
    reason,
  }
}

/* ---------------- OneMap ---------------- */

/**
 * OneMap's public-transport routing is OpenTripPlanner-based, so itineraries
 * live under `plan.itineraries`. Parsed defensively: if the shape differs the
 * caller gets a labelled estimate instead of a crash or a wrong number.
 */
function parseItinerary(payload, from, to) {
  const itinerary = payload?.plan?.itineraries?.[0]
  const seconds = itinerary?.duration
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null

  const toMinutes = (value) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value / 60) : null

  return {
    minutes: Math.round(seconds / 60),
    straightLineKm: Number(haversineKm(from, to).toFixed(2)),
    walkMinutes: toMinutes(itinerary.walkTime),
    transitMinutes: toMinutes(itinerary.transitTime),
    transfers: typeof itinerary.transfers === 'number' ? itinerary.transfers : null,
    legs: Array.isArray(itinerary.legs)
      ? itinerary.legs.map((leg) => ({
          mode: leg.mode ?? null,
          route: leg.route || leg.routeShortName || null,
          minutes: toMinutes(leg.duration),
        }))
      : [],
    source: 'onemap',
  }
}

/**
 * Travel time from `from` to `to` by public transport.
 * Always resolves — never rejects — so one bad pair cannot break a dashboard.
 *
 * @returns {Promise<{minutes:number, source:'onemap'|'estimate', ...}>}
 */
export async function routeCommute(from, to, departure = referenceDeparture()) {
  if (!from?.lat || !to?.lat) return estimate(from ?? to, to ?? from, 'missing-coordinates')

  loadCache()
  const key = cacheKey(from, to, departure)
  if (memoryCache.has(key)) return memoryCache.get(key)

  const token = await getToken()
  if (!token) return estimate(from, to, 'no-token')

  const params = new URLSearchParams({
    start: `${from.lat},${from.lng}`,
    end: `${to.lat},${to.lng}`,
    routeType: 'pt',
    date: departure.date,
    time: departure.time,
    mode: 'TRANSIT',
    maxWalkDistance: '1000',
    numItineraries: '1',
  })

  try {
    const response = await fetch(`${ROUTE_URL}?${params}`, {
      // OneMap takes the raw token — no "Bearer " prefix.
      headers: { Authorization: token },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (response.status === 401) {
      resetToken()
      return estimate(from, to, 'token-expired')
    }
    if (!response.ok) return estimate(from, to, `http-${response.status}`)

    const parsed = parseItinerary(await response.json(), from, to)
    if (!parsed) return estimate(from, to, 'no-route')

    memoryCache.set(key, parsed)
    persistCache()
    return parsed
  } catch (error) {
    return estimate(from, to, error.name === 'TimeoutError' ? 'timeout' : 'network')
  }
}

/* ---------------- batch ---------------- */

/** Runs tasks with a small concurrency cap so OneMap is not hit all at once. */
async function pooled(tasks, limit = MAX_CONCURRENT) {
  const results = Array.from({ length: tasks.length })
  let next = 0
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const index = next++
      results[index] = await tasks[index]()
    }
  })
  await Promise.all(workers)
  return results
}

export const commuteKey = (listingId, memberId) => `${listingId}|${memberId}`

/**
 * Travel time from every listing to every member's commute destination.
 *
 * @param listings    records with `ListingID` and `Coordinates {lat,lng}`
 * @param members     [{ id, name, destination: {Lat,Lng}, maxCommuteTime }]
 * @returns {Promise<Map<string, object>>} keyed by commuteKey(listingId, memberId);
 *          each value also carries `withinLimit` (null when the member set no limit)
 */
export async function commuteMatrix(listings, members, departure = referenceDeparture()) {
  const pairs = []
  for (const listing of listings) {
    if (!listing?.Coordinates?.lat) continue
    for (const member of members) {
      const destination = member?.destination
      if (!destination?.Lat) continue
      pairs.push({ listing, member, destination })
    }
  }

  const results = await pooled(
    pairs.map(
      ({ listing, destination }) =>
        () =>
          routeCommute(
            listing.Coordinates,
            { lat: destination.Lat, lng: destination.Lng },
            departure,
          ),
    ),
  )

  const matrix = new Map()
  pairs.forEach(({ listing, member }, index) => {
    const result = results[index]
    matrix.set(commuteKey(listing.ListingID, member.id), {
      ...result,
      memberId: member.id,
      memberName: member.name ?? null,
      listingId: listing.ListingID,
      maxCommuteTime: member.maxCommuteTime ?? null,
      withinLimit:
        typeof member.maxCommuteTime === 'number'
          ? result.minutes <= member.maxCommuteTime
          : null,
    })
  })
  return matrix
}

/** True once any result in the matrix came from an estimate, not OneMap. */
export function hasEstimates(matrix) {
  return [...matrix.values()].some((entry) => entry.source === 'estimate')
}
