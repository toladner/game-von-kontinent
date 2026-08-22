/**
 * Bakes Natural Earth (public domain, via world-atlas) into a small
 * continent-tagged GeoJSON the board renderer can paint directly.
 *
 * Run: node scripts/build-land.mjs
 *
 * Output: src/content/geo/land.json
 *
 * Doing this at build time keeps topojson out of the shipped bundle and makes
 * the landmasses just another content file - swap it to change the world.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { merge } from 'topojson-client'

const require = createRequire(import.meta.url)
const topo = require('world-atlas/countries-110m.json')

const CONTINENTS = {
  europa: [
    'Albania', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herz.', 'Bulgaria',
    'Croatia', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany',
    'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Kosovo', 'Latvia',
    'Lithuania', 'Luxembourg', 'Macedonia', 'Moldova', 'Montenegro',
    'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania', 'Russia',
    'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland',
    'Ukraine', 'United Kingdom',
  ],
  afrika: [
    'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi',
    'Cameroon', 'Central African Rep.', 'Chad', 'Congo', "Côte d'Ivoire",
    'Dem. Rep. Congo', 'Djibouti', 'Egypt', 'Eq. Guinea', 'Eritrea',
    'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau',
    'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali',
    'Mauritania', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria',
    'Rwanda', 'S. Sudan', 'Senegal', 'Sierra Leone', 'Somalia', 'Somaliland',
    'South Africa', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda',
    'W. Sahara', 'Zambia', 'Zimbabwe', 'eSwatini',
  ],
  nordamerika: [
    'Bahamas', 'Belize', 'Canada', 'Costa Rica', 'Cuba', 'Dominican Rep.',
    'El Salvador', 'Greenland', 'Guatemala', 'Haiti', 'Honduras', 'Jamaica',
    'Mexico', 'Nicaragua', 'Panama', 'Puerto Rico', 'Trinidad and Tobago',
    'United States of America',
  ],
  suedamerika: [
    'Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador',
    'Falkland Is.', 'Guyana', 'Paraguay', 'Peru', 'Suriname', 'Uruguay',
    'Venezuela',
  ],
  asien: [
    'Afghanistan', 'Armenia', 'Azerbaijan', 'Bangladesh', 'Bhutan', 'Brunei',
    'Cambodia', 'China', 'Cyprus', 'Georgia', 'India', 'Indonesia', 'Iran',
    'Iraq', 'Israel', 'Japan', 'Jordan', 'Kazakhstan', 'Kuwait', 'Kyrgyzstan',
    'Laos', 'Lebanon', 'Malaysia', 'Mongolia', 'Myanmar', 'N. Cyprus',
    'Nepal', 'North Korea', 'Oman', 'Pakistan', 'Palestine', 'Philippines',
    'Qatar', 'Saudi Arabia', 'South Korea', 'Sri Lanka', 'Syria', 'Taiwan',
    'Tajikistan', 'Thailand', 'Timor-Leste', 'Turkey', 'Turkmenistan',
    'United Arab Emirates', 'Uzbekistan', 'Vietnam', 'Yemen',
  ],
  ozeanien: [
    'Australia', 'Fiji', 'New Caledonia', 'New Zealand', 'Papua New Guinea',
    'Solomon Is.', 'Vanuatu',
  ],
}

const lookup = new Map()
for (const [continent, names] of Object.entries(CONTINENTS)) {
  for (const name of names) lookup.set(name, continent)
}

const skipped = []
const buckets = new Map()
for (const geom of topo.objects.countries.geometries) {
  const name = geom.properties?.name
  const continent = lookup.get(name)
  if (!continent) {
    skipped.push(name)
    continue
  }
  const list = buckets.get(continent) ?? []
  list.push(geom)
  buckets.set(continent, list)
}

/** Drop tiny islands and round coordinates - the board is not a sea chart. */
const round = (n) => Math.round(n * 100) / 100

function ringArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  }
  return Math.abs(a / 2)
}

const MIN_AREA = 0.6 // square degrees

const features = []
for (const [continent, geometries] of buckets) {
  const merged = merge(topo, geometries)
  const polygons = (merged.type === 'MultiPolygon' ? merged.coordinates : [merged.coordinates])
    .filter((poly) => ringArea(poly[0]) >= MIN_AREA)
    .map((poly) =>
      poly
        .filter((ring) => ringArea(ring) >= MIN_AREA / 4)
        .map((ring) => ring.map(([x, y]) => [round(x), round(y)])),
    )
    .filter((poly) => poly.length > 0)

  features.push({ continent, polygons })
}

features.sort((a, b) => a.continent.localeCompare(b.continent))

mkdirSync('src/content/geo', { recursive: true })
const out = { source: 'Natural Earth 1:110m via world-atlas (public domain)', features }
writeFileSync('src/content/geo/land.json', JSON.stringify(out))

const bytes = readFileSync('src/content/geo/land.json').length
console.log(
  `wrote src/content/geo/land.json (${(bytes / 1024).toFixed(0)} kB), ` +
    `${features.map((f) => `${f.continent}:${f.polygons.length}`).join(' ')}`,
)
if (skipped.length) console.log(`skipped: ${skipped.join(', ')}`)
