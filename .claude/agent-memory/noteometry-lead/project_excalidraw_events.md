---
name: Excalidraw v0.18 Pointer Event Architecture
description: How Excalidraw captures pointer events internally -- critical for any overlay that needs to intercept events over the canvas
type: project
---

Excalidraw v0.18 renders its interactive canvas as `canvas.excalidraw__canvas.interactive` with direct React onPointerDown/Move/Up handlers. Its `handleCanvasPointerDown` immediately calls `target.setPointerCapture(event.pointerId)` which redirects ALL subsequent pointer events for that ID to the canvas, regardless of DOM position.

The layer UI (`div.layer-ui__wrapper`) sits at z-index 4 (absolute, full width/height) over the canvas. Individual toolbar children have `pointer-events: auto`.

**Why:** This means any overlay that needs to intercept pointer events over Excalidraw MUST disable `pointer-events` on both `canvas.interactive` and `.layer-ui__wrapper` -- z-index alone is not sufficient because setPointerCapture overrides normal event targeting.

**How to apply:** When building overlays (lasso, annotation tools, etc.), toggle `pointer-events: none !important` on Excalidraw's interactive canvas and layer UI. Restore by removing the inline style override.
