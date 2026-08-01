/**
 * Manually verified routes.
 *
 * The distance-only cost model (js/costModel.js) can't know whether a train
 * line, ferry crossing, or airport actually exists between two specific
 * cities — it only knows how far apart they are. For routes listed here,
 * that guesswork is replaced with reality: `modes` lists ONLY the transport
 * options that actually exist for this pair, with a price that was checked
 * against a real booking site (not estimated). Any mode not listed is
 * treated as unavailable for that route, overriding the generic distance
 * cutoffs.
 *
 * Matching is by city name (case-insensitive, either direction). Add more
 * entries here as routes get verified.
 */
window.__ROUTE_OVERRIDES__ = [
  {
    cities: ["Siem Reap", "Phnom Penh"],
    modes: { bus: 16 },
    note: "No train service between Siem Reap and Phnom Penh; verified via 12Go.",
  },
  {
    cities: ["Phnom Penh", "Kampot"],
    modes: { bus: 12 },
    note: "Only reachable by bus (no airport in Kampot); verified via 12Go.",
  },
  {
    cities: ["Kampot", "Ha Tien"],
    modes: { bus: 12 },
    note: "Cross-border bus only — no ferry or train on this route; verified via 12Go.",
  },
  {
    cities: ["Ha Tien", "Phu Quoc"],
    modes: { ferry: 10 },
    note: "Phu Quoc is an island — ferry only; verified via 12Go.",
  },
  {
    cities: ["Phu Quoc", "Bali (Denpasar)"],
    modes: { plane: 120 },
    note: "International route — flight only; verified via 12Go.",
  },
];
