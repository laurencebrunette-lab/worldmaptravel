# World Travel Cost Map

An interactive world map for planning multi-city trips. Click cities on the
map (or search for them), and the app estimates plane / train / bus / taxi /
ferry costs (in €) between each stop, adding them into a running trip total.

## How it works

- **Map & search** use [OpenStreetMap](https://www.openstreetmap.org/) tiles
  and the free [Nominatim](https://nominatim.org/) geocoding API (no API key
  required) to turn map clicks or search text into city names/coordinates.
- **Cost estimates** are computed client-side from the great-circle distance
  between two cities using a per-mode base-fee + price-per-km model (see
  `js/costModel.js`). There is no live fare API wired in — real flight/train/
  bus pricing requires paid providers (Amadeus, Skyscanner, Rome2Rio, etc.).
  The numbers here are meant for ballpark trip budgeting, not booking.
- Each leg between two consecutive cities lets you pick which mode of
  transport to count toward the trip total (the cheapest available mode is
  selected by default). A mode is only offered if the distance is within a
  plausible range for it (e.g. no taxi across 3,000 km). Ferry is offered by
  distance too, same as the other modes — there's no data on which specific
  city pairs actually have a water crossing, so pick it manually when you
  know a route is a ferry route (e.g. island hops).
- **Countries are color-coded** with a vendored Natural Earth boundary
  dataset, and both **countries and major cities show a bilingual label**
  (English on top, local-language name below). Labels stay hidden by
  default and fade in on hover, or permanently once you zoom in enough —
  bigger countries/cities appear sooner — to keep the world view readable.
  Clicking a city's dot/label adds it straight to the trip (no geocoding
  round-trip needed); any other spot on the map still works via click +
  reverse geocoding as before.

## Usage

Just open `index.html` in a browser, or serve the folder statically:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

1. Click anywhere on the map, or use the search box, to add your first city.
2. Add a second city — a "leg" appears in the sidebar with a short
   "Estimating fares…" delay, then shows estimated costs per mode.
3. Keep adding cities; each new leg's cost is added to the running total at
   the top of the sidebar.
4. Click a different transport mode on any leg to swap which price counts
   toward the total. Remove a city with the ✕ button or the marker popup.

## Project structure

```
index.html            # layout: map + sidebar
css/style.css          # styling
js/geocode.js          # Nominatim search / reverse geocode helpers
js/costModel.js        # distance calculation + per-mode cost estimation
js/worldLayers.js       # country choropleth + bilingual country/city labels
js/app.js              # map setup, trip state, rendering
data/countries-topo.js  # Natural Earth country boundaries (via world-atlas)
data/countryNames.js    # English/native country names + colors (via world-countries)
data/cities.js          # curated list of ~150 major cities, English + native names
vendor/                # vendored Leaflet + topojson-client + fonts (no CDN dependency)
```

### Data sources & attribution

- Country boundaries: [Natural Earth](https://www.naturalearthdata.com/)
  (public domain), packaged as topojson by the
  [`world-atlas`](https://github.com/topojson/world-atlas) project (ISC).
- English/native country names: derived from the
  [`world-countries`](https://github.com/mledoze/countries) dataset,
  licensed under [ODbL](https://opendatacommons.org/licenses/odbl/) —
  attribution included here per that license.
- City list: hand-curated for this project.
- Fonts: [Quicksand](https://fonts.google.com/specimen/Quicksand) and
  [Nunito](https://fonts.google.com/specimen/Nunito), both OFL-1.1 licensed,
  vendored via `@fontsource`.

## Known limitations

- Country fill colors are assigned by hashing each country's ISO code to a
  hue — visually distinct in most cases, but not a true four-color-map
  algorithm, so a couple of neighbors can occasionally land on similar
  shades.
- Labels don't do collision avoidance, so in a few dense clusters (e.g.
  Western Europe, the Persian Gulf) a country and a city label can overlap
  slightly at low zoom. Zooming in or hovering resolves it.
- The city list is a curated ~200 major hubs (including secondary tourist
  cities, not just capitals/largest cities), not every city on Earth —
  anywhere else can still be added by clicking the map directly or via the
  search box, which uses live geocoding instead.

## Extending with real fares

To swap in live pricing, replace the `setTimeout` estimation step in
`addCity()` (`js/app.js`) with real API calls (flights via an Amadeus/
Skyscanner API, ground transport via Rome2Rio or similar), keeping the same
`{ distanceKm, costs: { plane, train, bus, taxi, ferry } }` shape so the rest
of the UI keeps working unchanged.
