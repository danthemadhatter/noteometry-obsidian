---
name: Noteometry Canvas Pointer Architecture
description: How the custom ink canvas, object layer, and lasso overlay split pointer events — critical context for any overlay/tool work
type: project
---

Noteometry uses a **custom React canvas engine**, not Excalidraw. Excalidraw was removed in commit `2657513` ("replace Excalidraw with custom canvas engine matching standalone"). All pointer-event knowledge about Excalidraw's `canvas.excalidraw__canvas.interactive` and `setPointerCapture` behavior no longer applies.

**Current layered architecture (bottom → top):**
1. `InkCanvas` — the drawing surface. CSS class `.noteometry-ink-layer`. Strokes rendered to an HTMLCanvasElement, sized in CSS pixels × `devicePixelRatio` for crisp rendering.
2. `CanvasObjectLayer` — text boxes, tables, images. Positioned absolutely above the ink canvas.
3. `LassoOverlay` — transient overlay canvas created on demand at z-index 300 (polygon draw), 305 (ghost preview during move), 310 (transparent move-drag interceptor), 320 (action bar UI).

**Key pointer patterns:**

- **Touch vs stylus discrimination:** every pointer handler in `InkCanvas` checks `e.pointerType`. `"touch"` always pans (separate touch effect handles it). `"pen"`/`"mouse"` drives the current tool (pen, eraser, grab, shapes).

- **Select mode = pass-through:** when the current tool is `"select"`, `InkCanvas` attaches **no** pointer listeners and sets inline `pointerEvents: "none"`, so clicks fall through to `CanvasObjectLayer` beneath it. Do not attach listeners conditionally on state inside an effect without cleanup — it produces stale closures.

- **Lasso capture-phase interception:** `LassoOverlay` attaches `pointerdown/move/up` on the *container* in CAPTURE phase (`addEventListener(..., true)`) and calls `e.preventDefault() + stopPropagation() + stopImmediatePropagation()` to beat both `InkCanvas` and `CanvasObjectLayer`. The overlay canvas itself is positioned absolute, full container, `touch-action: none`, `pointer-events: auto`.

- **Lasso move mode has TWO canvases:** a ghost canvas at z-index 305 (`pointer-events: none`) for the live preview, plus a transparent interceptor div at z-index 310 (`pointer-events: auto`) for capturing the drag. Keep these separate — combining them breaks the smooth rAF redraw path.

- **DPR math for lasso region capture:** bounds from lasso are in CSS pixels, but `inkCanvas.width/height` is CSS × DPR. When copying a region with `ctx.drawImage`, multiply source coords by DPR and destination coords stay in CSS pixels. See `LassoOverlay.captureSnapshot` for the canonical pattern.

**Stale-closure prevention pattern:** long-lived effects (lasso draw, pan, etc.) read mutable state through refs (`strokesRef`, `toolRef`, `scrollRef`) kept in sync via a `useEffect` that mirrors state → ref. Never read state directly inside a listener attached by an effect that doesn't re-run on every state change.

**Why this matters:** any new overlay or tool that needs to intercept input above the ink layer should either (a) attach to the container in CAPTURE phase and kill propagation, or (b) live inside `LassoOverlay`'s z-index band (300–320) with explicit `pointer-events` configured per layer. Don't rely on z-index alone — React re-renders and event ordering will bite you.

**How to apply:** when building lasso-adjacent features (new action-bar buttons, new selection modes, annotation tools): mirror the existing capture-phase + `pointerType` gate + ref-based state reads. Test touch (pan), pen (tool), and mouse (tool) paths separately — they hit different branches.
