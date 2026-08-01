/**
 * Thin wrapper around OpenStreetMap's Nominatim API for:
 *  - forward search (city name -> coordinates), used by the search box
 *  - reverse geocoding (coordinates -> place name), used when clicking the map
 *
 * Nominatim is free and requires no API key, but its usage policy asks for
 * at most ~1 request/second and a descriptive User-Agent/Referer, which the
 * browser sets automatically. Good enough for a personal trip-planning tool.
 */

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

async function searchPlaces(query) {
  if (!query || query.trim().length < 2) return [];

  const url = `${NOMINATIM_BASE}/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(
    query
  )}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();

  return data.map((item) => ({
    name: shortPlaceName(item),
    detail: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
}

async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=${lat}&lon=${lng}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Reverse geocode failed (${res.status})`);
  const data = await res.json();

  if (!data || data.error) {
    return { name: `${lat.toFixed(2)}, ${lng.toFixed(2)}`, lat, lng };
  }

  return { name: shortPlaceName(data), lat, lng };
}

function shortPlaceName(item) {
  const addr = item.address || {};
  const city =
    addr.city || addr.town || addr.village || addr.municipality || addr.county;
  const country = addr.country;

  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (item.name) return item.name;
  return item.display_name ? item.display_name.split(",")[0] : "Unknown place";
}
