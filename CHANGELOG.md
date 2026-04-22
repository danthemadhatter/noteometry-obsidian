# Changelog

## 1.6.5 — 2026-04-17

- **Math v12 guardrails:** regression tests for Math v12 prompt, MathML output, and copy-to-Word clipboard behavior. (`1615dd0`)

## 1.6.4 — 2026-04-17

- **Mobile CSS:** trigger mobile layout on coarse pointer too, so Z-Fold / foldable devices get the mobile tabs and FAB. (`72f1951`)

## 1.6.3 — 2026-04-17

- **Touch strokes:** release pointer capture after touch strokes so subsequent taps aren't swallowed.
- **Mobile:** add Tools FAB for quick access to drawing tools on mobile. (`1151fc5`)

## 1.6.2 — 2026-04-17

- **Android:** finger drawing mode toggle in Settings → Finger drawing, so users without a stylus can still draw on Android. (`5048bbc`)

## 1.6.1 — 2026-04-17

- **deleteSection:** use recursive rmdir so the section folder actually goes away instead of leaving empty shells behind. (`985a021`)

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
