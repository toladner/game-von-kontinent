/** Small geodesy helpers. Pure functions, no dependencies. */

export interface LatLon {
  readonly lat: number
  readonly lon: number
}

const R_EARTH_KM = 6371

const rad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Walk a polyline and return `count` interior points spaced evenly by
 * distance. Used to lay the movement pips along a sea lane.
 */
export function sampleAlongPolyline(points: readonly LatLon[], count: number): LatLon[] {
  if (count <= 0) return []
  const segLengths: number[] = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const d = distanceKm(points[i]!, points[i + 1]!)
    segLengths.push(d)
    total += d
  }
  if (total === 0) return []

  const out: LatLon[] = []
  for (let k = 1; k <= count; k++) {
    let target = (total * k) / (count + 1)
    let seg = 0
    while (seg < segLengths.length - 1 && target > segLengths[seg]!) {
      target -= segLengths[seg]!
      seg++
    }
    const len = segLengths[seg]!
    const t = len === 0 ? 0 : target / len
    const from = points[seg]!
    const to = points[seg + 1]!
    out.push({
      lat: from.lat + (to.lat - from.lat) * t,
      lon: from.lon + (to.lon - from.lon) * t,
    })
  }
  return out
}

/** Equirectangular projection into an arbitrary drawing box. */
export function project(
  p: LatLon,
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  size: { width: number; height: number },
): { x: number; y: number } {
  const x = ((p.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * size.width
  const y = ((bounds.maxLat - p.lat) / (bounds.maxLat - bounds.minLat)) * size.height
  return { x, y }
}
