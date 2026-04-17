import React from "react";

const s = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const IconSelect = () => <svg {...s}><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/></svg>;
export const IconPen = () => <svg {...s}><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>;
export const IconEraser = () => <svg {...s}><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>;
export const IconHand = () => <svg {...s}><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>;
export const IconLasso = () => <svg {...s}><path d="M7 22a5 5 0 0 1-2-4"/><path d="M7 16.93c.96.43 1.96.74 2.99.91"/><path d="M3.34 14A6.8 6.8 0 0 1 2 10c0-4.42 4.48-8 10-8s10 3.58 10 8-4.48 8-10 8a12 12 0 0 1-3.34-.46"/><path d="M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>;
export const IconScan = () => <svg {...s}><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8h8"/><path d="M7 12h10"/><path d="M7 16h6"/></svg>;
export const IconType = () => <svg {...s}><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>;
export const IconTable = () => <svg {...s}><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>;
export const IconImage = () => <svg {...s}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>;
export const IconUndo = () => <svg {...s}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>;
export const IconRedo = () => <svg {...s}><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>;
export const IconLine = () => <svg {...s}><path d="M5 12h14"/></svg>;
export const IconArrow = () => <svg {...s}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>;
export const IconRect = () => <svg {...s}><rect width="18" height="18" x="3" y="3" rx="2"/></svg>;
export const IconCircle = () => <svg {...s}><circle cx="12" cy="12" r="10"/></svg>;
export const IconDownload = () => <svg {...s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
export const IconTrash = () => <svg {...s}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
export const IconSliders = () => <svg {...s}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>;
export const IconPlus = () => <svg {...s}><path d="M5 12h14"/><path d="M12 5v14"/></svg>;
export const IconFolder = () => <svg {...s}><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/></svg>;
export const IconFile = () => <svg {...s}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><polyline points="14 2 14 8 20 8"/></svg>;
export const IconChevDown = () => <svg {...s}><path d="m6 9 6 6 6-6"/></svg>;
export const IconChevRight = () => <svg {...s}><path d="m9 18 6-6-6-6"/></svg>;
export const IconMenu = () => <svg {...s}><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/></svg>;
export const IconX = () => <svg {...s}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
export const IconSend = () => <svg {...s}><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>;
export const IconPaperclip = () => <svg {...s}><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>;
export const IconRotate = () => <svg {...s}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>;
export const IconCopy = () => <svg {...s}><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>;
export const IconCheck = () => <svg {...s}><path d="M20 6 9 17l-5-5"/></svg>;
export const IconRefresh = () => <svg {...s}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>;
// Combined rect+circle = "shapes" group. Used as the fallback icon on the
// shape picker so the button never looks like a minus sign (which was the
// problem Dan repeatedly flagged with the old IconLine fallback).
export const IconShapes = () => <svg {...s}><rect x="3" y="3" width="10" height="10" rx="1"/><circle cx="16" cy="15" r="5"/></svg>;
// Dashed square + anchor dot = rectangular lasso, visually distinct from
// both the freehand IconLasso and the solid-rect shape-drawing IconRect.
export const IconLassoRect = () => <svg {...s}><rect x="3" y="3" width="14" height="14" rx="1" strokeDasharray="3 2"/><circle cx="19" cy="19" r="2"/></svg>;
// Zoom-out magnifier. Re-added to the toolbar after Dan asked for zoom
// out back; my earlier removal conflated it with an unrelated "minus" icon.
export const IconZoomOut = () => <svg {...s}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>;
// PDF file icon — a page outline with a "P" inside. Used on the "Insert PDF"
// toolbar button so users can drop textbook pages / lecture slides / lab
// manuals onto the canvas and lasso-clip pieces into the chat.
export const IconPdf = () => <svg {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h1.5a1.5 1.5 0 0 1 0 3H9v-3z" fill="currentColor" stroke="none"/><path d="M9 13v5"/></svg>;
export const IconBook = () => <svg {...s}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>;

/* ── Contextual page / dashboard icons ────────────────────────────────
 * Added so pages auto-show a meaningful glyph based on name keywords
 * (math, physics, coding, writing, planning, etc). Improves at-a-glance
 * recognition — critical for ADHD/visual-memory users who scan not read.
 */
export const IconSparkles = () => <svg {...s}><path d="M12 3v3m0 12v3M4.5 4.5l2 2m11 11 2 2M3 12h3m12 0h3M4.5 19.5l2-2m11-11 2-2"/><circle cx="12" cy="12" r="3"/></svg>;
export const IconBrain = () => <svg {...s}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2a2.5 2.5 0 0 0-2.5 2.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z"/></svg>;
export const IconCalculator = () => <svg {...s}><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M12 10h2M16 10h0.01M8 14h2M12 14h2M16 14h0.01M8 18h2M12 18h6"/></svg>;
export const IconFlask = () => <svg {...s}><path d="M10 2v7.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V2"/><path d="M8 2h8"/><path d="M7 14h10"/></svg>;
export const IconAtom = () => <svg {...s}><circle cx="12" cy="12" r="1"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/></svg>;
export const IconCode = () => <svg {...s}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
export const IconTarget = () => <svg {...s}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
export const IconCalendar = () => <svg {...s}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
export const IconPlay = () => <svg {...s}><polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/></svg>;
export const IconEye = () => <svg {...s}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
export const IconEdit3 = () => <svg {...s}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
export const IconMessageCircle = () => <svg {...s}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>;
export const IconZap = () => <svg {...s}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
export const IconLayout = () => <svg {...s}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>;
export const IconList = () => <svg {...s}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>;
export const IconGlobe = () => <svg {...s}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/></svg>;
export const IconMusic = () => <svg {...s}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
export const IconFeather = () => <svg {...s}><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>;

/* Map a page/section name to a contextual icon. Cheap substring pass:
 * no dependencies, safe fallback to IconFile. Callers render the returned
 * component directly — no runtime cost beyond a single regex-free scan. */
const iconMap: Array<[RegExp, React.ComponentType]> = [
  [/\b(math|algebra|calc|geom|trig|stat)/i, IconCalculator],
  [/\b(chem|lab|flask|reaction)/i, IconFlask],
  [/\b(phys|physics|mech|quantum|atom)/i, IconAtom],
  [/\b(bio|biolog|anat|cell|gene)/i, IconFeather],
  [/\b(code|program|software|dev|cs|comp.?sci)/i, IconCode],
  [/\b(goal|target|objective|plan|okr)/i, IconTarget],
  [/\b(week|day|schedule|calendar|gantt)/i, IconCalendar],
  [/\b(idea|brainstorm|think|notes?)/i, IconBrain],
  [/\b(chat|journal|log|diary)/i, IconMessageCircle],
  [/\b(essay|writ|paper|draft)/i, IconEdit3],
  [/\b(history|world|geo|country)/i, IconGlobe],
  [/\b(music|song|audio)/i, IconMusic],
  [/\b(todo|list|checklist)/i, IconList],
  [/\b(spark|quick|scratch)/i, IconSparkles],
];

export function iconFromName(name: string): React.ComponentType {
  for (const [re, Icon] of iconMap) if (re.test(name)) return Icon;
  return IconFile;
}
