# Changelog

## 1.6.0 — 2026-04-17

- **Mobile:** right panel Input/Chat tabs with hide button; math palette docks top on mobile instead of bottom; context menu scrolls when it overflows.
- **Versioning:** CHANGELOG + scripts/ship.sh helper so every visible change gets its own patch bump.
- Rolls up 1.5.1 through 1.5.8.

## 1.5.8 — 2026-04-17

- **Mobile:** stack canvas above right panel at <=768px; raise panel height from 40vh to 65vh. (`72c9335`)

## 1.5.7 — 2026-04-17

- **Sidebar:** section tabs stack vertically instead of truncating at 100px. Left-border accent replaces bottom-border. (`4a29636`)

## 1.5.6 — 2026-04-17

- **Stamp menu:** label "Regular" renamed to "Normal" to match the internal `StampSize` enum. (`c7ce6d5`)

## 1.5.5 — 2026-04-17

- **Clear Canvas:** now wipes drop-ins too, not just strokes and stamps. Double confirmation retained. (`81d0191`)

## 1.5.4 — 2026-04-17

- **Stamp size:** collapsed from three sizes (S/M/L floating toggle) to Small/Normal via right-click context menu. (`306fe0e`)

## 1.5.3 — 2026-04-17

- **Drop-in z-order:** pointer-down on any drop-in raises it above stacked neighbors. Capture phase, so interactions inside a drop-in's own content still trigger the raise. (`d2a9ad4`)

## 1.5.2 — 2026-04-17

- **AI error surfacing:** `throw: false` on Obsidian `requestUrl` so Anthropic/LMStudio 4xx bodies reach the UI instead of the generic "Request failed" wrapper.
- **Chat history:** drop ghost-empty user turns (leftover from image-only sends whose attachments aren't persisted) that were causing 400 `non-empty content` errors. (`dc88320`)

## 1.5.1 — 2026-04-17

- **ChatPanel:** accept pasted (⌘V) and dragged/dropped images directly instead of letting Obsidian create a `file://` link to a temp path that gets wiped.
- **Build:** deploy only to `plugins/noteometry`; was also writing to a stale `noteometry-build` clone that kept resurrecting. (`40f49de`)

## 1.5.0 — earlier

- Full source recovery, 14 drop-ins, PDF fix, Circuit Sniper.
