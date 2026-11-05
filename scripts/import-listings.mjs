/**
 * Converts a 99.co aggregator export into the Housing_Listing shape used by
 * src/data/listings.json, and merges it into that file.
 *
 *   node scripts/import-listings.mjs <export.json> [--dry]
 *
 * The export uses camelCase and a different field set, so the mapping is
 * explicit rather than a spread. Two things it deliberately does NOT do:
 * invent values the export does not carry, and pass through sentinels.
 */
import fs from 'fs'
import path from 'path'

const TARGET = path.join(process.cwd(), 'src/data/listings.json')
const [input, ...flags] = process.argv.slice(2)
const dry = flags.includes('--dry')
if (!input) {
  console.error('usage: node scripts/import-listings.mjs <export.json> [--dry]')
  process.exit(1)
}

const PROPERTY_TYPE = { condo: 'Condo', hdb: 'HDB', landed: 'Landed' }

// Amenity tags in the existing corpus are derived, not supplied. Rules read off
// the 200 records already in the file: Near MRT at <=10 min, 2+ bathrooms at
// >=2, Spacious at >=100 sqm, Condo facilities for condos, plus furnishing.
function amenitiesFor(r, areaSqm) {
  const out = []
  if (r.furnishing) out.push(r.furnishing)
  if (Number(r.mrtWalkingMinutes) <= 10) out.push('Near MRT')
  if (Number(r.bathrooms) >= 2) out.push('2+ bathrooms')
  if (Number(areaSqm) >= 100) out.push('Spacious (100+ sqm)')
  if (PROPERTY_TYPE[r.propertyType] === 'Condo') out.push('Condo facilities')
  return out
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function convert(r, fetchedAt) {
  // The export uses -1 for "bedrooms unknown". Passing that through would make
  // every such listing look like a huge shortfall against the group's minimum
  // instead of insufficient data, so it becomes null.
  const bedrooms = num(r.bedrooms) !== null && r.bedrooms >= 0 ? r.bedrooms : null

  // Smallest real area in the existing corpus is 11 sqm; anything under 10 is
  // a bad row, and a 1 sqm flat would wreck the rent-per-sqm comparison.
  const areaRaw = num(r.areaSqm)
  const areaSqm = areaRaw !== null && areaRaw >= 10 ? areaRaw : null

  const postal = /(\d{6})\s*$/.exec(r.address || '')

  return {
    ListingID: r.id,
    Title: r.title,
    ImageURL: r.photo ?? null,
    Address: r.address ?? null,
    PostalCode: postal ? postal[1] : null,
    Coordinates: num(r.lat) !== null && num(r.lng) !== null ? { lat: r.lat, lng: r.lng } : null,
    MonthlyRent: num(r.monthlyRent),
    PropertyType: PROPERTY_TYPE[r.propertyType] ?? null,
    Bedrooms: bedrooms,
    AvailableDate: null, // the export carries no availability date
    Amenities: amenitiesFor(r, areaSqm),
    OriginalSourceURL: null,
    IsAvailable: true,
    Neighbourhood: r.neighbourhood ?? null,
    Region: r.region ?? null,
    Bathrooms: num(r.bathrooms),
    AreaSqm: areaSqm,
    NearestMrt: r.nearestMrt ?? null,
    MrtWalkingMinutes: num(r.mrtWalkingMinutes),
    FetchedAt: fetchedAt,
  }
}

const raw = JSON.parse(fs.readFileSync(input, 'utf8'))
const source = Array.isArray(raw) ? raw : raw.listings || raw.data || []
const existing = JSON.parse(fs.readFileSync(TARGET, 'utf8'))
const seen = new Set(existing.map((l) => l.ListingID))
const fetchedAt = new Date().toISOString()

const skipped = { notRent: 0, mock: 0, duplicate: 0, noId: 0, noRent: 0, noCoords: 0 }
const added = []

for (const r of source) {
  if (!r.id) { skipped.noId++; continue }
  if (r.dealType && r.dealType !== 'rent') { skipped.notRent++; continue }
  if (r.isMockData === true) { skipped.mock++; continue }
  if (seen.has(r.id)) { skipped.duplicate++; continue }
  const rec = convert(r, fetchedAt)
  if (rec.MonthlyRent === null) { skipped.noRent++; continue }
  if (!rec.Coordinates) { skipped.noCoords++; continue }
  seen.add(r.id)
  added.push(rec)
}

const merged = [...existing, ...added]
console.log(`read      ${source.length} from ${path.basename(input)}`)
console.log(`existing  ${existing.length}`)
console.log(`added     ${added.length}`)
console.log('skipped  ', Object.entries(skipped).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join(' ') || 'none')
console.log(`total     ${merged.length}`)

const nulls = (f) => added.filter((r) => r[f] == null).length
console.log(`\nnulls in added: Bedrooms=${nulls('Bedrooms')} AreaSqm=${nulls('AreaSqm')} PostalCode=${nulls('PostalCode')}`)

if (dry) { console.log('\n--dry: nothing written'); process.exit(0) }
fs.writeFileSync(TARGET, JSON.stringify(merged, null, 2) + '\n')
console.log(`\nwrote ${TARGET}`)
