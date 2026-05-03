/* ── Canvas Objects ─────────────────────────────────────
   Positioned objects on the canvas: text boxes, tables, images,
   PDFs, and the v1.10 AI drop-ins (Math + Chat).

   v1.10.0: The engineering + math-tools + study + legacy-AI drop-ins
   were removed. Their types are no longer part of the CanvasObject
   union, but the loader in persistence silently drops unknown kinds
   so old .nmpage files keep loading.
   ──────────────────────────────────────────────────────── */

import type { ChatMessage } from "../types";

export interface CanvasObjectBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** User-editable display name shown in the drag handle. Defaults to
   * the type (Text / Table / Image / PDF / Math / Chat) when the
   * object is created. Optional so old pages load without migration. */
  name?: string;
}

export interface TextBoxObject extends CanvasObjectBase {
  type: "textbox";
}

export interface TableObject extends CanvasObjectBase {
  type: "table";
}

export interface ImageObject extends CanvasObjectBase {
  type: "image";
  dataURL: string;
}

export interface PdfObject extends CanvasObjectBase {
  type: "pdf";
  /** Vault-relative path to the PDF file. Stored in the attachments dir
   * next to images. Never a base64 data URL — PDFs are far too big for
   * that to make sense. */
  fileRef: string;
  /** Current page being rendered (1-based). Saved with the object so the
   * user returns to the same page after reload. */
  page: number;
}

/* ── v1.10 AI drop-ins ─────────────────────────────────────
   Every AI output lives as a canvas-anchored drop-in. No sidebar,
   no global chat state. Each drop-in owns its own conversation or
   its own LaTeX. Dropped next to the lasso that spawned it so the
   question stays visually tethered to the thing it's about. This
   is the ADHD-anti-amnesia architecture: if it's on the canvas,
   it exists; if it's not, it doesn't.

   - MathObject: 123 output. Holds LaTeX. "Solve" button routes
     the LaTeX through v12 and spawns a ChatObject next to it.
   - ChatObject: ABC output (and Solve output). Holds a pinned
     image attachment (base64 PNG) + a conversation. Sends image
     + prompt on first turn, text-only follow-ups thereafter —
     the vision-capable provider already has the image in context.
   ──────────────────────────────────────────────────────── */

export interface MathObject extends CanvasObjectBase {
  type: "math";
  /** LaTeX string — the 123 output. Editable in-place so the user
   *  can fix a vision miss without re-lassoing. */
  latex: string;
  /** True while the vision call is in flight (first render after
   *  creation). Rendered as a spinner in place of the KaTeX output. */
  pending?: boolean;
}

export interface ChatObject extends CanvasObjectBase {
  type: "chat";
  /** The lasso image, base64 PNG, pinned at the top of the chat.
   *  Optional because Solve-spawned chats carry LaTeX instead of
   *  an image — the math drop-in is already the visual anchor. */
  attachedImage?: string;
  /** Seeded LaTeX for Solve-spawned chats. When present, the first
   *  user message is the LaTeX and the v12 preset is applied. */
  seedLatex?: string;
  /** Seeded plain text for the input textarea (NOT auto-fired).
   *  v1.11.0 phase-3 sub-PR 3.2: freeze → "Brain dump" pre-fills the
   *  textarea with `[brain dump @ <iso>]` and focuses the cursor at
   *  the end so the user just keeps typing. Cleared after consumption
   *  on first render so re-hydration doesn't re-seed. */
  seedText?: string;
  /** Conversation history for this drop-in only. No cross-drop-in
   *  state — each chat is its own universe. */
  messages: ChatMessage[];
  /** True while an AI response is pending. */
  pending?: boolean;
}

export type CanvasObject =
  | TextBoxObject | TableObject | ImageObject | PdfObject
  | MathObject | ChatObject;

export function newObjectId(): string {
  return crypto.randomUUID();
}

export function createTextBox(x: number, y: number, name: string = "Text"): TextBoxObject {
  return { id: newObjectId(), type: "textbox", x, y, w: 350, h: 200, name };
}

export function createTable(x: number, y: number, name: string = "Table"): TableObject {
  return { id: newObjectId(), type: "table", x, y, w: 400, h: 250, name };
}

export function createImageObject(
  x: number, y: number,
  dataURL: string,
  w: number = 300, h: number = 200,
  name: string = "Image"
): ImageObject {
  return { id: newObjectId(), type: "image", x, y, w, h, dataURL, name };
}

export function createPdfObject(
  x: number, y: number,
  fileRef: string,
  w: number = 560, h: number = 720,
  name: string = "PDF"
): PdfObject {
  return { id: newObjectId(), type: "pdf", x, y, w, h, fileRef, page: 1, name };
}

/* ── v1.10 factories ─────────────────────────────────────── */

export function createMathObject(
  x: number, y: number,
  latex: string = "",
  pending: boolean = false,
  name: string = "Math",
): MathObject {
  return { id: newObjectId(), type: "math", x, y, w: 360, h: 160, name, latex, pending };
}

export function createChatObject(
  x: number, y: number,
  opts: {
    attachedImage?: string;
    seedLatex?: string;
    seedText?: string;
    messages?: ChatMessage[];
    pending?: boolean;
    name?: string;
  } = {},
): ChatObject {
  return {
    id: newObjectId(),
    type: "chat",
    x, y,
    w: 420, h: 480,
    name: opts.name ?? "Chat",
    attachedImage: opts.attachedImage,
    seedLatex: opts.seedLatex,
    seedText: opts.seedText,
    messages: opts.messages ?? [],
    pending: opts.pending,
  };
}

/** Default display name when an object has none set (old pages). */
export function defaultObjectName(obj: CanvasObject): string {
  if (obj.name && obj.name.trim()) return obj.name;
  switch (obj.type) {
    case "textbox": return "Text";
    case "table": return "Table";
    case "image": return "Image";
    case "pdf": return "PDF";
    case "math": return "Math";
    case "chat": return "Chat";
  }
}

/* ── v1.10 migration ────────────────────────────────────────
   Old pages may contain drop-ins of types that no longer exist
   (circuit-sniper, oscilloscope, multimeter, compute, graph-plotter,
   unit-circle, unit-converter, animation-canvas, study-gantt,
   ai-dropin). The loader calls this to strip them and report the
   counts to the user via a one-time Notice.
   ──────────────────────────────────────────────────────── */

const REMOVED_TYPES = new Set([
  "circuit-sniper", "oscilloscope", "multimeter", "compute",
  "graph-plotter", "unit-circle", "unit-converter",
  "animation-canvas", "study-gantt", "ai-dropin",
]);

const REMOVED_LABELS: Record<string, string> = {
  "circuit-sniper": "Circuit Sniper",
  "oscilloscope": "Oscilloscope",
  "multimeter": "Multimeter",
  "compute": "Calculator",
  "graph-plotter": "Graph Plotter",
  "unit-circle": "Unit Circle",
  "unit-converter": "Unit Converter",
  "animation-canvas": "Animation Canvas",
  "study-gantt": "Study Gantt",
  "ai-dropin": "AI Drop-in",
};

export function stripRemovedObjects(
  objects: unknown[],
): { kept: CanvasObject[]; removed: Record<string, number> } {
  const kept: CanvasObject[] = [];
  const removed: Record<string, number> = {};
  for (const o of objects) {
    const t = (o as { type?: string } | null)?.type;
    if (!t) continue;
    if (REMOVED_TYPES.has(t)) {
      const label = REMOVED_LABELS[t] ?? t;
      removed[label] = (removed[label] ?? 0) + 1;
      continue;
    }
    // Belt-and-braces: only keep types we actually render.
    if (t === "textbox" || t === "table" || t === "image" || t === "pdf"
        || t === "math" || t === "chat") {
      kept.push(o as CanvasObject);
    }
  }
  return { kept, removed };
}
