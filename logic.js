/* =============================================================================
   Smart Stadium Ops — SHARED LOGIC MODULE
   -----------------------------------------------------------------------------
   Pure, dependency-free business-logic functions used by both index.html
   (the live app) and tests.html (the automated test suite).

   Why this file exists:
   Originally every one of these functions lived inline inside index.html's
   single <script> tag, mixed in with DOM rendering code. That made the app
   100% untestable — there was no way to check "does shortestPath() actually
   find the shortest path?" without spinning up a whole browser DOM.
   Pulling the pure calculation/formatting logic out into this plain,
   global-scope file means:
     1. It can be loaded by tests.html and exercised directly, with no DOM.
     2. index.html still loads it with a plain <script src="logic.js"></script>
        (no build step, no bundler — keeps the "single deployable folder,
        works offline" property of the original submission).
     3. Each function documents its contract (inputs/outputs) once, instead
        of being implicitly defined by wherever it happened to be called.

   No function in this file touches document, window.localStorage, network,
   or any other browser-only API — that's what keeps them unit-testable.
   ============================================================================= */

/**
 * Escape special HTML characters so untrusted strings (chat input, lost &
 * found descriptions, feedback comments, etc.) can be safely interpolated
 * into innerHTML without introducing an XSS vulnerability.
 * @param {*} str - any value; will be coerced to a string first.
 * @returns {string} HTML-safe string.
 */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/**
 * Very small keyword-based intent classifier for the AI Concierge chat.
 * @param {string} message - raw user message.
 * @param {Object.<string,string[]>} intentKeywords - map of intent -> keyword list.
 * @returns {string} the matched intent key, or "fallback" if nothing matched.
 */
function detectIntent(message, intentKeywords) {
  const lower = String(message).toLowerCase();
  for (const [intent, keywords] of Object.entries(intentKeywords)) {
    if (keywords.some((k) => lower.includes(k.toLowerCase()))) return intent;
  }
  return "fallback";
}

/** Color token for a given occupancy percentage (crowd heatmap). */
function densityColor(pct) {
  if (pct >= 95) return "var(--red)";
  if (pct >= 85) return "var(--amber)";
  return "var(--turf)";
}

/** CSS status class for a given occupancy percentage. */
function densityClass(pct) {
  if (pct >= 95) return "crit";
  if (pct >= 85) return "warn";
  return "";
}

/**
 * Rough estimated queueing wait time, derived from occupancy percentage.
 * Below 50% occupancy the estimate floors at 0 minutes.
 */
function estWaitMinutes(pct) {
  return Math.max(0, Math.round((pct - 50) / 5));
}

/** Locale-formatted HH:MM from an ISO timestamp. */
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Format a (possibly negative) number of seconds as +/-MM:SS. */
function fmtClock(sec) {
  const neg = sec < 0;
  const abs = Math.abs(Math.round(sec));
  const m = Math.floor(abs / 60), s = abs % 60;
  return `${neg ? "-" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Scale a base (seed) capacity number proportionally to the selected stadium. */
function scaledCapacity(baseCapacity, stadiumCapacity, baseTotalCapacity) {
  return Math.round(baseCapacity * (stadiumCapacity / baseTotalCapacity));
}

/** Gate zone with the lowest occupancy percentage. */
function leastCrowded(zs) {
  return zs.filter((z) => z.type === "gate").slice().sort((a, b) => a.densityPct - b.densityPct)[0];
}

/** Gate zone with the highest occupancy percentage. */
function mostCrowded(zs) {
  return zs.filter((z) => z.type === "gate").slice().sort((a, b) => b.densityPct - a.densityPct)[0];
}

/**
 * Build an undirected adjacency list from an edge list.
 * @param {string[]} nodes - every node name in the graph.
 * @param {Array<[string,string,number,boolean]>} edges - [from, to, distanceMeters, accessible].
 * @param {boolean} accessibleOnly - if true, exclude edges flagged as not step-free.
 */
function buildAdjacency(nodes, edges, accessibleOnly) {
  const adj = new Map(nodes.map((n) => [n, []]));
  for (const [a, b, dist, accessible] of edges) {
    if (accessibleOnly && !accessible) continue;
    // Defensively skip edges referencing a node outside the known node list,
    // rather than throwing — a malformed data entry shouldn't crash routing.
    if (!adj.has(a) || !adj.has(b)) continue;
    adj.get(a).push({ to: b, dist });
    adj.get(b).push({ to: a, dist });
  }
  return adj;
}

/**
 * Dijkstra's shortest path between two named nodes in the venue graph.
 * @returns {{error:string}|{from:string,to:string,accessible:boolean,steps:string[],distanceMeters:number,etaMinutes:number}}
 */
function shortestPath(nodes, edges, from, to, { accessible = false } = {}) {
  if (!nodes.includes(from) || !nodes.includes(to)) return { error: "Unknown location." };
  const adj = buildAdjacency(nodes, edges, accessible);
  const dist = new Map(nodes.map((n) => [n, Infinity]));
  const prev = new Map();
  const visited = new Set();
  dist.set(from, 0);
  while (visited.size < nodes.length) {
    let current = null, best = Infinity;
    for (const n of nodes) { if (!visited.has(n) && dist.get(n) < best) { best = dist.get(n); current = n; } }
    if (current === null) break;
    visited.add(current);
    if (current === to) break;
    for (const edge of adj.get(current)) {
      const alt = dist.get(current) + edge.dist;
      if (alt < dist.get(edge.to)) { dist.set(edge.to, alt); prev.set(edge.to, current); }
    }
  }
  if (dist.get(to) === Infinity) {
    return { error: accessible ? `No step-free route found between ${from} and ${to}.` : `No route found between ${from} and ${to}.` };
  }
  const path = [to]; let cur = to;
  while (cur !== from) { cur = prev.get(cur); path.unshift(cur); }
  const totalMeters = dist.get(to);
  return { from, to, accessible, steps: path, distanceMeters: totalMeters, etaMinutes: Math.max(1, Math.round(totalMeters / 80)) };
}

// Expose everything as plain globals (this file is a classic <script>, not a
// module) AND as a namespaced object, so both index.html's existing call
// style (`escapeHtml(x)`) and tests.html's explicit style
// (`StadiumLogic.escapeHtml(x)`) work without any further changes.
const StadiumLogic = {
  escapeHtml, detectIntent, densityColor, densityClass, estWaitMinutes,
  fmtTime, fmtClock, scaledCapacity, leastCrowded, mostCrowded,
  buildAdjacency, shortestPath
};
if (typeof module !== "undefined" && module.exports) module.exports = StadiumLogic;
