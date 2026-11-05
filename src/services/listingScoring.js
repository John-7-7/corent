import {
  DEFAULT_PRIORITY_ORDER,
  matchScore,
  priorityOrder,
} from './groupAggregation'
import { commuteKey } from './routingService'

/**
 * Listing match scores against the group's agreed preferences (F-REQ-015).
 *
 * Each listing is scored once per member using that member's own priority
 * ranking, and the group score is the average. Ya Lin's MemberPriorities are
 * per member, so there is no single weight vector to score against; averaging
 * per-member scores is the same shape her groupMatchScore uses for the radar,
 * which keeps the two pages consistent.
 *
 * Weighting is hers too: scoring goes through matchScore(), so a factor ranked
 * first of four weighs 4 and anything unranked weighs 1 (F-REQ-012).
 *
 * AC4 of F-REQ-015 is the rule that shapes everything here: a criterion with no
 * data is "insufficient data", never a zero. Unknown criteria are dropped from
 * the weighted average rather than dragging the score down.
 */

/* ---------------- criteria ---------------- */

// The four with an agreed group value and a member ranking, plus three the
// requirement asks for that the group has not agreed a value for yet.
export const SCORED_CRITERIA = [
  { key: 'budget', label: 'Budget', ranked: true },
  { key: 'region', label: 'Location', ranked: true },
  { key: 'PropertyType', label: 'Property type', ranked: true },
  { key: 'bedrooms', label: 'Bedrooms', ranked: true },
  { key: 'commute', label: 'Commute', ranked: false },
  { key: 'furnishing', label: 'Furnishing', ranked: false },
  { key: 'moveIn', label: 'Move-in date', ranked: false },
]

/**
 * F-REQ-015 asks for budget, location, commute, move-in date, rooms and
 * amenities. Only the first four of SCORED_CRITERIA carry a group-agreed value
 * and a member ranking; the rest fall back to weight 1 and, where the data does
 * not exist, score null. Listed here so the gap is visible at review rather
 * than buried.
 */
export const PENDING_GROUP_DECISION = [
  { key: 'commute', reason: 'Per member only — no group-level limit is agreed.' },
  { key: 'moveIn', reason: 'No listing in the current corpus carries AvailableDate.' },
  {
    key: 'amenities',
    reason:
      'Listing amenities are descriptive strings; they do not map to the eight ' +
      'preference slugs. Only furnishing can be compared today.',
  },
]

const clamp100 = (n) => Math.max(0, Math.min(100, Math.round(n)))

/**
 * Number(null) is 0 and Number('') is 0, so a missing field read through
 * Number() turns into a real value and scores as a failure instead of as
 * insufficient data. Everything taken off a listing goes through this.
 */
const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

// Full marks inside the limit, then straight down to zero at twice the limit.
// Absolute against the stated limit, never relative to the other candidates, so
// a listing's score does not move when the filters change (NFR-REQ-06).
function withinLimit(value, limit) {
  if (!Number.isFinite(value) || !Number.isFinite(limit) || limit <= 0) return null
  if (value <= limit) return 100
  return clamp100(100 * (1 - (value - limit) / limit))
}

const FURNISHING_FROM_AMENITY = {
  'Fully furnished': 'Full',
  'Partially furnished': 'Partial',
  Unfurnished: 'Unfurnished',
}

function listingFurnishing(listing) {
  const match = (listing.Amenities || []).find((a) => a in FURNISHING_FROM_AMENITY)
  return match ? FURNISHING_FROM_AMENITY[match] : null
}

const row = (key, label, score, detail) => ({ key, label, score, detail })

/* ---------------- one member's view of one listing ---------------- */

/**
 * Scores a listing for a single member. Every row is { key, label, score, detail };
 * a null score means insufficient data and is excluded from the average.
 */
export function scoreForMember(listing, groupPref, member, commute = null) {
  const rows = []
  const profile = member.profile || {}

  // Budget — the group rents together, so what matters is each member's share.
  const household = toNumber(groupPref?.HouseholdSize) || member.householdSize || null
  const perPersonCap =
    toNumber(groupPref?.BudgetPerPersonMax) ||
    (toNumber(groupPref?.MonthlyRentMax) && household
      ? toNumber(groupPref.MonthlyRentMax) / household
      : null) ||
    toNumber(profile.BudgetMax) ||
    null
  const rent = toNumber(listing.MonthlyRent)
  const share = household && rent !== null ? rent / household : null
  rows.push(
    row(
      'budget',
      'Budget',
      withinLimit(share, perPersonCap),
      share && perPersonCap
        ? `$${Math.round(share).toLocaleString('en-SG')} each against a $${Math.round(perPersonCap).toLocaleString('en-SG')} cap`
        : 'Needs a household size and an agreed budget',
    ),
  )

  // Location
  const regions = groupPref?.PreferredRegions || []
  rows.push(
    row(
      'region',
      'Location',
      regions.length ? (regions.includes(listing.Region) ? 100 : 0) : null,
      regions.length ? listing.Region || 'Region not listed' : 'No region agreed yet',
    ),
  )

  // Property type — 'Any' means the group did not constrain it, not a mismatch.
  const wantedType = groupPref?.PropertyType
  rows.push(
    row(
      'PropertyType',
      'Property type',
      !wantedType || wantedType === 'Any' ? null : listing.PropertyType === wantedType ? 100 : 0,
      listing.PropertyType || 'Not listed',
    ),
  )

  // Bedrooms — a shortfall costs a third per missing room; a surplus is fine.
  const bedsRaw = toNumber(listing.Bedrooms)
  // Some exports use -1 for "not stated"; treat any non-positive count as unknown.
  const beds = bedsRaw !== null && bedsRaw > 0 ? bedsRaw : null
  const min = toNumber(groupPref?.BedroomsMin) || null
  const max = toNumber(groupPref?.BedroomsMax) || null
  let bedScore = null
  if (beds !== null && (min || max)) {
    if (min && beds < min) bedScore = clamp100(100 - (min - beds) * 34)
    else if (max && beds > max) bedScore = clamp100(100 - (beds - max) * 15)
    else bedScore = 100
  }
  rows.push(
    row(
      'bedrooms',
      'Bedrooms',
      bedScore,
      beds !== null ? `${beds} bedrooms` : 'Not listed',
    ),
  )

  // Commute — per member, against that member's own limit. An estimate is not a
  // measurement, so it scores null: counting it would make the same listing
  // score differently depending on whether the OneMap token happened to work
  // (NFR-REQ-06), and AC4 already says unknown data is not a failure.
  const limit = toNumber(profile.MaxCommuteTime) || null
  const measured = commute && commute.source === 'onemap' ? commute.minutes : null
  rows.push(
    row(
      'commute',
      'Commute',
      withinLimit(measured, limit),
      measured
        ? `${measured} min against a ${limit} min limit`
        : commute?.source === 'estimate'
          ? 'Estimated only — not counted'
          : 'No commute destination set',
    ),
  )

  // Furnishing — the only member amenity preference the listing data supports.
  const want = profile.FurnishingLevel
  const has = listingFurnishing(listing)
  rows.push(
    row(
      'furnishing',
      'Furnishing',
      !want || want === 'Any' || !has ? null : has === want ? 100 : 0,
      has || 'Not listed',
    ),
  )

  // Move-in date — no listing carries AvailableDate today, so this is always
  // insufficient data. Kept because F-REQ-015 asks for it.
  rows.push(row('moveIn', 'Move-in date', null, 'Availability date not listed'))

  const order = priorityOrder(groupPref?.MemberPriorities?.[member.uid]) || DEFAULT_PRIORITY_ORDER
  return { uid: member.uid, name: member.name ?? null, score: matchScore(rows, order), rows }
}

/* ---------------- group view ---------------- */

/**
 * Scores one listing for the whole group.
 * @returns {{listingId, score, perMember, rows, knownCriteria, unknownCriteria}}
 *          `score` is a percentage, or null when nothing could be evaluated.
 */
export function scoreListing(listing, groupPref, members, matrix = new Map()) {
  const perMember = members.map((member) =>
    scoreForMember(listing, groupPref, member, matrix.get(commuteKey(listing.ListingID, member.uid))),
  )

  const scores = perMember.map((m) => m.score).filter((s) => s != null)
  const score = scores.length
    ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
    : null

  // One row per criterion for the whole group: the mean of the members who
  // could be evaluated on it, so the breakdown explains the headline number.
  const rows = SCORED_CRITERIA.map(({ key, label }) => {
    const known = perMember
      .map((m) => m.rows.find((r) => r.key === key))
      .filter((r) => r && r.score != null)
    const mean = known.length
      ? Math.round(known.reduce((sum, r) => sum + r.score, 0) / known.length)
      : null
    return {
      key,
      label,
      score: mean,
      status: mean == null ? 'unknown' : mean >= 60 ? 'met' : 'unmet',
      membersEvaluated: known.length,
      detail: known[0]?.detail ?? 'Insufficient data',
    }
  })

  return {
    listingId: listing.ListingID,
    score,
    perMember,
    rows,
    knownCriteria: rows.filter((r) => r.score != null).length,
    unknownCriteria: rows.filter((r) => r.score == null).length,
  }
}

/** Scores every listing. Pure and synchronous — run the commute matrix first. */
export function scoreListings(listings, groupPref, members, matrix = new Map()) {
  return listings.map((listing) => scoreListing(listing, groupPref, members, matrix))
}

/* ---------------- ranking (F-REQ-018) ---------------- */

/**
 * Ranks the shortlist: most votes first, group-match percentage breaking ties
 * (F-REQ-018.7 and .9). Listing votes are Yi Phu's and not merged yet, so an
 * empty tally ranks on score alone and the sort does not change when it lands.
 *
 * @param scored   output of scoreListings
 * @param voteTally { [listingId]: number }
 */
export function rankShortlist(scored, voteTally = {}) {
  return [...scored]
    .map((entry) => ({ ...entry, votes: voteTally[entry.listingId] ?? 0 }))
    .sort((a, b) => b.votes - a.votes || (b.score ?? -1) - (a.score ?? -1))
}
