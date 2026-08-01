/**
 * Distance + travel-cost estimation model.
 *
 * There is no free "live fare" API for flights/trains/buses, so costs here
 * are approximated from typical global fare curves (a base/boarding fee
 * plus a per-km rate). They're meant for ballpark trip-budgeting, not
 * booking. Feasibility cutoffs (e.g. no taxi across an ocean) are also
 * distance-based approximations and don't know about actual geography
 * (coastlines, borders, rail networks).
 */

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineDistanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

const MODES = {
  plane: {
    label: "Flight",
    icon: "✈️",
    minKm: 80,
    maxKm: Infinity,
    baseFee: 55,
    perKm: 0.11,
    // long-haul fares taper off per-km a bit
    tail: (km) => (km > 4000 ? -0.02 * (km - 4000) : 0),
  },
  train: {
    label: "Train",
    icon: "🚆",
    minKm: 0,
    maxKm: 2500,
    baseFee: 8,
    perKm: 0.09,
    tail: () => 0,
  },
  bus: {
    label: "Bus",
    icon: "🚌",
    minKm: 0,
    maxKm: 1500,
    baseFee: 5,
    perKm: 0.055,
    tail: () => 0,
  },
  taxi: {
    label: "Taxi / car",
    icon: "🚕",
    minKm: 0,
    maxKm: 200,
    baseFee: 6,
    perKm: 0.95,
    tail: () => 0,
  },
};

function estimateModeCost(mode, distanceKm) {
  const cfg = MODES[mode];
  if (distanceKm < cfg.minKm || distanceKm > cfg.maxKm) return null;
  const raw = cfg.baseFee + distanceKm * cfg.perKm + cfg.tail(distanceKm);
  return Math.max(cfg.baseFee, Math.round(raw));
}

function estimateLegCosts(cityA, cityB) {
  const distanceKm = haversineDistanceKm(cityA, cityB);
  const costs = {};
  for (const mode of Object.keys(MODES)) {
    costs[mode] = estimateModeCost(mode, distanceKm);
  }
  return { distanceKm, costs };
}

function cheapestAvailableMode(costs) {
  let best = null;
  for (const [mode, price] of Object.entries(costs)) {
    if (price == null) continue;
    if (!best || price < costs[best]) best = mode;
  }
  return best;
}
