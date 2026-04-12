/* ── Canvas Objects ─────────────────────────────────────
   Positioned objects on the canvas: text boxes, tables, images.
   These render as DOM overlays above the ink layer.
   ──────────────────────────────────────────────────────── */

export interface CanvasObjectBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** User-editable display name shown in the drag handle. Defaults to
   * the type (Text / Table / Image / PDF) when the object is created.
   * Optional so old pages load without migration. */
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

export type CanvasObject = TextBoxObject | TableObject | ImageObject | PdfObject;

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

/** Default display name when an object has none set (old pages). */
export function defaultObjectName(obj: CanvasObject): string {
  if (obj.name && obj.name.trim()) return obj.name;
  switch (obj.type) {
    case "textbox": return "Text";
    case "table": return "Table";
    case "image": return "Image";
    case "pdf": return "PDF";
  }
}
