/**
 * Prints the OneMap theme catalogue for your account.
 *
 *   node scripts/onemap-themes.mjs <token>
 *   node scripts/onemap-themes.mjs            (reads VITE_ONEMAP_TOKEN from .env)
 *
 * nearbyAmenitiesService.js matches its wanted categories against these names
 * at runtime rather than hardcoding queryName values, so this script is how
 * you check what is actually available — and which categories are being
 * skipped because nothing matched.
 */
import fs from 'fs'

function tokenFromEnvFile() {
  try {
    const line = fs
      .readFileSync('.env', 'utf8')
      .split('\n')
      .find((l) => l.startsWith('VITE_ONEMAP_TOKEN='))
    return line ? line.slice('VITE_ONEMAP_TOKEN='.length).trim() : null
  } catch {
    return null
  }
}

const token = process.argv[2] || tokenFromEnvFile()
if (!token) {
  console.error('usage: node scripts/onemap-themes.mjs <token>  (or set VITE_ONEMAP_TOKEN in .env)')
  process.exit(1)
}

const response = await fetch(
  'https://www.onemap.gov.sg/api/public/themesvc/getAllThemesInfo',
  { headers: { Authorization: token } },
)
if (!response.ok) {
  console.error(`OneMap returned ${response.status} ${response.statusText}`)
  if (response.status === 401) console.error('The token is expired or wrong.')
  process.exit(1)
}

const payload = await response.json()
const themes = payload.Theme_Names ?? payload.themes ?? []
console.log(`${themes.length} themes\n`)
for (const theme of themes) {
  const queryName = theme.QUERYNAME ?? theme.queryName ?? '?'
  const name = theme.THEMENAME ?? theme.themeName ?? ''
  console.log(`${queryName.padEnd(34)} ${name}`)
}
