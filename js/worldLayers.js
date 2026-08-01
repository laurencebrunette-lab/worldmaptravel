/**
 * Country choropleth + bilingual country/city labels.
 *
 * Country geometry/coloring comes from a vendored Natural Earth topojson
 * (data/countries-topo.js) joined with English/native names from
 * data/countryNames.js (derived from the mledoze/countries dataset, ODbL —
 * see README). City labels come from a hand-curated list in data/cities.js.
 *
 * Labels are hidden by default and fade in either on hover, or permanently
 * once the map is zoomed past a per-country/per-city threshold (bigger
 * countries/cities appear sooner), to keep the world view uncluttered.
 */

function initWorldLayers(map, { onCityClick }) {
  const labelLayer = L.layerGroup().addTo(map);
  const geoLabels = []; // { marker, minZoom }

  const TIER_MIN_ZOOM = { 1: 0, 2: 4, 3: 6 };

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function hashHue(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  function hsl(hue, s, l) {
    return `hsl(${hue}, ${s}%, ${l}%)`;
  }

  function areaTier(area) {
    if (area == null) return 3;
    if (area > 1500000) return 1;
    if (area > 250000) return 2;
    return 3;
  }

  function ringBBoxArea(ring) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return (maxX - minX) * (maxY - minY);
  }

  function ringCentroid(ring) {
    let sx = 0, sy = 0;
    for (const [x, y] of ring) {
      sx += x;
      sy += y;
    }
    return [sy / ring.length, sx / ring.length]; // [lat, lng]
  }

  function geometryLabelPoint(geometry) {
    if (!geometry) return null;
    if (geometry.type === "Polygon") return ringCentroid(geometry.coordinates[0]);
    if (geometry.type === "MultiPolygon") {
      let best = null, bestArea = -1;
      for (const poly of geometry.coordinates) {
        const area = ringBBoxArea(poly[0]);
        if (area > bestArea) {
          bestArea = area;
          best = poly[0];
        }
      }
      return best ? ringCentroid(best) : null;
    }
    return null;
  }

  function registerLabel(marker, minZoom) {
    geoLabels.push({ marker, minZoom });
  }

  function updateLabelVisibility() {
    const zoom = map.getZoom();
    geoLabels.forEach(({ marker, minZoom }) => {
      const el = marker.getElement();
      if (el) el.classList.toggle("zoom-visible", zoom >= minZoom);
    });
  }
  map.on("zoomend", updateLabelVisibility);

  function makeLabelMarker(latlng, className, innerHtml, interactive) {
    const icon = L.divIcon({
      className,
      html: `<div class="geo-label-inner">${innerHtml}</div>`,
      iconSize: null,
    });
    return L.marker(latlng, { icon, interactive: !!interactive, keyboard: false }).addTo(labelLayer);
  }

  function renderCountries() {
    const topo = window.__COUNTRIES_TOPOJSON__;
    const names = window.__COUNTRY_NAMES__ || {};
    if (!topo || typeof topojson === "undefined") return;

    const geo = topojson.feature(topo, topo.objects.countries);
    const countryLabelMarkers = {};

    L.geoJSON(geo, {
      style: (feature) => {
        const info = names[feature.id];
        const hue = info ? info.hue : hashHue(feature.properties.name || String(feature.id));
        return {
          fillColor: hsl(hue, 55, 45),
          color: hsl(hue, 45, 22),
          weight: 1,
          opacity: 0.75,
          fillOpacity: 0.4,
        };
      },
      onEachFeature: (feature, layer) => {
        const info = names[feature.id];
        const en = (info && info.en) || feature.properties.name;
        const native = info && info.native;
        const tier = areaTier(info && info.area);

        const point = geometryLabelPoint(feature.geometry);
        if (point) {
          const html =
            `<span class="label-en">${escapeHtml(en)}</span>` +
            (native ? `<span class="label-native">${escapeHtml(native)}</span>` : "");
          const marker = makeLabelMarker(point, "geo-label-country", html, false);
          registerLabel(marker, TIER_MIN_ZOOM[tier]);
          countryLabelMarkers[feature.id] = marker;
        }

        layer.on("mouseover", () => {
          layer.setStyle({ fillOpacity: 0.68 });
          const el = countryLabelMarkers[feature.id] && countryLabelMarkers[feature.id].getElement();
          if (el) el.classList.add("hover-visible");
        });
        layer.on("mouseout", () => {
          layer.setStyle({ fillOpacity: 0.4 });
          const el = countryLabelMarkers[feature.id] && countryLabelMarkers[feature.id].getElement();
          if (el) el.classList.remove("hover-visible");
        });
      },
    }).addTo(map);
  }

  function renderCities() {
    const cities = window.__CITIES__ || [];
    cities.forEach((city) => {
      const minZoom = TIER_MIN_ZOOM[city.tier] != null ? TIER_MIN_ZOOM[city.tier] : 6;
      const html =
        `<span class="label-dot"></span><span class="label-text">` +
        `<span class="label-en">${escapeHtml(city.name)}</span>` +
        (city.native ? `<span class="label-native">${escapeHtml(city.native)}</span>` : "") +
        `</span>`;
      const marker = makeLabelMarker([city.lat, city.lng], "geo-label-city", html, true);
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (onCityClick) onCityClick(city);
      });
      registerLabel(marker, minZoom);
    });
  }

  renderCountries();
  renderCities();
  updateLabelVisibility();
}
