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

/* ── New drop-in types (v1.3.0) ──────────────────────── */

/** Relative stroke for Image Annotator — coordinates are 0.0–1.0
 *  fractions of the annotation area so they survive resizing. */
export interface RelativeStroke {
  points: { x: number; y: number; pressure: number }[];
  color: string;
  width: number;
}

export interface ImageAnnotatorObject extends CanvasObjectBase {
  type: "image-annotator";
  /** Vault-relative path to the source image, or a data: URL for camera roll imports. */
  imagePath: string;
  /** Width/height ratio of the source image, used for letterboxing. */
  imageAspectRatio: number;
  /** Annotation strokes stored in normalized 0.0–1.0 coordinates. */
  strokes: RelativeStroke[];
}

export interface FormulaCardObject extends CanvasObjectBase {
  type: "formula-card";
  /** Raw LaTeX source string. */
  latex: string;
  /** Background hex color. */
  bgColor: string;
  /** KaTeX display font size in px. */
  fontSize: number;
}

export interface UnitConverterObject extends CanvasObjectBase {
  type: "unit-converter";
  /** Currently selected category tab. */
  activeCategory: string;
  /** Per-category SI-base value last entered (null if cleared). */
  values: Record<string, number | null>;
}

export type CanvasObject =
  | TextBoxObject
  | TableObject
  | ImageObject
  | PdfObject
  | ImageAnnotatorObject
  | FormulaCardObject
  | UnitConverterObject;

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

export function createImageAnnotator(
  x: number, y: number,
  imagePath: string = "",
  w: number = 320, h: number = 260,
  name: string = "Image Annotator"
): ImageAnnotatorObject {
  return {
    id: newObjectId(), type: "image-annotator", x, y, w, h, name,
    imagePath, imageAspectRatio: 4 / 3, strokes: [],
  };
}

export function createFormulaCard(
  x: number, y: number,
  name: string = "Formula"
): FormulaCardObject {
  return {
    id: newObjectId(), type: "formula-card", x, y,
    w: 240, h: 100, name,
    latex: "", bgColor: "#FFF9C4", fontSize: 18,
  };
}

export function createUnitConverter(
  x: number, y: number,
  name: string = "Unit Converter"
): UnitConverterObject {
  return {
    id: newObjectId(), type: "unit-converter", x, y,
    w: 240, h: 300, name,
    activeCategory: "resistance", values: {},
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
    case "image-annotator": return "Image Annotator";
    case "formula-card": return "Formula";
    case "unit-converter": return "Unit Converter";
  }
}
