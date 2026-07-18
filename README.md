# Smart Stadium Ops
**PromptWars — Challenge 4: Smart Stadiums & Tournament Operations**

A GenAI-enabled fan app + ops dashboard for FIFA World Cup 2026 venues: live gate
crowd pulse, an AI concierge (multilingual, intent-based), step-free wayfinding,
transport/parking, accessibility requests, sustainability tracking, a live match
center, lost & found, feedback/sentiment, and a stewarding/ops console.

## Running it
No install, no build step, no server required.

```
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

Everything runs client-side against a simulated "digital twin" of venue data —
by design, so the submission is a single portable folder that works fully offline.

## Project structure
```
index.html    the app (UI + rendering + simulation state)
logic.js      pure, dependency-free business logic (no DOM, no globals mutated)
tests.html    unit tests for logic.js — open directly in a browser
README.md     this file
```

`logic.js` was pulled out of the original single-file build specifically so the
core algorithms (Dijkstra pathfinding for wayfinding, HTML-escaping for safe
rendering of user input, crowd-density thresholds, wait-time estimation, clock
formatting) can be tested in isolation, independent of the DOM. `index.html`
loads it with a plain `<script src="logic.js">` — same zero-build-step
philosophy, just with the testable logic factored out.

## Testing
Open `tests.html` in a browser. It loads `logic.js` and runs ~39 assertions
against it (XSS-safe escaping, intent detection, crowd thresholds, wait-time
estimates, clock formatting, capacity scaling, and Dijkstra shortest-path
correctness — including step-free-only routing and unreachable/unknown-node
error cases) with no framework, network access, or install step.

## Accessibility
- Skip-to-content link; `<header>`/`<main>`/`<footer>` landmarks.
- Both tab systems (top-level view switcher and the 13-tab fan-app row) use
  proper `role="tab"`/`role="tabpanel"`/`aria-selected` semantics, and the
  secondary tab row supports arrow-key navigation.
- Every form `<label>` is associated with its control via `for`/`id`.
- The star-rating widget is a keyboard-operable `radiogroup` (arrow keys +
  Enter/Space), not just a mouse-only click target.
- The AI concierge chat log is an `aria-live` region so new messages are
  announced to screen readers.
- Visible focus outlines on all interactive elements (`:focus-visible`).
- All user-submitted text (chat, lost & found, feedback, incident reports) is
  HTML-escaped before rendering — see `escapeHtml()` in `logic.js`.

## Performance
The live dashboard previously re-rendered every panel — including a full SVG
stadium-map rebuild — on a fixed 2.5s timer regardless of whether the tab was
visible or in the background. It now:
- Skips all periodic re-rendering while the browser tab is hidden
  (Page Visibility API).
- Only rebuilds a given panel (map, crowd-pulse strip, signage, stewarding,
  concessions) if it's actually visible in the current view/tab, using a
  cheap `offsetParent !== null` check, instead of rebuilding every panel on
  every tick regardless of what the user is looking at.

## Known limitations / next steps
- Venue data (occupancy, weather, match events) is simulated client-side and
  resets on page reload — a production version would wire this to real
  venue telemetry and a backend LLM (the concierge's rule-based intent
  matching is a stand-in for a real Claude-backed endpoint).
- `logic.js` covers the deterministic core logic; DOM-rendering functions in
  `index.html` remain integration-tested manually rather than unit-tested,
  since they require a full browser environment.
