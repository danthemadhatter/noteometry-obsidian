import { App, Notice, TFile, TFolder } from "obsidian";
import type NoteometryPlugin from "../main";
import type { CanvasObject } from "./canvasObjects";
import {
  CanvasData,
  EMPTY_PAGE,
  packToV3,
  unpackFromV3,
  isV3Page,
} from "./pageFormat";

// Re-export so existing consumers don't have to change their imports.
export type { CanvasData } from "./pageFormat";
export {
  EMPTY_PAGE,
  packToV3,
  unpackFromV3,
  isV3Page,
} from "./pageFormat";
export type {
  NoteometryPageV3,
  PageElementV3,
  StrokeElementV3,
  StampElementV3,
  TextboxElementV3,
  TableElementV3,
  ImageElementV3,
} from "./pageFormat";

/** Default root folder used by the "New page" command when no other
 *  parent folder is implied by the active file. */
export function rootDir(plugin: NoteometryPlugin): string {
  return plugin.settings.vaultFolder || "Noteometry";
}

/* ══════════════════════════════════════════════════════════════════
 * File-bound page I/O (tier 3 native explorer)
 *
 * Each open page is a FileView bound to a single .nmpage TFile.
 * Obsidian's own file explorer is the page navigator.
 * ══════════════════════════════════════════════════════════════════ */

/** Decode raw page contents (any format) to CanvasData, or null if the
 *  content isn't a recognizable Noteometry page. */
export function parsePageContent(raw: string): CanvasData | null {
  try {
    const parsed = JSON.parse(raw);
    if (isV3Page(parsed)) {
      return unpackFromV3(parsed);
    }
    if (parsed && typeof parsed === "object" && (parsed.version === 2 || Array.isArray(parsed.strokes))) {
      return {
        strokes: parsed.strokes ?? [],
        stamps: parsed.stamps ?? [],
        canvasObjects: parsed.canvasObjects ?? [],
        viewport: parsed.viewport ?? { scrollX: 0, scrollY: 0 },
        panelInput: parsed.panelInput ?? "",
        chatMessages: parsed.chatMessages ?? [],
        tableData: parsed.tableData ?? {},
        textBoxData: parsed.textBoxData ?? {},
        lastSaved: parsed.lastSaved ?? "",
      };
    }
    if (parsed && typeof parsed === "object") {
      return {
        strokes: [],
        stamps: [],
        canvasObjects: [],
        viewport: { scrollX: 0, scrollY: 0 },
        panelInput: parsed.panelInput ?? "",
        chatMessages: parsed.chatMessages ?? [],
        tableData: parsed.tableData ?? {},
        textBoxData: parsed.textBoxData ?? {},
        lastSaved: parsed.lastSaved ?? "",
      };
    }
  } catch {
    // fall through
  }
  return null;
}

/** Read the given TFile and return CanvasData. Returns EMPTY_PAGE for an
 *  empty file; returns null if the content isn't a recognizable Noteometry
 *  page so the caller can surface an error. */
export async function loadPageFromFile(app: App, file: TFile): Promise<CanvasData | null> {
  try {
    const raw = await app.vault.read(file);
    if (!raw.trim()) {
      return { ...EMPTY_PAGE };
    }
    return parsePageContent(raw);
  } catch (e) {
    console.error("[Noteometry] load failed:", e);
    new Notice(`Failed to load "${file.path}" — file may be corrupt (see console)`, 10000);
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════
 * Fort Knox save engine (v1.16.0)
 *
 * Three guards layered on top of the existing recovery-cache path:
 *
 *   1. Per-file write mutex. Concurrent savePageToFile calls for the
 *      same TFile serialize through a promise chain so a fast autosave
 *      can't race a manual save and trample the result of the other.
 *      Different files have independent queues — saves to A don't
 *      block saves to B.
 *
 *   2. Anti-empty-payload guardrail. We refuse to overwrite a non-empty
 *      page on disk with a payload that looks empty (no strokes,
 *      stamps, canvasObjects, table data, or text). This catches the
 *      "state hook fired with the default state before hydration"
 *      class of bug where a real page gets wiped on the next autosave.
 *      Callers that genuinely need to clear a page can pass
 *      { allowEmptyOverwrite: true } — Clear Canvas does this through
 *      the existing CanvasData flow, so the data it writes still has
 *      a viewport/lastSaved.
 *
 *   3. Emergency backup on failure. If vault.modify throws, we drop
 *      the packed v3 next to the page as a sibling file
 *      "<basename>.nm-emergency-<isoStamp>.json" via the raw adapter
 *      (which doesn't need a TFile to exist yet). The user can copy
 *      this back onto the .nmpage to recover. We never delete these
 *      automatically — they're the lifeline.
 *
 *   4. Shadow Ledger. A bounded rolling backup in localStorage. Each
 *      successful save appends to a per-file ring of the last
 *      SHADOW_LEDGER_DEPTH payloads (with timestamp). Independent of
 *      cachePageDataSync above (which is the single in-flight buffer
 *      that gets cleared after each save) — the ledger PERSISTS until
 *      it rolls over. So even after the recovery cache has been
 *      cleared, the user has the last few versions to read back.
 *
 * Public API contract preserved:
 *   - savePageToFile(app, file, data) still returns Promise<void>
 *   - All existing callers (NoteometryView, tests) work unchanged
 *   - Optional 4th-param `opts` is purely additive
 * ══════════════════════════════════════════════════════════════════ */

/** Per-file serialization queue. Keyed by vault path. */
const __saveQueues = new Map<string, Promise<void>>();

/** Bounded rolling backup depth. Each entry is a full packed v3 JSON +
 *  timestamp; we round-robin overwrite the oldest. Tuned low so we don't
 *  blow localStorage quota on big canvases — five copies of a page that
 *  serializes to ~500KB is 2.5MB, which fits comfortably under the 5MB
 *  per-origin limit Electron honors. */
const SHADOW_LEDGER_DEPTH = 5;
const SHADOW_LEDGER_PREFIX = "nm:ledger:";

export interface SavePageOptions {
  /** Bypass the empty-overwrite guard. Used by Clear Canvas, where
   *  wiping is the explicit user intent. */
  allowEmptyOverwrite?: boolean;
}

/** True when a CanvasData carries no visible content. Used to refuse
 *  silent overwrites of real pages with default state. Viewport,
 *  panelInput, chatMessages and lastSaved are intentionally NOT part
 *  of the heuristic — a page with only a viewport pan is still empty
 *  for our purposes, and panelInput/chatMessages are legacy fields. */
export function isCanvasDataEmpty(data: CanvasData | null | undefined): boolean {
  if (!data || typeof data !== "object") return true;
  if (Array.isArray(data.strokes) && data.strokes.length > 0) return false;
  if (Array.isArray(data.stamps) && data.stamps.length > 0) return false;
  if (Array.isArray(data.canvasObjects) && data.canvasObjects.length > 0) return false;
  if (data.tableData && Object.keys(data.tableData).length > 0) return false;
  if (data.textBoxData && Object.keys(data.textBoxData).length > 0) return false;
  return true;
}

/** Cheap shape check on a parsed v3 page — used by the guardrail to
 *  decide whether what's on disk is "real". We don't want to refuse
 *  the very first save into a brand-new empty file. */
function v3PageHasContent(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  const p = parsed as { elements?: unknown[]; pipeline?: { tableData?: Record<string, unknown>; textBoxData?: Record<string, unknown> } };
  if (Array.isArray(p.elements) && p.elements.length > 0) return true;
  const pipe = p.pipeline;
  if (pipe?.tableData && Object.keys(pipe.tableData).length > 0) return true;
  if (pipe?.textBoxData && Object.keys(pipe.textBoxData).length > 0) return true;
  return false;
}

/** Append a payload to the per-file shadow ledger ring. Best-effort:
 *  swallows quota errors so a backup failure can never break a save. */
export function appendShadowLedger(filePath: string, packedJson: string): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    const key = SHADOW_LEDGER_PREFIX + filePath;
    const raw = ls.getItem(key);
    const stamp = new Date().toISOString();
    let entries: Array<{ ts: string; json: string }> = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) entries = parsed;
      } catch { /* corrupt ledger — start fresh */ }
    }
    entries.push({ ts: stamp, json: packedJson });
    if (entries.length > SHADOW_LEDGER_DEPTH) {
      entries = entries.slice(entries.length - SHADOW_LEDGER_DEPTH);
    }
    ls.setItem(key, JSON.stringify(entries));
  } catch { /* quota / serialization — best effort */ }
}

/** Read the rolling backup ring for a file. Newest entry is last. */
export function readShadowLedger(filePath: string): Array<{ ts: string; json: string }> {
  const ls = safeLocalStorage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(SHADOW_LEDGER_PREFIX + filePath);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is { ts: string; json: string } =>
        e && typeof e === "object" && typeof e.ts === "string" && typeof e.json === "string",
    );
  } catch { return []; }
}

/** Drop the ledger for a file. Not called automatically — exposed for
 *  the "I've recovered, clear backups" flow. */
export function clearShadowLedger(filePath: string): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try { ls.removeItem(SHADOW_LEDGER_PREFIX + filePath); } catch { /* ignore */ }
}

/** Best-effort emergency dump to a sibling file via the vault adapter.
 *  Used only after vault.modify throws. Never re-throws — the original
 *  error has already been reported to the user. */
async function writeEmergencyBackup(app: App, file: TFile, body: string): Promise<string | null> {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const parent = file.parent?.path ?? "";
    const target = parent
      ? `${parent}/${file.basename}.nm-emergency-${stamp}.json`
      : `${file.basename}.nm-emergency-${stamp}.json`;
    await app.vault.adapter.write(target, body);
    return target;
  } catch (e) {
    console.error("[Noteometry] emergency backup also failed:", e);
    return null;
  }
}

/**
 * Serialize CanvasData (as v3) and write to the given TFile.
 *
 * Hardened in v1.16.0 with serialized writes, empty-overwrite guard,
 * shadow ledger, and emergency-backup-on-failure. See block comment
 * above for the full model. The public contract is unchanged:
 * returns a Promise<void> that resolves once the write (or its
 * fallback) has settled.
 */
export async function savePageToFile(
  app: App,
  file: TFile,
  data: CanvasData,
  opts: SavePageOptions = {},
): Promise<void> {
  const filePath = file.path;
  // Chain onto whatever's currently writing this file so concurrent
  // saves serialize. Errors in the prior link must NOT kill the chain,
  // or one failed save would jam all subsequent saves to that file.
  const prior = __saveQueues.get(filePath) ?? Promise.resolve();
  const next = prior.then(
    () => doSavePageToFile(app, file, data, opts),
    () => doSavePageToFile(app, file, data, opts),
  );
  __saveQueues.set(filePath, next);
  // Once this link resolves, clean up the queue entry IF it's still us.
  // (A later save will have replaced the map entry already; don't blow
  // away someone else's queue head.)
  next.finally(() => {
    if (__saveQueues.get(filePath) === next) {
      __saveQueues.delete(filePath);
    }
  });
  return next;
}

async function doSavePageToFile(
  app: App,
  file: TFile,
  data: CanvasData,
  opts: SavePageOptions,
): Promise<void> {
  // Guard 1: refuse a null/garbage payload outright.
  if (!data || typeof data !== "object") {
    console.error("[Noteometry] refusing save: payload is not a CanvasData object", data);
    new Notice(`Refused to save "${file.path}" — invalid data shape. (Your file on disk is unchanged.)`, 10000);
    return;
  }

  // Guard 2: anti-empty-overwrite. Only blocks when the in-memory data
  // is empty AND what's on disk is non-trivial. A fresh empty page is
  // perfectly legal to save — that's how new pages get content later.
  //
  // Refinement: every real save through saveNow sets lastSaved to a
  // fresh ISO timestamp. The only way to reach savePageToFile with
  // both lastSaved === "" AND empty content is the failure mode this
  // guard exists for: an autosave fired against default state before
  // the file had a chance to hydrate. Legitimate Clear Canvas writes
  // are empty BUT carry a fresh lastSaved, so they fall through.
  const hasFreshTimestamp = typeof data.lastSaved === "string" && data.lastSaved.length > 0;
  if (!opts.allowEmptyOverwrite && !hasFreshTimestamp && isCanvasDataEmpty(data)) {
    try {
      const onDisk = await app.vault.read(file);
      if (onDisk && onDisk.trim()) {
        let parsed: unknown = null;
        try { parsed = JSON.parse(onDisk); } catch { /* not JSON */ }
        if (parsed && v3PageHasContent(parsed)) {
          console.error(
            `[Noteometry] refusing save: empty CanvasData would overwrite real content in "${file.path}". ` +
            `Pass { allowEmptyOverwrite: true } to bypass.`,
          );
          new Notice(
            `Noteometry: Aborted an empty save that would have wiped "${file.basename}". ` +
            `Your file on disk is unchanged.`,
            10000,
          );
          return;
        }
      }
    } catch (readErr) {
      // If we can't read the file, fall through and let the write
      // attempt — read errors are usually transient and we don't want
      // to brick saves on a flaky vault.
      console.warn("[Noteometry] anti-empty-overwrite check couldn't read on-disk content:", readErr);
    }
  }

  let body: string;
  try {
    const v3 = packToV3(data);
    body = JSON.stringify(v3, null, 0);
  } catch (e) {
    console.error("[Noteometry] save failed (pack):", e);
    new Notice(`Failed to save "${file.path}" — could not encode page (see console)`, 10000);
    return;
  }

  // Guard 3: emergency-backup-on-failure + shadow ledger after success.
  try {
    await app.vault.modify(file, body);
    // Successful save — append to the rolling ledger. This happens AFTER
    // the write so we never persist a payload that didn't actually land.
    appendShadowLedger(file.path, body);
  } catch (e) {
    console.error("[Noteometry] save failed:", e);
    const backupPath = await writeEmergencyBackup(app, file, body);
    if (backupPath) {
      new Notice(
        `Failed to save "${file.path}". Emergency backup written to "${backupPath}". ` +
        `Open it manually to recover.`,
        15000,
      );
    } else {
      new Notice(
        `Failed to save "${file.path}" — changes may not persist (see console)`,
        10000,
      );
    }
  }
}

/* ══════════════════════════════════════════════════════════════════
 * v1.14.5 emergency recovery cache
 *
 * Async vault writes can be killed mid-flight when the user X's a tab,
 * force-reloads, or quits Obsidian. The Promise chain dies and bytes
 * never reach disk. To survive that, we synchronously stash the
 * about-to-be-written v3 JSON in localStorage BEFORE the async vault
 * write, and remove it after the write resolves. On the next
 * onLoadFile, we check for a stranded cache entry and recover it.
 *
 * localStorage is synchronous and persists across Electron renderer
 * reloads, so it survives the exact failure modes vault.modify can't.
 * Cache key is the file's vault path so multiple open pages don't collide.
 * Quota errors are swallowed — recovery is best-effort, not a contract.
 * ══════════════════════════════════════════════════════════════════ */

const RECOVERY_PREFIX = "nm:cache:";

function safeLocalStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch { /* iframes / sandboxed contexts can throw on access */ }
  return null;
}

export function cachePageDataSync(filePath: string, packedJson: string): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try { ls.setItem(RECOVERY_PREFIX + filePath, packedJson); } catch { /* quota */ }
}

export function getCachedPageData(filePath: string): string | null {
  const ls = safeLocalStorage();
  if (!ls) return null;
  try { return ls.getItem(RECOVERY_PREFIX + filePath); } catch { return null; }
}

export function clearPageCache(filePath: string): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try { ls.removeItem(RECOVERY_PREFIX + filePath); } catch { /* ignore */ }
}

/** Heuristic: does a .md file's content decode as a v3 Noteometry page?
 *  Used by the "Convert legacy .md pages" command — we only rename files
 *  whose first JSON.parse yields a v3 page, so real markdown is never
 *  touched. */
export function isLegacyNoteometryMdContent(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw);
    return isV3Page(parsed);
  } catch {
    return false;
  }
}

/**
 * Create a new empty .nmpage file under `parentFolderPath`, picking a
 * non-colliding filename. Returns the created TFile (or null on failure).
 */
export async function createNewPageFile(
  app: App,
  parentFolderPath: string,
  baseName = "Untitled",
): Promise<TFile | null> {
  try {
    // Ensure the folder exists.
    let folder = app.vault.getAbstractFileByPath(parentFolderPath);
    if (!folder) {
      folder = await app.vault.createFolder(parentFolderPath);
    }
    if (!(folder instanceof TFolder)) {
      new Notice(`Can't create Noteometry page: "${parentFolderPath}" is not a folder.`, 8000);
      return null;
    }

    const base = parentFolderPath.replace(/\/+$/, "");
    let name = `${baseName}.nmpage`;
    let n = 1;
    const candidate = () => (base ? `${base}/${name}` : name);
    while (app.vault.getAbstractFileByPath(candidate())) {
      name = `${baseName} ${n}.nmpage`;
      n += 1;
    }

    const empty: CanvasData = { ...EMPTY_PAGE, lastSaved: new Date().toISOString() };
    const v3 = packToV3(empty);
    return await app.vault.create(candidate(), JSON.stringify(v3, null, 0));
  } catch (e) {
    console.error("[Noteometry] create page failed:", e);
    new Notice("Couldn't create new Noteometry page — see console.", 8000);
    return null;
  }
}

/**
 * Scan `rootFolder` recursively and return every .md file whose content
 * decodes as a v3 Noteometry page. Non-destructive — caller decides
 * whether to rename, count for a banner, etc.
 */
export async function findLegacyMdPages(
  app: App,
  rootFolder: string,
): Promise<TFile[]> {
  const root = app.vault.getAbstractFileByPath(rootFolder);
  if (!(root instanceof TFolder)) return [];

  const candidates: TFile[] = [];
  const walk = (folder: TFolder) => {
    for (const child of folder.children) {
      if (child instanceof TFolder) walk(child);
      else if (child instanceof TFile && child.extension === "md") candidates.push(child);
    }
  };
  walk(root);

  const legacy: TFile[] = [];
  for (const file of candidates) {
    try {
      const raw = await app.vault.read(file);
      if (isLegacyNoteometryMdContent(raw)) legacy.push(file);
    } catch (e) {
      console.error(`[Noteometry] legacy-scan read failed for ${file.path}:`, e);
    }
  }
  return legacy;
}

/**
 * Rename legacy .md pages in `rootFolder` to .nmpage. Every legacy file is
 * always renamed — if `Foo.nmpage` already exists, the legacy `Foo.md` is
 * renamed to `Foo 1.nmpage` (or the next free suffix) so the convert always
 * finishes. Otherwise a stale `.md` would survive on disk and the
 * legacy-page notice would re-fire on every plugin load. Returns counts of
 * direct renames and suffixed renames so the caller can summarize.
 * No backups — caller has confirmed test data only.
 */
export async function convertLegacyMdPagesToNmpage(
  app: App,
  rootFolder: string,
): Promise<{ converted: number; collisions: number }> {
  const legacy = await findLegacyMdPages(app, rootFolder);

  let converted = 0;
  let collisions = 0;
  for (const file of legacy) {
    try {
      const parentPath = file.parent?.path ?? "";
      const baseTarget = parentPath
        ? `${parentPath}/${file.basename}.nmpage`
        : `${file.basename}.nmpage`;
      let target = baseTarget;
      if (app.vault.getAbstractFileByPath(target)) {
        // Name collision with an existing .nmpage. Find the next free
        // numeric suffix so the rename still happens — silently skipping
        // would leave the .md on disk and the legacy notice would loop.
        const stem = parentPath
          ? `${parentPath}/${file.basename}`
          : file.basename;
        let n = 1;
        while (app.vault.getAbstractFileByPath(`${stem} ${n}.nmpage`)) n += 1;
        target = `${stem} ${n}.nmpage`;
        collisions += 1;
        console.warn(
          `[Noteometry] legacy convert: ${file.path} collides with ${baseTarget}, renaming to ${target}`,
        );
      }
      await app.vault.rename(file, target);
      converted += 1;
    } catch (e) {
      console.error(`[Noteometry] convert failed for ${file.path}:`, e);
    }
  }
  return { converted, collisions };
}

/* ══════════════════════════════════════════════════════════════════
 * Attachment I/O (images + PDFs)
 *
 * Drop-in binaries live in an "attachments/" folder next to the bound
 * page file. Callers pass the page's parent folder path explicitly.
 * ══════════════════════════════════════════════════════════════════ */

async function ensureDir(app: App, dir: string): Promise<void> {
  const adapter = app.vault.adapter;
  if (!(await adapter.exists(dir))) {
    await adapter.mkdir(dir);
  }
}

export async function saveImageBytesTo(
  app: App,
  parentFolder: string,
  imageId: string,
  base64Data: string,
): Promise<string> {
  const attachDir = `${parentFolder}/attachments`;
  await ensureDir(app, attachDir);
  const raw = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const binary = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
  const vaultPath = `${attachDir}/${imageId}.png`;
  await app.vault.adapter.writeBinary(vaultPath, binary.buffer as ArrayBuffer);
  return vaultPath;
}

export async function savePdfBytesTo(
  app: App,
  parentFolder: string,
  pdfId: string,
  bytes: ArrayBuffer,
): Promise<string> {
  const attachDir = `${parentFolder}/attachments`;
  await ensureDir(app, attachDir);
  const vaultPath = `${attachDir}/${pdfId}.pdf`;
  await app.vault.adapter.writeBinary(vaultPath, bytes);
  return vaultPath;
}

export async function loadImageFromVault(
  plugin: NoteometryPlugin,
  vaultPath: string,
): Promise<string> {
  const adapter = plugin.app.vault.adapter;
  const buf = await adapter.readBinary(vaultPath);
  const bytes = new Uint8Array(buf);
  let binaryStr = "";
  for (let i = 0; i < bytes.length; i++) {
    binaryStr += String.fromCharCode(bytes[i]!);
  }
  const b64 = btoa(binaryStr);
  return `data:image/png;base64,${b64}`;
}

export async function loadPdfFromVault(
  plugin: NoteometryPlugin,
  vaultPath: string,
): Promise<ArrayBuffer> {
  const adapter = plugin.app.vault.adapter;
  return await adapter.readBinary(vaultPath);
}
