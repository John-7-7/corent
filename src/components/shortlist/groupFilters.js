/**
 * The group's agreed search filters, read from Group_Preferences, in the form
 * the What-if slider and the Decision funnel share. Read-only: nothing here
 * writes, and the match % itself stays in services/listingScoring.js.
 */

const toNumber = (value) => {
  const n = Number(value)
  return value === null || value === undefined || value === '' || !Number.isFinite(n) ? null : n
}

/** People splitting the rent: the agreed household size, else the member count. */
export function householdSize(groupPref, memberCount = 1) {
  return toNumber(groupPref?.HouseholdSize) || Math.max(memberCount, 1)
}

/**
 * The agreed budget per person, or null when the group has not agreed one.
 * Mirrors listingScoring's order: an explicit per-person cap first, then the
 * monthly ceiling divided by the household.
 */
export function agreedPerPersonBudget(groupPref, memberCount = 1) {
  const perPerson = toNumber(groupPref?.BudgetPerPersonMax)
  if (perPerson) return perPerson
  const monthly = toNumber(groupPref?.MonthlyRentMax)
  return monthly ? monthly / householdSize(groupPref, memberCount) : null
}

/**
 * True when a listing passes the group's agreed type, regions and bedrooms.
 * Anything the group has not agreed on, or the listing does not state, passes:
 * missing data is not a mismatch (the same rule the match % follows).
 */
export function matchesAgreedFilters(listing, groupPref) {
  if (!groupPref) return true
  const type = groupPref.PropertyType
  if (type && type !== 'Any' && listing.PropertyType && listing.PropertyType !== type) return false

  const regions = groupPref.PreferredRegions || []
  if (regions.length && listing.Region && !regions.includes(listing.Region)) return false

  const beds = toNumber(listing.Bedrooms)
  if (beds !== null && beds > 0) {
    const min = toNumber(groupPref.BedroomsMin)
    const max = toNumber(groupPref.BedroomsMax)
    if (min && beds < min) return false
    if (max && beds > max) return false
  }
  return true
}

/** Each person's share of a listing's rent. */
export const shareOf = (listing, people) => Number(listing.MonthlyRent) / Math.max(people, 1)

export const money = (value) =>
  `$${Math.round(Number(value) || 0).toLocaleString('en-SG')}`
