import stations from '@/data/mrtStations.json'
import { haversineKm } from './geo'

/**
 * A public-transport route estimated from the MRT and LRT network, for when
 * OneMap's routing is unavailable (no token, expired token, offline).
 *
 * Walk to a station, ride the rail network (changing lines where needed),
 * walk to the destination. Station positions and line codes come from OneMap's
 * public search (src/data/mrtStations.json), and the path follows the stations
 * in line order, so it traces the real lines rather than a straight line. Bus
 * routes need OneMap and are not estimated. Always labelled as an estimate.
 */

const WALK_KM_PER_MIN = 0.075 // 4.5 km/h
const WALK_DETOUR = 1.25 // streets are not straight lines
const MRT_KM_PER_MIN = 0.55 // about 33 km/h between stations, stops included
const LRT_KM_PER_MIN = 0.4
const DWELL_MIN = 0.5
const TRANSFER_MIN = 4
const WAIT_MIN = 4
const LRT_LINES = new Set(['BP', 'SE', 'SW', 'PE', 'PW'])

export const LINE_NAMES = {
  NS: 'North-South Line',
  EW: 'East-West Line',
  CG: 'East-West Line (Changi Airport)',
  NE: 'North East Line',
  CC: 'Circle Line',
  CE: 'Circle Line',
  DT: 'Downtown Line',
  TE: 'Thomson-East Coast Line',
  BP: 'Bukit Panjang LRT',
  SE: 'Sengkang LRT',
  SW: 'Sengkang LRT',
  PE: 'Punggol LRT',
  PW: 'Punggol LRT',
}

const point = (station) => ({ lat: station.lat, lng: station.lng })
const parse = (code) => {
  const match = /^([A-Z]+)(\d*)$/.exec(code)
  return match ? { line: match[1], num: Number(match[2] || 0) } : null
}

/* ---------------- network ---------------- */

let graph = null

function buildGraph() {
  const edges = stations.map(() => [])
  const link = (a, b, line) => {
    if (a === b || a < 0 || b < 0) return
    edges[a].push({ to: b, line })
    edges[b].push({ to: a, line })
  }
  const byCode = new Map()
  const lines = new Map()
  stations.forEach((station, index) => {
    for (const code of station.codes) {
      byCode.set(code, index)
      const parsed = parse(code)
      if (!parsed || parsed.line === 'STC' || parsed.line === 'PTC') continue
      if (!lines.has(parsed.line)) lines.set(parsed.line, [])
      lines.get(parsed.line).push({ index, num: parsed.num })
    }
  })
  // Neighbouring stations on each line, in code order.
  for (const [line, list] of lines) {
    list.sort((a, b) => a.num - b.num)
    for (let i = 1; i < list.length; i++) link(list[i - 1].index, list[i].index, line)
  }
  const at = (code) => byCode.get(code) ?? -1
  // Branches and loops that code order alone does not join up.
  link(at('EW4'), at('CG1'), 'CG') // Tanah Merah to Expo
  link(at('CC34'), at('CC4'), 'CC') // Bayfront to Promenade
  link(at('BP13'), at('BP6'), 'BP') // Bukit Panjang loop
  for (const [hub, loops] of [
    ['STC', [['SE', 1, 5], ['SW', 1, 8]]],
    ['PTC', [['PE', 1, 7], ['PW', 1, 7]]],
  ]) {
    for (const [line, first, last] of loops) {
      link(at(hub), at(`${line}${first}`), line)
      link(at(hub), at(`${line}${last}`), line)
    }
  }
  // Stations next to each other (Sengkang MRT and LRT, interchanges listed
  // twice) are a short walk apart.
  for (let a = 0; a < stations.length; a++) {
    for (let b = a + 1; b < stations.length; b++) {
      if (haversineKm(point(stations[a]), point(stations[b])) < 0.2) link(a, b, 'TRANSFER')
    }
  }
  return edges
}

function rideMinutes(a, b, line) {
  const km = haversineKm(point(stations[a]), point(stations[b]))
  if (line === 'TRANSFER') return Math.max(km / WALK_KM_PER_MIN, 2)
  return km / (LRT_LINES.has(line) ? LRT_KM_PER_MIN : MRT_KM_PER_MIN) + DWELL_MIN
}

/** Fastest ride between two stations; changing line costs TRANSFER_MIN. */
function shortestRide(from, to) {
  graph ??= buildGraph()
  const key = (index, line) => `${index}|${line}`
  const best = new Map([[key(from, ''), 0]])
  const previous = new Map()
  const queue = [{ index: from, line: '', cost: 0 }]
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost)
    const current = queue.shift()
    if (current.cost > (best.get(key(current.index, current.line)) ?? Infinity)) continue
    if (current.index === to) {
      const path = []
      let state = key(current.index, current.line)
      while (previous.has(state)) {
        const step = previous.get(state)
        path.unshift({ from: step.from, to: Number(state.split('|')[0]), line: state.split('|')[1] })
        state = step.state
      }
      return { minutes: current.cost, path }
    }
    for (const edge of graph[current.index]) {
      const change = current.line && edge.line !== current.line && edge.line !== 'TRANSFER' && current.line !== 'TRANSFER'
      const cost = current.cost + rideMinutes(current.index, edge.to, edge.line) + (change ? TRANSFER_MIN : 0)
      const next = key(edge.to, edge.line)
      if (cost < (best.get(next) ?? Infinity)) {
        best.set(next, cost)
        previous.set(next, { state: key(current.index, current.line), from: current.index })
        queue.push({ index: edge.to, line: edge.line, cost })
      }
    }
  }
  return null
}

/* ---------------- route ---------------- */

const walkMinutes = (a, b) => (haversineKm(a, b) * WALK_DETOUR) / WALK_KM_PER_MIN

function nearestStations(target, count = 3) {
  return stations
    .map((station, index) => ({ index, km: haversineKm(target, point(station)) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, count)
    .map((entry) => entry.index)
}

function stationNamed(name) {
  if (!name) return -1
  const wanted = String(name).trim().toLowerCase()
  return stations.findIndex((station) => station.name.toLowerCase() === wanted)
}

/**
 * @param {{lat:number,lng:number}} from  e.g. the listing
 * @param {{lat:number,lng:number}} to    e.g. a member's destination
 * @param {string} [nearestMrtName]       the listing's NearestMrt, when known
 * @returns {{ minutes:number, legs:Array<{mode, route, label, minutes, points}> } | null}
 */
export function estimateTransitRoute(from, to, nearestMrtName = '') {
  if (!from?.lat || !to?.lat) return null
  const walkOnly = walkMinutes(from, to)

  const starts = [...new Set([stationNamed(nearestMrtName), ...nearestStations(from)].filter((i) => i >= 0))]
  const ends = nearestStations(to)

  let best = null
  for (const start of starts) {
    for (const end of ends) {
      if (start === end) continue
      const ride = shortestRide(start, end)
      if (!ride) continue
      const total =
        walkMinutes(from, point(stations[start])) + WAIT_MIN + ride.minutes + walkMinutes(point(stations[end]), to)
      if (!best || total < best.total) best = { total, start, end, ride }
    }
  }

  // Close enough to walk, or no rail route at all.
  if (!best || walkOnly <= best.total) {
    return {
      minutes: Math.round(walkOnly),
      legs: [{ mode: 'WALK', route: null, label: 'Walk', minutes: Math.round(walkOnly), points: [[from.lat, from.lng], [to.lat, to.lng]] }],
    }
  }

  const legs = []
  const first = point(stations[best.start])
  legs.push({
    mode: 'WALK',
    route: null,
    label: 'Walk',
    minutes: Math.round(walkMinutes(from, first)),
    points: [[from.lat, from.lng], [first.lat, first.lng]],
  })
  // Merge consecutive steps on the same line into one leg.
  for (const step of best.ride.path) {
    const last = legs[legs.length - 1]
    const minutes = rideMinutes(step.from, step.to, step.line)
    const target = stations[step.to]
    if (last.route === step.line && last.mode !== 'WALK') {
      last.points.push([target.lat, target.lng])
      last.minutes += minutes
      last.stops += 1
      continue
    }
    const origin = stations[step.from]
    if (step.line === 'TRANSFER') {
      legs.push({ mode: 'WALK', route: null, label: 'Walk', minutes, points: [[origin.lat, origin.lng], [target.lat, target.lng]] })
    } else {
      legs.push({
        mode: LRT_LINES.has(step.line) ? 'TRAM' : 'SUBWAY',
        route: step.line,
        lineName: LINE_NAMES[step.line] ?? step.line,
        from: origin.name,
        minutes,
        stops: 1,
        points: [[origin.lat, origin.lng], [target.lat, target.lng]],
      })
    }
  }
  const end = point(stations[best.end])
  legs.push({
    mode: 'WALK',
    route: null,
    label: 'Walk',
    minutes: Math.round(walkMinutes(end, to)),
    points: [[end.lat, end.lng], [to.lat, to.lng]],
  })
  legs.forEach((leg) => {
    leg.minutes = Math.max(Math.round(leg.minutes), 1)
  })
  return { minutes: Math.round(best.total), legs }
}
