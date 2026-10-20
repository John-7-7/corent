// OneMap (Singapore Land Authority) public search API. No API key is needed for
// search, but it is rate limited, so results are cached per query.
const ONEMAP_SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search'
const TIMEOUT_MS = 8000

const cache = new Map()

async function fetchFirstResult(query) {
  const params = new URLSearchParams({
    searchVal: query,
    returnGeom: 'Y',
    getAddrDetails: 'Y',
    pageNum: '1',
  })
  const response = await fetch(`${ONEMAP_SEARCH_URL}?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`OneMap search failed (${response.status})`)

  const { results = [] } = await response.json()
  const [match] = results
  if (!match) throw new Error(`No OneMap result for "${query}"`)

  return { Address: match.ADDRESS, Lat: Number(match.LATITUDE), Lng: Number(match.LONGITUDE) }
}

/**
 * Resolves a search term (address, building or postal code) to
 * { Address, Lat, Lng }, matching the CommuteDestination schema.
 */
export function searchAddress(query) {
  const key = query.trim().toUpperCase()
  if (!cache.has(key)) {
    const request = fetchFirstResult(key).catch((error) => {
      cache.delete(key)
      throw error
    })
    cache.set(key, request)
  }
  return cache.get(key)
}
