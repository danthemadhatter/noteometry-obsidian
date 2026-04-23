/**
 * Pure validation for sidebar rename (page / section). Kept out of the
 * React component so we can pin the invariants with unit tests — the
 * user reported rename "doesn't work" in v1.6.10 and we want a single
 * authoritative place that decides whether a commit is legal.
 *
 * Returns the trimmed, legal name, or an error message. A name is
 * illegal when blank, unchanged, colliding with an existing name
 * (case-insensitive), or containing characters Obsidian's filesystem
 * adapter refuses (`/`, `\\`, `:` across platforms).
 */

export type RenameValidation =
  | { ok: true; name: string }
  | { ok: false; error: string };

const FS_FORBIDDEN = /[\\/:]/;

export function validateRename(
  rawName: string,
  originalName: string,
  siblings: readonly string[],
): RenameValidation {
  const name = rawName.trim();
  if (!name) return { ok: false, error: "Name can't be blank" };
  if (name === originalName) return { ok: false, error: "unchanged" };
  if (FS_FORBIDDEN.test(name)) {
    return { ok: false, error: "Name can't contain / \\ or :" };
  }
  const lower = name.toLowerCase();
  const clash = siblings.some(
    (s) => s.toLowerCase() === lower && s !== originalName,
  );
  if (clash) return { ok: false, error: `"${name}" already exists here` };
  return { ok: true, name };
}
