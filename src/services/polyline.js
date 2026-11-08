/**
 * Decodes an encoded polyline (Google's algorithm, precision 5) into
 * [[lat, lng], ...]. OneMap's routing returns each leg's path in this format
 * (legGeometry.points). Kept dependency-free: it is twenty lines.
 */
export function decodePolyline(encoded, precision = 5) {
  if (typeof encoded !== 'string' || !encoded) return []
  const factor = 10 ** precision
  const points = []
  let index = 0
  let lat = 0
  let lng = 0

  const next = () => {
    let result = 0
    let shift = 0
    let byte
    do {
      if (index >= encoded.length) return null
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }

  while (index < encoded.length) {
    const dLat = next()
    const dLng = next()
    if (dLat === null || dLng === null) break
    lat += dLat
    lng += dLng
    points.push([lat / factor, lng / factor])
  }
  return points
}
