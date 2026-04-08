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

export type CanvasObject = TextBoxObject | TableObject | ImageObject;

export function newObjectId(): string {
  return crypto.randomUUID();
}

export function createTextBox(x: number, y: number): TextBoxObject {
  return { id: newObjectId(), type: "textbox", x, y, w: 350, h: 200 };
}

export function createTable(x: number, y: number): TableObject {
  return { id: newObjectId(), type: "table", x, y, w: 400, h: 250 };
}

export function createImageObject(
  x: number, y: number,
  dataURL: string,
  w: number = 300, h: number = 200
): ImageObject {
  return { id: newObjectId(), type: "image", x, y, w, h, dataURL };
}
