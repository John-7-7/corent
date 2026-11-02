// Group preference aggregation (F-REQ-010 to 013). Pure functions over members
// as { uid, name, profile }; private budgets are never read here.
import {
  AMENITIES,
  LOCATIONS,
  PROPERTY_TYPES,
  LEASE_DURATIONS,
  FURNISHING_LEVELS,
  COOKING_ACCESS,
  AIRCON_COVERAGE,
  SMOKING_PREFERENCES,
  STUDY_ENVIRONMENTS,
  GUEST_POLICIES,
  optionLabel,
  formatCurrency,
  formatMoveInDate,
  BEDROOM_RANGE,
} from '../components/profile/preferenceOptions.js'
import { formatDistance, haversineKm } from './geo.js'

export const PREFERENCE_SECTIONS = [
  {
    title: 'Rental preferences',
    rows: [
      { key: 'budget', label: 'Monthly budget (SGD)' },
      { key: 'PreferredLocations', label: 'Preferred locations', options: LOCATIONS },
      { key: 'MaxCommuteTime', label: 'Maximum commute' },
      { key: 'CommuteDestination', label: 'Commute destination' },
      { key: 'PreferredMoveInDate', label: 'Move-in date' },
      { key: 'bedrooms', label: 'Bedrooms' },
      { key: 'Amenities', label: 'Amenities', options: AMENITIES },
    ],
  },
  {
    title: 'Housing & lifestyle',
    rows: [
      { key: 'PropertyType', label: 'Property type', options: PROPERTY_TYPES },
      { key: 'LeaseDuration', label: 'Lease duration', options: LEASE_DURATIONS },
      { key: 'CoTenants', label: 'Co-tenants' },
      { key: 'FurnishingLevel', label: 'Furnishing', options: FURNISHING_LEVELS },
      { key: 'CookingAccess', label: 'Cooking access', options: COOKING_ACCESS },
      { key: 'AirconCoverage', label: 'Air conditioning', options: AIRCON_COVERAGE },
      { key: 'SmokingPreference', label: 'Smoking', options: SMOKING_PREFERENCES },
      { key: 'StudyEnvironment', label: 'Study environment', options: STUDY_ENVIRONMENTS },
      { key: 'GuestPolicy', label: 'Guests', options: GUEST_POLICIES },
    ],
  },
]
export const PREFERENCE_ROWS = PREFERENCE_SECTIONS.flatMap((section) => section.rows)
const COMMUTE_ROW = { key: 'commute', label: 'Commute' }
const REGION_ROW = { key: 'region', label: 'Region' }
const rowFor = (key) =>
  key === 'commute'
    ? COMMUTE_ROW
    : key === 'region'
      ? REGION_ROW
      : PREFERENCE_ROWS.find((row) => row.key === key)

// Profile areas mapped to the Region values used by Housing_Listing.
export const LISTING_REGIONS = [
  'Central Region',
  'East Region',
  'North Region',
  'North-East Region',
  'West Region',
]
export const REGION_FOR_AREA = {
  tampines: 'East Region',
  'bukit-timah': 'Central Region',
  queenstown: 'Central Region',
  bugis: 'Central Region',
  clementi: 'West Region',
  bishan: 'Central Region',
  jurong: 'West Region',
  punggol: 'North-East Region',
  'buona-vista': 'Central Region',
  'toa-payoh': 'Central Region',
  novena: 'Central Region',
  serangoon: 'North-East Region',
}
export const regionsOf = (profile) =>
  LISTING_REGIONS.filter((region) =>
    (profile?.PreferredLocations || []).some((area) => REGION_FOR_AREA[area] === region),
  )

// The four listing-search filters the group ranks; `field` is the saved key.
export const PRIORITY_FACTORS = [
  { key: 'budget', label: 'Budget', field: 'Budget' },
  { key: 'region', label: 'Region', field: 'Region' },
  { key: 'PropertyType', label: 'Property type', field: 'PropertyType' },
  { key: 'bedrooms', label: 'Bedrooms', field: 'Bedrooms' },
]
const PRIORITY_ALIASES = { PreferredLocations: 'region' }
export const DEFAULT_PRIORITY_ORDER = PRIORITY_FACTORS.map((factor) => factor.key)
// Rank 1 of 4 weighs 4, rank 4 weighs 1; every other scored factor weighs 1.
const priorityWeight = (key, order = DEFAULT_PRIORITY_ORDER) => {
  const index = order.indexOf(PRIORITY_ALIASES[key] || key)
  return index === -1 ? 1 : PRIORITY_FACTORS.length - index
}
export const RADAR_FACTORS = [
  { key: 'budget', label: 'Budget' },
  { key: 'bedrooms', label: 'Bedrooms' },
  { key: 'PropertyType', label: 'Property' },
  { key: 'PreferredLocations', label: 'Location' },
  { key: 'Amenities', label: 'Amenities' },
]

// Rough door-to-door public transport reach in Singapore (30 min ≈ 9 km).
const COMMUTE_KM_PER_MINUTE = 0.3
const MOVE_IN_WINDOW_DAYS = 30

export function formatRange(min, max, format = String) {
  if (min == null && max == null) return 'Not provided'
  if (min == null) return `Up to ${format(max)}`
  if (max == null) return `From ${format(min)}`
  return min === max ? format(min) : `${format(min)} – ${format(max)}`
}

// Display only. Without a viewer, every private budget shows as "Private".
export function displayPreference(profile, row, viewer = null) {
  if (!profile) return 'Preferences unavailable'

  if (row.key === 'budget') {
    if (profile.IsBudgetPrivate === true) {
      if (!viewer || profile.UserID !== viewer.uid) return 'Private'
      const budget = viewer.privateBudget
      if (!budget) return 'Private budget unavailable'
      return formatRange(budget.BudgetMin, budget.BudgetMax, formatCurrency)
    }
    if (profile.IsBudgetPrivate !== false) return 'Not shared'
    return formatRange(profile.BudgetMin, profile.BudgetMax, formatCurrency)
  }
  if (row.key === 'bedrooms') {
    if (profile.BedroomsMin === null && profile.BedroomsMax === null) return 'Any'
    return formatRange(profile.BedroomsMin, profile.BedroomsMax)
  }
  if (row.key === 'region') {
    if (!Array.isArray(profile.PreferredLocations)) return 'Not provided'
    return regionsOf(profile).join(', ') || 'Any region'
  }
  if (row.key === 'commute') {
    const time = profile.MaxCommuteTime
    const place = profile.CommuteDestination?.Address
    if (time == null && !place) return 'Not provided'
    return [time != null && `Up to ${time} min`, place && `to ${place}`].filter(Boolean).join(' ')
  }

  const value = profile[row.key]
  if (value == null || value === '') return 'Not provided'
  if (row.key === 'PreferredLocations' || row.key === 'Amenities') {
    if (!Array.isArray(value)) return 'Not provided'
    if (!value.length) return row.key === 'PreferredLocations' ? 'Any location' : 'None selected'
    return value.map((item) => optionLabel(row.options, item)).join(', ')
  }
  if (row.key === 'MaxCommuteTime') return `${value} minutes`
  if (row.key === 'CommuteDestination') return value.Address || 'Not provided'
  if (row.key === 'PreferredMoveInDate') return formatMoveInDate(value)
  if (row.key === 'LeaseDuration') return optionLabel(LEASE_DURATIONS, normaliseLease(value))
  return row.options ? optionLabel(row.options, value) : String(value)
}

const normaliseLease = (value) => (value === 'Flexible' ? value : Number(value))
const isOption = (options, value) => options.some((option) => option.value === value)
const validRange = (min, max) =>
  Number.isFinite(min) && Number.isFinite(max) && min >= 0 && min <= max
const validDate = (date) =>
  typeof date === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
  new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
const validPlace = (place) => Number.isFinite(place?.Lat) && Number.isFinite(place?.Lng)

// The largest member groups; more than one means a tie.
function largestGroups(groups) {
  const size = Math.max(0, ...groups.map((group) => group.length))
  const unique = new Map()
  for (const group of groups) {
    if (size && group.length === size) unique.set([...group].sort().join('|'), group)
  }
  return [...unique.values()]
}

// The best common value is always some range's minimum.
function bestOverlaps(ranges) {
  return largestGroups(
    ranges.map(({ min }) =>
      ranges.filter((range) => range.min <= min && min <= range.max).map((r) => r.uid),
    ),
  )
}

// The deepest overlap is a circle centre or where two circle edges cross.
function bestCommuteOverlaps(circles) {
  const origin = circles[0]
  const kmPerLng = 111.32 * Math.cos((origin.lat * Math.PI) / 180)
  const points = circles.map((c) => ({
    ...c,
    x: (c.lng - origin.lng) * kmPerLng,
    y: (c.lat - origin.lat) * 110.574,
  }))
  const candidates = points.map(({ x, y }) => ({ x, y }))
  points.forEach((a, i) =>
    points.slice(i + 1).forEach((b) => {
      const d = Math.hypot(b.x - a.x, b.y - a.y)
      if (!d || d > a.r + b.r || d < Math.abs(a.r - b.r)) return
      const along = (a.r ** 2 - b.r ** 2 + d ** 2) / (2 * d)
      const h = Math.sqrt(Math.max(a.r ** 2 - along ** 2, 0))
      const mx = a.x + (along * (b.x - a.x)) / d
      const my = a.y + (along * (b.y - a.y)) / d
      candidates.push(
        { x: mx + (h * (b.y - a.y)) / d, y: my - (h * (b.x - a.x)) / d },
        { x: mx - (h * (b.y - a.y)) / d, y: my + (h * (b.x - a.x)) / d },
      )
    }),
  )
  return largestGroups(
    candidates.map((point) =>
      points
        .filter((c) => Math.hypot(c.x - point.x, c.y - point.y) <= c.r + 1e-6)
        .map((c) => c.uid),
    ),
  )
}

// Vote options for a factor that needs attention.
const WILDCARDS = ['Any', 'Flexible', 'NoPreference']
export function buildVoteOptions(key, members) {
  const present = members.filter(({ profile }) => profile)
  const unique = (options) => [...new Map(options.map((option) => [option.value, option])).values()]
  const who = (test) => present.filter(({ profile }) => test(profile)).map(({ uid }) => uid)
  if (key === 'budget') {
    return []
  }
  if (key === 'commute') {
    return unique(
      present
        .filter(({ profile: p }) => p.CommuteDestination?.Address)
        .map(({ profile: p }) => ({
          value: p.CommuteDestination.Address,
          label: `Near ${p.CommuteDestination.Address}`,
          supporters: who((q) => q.CommuteDestination?.Address === p.CommuteDestination.Address),
        })),
    )
  }
  if (key === 'region') {
    return LISTING_REGIONS.map((region) => ({
      value: region,
      label: region,
      supporters: who((p) => regionsOf(p).includes(region)),
    }))
  }
  if (key === 'PreferredLocations') {
    return LOCATIONS.map((option) => ({
      value: option.value,
      label: option.label,
      supporters: who((p) => p.PreferredLocations?.includes(option.value)),
    }))
      .filter((option) => option.supporters.length)
      .sort((a, b) => b.supporters.length - a.supporters.length)
  }
  if (key === 'bedrooms') {
    const ranges = present.map(({ profile }) => profile).filter((p) => p.BedroomsMin != null)
    // From the lowest minimum to the highest maximum picked; every count if all chose Any.
    const low = ranges.length ? Math.min(...ranges.map((p) => p.BedroomsMin)) : BEDROOM_RANGE.min
    const high = ranges.length ? Math.max(...ranges.map((p) => p.BedroomsMax)) : BEDROOM_RANGE.max
    const options = []
    for (let n = low; n <= high; n++) {
      options.push({
        value: n,
        label: `${n} ${n === 1 ? 'bedroom' : 'bedrooms'}`,
        supporters: who((p) => p.BedroomsMin != null && p.BedroomsMin <= n && n <= p.BedroomsMax),
      })
    }
    return options
  }
  if (key === 'PreferredMoveInDate') {
    return [...new Set(present.map(({ profile }) => profile.PreferredMoveInDate))]
      .sort()
      .map((date) => ({
        value: date,
        label: formatMoveInDate(date),
        supporters: who((p) => p.PreferredMoveInDate === date),
      }))
  }
  if (key === 'CoTenants') {
    return [...new Set([members.length, ...present.map(({ profile }) => profile.CoTenants + 1)])]
      .sort((a, b) => a - b)
      .map((size) => ({
        value: size,
        label: `Household of ${size}`,
        supporters: who((p) => p.CoTenants + 1 === size),
      }))
  }
  const row = rowFor(key)
  const valueOf = (p) => (key === 'LeaseDuration' ? normaliseLease(p[key]) : p[key])
  const everyOption = key === 'PropertyType'
  return (row?.options || [])
    .filter((option) => !WILDCARDS.includes(option.value))
    .map(({ value, label }) => ({ value, label, supporters: who((p) => valueOf(p) === value) }))
    .filter((option) => everyOption || option.supporters.length)
}

export function flexibleMembers(key, members) {
  const flexible = {
    PreferredLocations: (p) => Array.isArray(p.PreferredLocations) && !p.PreferredLocations.length,
    region: (p) => Array.isArray(p.PreferredLocations) && !p.PreferredLocations.length,
    bedrooms: (p) => p.BedroomsMin === null && p.BedroomsMax === null,
  }
  const test =
    flexible[key] ||
    ((p) => WILDCARDS.includes(key === 'LeaseDuration' ? normaliseLease(p[key]) : p[key]))
  return members.filter(({ profile }) => profile && test(profile)).map(({ uid }) => uid)
}

// Overlap of shared budgets, or the gap between the lowest maximum and the
// highest minimum. Private budgets are never used.
export function resolveBudget(members) {
  const ranges = members
    .map(({ profile: p }) => p)
    .filter((p) => p?.IsBudgetPrivate === false && validRange(p.BudgetMin, p.BudgetMax))
  if (!ranges.length) return { min: null, max: null, gap: null }
  const highestMin = Math.max(...ranges.map((p) => p.BudgetMin))
  const lowestMax = Math.min(...ranges.map((p) => p.BudgetMax))
  return highestMin <= lowestMax
    ? { min: highestMin, max: lowestMax, gap: null }
    : { min: null, max: null, gap: { from: lowestMax, to: highestMin } }
}

// When budgets conflict: end at the lowest maximum (a hard limit) and start at
// the highest minimum that still fits under it.
export function budgetSuggestion(members) {
  const { gap } = resolveBudget(members)
  if (!gap) return null
  const minimums = members
    .map(({ profile: p }) => p)
    .filter((p) => p?.IsBudgetPrivate === false && validRange(p.BudgetMin, p.BudgetMax))
    .map((p) => p.BudgetMin)
    .filter((min) => min <= gap.from)
  return { min: minimums.length ? Math.max(...minimums) : gap.from, max: gap.from }
}

// Budget ballots are { min, max, round }; only this round counts. The result is
// the overlap once everyone has voted, and flagged when there is none.
export function summariseBudgetVotes(members, votes = {}, round = 0, myUid = null) {
  const validVote = (vote) => vote && validRange(vote.min, vote.max) && (vote.round ?? 0) <= round
  const inRound = (r) =>
    members
      .filter(({ uid }) => validVote(votes[uid]) && (votes[uid].round ?? 0) === r)
      .map(({ uid }) => ({ ...votes[uid], uid }))
  const group = (list) =>
    Object.values(
      list.reduce((groups, { uid, min, max }) => {
        const key = `${min}-${max}`
        groups[key] ??= { min, max, count: 0, mine: false }
        groups[key].count += 1
        groups[key].mine ||= uid === myUid
        return groups
      }, {}),
    ).sort((a, b) => a.min - b.min || a.max - b.max) // by amount, so voting never reorders
  const current = inRound(round)
  const low = current.length ? Math.max(...current.map((vote) => vote.min)) : null
  const high = current.length ? Math.min(...current.map((vote) => vote.max)) : null
  const overlap = current.length && low <= high ? { min: low, max: high } : null
  const everyone = current.length === members.length
  return {
    ranges: group(current),
    submitted: current.length,
    overlap,
    result: everyone ? overlap : null,
    flagged: everyone && !overlap,
  }
}

const daysBetween = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5

// One result per factor: status (shared | discussion | conflict | unavailable |
// info), value, cause, suggestion, details (each member's fit), support, scored.
export function analyseGroup(members) {
  if (members.length < 2) return []
  const results = []

  function add(key, result) {
    const row = rowFor(key)
    const fits = result.fits || {}
    const details = members.map((member) => ({
      uid: member.uid,
      name: member.name,
      value: displayPreference(member.profile, row),
      fit: fits[member.uid] ?? null,
      highlight: result.highlights?.[member.uid] || null,
    }))
    const assessed = details.filter((detail) => detail.fit !== null)
    results.push({
      key,
      label: result.label || row.label,
      title: result.title || result.label || row.label,
      status: result.status,
      value: result.value,
      note: result.note || null,
      cause: result.cause || null,
      suggestion: result.suggestion || null,
      tie: result.tie || false,
      additional: result.additional || null,
      scored: result.scored ?? true,
      details,
      support:
        result.status === 'unavailable' || !assessed.length
          ? null
          : assessed.filter((detail) => detail.fit).length / assessed.length,
      voteOptions: ['conflict', 'discussion'].includes(result.status)
        ? buildVoteOptions(key, members)
        : null,
    })
  }
  const unavailable = (
    key,
    label,
    note = 'Not assessed: some preference data is missing or invalid.',
  ) => add(key, { label, status: 'unavailable', value: 'Not assessed', note })
  const fitMap = (ids) => Object.fromEntries(members.map(({ uid }) => [uid, ids.includes(uid)]))
  const nameList = (uids) =>
    members
      .filter(({ uid }) => uids.includes(uid))
      .map(({ name }) => name)
      .join(', ')
  const fitsLine = (count, total = members.length) => `${count} of ${total} members`
  const joinNames = (uids) => {
    const names = members.filter(({ uid }) => uids.includes(uid)).map(({ name }) => name)
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]
  }
  const tiedGroupsLine = (groups, verb, total = members.length) =>
    `${groups.map(joinNames).join(', or ')}, ${verb} (${fitsLine(groups[0].length, total)} each).`
  const isTie = (groups) => groups.length > 1 && groups[0].length > 1

  // Budget: only a gap between shared budgets needs a vote.
  const budget = resolveBudget(members)
  if (budget.gap) {
    add('budget', {
      label: 'Budget',
      title: 'Budget per person',
      status: 'conflict',
      value: "Budgets don't overlap",
      cause: `One member can pay up to ${formatCurrency(budget.gap.from)}, another needs at least ${formatCurrency(budget.gap.to)}.`,
    })
  } else {
    add('budget', {
      label: 'Budget',
      title: 'Budget per person',
      status: 'shared',
      value:
        budget.max == null ? 'No limit set' : formatRange(budget.min, budget.max, formatCurrency),
    })
  }

  // Commute: can every member reach one place within their maximum time?
  if (
    members.some(
      ({ profile: p }) =>
        !(Number.isFinite(p?.MaxCommuteTime) && p.MaxCommuteTime > 0) ||
        !validPlace(p.CommuteDestination),
    )
  ) {
    unavailable('commute', 'Commute')
  } else {
    const circles = members.map(({ uid, profile: p }) => ({
      uid,
      lat: p.CommuteDestination.Lat,
      lng: p.CommuteDestination.Lng,
      r: p.MaxCommuteTime * COMMUTE_KM_PER_MINUTE,
    }))
    const groups = bestCommuteOverlaps(circles)
    const best = groups[0]
    const conflict = best.length < members.length
    const places = [...new Set(members.map(({ profile: p }) => p.CommuteDestination.Address))]
    const shortest = Math.min(...members.map(({ profile: p }) => p.MaxCommuteTime))
    const highlights = {}
    let cause = null
    if (conflict) {
      let worst = null
      circles.forEach((a, i) =>
        circles.slice(i + 1).forEach((b) => {
          const gap = haversineKm(a, b) - a.r - b.r
          if (!worst || gap > worst.gap) worst = { a, b, gap }
        }),
      )
      if (worst.gap > 0) {
        highlights[worst.a.uid] = 'Too far apart'
        highlights[worst.b.uid] = 'Too far apart'
        cause = `${nameList([worst.a.uid])} and ${nameList([worst.b.uid])} commute to places too far apart: no home is within both of their maximum commute times.`
      } else {
        cause =
          'Each pair of members could share a commute area, but no single area works for everyone.'
      }
    }
    add('commute', {
      label: 'Commute',
      status: conflict ? 'conflict' : 'shared',
      value: conflict
        ? 'No shared commute area'
        : places.length === 1
          ? `Within ${shortest} min of ${places[0]}`
          : 'Shared commute area found',
      note: `Estimated from straight-line distance to ${places.length} ${places.length === 1 ? 'destination' : 'destinations'}.`,
      cause,
      suggestion: !conflict
        ? null
        : best.length === 1
          ? 'No two members could share a home within their commutes.'
          : isTie(groups)
            ? tiedGroupsLine(groups, 'could each share a home within their commutes')
            : `A home could suit the commutes of ${joinNames(best)} (${fitsLine(best.length)}).`,
      tie: conflict && isTie(groups),
      highlights,
      fits: fitMap(best),
    })
  }

  // Location: "Any" (no areas picked) never restricts the group.
  if (
    members.some(
      ({ profile: p }) =>
        !Array.isArray(p?.PreferredLocations) ||
        p.PreferredLocations.some((value) => !isOption(LOCATIONS, value)),
    )
  ) {
    unavailable('PreferredLocations', 'Location')
  } else {
    const choices = members
      .map(({ profile: p }) => p.PreferredLocations)
      .filter((areas) => areas.length)
    const common = choices.length
      ? [...new Set(choices[0])].filter((area) => choices.every((areas) => areas.includes(area)))
      : []
    const counts = LOCATIONS.map((option) => ({
      ...option,
      count: choices.filter((areas) => areas.includes(option.value)).length,
    }))
    const top = counts.reduce((a, b) => (b.count > a.count ? b : a))
    const tied = counts.filter((option) => option.count && option.count === top.count)
    const fitIds = members
      .filter(
        ({ profile: p }) =>
          !p.PreferredLocations.length || p.PreferredLocations.includes(top.value),
      )
      .map(({ uid }) => uid)
    const conflict = choices.length > 0 && !common.length
    const labels = (areas) => areas.map((area) => optionLabel(LOCATIONS, area)).join(', ')
    add('PreferredLocations', {
      label: 'Location',
      status: conflict ? 'conflict' : 'shared',
      value: conflict ? 'No shared option' : choices.length ? labels(common) : 'Any location',
      note: conflict
        ? 'No shared preferred location.'
        : choices.length
          ? null
          : 'Nobody has restricted the area.',
      cause: conflict
        ? 'No location appears in every member’s selected areas. “Any” does not restrict the group.'
        : null,
      suggestion: !conflict
        ? null
        : tied.length > 1
          ? `${tied.map((option) => option.label).join(' or ')} each suit ${fitsLine(fitIds.length)}.`
          : `${top.label} suits ${fitsLine(fitIds.length)}, the most of any area.`,
      tie: conflict && tied.length > 1,
      highlights: conflict
        ? Object.fromEntries(
            members
              .filter(({ profile: p }) => p.PreferredLocations.length)
              .map(({ uid }) => [uid, 'Selected areas']),
          )
        : {},
      fits: fitMap(fitIds),
    })
  }

  // Region: "Any" suits every region.
  if (
    members.some(
      ({ profile: p }) =>
        !Array.isArray(p?.PreferredLocations) ||
        p.PreferredLocations.some((value) => !REGION_FOR_AREA[value]),
    )
  ) {
    unavailable('region', 'Region')
  } else {
    const choices = members.map(({ profile: p }) => regionsOf(p)).filter((list) => list.length)
    const common = choices.length
      ? choices[0].filter((region) => choices.every((list) => list.includes(region)))
      : []
    const counts = LISTING_REGIONS.map((region) => ({
      region,
      count: choices.filter((list) => list.includes(region)).length,
    }))
    const top = counts.reduce((a, b) => (b.count > a.count ? b : a))
    const fitIds = members
      .filter(({ profile: p }) => !regionsOf(p).length || regionsOf(p).includes(top.region))
      .map(({ uid }) => uid)
    const conflict = choices.length > 0 && !common.length
    add('region', {
      label: 'Region',
      status: conflict ? 'conflict' : 'shared',
      value: conflict ? 'No shared region' : choices.length ? common.join(', ') : 'Any region',
      fits: fitMap(fitIds),
    })
  }

  // Bedrooms: null min and max means "Any".
  if (
    members.some(
      ({ profile: p }) =>
        !p ||
        (!(p.BedroomsMin === null && p.BedroomsMax === null) &&
          !(
            validRange(p.BedroomsMin, p.BedroomsMax) &&
            Number.isInteger(p.BedroomsMin) &&
            Number.isInteger(p.BedroomsMax) &&
            p.BedroomsMin >= 1
          )),
    )
  ) {
    unavailable('bedrooms', 'Bedrooms')
  } else {
    const ranges = members
      .filter(({ profile: p }) => p.BedroomsMin !== null)
      .map(({ uid, profile: p }) => ({ uid, min: p.BedroomsMin, max: p.BedroomsMax }))
    const min = Math.max(...ranges.map((r) => r.min))
    const max = Math.min(...ranges.map((r) => r.max))
    const conflict = ranges.length > 0 && min > max
    const anyIds = members.filter(({ profile: p }) => p.BedroomsMin === null).map(({ uid }) => uid)
    const groups = bestOverlaps(ranges).map((group) => [...anyIds, ...group])
    const fitIds = groups[0] || anyIds
    const highlights = {}
    if (conflict) {
      ranges.forEach((r) => {
        const labels = [r.min === min && 'Highest minimum', r.max === max && 'Lowest maximum']
        if (labels.some(Boolean)) highlights[r.uid] = labels.filter(Boolean).join(' · ')
      })
    }
    add('bedrooms', {
      label: 'Bedrooms',
      status: conflict ? 'conflict' : 'shared',
      value: conflict ? 'No shared option' : ranges.length ? formatRange(min, max) : 'Any',
      note: conflict
        ? 'No overlapping bedroom requirement.'
        : ranges.length
          ? null
          : 'Nobody has restricted the range.',
      cause: conflict
        ? `The highest minimum (${min}) exceeds the lowest maximum (${max}). There is no shared bedroom range.`
        : null,
      suggestion: !conflict
        ? null
        : fitIds.length === 1
          ? 'No two bedroom ranges overlap.'
          : isTie(groups)
            ? tiedGroupsLine(groups, 'have overlapping bedroom ranges')
            : `The bedroom ranges of ${joinNames(fitIds)} overlap (${fitsLine(fitIds.length)}, counting “Any”).`,
      tie: conflict && isTie(groups),
      highlights,
      fits: fitMap(fitIds),
    })
  }

  // Move-in date: a spread is something to discuss, not a hard conflict.
  const dates = members.map(({ profile: p }) => p?.PreferredMoveInDate)
  if (!dates.every(validDate)) {
    unavailable('PreferredMoveInDate', 'Move-in date')
  } else {
    const sorted = [...dates].sort()
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const same = first === last
    const windows = [...new Set(sorted)].map((start) => ({
      start,
      ids: members
        .filter(({ profile: p }) => {
          const days = daysBetween(start, p.PreferredMoveInDate)
          return days >= 0 && days <= MOVE_IN_WINDOW_DAYS
        })
        .map(({ uid }) => uid),
    }))
    const groups = largestGroups(windows.map((window) => window.ids))
    const startOf = (group) =>
      windows.find((window) => window.ids.join('|') === group.join('|')).start
    const best = groups[0]
    const span = `${formatMoveInDate(first)} – ${formatMoveInDate(last)}`
    const highlights = {}
    if (!same) {
      members.forEach(({ uid, profile: p }) => {
        if (p.PreferredMoveInDate === first) highlights[uid] = 'Earliest date'
        if (p.PreferredMoveInDate === last) highlights[uid] = 'Latest date'
      })
    }
    add('PreferredMoveInDate', {
      label: 'Move-in date',
      title: same ? 'Move-in date' : 'Move-in date span',
      status: same ? 'shared' : 'discussion',
      value: same ? formatMoveInDate(first) : span,
      note: same ? `Everyone prefers ${formatMoveInDate(first)}.` : null,
      cause: same
        ? null
        : 'Members prefer different move-in dates. This span shows their earliest and latest choices, not an agreed date range.',
      suggestion: same
        ? null
        : best.length === 1
          ? `No two members' dates are within ${MOVE_IN_WINDOW_DAYS} days of each other.`
          : isTie(groups)
            ? `${groups.map((group) => `${joinNames(group)} (from ${formatMoveInDate(startOf(group))})`).join(', or ')}, have dates within ${MOVE_IN_WINDOW_DAYS} days of each other (${fitsLine(best.length)} each).`
            : `Dates of ${joinNames(best)} fall within ${MOVE_IN_WINDOW_DAYS} days of ${formatMoveInDate(startOf(best))} (${fitsLine(best.length)}).`,
      tie: !same && isTie(groups),
      highlights,
      fits: fitMap(best),
    })
  }

  // Single-choice factors: opposing pairs conflict, other differences need discussion.
  const choiceFactors = [
    { key: 'PropertyType', label: 'Property type', options: PROPERTY_TYPES, wildcard: 'Any' },
    {
      key: 'LeaseDuration',
      label: 'Lease duration',
      options: LEASE_DURATIONS,
      wildcard: 'Flexible',
      normalise: normaliseLease,
    },
    { key: 'FurnishingLevel', label: 'Furnishing', options: FURNISHING_LEVELS, wildcard: 'Any' },
    {
      key: 'SmokingPreference',
      label: 'Smoking',
      options: SMOKING_PREFERENCES,
      wildcard: 'NoPreference',
      opposites: ['Allowed', 'NonSmoking'],
    },
    {
      key: 'StudyEnvironment',
      label: 'Study environment',
      options: STUDY_ENVIRONMENTS,
      wildcard: 'NoPreference',
    },
    {
      key: 'GuestPolicy',
      label: 'Guests',
      options: GUEST_POLICIES,
      opposites: ['Welcome', 'NoGuests'],
    },
  ]
  for (const { key, label, options, wildcard, opposites, normalise = (v) => v } of choiceFactors) {
    const values = members.map(({ profile: p }) => (p ? normalise(p[key]) : undefined))
    if (values.some((value) => !isOption(options, value))) {
      unavailable(key, label)
      continue
    }
    const counts = options
      .filter((option) => option.value !== wildcard)
      .map((option) => ({ ...option, count: values.filter((v) => v === option.value).length }))
      .filter((option) => option.count)
    const top = counts.length ? counts.reduce((a, b) => (b.count > a.count ? b : a)) : null
    const tied = counts.filter((option) => option.count === top?.count)
    const fitIds = members
      .filter((_, i) => !top || values[i] === wildcard || values[i] === top.value)
      .map(({ uid }) => uid)
    const conflict = opposites?.every((value) => values.includes(value))
    const status = counts.length <= 1 ? 'shared' : conflict ? 'conflict' : 'discussion'
    const highlights = {}
    if (conflict) {
      members.forEach(({ uid }, i) => {
        if (opposites.includes(values[i])) highlights[uid] = 'Opposing choice'
      })
    }
    add(key, {
      label,
      status,
      value: !top
        ? optionLabel(options, wildcard) || 'No preference'
        : status === 'shared'
          ? top.label
          : `${counts.length} different choices`,
      note:
        status === 'shared'
          ? null
          : counts.map((option) => `${option.count} × ${option.label}`).join('; '),
      cause: conflict
        ? `${opposites.map((value) => optionLabel(options, value)).join(' and ')} cannot both be met in one home.`
        : status === 'discussion'
          ? 'Members chose different options. Agree on one before shortlisting.'
          : null,
      suggestion:
        status === 'shared'
          ? null
          : `${tied.map((option) => option.label).join(' or ')} ${tied.length > 1 ? 'each suit' : 'suits'} ${fitsLine(fitIds.length)}.`,
      tie: status !== 'shared' && tied.length > 1,
      highlights,
      fits: fitMap(fitIds),
    })
  }

  // Requirements: the strictest choice suits everyone, so they never conflict.
  for (const [key, label, options, order] of [
    ['CookingAccess', 'Cooking access', COOKING_ACCESS, ['Required', 'NoPreference', 'NotNeeded']],
    [
      'AirconCoverage',
      'Air conditioning',
      AIRCON_COVERAGE,
      ['AllRooms', 'CommonOnly', 'NotRequired'],
    ],
  ]) {
    const values = members.map(({ profile: p }) => p?.[key])
    if (values.some((value) => !isOption(options, value))) {
      unavailable(key, label)
      continue
    }
    const strictest = order.find((value) => values.includes(value))
    const count = values.filter((value) => value === strictest).length
    add(key, {
      label,
      status: 'shared',
      value: optionLabel(options, strictest),
      note: `Strictest choice, from ${fitsLine(count)}. It also suits everyone else.`,
      scored: false,
      fits: fitMap(members.map(({ uid }) => uid)),
    })
  }

  if (members.some(({ profile: p }) => !Number.isInteger(p?.CoTenants))) {
    unavailable('CoTenants', 'Co-tenants')
  } else {
    const others = members.length - 1
    const fitIds = members.filter(({ profile: p }) => p.CoTenants >= others).map(({ uid }) => uid)
    const fewer = members.filter(({ uid }) => !fitIds.includes(uid))
    add('CoTenants', {
      label: 'Co-tenants',
      status: fewer.length ? 'discussion' : 'shared',
      value: `Group of ${members.length}`,
      note: fewer.length
        ? `${fitsLine(fewer.length)} expect fewer than ${others} co-tenants.`
        : `Everyone expects at least ${others} co-tenants.`,
      cause: fewer.length
        ? `This group has ${members.length} people, so each member would live with ${others} others.`
        : null,
      highlights: Object.fromEntries(fewer.map(({ uid }) => [uid, 'Expects fewer housemates'])),
      fits: fitMap(fitIds),
    })
  }

  // Amenities: a member fits when at least half their requests are on the group list.
  if (
    members.some(
      ({ profile: p }) =>
        !Array.isArray(p?.Amenities) || p.Amenities.some((value) => !isOption(AMENITIES, value)),
    )
  ) {
    unavailable('Amenities', 'Amenities')
  } else {
    const selections = members.map(({ profile: p }) => p.Amenities)
    const requested = [...new Set(selections.flat())]
    const shared = requested.filter((value) => selections.every((items) => items.includes(value)))
    const additional = requested.filter((value) => !shared.includes(value))
    const groupList = requested.filter(
      (value) => selections.filter((items) => items.includes(value)).length * 2 >= members.length,
    )
    const fitIds = members
      .filter(
        ({ profile: p }) =>
          p.Amenities.filter((value) => groupList.includes(value)).length * 2 >= p.Amenities.length,
      )
      .map(({ uid }) => uid)
    const labels = (values) => values.map((value) => optionLabel(AMENITIES, value)).join(', ')
    add('Amenities', {
      label: 'Amenities',
      status: shared.length ? 'shared' : 'info',
      value: labels(shared) || 'None selected by everyone',
      note: 'Shared amenities',
      additional: labels(additional) || 'None',
      suggestion: `Picked by at least half the group: ${labels(groupList) || 'none'}. This list covers most requests of ${fitsLine(fitIds.length)}.`,
      fits: fitMap(fitIds),
    })
  }

  return results
}

// Me vs one member: every preference scores 0–100 (compatible ≥ 60, discuss
// 1–59, conflict 0, unknown without data). "Any" or a range inside the other's
// scores 100.
const COMPATIBLE_FROM = 60
const WILDCARD_SCORE = 100
const DATE_SAME_DAYS = 14
const DATE_FADE_DAYS = 60

const stateForScore = (score) =>
  score == null
    ? 'unknown'
    : score >= COMPATIBLE_FROM
      ? 'compatible'
      : score > 0
        ? 'discuss'
        : 'conflict'
const clampScore = (value) => Math.round(Math.min(100, Math.max(0, value)))

const PAIR_CHOICES = [
  { key: 'PropertyType', label: 'Property type', wildcard: 'Any' },
  {
    key: 'LeaseDuration',
    label: 'Lease duration',
    wildcard: 'Flexible',
    normalise: normaliseLease,
  },
  { key: 'FurnishingLevel', label: 'Furnishing', wildcard: 'Any' },
  {
    key: 'SmokingPreference',
    label: 'Smoking',
    wildcard: 'NoPreference',
    opposites: ['Allowed', 'NonSmoking'],
  },
  { key: 'StudyEnvironment', label: 'Study environment', wildcard: 'NoPreference' },
  { key: 'GuestPolicy', label: 'Guests', opposites: ['Welcome', 'NoGuests'] },
]
const PAIR_REQUIREMENTS = [
  { key: 'CookingAccess', label: 'Cooking access' },
  { key: 'AirconCoverage', label: 'Air conditioning' },
]

function rangeOverlapScore(a, b, inclusive = false) {
  const extra = inclusive ? 1 : 0
  const overlap = Math.min(a.max, b.max) - Math.max(a.min, b.min) + extra
  if (overlap <= 0) return 0
  const narrower = Math.max(Math.min(a.max - a.min, b.max - b.min) + extra, 1)
  return clampScore((overlap / narrower) * 100)
}
const listOverlapScore = (a, b) =>
  clampScore((a.filter((item) => b.includes(item)).length / Math.min(a.length, b.length)) * 100)

// My budget is used even if private (only I see this); theirs only if shared.
export function compareWithMember(
  myProfile,
  theirProfile,
  { myBudget = null, name = 'They' } = {},
) {
  const rows = []
  const add = (key, label, score, reason, brief) => {
    const row = rowFor(key)
    rows.push({
      key,
      label,
      score,
      state: stateForScore(score),
      reason,
      brief,
      mine:
        key === 'budget'
          ? myBudget && validRange(myBudget.BudgetMin, myBudget.BudgetMax)
            ? formatRange(myBudget.BudgetMin, myBudget.BudgetMax, formatCurrency)
            : 'Not provided'
          : displayPreference(myProfile, row),
      theirs: displayPreference(theirProfile, row),
    })
  }
  const order = [
    'budget',
    'commute',
    'PreferredLocations',
    'bedrooms',
    'PreferredMoveInDate',
    ...PAIR_CHOICES.map((choice) => choice.key),
    ...PAIR_REQUIREMENTS.map((choice) => choice.key),
    'CoTenants',
    'Amenities',
  ]
  if (!myProfile || !theirProfile) {
    order.forEach((key) => add(key, rowFor(key).label, null, 'Preferences unavailable.', 'Missing'))
    return rows
  }
  const me = myProfile
  const them = theirProfile

  // Budget: overlap as a share of the narrower range, the same from either side.
  if (!myBudget || !validRange(myBudget.BudgetMin, myBudget.BudgetMax)) {
    add('budget', 'Budget', null, 'Your budget is missing.', 'Missing')
  } else if (them.IsBudgetPrivate !== false) {
    add('budget', 'Budget', null, `${name} keeps their budget private.`, 'Private')
  } else if (!validRange(them.BudgetMin, them.BudgetMax)) {
    add('budget', 'Budget', null, `${name}'s budget is missing.`, 'Missing')
  } else {
    const low = Math.max(myBudget.BudgetMin, them.BudgetMin)
    const high = Math.min(myBudget.BudgetMax, them.BudgetMax)
    const narrower = Math.min(
      myBudget.BudgetMax - myBudget.BudgetMin,
      them.BudgetMax - them.BudgetMin,
    )
    add(
      'budget',
      'Budget',
      low > high ? 0 : narrower > 0 ? clampScore(((high - low) / narrower) * 100) : 100,
      low === high
        ? `Your budgets only meet at ${formatCurrency(low)}.`
        : low < high
          ? `You overlap at ${formatRange(low, high, formatCurrency)}, ${formatCurrency(high - low)} of the narrower ${formatCurrency(narrower)} range.`
          : `No overlap: a ${formatCurrency(low - high)} gap.`,
      low > high
        ? `${formatCurrency(low - high)} gap`
        : low === high
          ? 'Only touching'
          : `${formatCurrency(high - low)} overlap`,
    )
  }

  // Commute: spare reach once the distance between destinations is used up.
  const validCommute = (p) =>
    Number.isFinite(p.MaxCommuteTime) && p.MaxCommuteTime > 0 && validPlace(p.CommuteDestination)
  if (!validCommute(me) || !validCommute(them)) {
    add('commute', 'Commute', null, 'A commute time or destination is missing.', 'Missing')
  } else {
    const distance = haversineKm(
      { lat: me.CommuteDestination.Lat, lng: me.CommuteDestination.Lng },
      { lat: them.CommuteDestination.Lat, lng: them.CommuteDestination.Lng },
    )
    const reach = (me.MaxCommuteTime + them.MaxCommuteTime) * COMMUTE_KM_PER_MINUTE
    add(
      'commute',
      'Commute',
      distance < 0.5 ? 100 : clampScore((1 - distance / reach) * 100),
      distance < 0.5
        ? 'Same destination.'
        : distance <= reach
          ? `Destinations ${formatDistance(distance)} apart; a home between them suits both (estimate).`
          : `Destinations ${formatDistance(distance)} apart; too far for both commutes (estimate).`,
      distance < 0.5 ? 'Same place' : `${formatDistance(distance)} apart`,
    )
  }

  const validAreas = (p) =>
    Array.isArray(p.PreferredLocations) &&
    p.PreferredLocations.every((value) => isOption(LOCATIONS, value))
  if (!validAreas(me) || !validAreas(them)) {
    add('PreferredLocations', 'Location', null, 'Preferred locations are missing.', 'Missing')
  } else if (!me.PreferredLocations.length || !them.PreferredLocations.length) {
    add(
      'PreferredLocations',
      'Location',
      WILDCARD_SCORE,
      'One of you is open to any area.',
      [...me.PreferredLocations, ...them.PreferredLocations]
        .map((area) => optionLabel(LOCATIONS, area))
        .join(', ') || 'Open to any',
    )
  } else {
    const common = me.PreferredLocations.filter((area) => them.PreferredLocations.includes(area))
    add(
      'PreferredLocations',
      'Location',
      listOverlapScore(me.PreferredLocations, them.PreferredLocations),
      common.length
        ? `Both like ${common.map((area) => optionLabel(LOCATIONS, area)).join(', ')}.`
        : 'No area in common.',
      common.length
        ? `Both: ${common.map((area) => optionLabel(LOCATIONS, area)).join(', ')}`
        : 'No shared area',
    )
  }

  const anyRooms = (p) => p.BedroomsMin === null && p.BedroomsMax === null
  const validRooms = (p) => anyRooms(p) || validRange(p.BedroomsMin, p.BedroomsMax)
  if (!validRooms(me) || !validRooms(them)) {
    add('bedrooms', 'Bedrooms', null, 'A bedroom range is missing.', 'Missing')
  } else if (anyRooms(me) || anyRooms(them)) {
    add(
      'bedrooms',
      'Bedrooms',
      WILDCARD_SCORE,
      'One of you accepts any number of bedrooms.',
      anyRooms(me) && anyRooms(them)
        ? 'Open to any'
        : `${anyRooms(me) ? formatRange(them.BedroomsMin, them.BedroomsMax) : formatRange(me.BedroomsMin, me.BedroomsMax)} rooms`,
    )
  } else {
    const low = Math.max(me.BedroomsMin, them.BedroomsMin)
    const high = Math.min(me.BedroomsMax, them.BedroomsMax)
    add(
      'bedrooms',
      'Bedrooms',
      rangeOverlapScore(
        { min: me.BedroomsMin, max: me.BedroomsMax },
        { min: them.BedroomsMin, max: them.BedroomsMax },
        true,
      ),
      low <= high ? `Both accept ${formatRange(low, high)}.` : 'Your ranges don’t overlap.',
      low <= high ? `${formatRange(low, high)} rooms` : 'No overlap',
    )
  }

  // Move-in date: full marks within two weeks, fading to 0 over 60 days.
  if (!validDate(me.PreferredMoveInDate) || !validDate(them.PreferredMoveInDate)) {
    add('PreferredMoveInDate', 'Move-in date', null, 'A move-in date is missing.', 'Missing')
  } else {
    const days = Math.abs(daysBetween(me.PreferredMoveInDate, them.PreferredMoveInDate))
    add(
      'PreferredMoveInDate',
      'Move-in date',
      clampScore(100 - (Math.max(days - DATE_SAME_DAYS, 0) / DATE_FADE_DAYS) * 100),
      days === 0 ? 'Same date.' : `${days} ${days === 1 ? 'day' : 'days'} apart.`,
      days === 0 ? 'Same date' : `${days} ${days === 1 ? 'day' : 'days'} apart`,
    )
  }

  for (const { key, label, wildcard, opposites, normalise = (v) => v } of PAIR_CHOICES) {
    const options = rowFor(key).options
    const mine = normalise(me[key])
    const theirs = normalise(them[key])
    if (!isOption(options, mine) || !isOption(options, theirs)) {
      add(key, label, null, 'A preference is missing.', 'Missing')
    } else if (mine === theirs) {
      add(key, label, 100, 'Same choice.', mine === wildcard ? 'Open to any' : 'Same')
    } else if (mine === wildcard || theirs === wildcard) {
      add(
        key,
        label,
        WILDCARD_SCORE,
        'One of you has no preference.',
        optionLabel(options, mine === wildcard ? theirs : mine),
      )
    } else if (opposites?.includes(mine) && opposites.includes(theirs)) {
      add(key, label, 0, 'Opposite choices.', 'Opposite')
    } else {
      add(key, label, 40, 'Different choices.', 'Different')
    }
  }

  for (const { key, label } of PAIR_REQUIREMENTS) {
    const options = rowFor(key).options
    if (!isOption(options, me[key]) || !isOption(options, them[key])) {
      add(key, label, null, 'A preference is missing.', 'Missing')
    } else {
      add(key, label, 100, 'A home meeting the stricter choice suits both.', 'Stricter applies')
    }
  }

  if (!Number.isInteger(me.CoTenants) || !Number.isInteger(them.CoTenants)) {
    add('CoTenants', 'Co-tenants', null, 'A co-tenant count is missing.', 'Missing')
  } else {
    const gap = Math.abs(me.CoTenants - them.CoTenants)
    add(
      'CoTenants',
      'Co-tenants',
      gap === 0 ? 100 : gap === 1 ? 60 : 30,
      gap === 0
        ? `Both expect a household of ${me.CoTenants + 1}.`
        : `You expect ${me.CoTenants + 1} people; ${name} expects ${them.CoTenants + 1}.`,
      gap === 0
        ? `Both ${me.CoTenants + 1} people`
        : `${me.CoTenants + 1} vs ${them.CoTenants + 1} people`,
    )
  }

  const validAmenities = (p) =>
    Array.isArray(p.Amenities) && p.Amenities.every((value) => isOption(AMENITIES, value))
  if (!validAmenities(me) || !validAmenities(them)) {
    add('Amenities', 'Amenities', null, 'Amenities are missing.', 'Missing')
  } else if (!me.Amenities.length || !them.Amenities.length) {
    add(
      'Amenities',
      'Amenities',
      WILDCARD_SCORE,
      'One of you has no amenity requests.',
      [...me.Amenities, ...them.Amenities]
        .map((value) => optionLabel(AMENITIES, value))
        .join(', ') || 'Open to any',
    )
  } else {
    const common = me.Amenities.filter((value) => them.Amenities.includes(value))
    add(
      'Amenities',
      'Amenities',
      listOverlapScore(me.Amenities, them.Amenities),
      common.length
        ? `Both want ${common.map((value) => optionLabel(AMENITIES, value)).join(', ')}.`
        : 'No amenities in common.',
      common.length
        ? `Both: ${common.map((value) => optionLabel(AMENITIES, value)).join(', ')}`
        : 'None shared',
    )
  }

  return rows
}

// Priority-weighted match; rows without data are left out.
export function matchScore(rows, priorities) {
  const weightOf = (key) => priorityWeight(key, priorities)
  const known = rows.filter((row) => row.score != null)
  if (!known.length) return null
  const total = known.reduce((sum, row) => sum + weightOf(row.key), 0)
  const weighted = known.reduce((sum, row) => sum + weightOf(row.key) * row.score, 0)
  return Math.round(weighted / total)
}

// A member's ranking is saved as { Budget: 1, ... }, 1 = most important.
export const priorityMap = (order) =>
  Object.fromEntries(PRIORITY_FACTORS.map(({ key, field }) => [field, order.indexOf(key) + 1]))
export const priorityOrder = (map) => {
  const ranked = PRIORITY_FACTORS.filter(({ field }) => map?.[field] > 0)
    .sort((a, b) => map[a.field] - map[b.field])
    .map(({ key }) => key)
  return ranked.length === PRIORITY_FACTORS.length ? ranked : null
}

// Average match of every pair, each pair weighed by both members' own rankings.
export function groupMatchScore(members, prioritiesOf = () => DEFAULT_PRIORITY_ORDER) {
  const scores = []
  members.forEach((a, i) =>
    members.slice(i + 1).forEach((b) => {
      const budget = a.profile?.IsBudgetPrivate === false ? a.profile : null
      const rows = compareWithMember(a.profile, b.profile, { myBudget: budget, name: b.name })
      const pair = [a, b]
        .map((member) => matchScore(rows, prioritiesOf(member.uid)))
        .filter((score) => score != null)
      if (pair.length) scores.push(pair.reduce((sum, score) => sum + score, 0) / pair.length)
    }),
  )
  if (!scores.length) return null
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

// The agreed listing-search filters, saved as Group_Preferences/{GroupID}.
// MonthlyRentMax is the per-person maximum times the household size.
export const SEARCH_FACTORS = ['budget', 'region', 'PropertyType', 'bedrooms']

// decisions holds finalised votes; anything unsettled goes in PendingPreferences.
export function buildGroupPreference({ groupId, members, analysis, decisions = {} }) {
  const profiles = members.map(({ profile }) => profile).filter(Boolean)
  const statusOf = (key) => analysis.find((factor) => factor.key === key)?.status
  const pending = []
  const settle = (key, fromDecision, fromAgreement) => {
    if (key in decisions) return fromDecision(decisions[key])
    if (statusOf(key) === 'shared') return fromAgreement()
    pending.push(key)
    return null
  }

  // Older finalised budget votes may hold a plain number (a maximum).
  const budget = settle(
    'budget',
    (decided) => (typeof decided === 'object' ? decided : { min: null, max: decided }),
    () => {
      const { min, max } = resolveBudget(members)
      return { min, max }
    },
  )
  const regions = settle(
    'region',
    (region) => [region],
    () => {
      const choices = profiles.map(regionsOf).filter((list) => list.length)
      return choices.length
        ? choices[0].filter((region) => choices.every((list) => list.includes(region)))
        : []
    },
  )
  const propertyType = settle(
    'PropertyType',
    (type) => type,
    () => profiles.map((p) => p.PropertyType).find((type) => type !== 'Any') ?? 'Any',
  )
  const bedrooms = settle(
    'bedrooms',
    (count) => ({ min: count, max: count }),
    () => {
      const ranges = profiles.filter((p) => p.BedroomsMin != null)
      return ranges.length
        ? {
            min: Math.max(...ranges.map((p) => p.BedroomsMin)),
            max: Math.min(...ranges.map((p) => p.BedroomsMax)),
          }
        : { min: null, max: null }
    },
  )

  return {
    GroupID: groupId,
    HouseholdSize: members.length,
    BudgetPerPersonMin: budget?.min ?? null,
    BudgetPerPersonMax: budget?.max ?? null,
    MonthlyRentMax: budget?.max == null ? null : budget.max * members.length,
    PreferredRegions: regions,
    PropertyType: propertyType,
    BedroomsMin: bedrooms?.min ?? null,
    BedroomsMax: bedrooms?.max ?? null,
    PendingPreferences: pending,
    IsComplete: !pending.length,
  }
}
