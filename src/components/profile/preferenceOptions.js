// Single source of truth for User_Preferences values (see CLAUDE.md) and the
// labels the UI shows for them. Stored values are schema enums or slugs.

export const BUDGET_RANGE = { min: 500, max: 8000, step: 50, minGap: 100 }
export const COMMUTE_RANGE = { min: 5, max: 90, step: 5 }
export const BEDROOM_RANGE = { min: 1, max: 6 }
export const CO_TENANT_RANGE = { min: 1, max: 10 }

export const PROPERTY_TYPES = [
  { value: 'HDB', label: 'HDB' },
  { value: 'Condo', label: 'Condo' },
  { value: 'Landed', label: 'Landed' },
  { value: 'Any', label: 'Any' },
]

export const LEASE_DURATIONS = [
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
  { value: 24, label: '24 months' },
  { value: 'Flexible', label: 'Flexible' },
]

export const FURNISHING_LEVELS = [
  { value: 'Unfurnished', label: 'Unfurnished' },
  { value: 'Partial', label: 'Partially Furnished' },
  { value: 'Full', label: 'Fully Furnished' },
  { value: 'Any', label: 'Any' },
]

export const COOKING_ACCESS = [
  { value: 'Required', label: 'Kitchen Access Required' },
  { value: 'NotNeeded', label: 'No Cooking Needed' },
  { value: 'NoPreference', label: 'No Preference' },
]

export const AIRCON_COVERAGE = [
  { value: 'AllRooms', label: 'Aircon in All Rooms' },
  { value: 'CommonOnly', label: 'Common Areas Only' },
  { value: 'NotRequired', label: 'Not Required' },
]

export const SMOKING_PREFERENCES = [
  { value: 'Allowed', label: 'Smoking Allowed' },
  { value: 'NonSmoking', label: 'Non-Smoking Only' },
  { value: 'NoPreference', label: 'No Preference' },
]

export const STUDY_ENVIRONMENTS = [
  { value: 'Quiet', label: 'Quiet Study Space Needed' },
  { value: 'Sociable', label: 'Sociable Household OK' },
  { value: 'NoPreference', label: 'No Preference' },
]

export const GUEST_POLICIES = [
  { value: 'Welcome', label: 'Guests Welcome' },
  { value: 'Limited', label: 'Limited Guests' },
  { value: 'NoGuests', label: 'No Guests Preferred' },
]

export const AMENITIES = [
  { value: 'wifi', label: 'WiFi', icon: 'wifi' },
  { value: 'aircon', label: 'Aircon', icon: 'snowflake' },
  { value: 'pet-friendly', label: 'Pet-friendly', icon: 'paw' },
  { value: 'gym', label: 'Gym', icon: 'dumbbell' },
  { value: 'pool', label: 'Pool', icon: 'waves' },
  { value: 'parking', label: 'Parking', icon: 'car' },
  { value: 'laundry', label: 'Laundry', icon: 'shirt' },
  { value: 'balcony', label: 'Balcony', icon: 'sun' },
]

// An empty PreferredLocations array means "Any location".
export const LOCATIONS = [
  { value: 'tampines', label: 'Tampines', icon: 'map-pin' },
  { value: 'bukit-timah', label: 'Bukit Timah', icon: 'map-pin' },
  { value: 'queenstown', label: 'Queenstown', icon: 'map-pin' },
  { value: 'bugis', label: 'Bugis', icon: 'map-pin' },
  { value: 'clementi', label: 'Clementi', icon: 'map-pin' },
  { value: 'bishan', label: 'Bishan', icon: 'map-pin' },
  { value: 'jurong', label: 'Jurong', icon: 'map-pin' },
  { value: 'punggol', label: 'Punggol', icon: 'map-pin' },
  { value: 'buona-vista', label: 'Buona Vista', icon: 'map-pin' },
  { value: 'toa-payoh', label: 'Toa Payoh', icon: 'map-pin' },
  { value: 'novena', label: 'Novena', icon: 'map-pin' },
  { value: 'serangoon', label: 'Serangoon', icon: 'map-pin' },
]

// Commute destinations are geocoded with OneMap by postal code. `fallback` is
// used only if OneMap is unreachable, so a save never blocks on the network.
export const UNIVERSITIES = [
  {
    value: 'nus',
    label: 'NUS',
    name: 'National University of Singapore',
    postal: '117570',
    fallback: {
      Address: '5 ARTS LINK NATIONAL UNIVERSITY OF SINGAPORE SINGAPORE 117570',
      Lat: 1.294201,
      Lng: 103.771072,
    },
  },
  {
    value: 'ntu',
    label: 'NTU',
    name: 'Nanyang Technological University',
    postal: '639798',
    fallback: {
      Address:
        '50 NANYANG AVENUE NANYANG TECHNOLOGICAL UNIVERSITY (ADMINISTRATION BUILDING) SINGAPORE 639798',
      Lat: 1.344484,
      Lng: 103.681032,
    },
  },
  {
    value: 'smu',
    label: 'SMU',
    name: 'Singapore Management University',
    postal: '188065',
    fallback: {
      Address: '81 VICTORIA STREET SINGAPORE MANAGEMENT UNIVERSITY (ADMIN BLDG) SINGAPORE 188065',
      Lat: 1.296847,
      Lng: 103.850233,
    },
  },
  {
    value: 'sutd',
    label: 'SUTD',
    name: 'Singapore University of Technology and Design',
    postal: '487372',
    fallback: {
      Address: '8 SOMAPAH ROAD SINGAPORE UNIVERSITY OF TECHNOLOGY AND DESIGN SINGAPORE 487372',
      Lat: 1.340172,
      Lng: 103.96286,
    },
  },
  {
    value: 'sit',
    label: 'SIT',
    name: 'Singapore Institute of Technology',
    postal: '828608',
    fallback: {
      Address: '1 PUNGGOL COAST ROAD SINGAPORE INSTITUTE OF TECHNOLOGY SINGAPORE 828608',
      Lat: 1.413993,
      Lng: 103.912872,
    },
  },
  {
    value: 'suss',
    label: 'SUSS',
    name: 'Singapore University of Social Sciences',
    postal: '599494',
    fallback: {
      Address: '463 CLEMENTI ROAD SINGAPORE UNIVERSITY OF SOCIAL SCIENCES SINGAPORE 599494',
      Lat: 1.328326,
      Lng: 103.775805,
    },
  },
]

export function defaultPreferences() {
  return {
    IsBudgetPrivate: false,
    BudgetMin: 1500,
    BudgetMax: 3200,
    MaxCommuteTime: 30,
    CommuteDestination: null,
    BedroomsMin: null,
    BedroomsMax: null,
    PreferredMoveInDate: null,
    PropertyType: 'Any',
    LeaseDuration: 12,
    CoTenants: 1,
    FurnishingLevel: 'Any',
    CookingAccess: 'NoPreference',
    AirconCoverage: 'NotRequired',
    SmokingPreference: 'NoPreference',
    StudyEnvironment: 'NoPreference',
    GuestPolicy: 'Welcome',
    Amenities: [],
    PreferredLocations: [],
  }
}

/** Fills any missing fields with defaults and drops fields the form does not own. */
export function normalizePreferences(raw) {
  const defaults = defaultPreferences()
  if (!raw) return defaults
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [key, raw[key] === undefined ? defaults[key] : raw[key]]),
  )
}

export function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label ?? String(value ?? '')
}

export function universityForDestination(destination) {
  if (!destination?.Address) return null
  return UNIVERSITIES.find((uni) => destination.Address.includes(uni.postal)) ?? null
}

/** OneMap returns upper-case addresses; render them in title case for display. */
export function formatAddress(address) {
  return (address ?? '').toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase())
}

export function formatCurrency(amount) {
  return `$${Number(amount).toLocaleString('en-SG')}`
}

/** Today's date as YYYY-MM-DD in the user's local time zone (not UTC). */
export function todayIsoDate() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Parses a stored YYYY-MM-DD string as a local date, or null if malformed. */
export function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!match) return null
  const [, y, m, d] = match.map(Number)
  const date = new Date(y, m - 1, d)
  return date.getMonth() === m - 1 && date.getDate() === d ? date : null
}

export function formatMoveInDate(value) {
  const date = parseIsoDate(value)
  return date
    ? date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not set'
}
