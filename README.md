# World Travel Cost Map

An interactive world map for planning multi-city trips. Click cities on the
map (or search for them), and the app estimates plane / train / bus / taxi
costs between each stop, adding them into a running trip total.

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
  plausible range for it (e.g. no taxi across 3,000 km).

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
index.html        # layout: map + sidebar
css/style.css      # styling
js/geocode.js      # Nominatim search / reverse geocode helpers
js/costModel.js     # distance calculation + per-mode cost estimation
js/app.js          # map setup, trip state, rendering
```

## Extending with real fares

To swap in live pricing, replace the `setTimeout` estimation step in
`addCity()` (`js/app.js`) with real API calls (flights via an Amadeus/
Skyscanner API, ground transport via Rome2Rio or similar), keeping the same
`{ distanceKm, costs: { plane, train, bus, taxi } }` shape so the rest of the
UI keeps working unchanged.
