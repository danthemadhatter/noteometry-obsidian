# Shared textbook & per-week checklist — design note (v1.6.11)

## Problem

> "I don't want to upload the same textbook 16 times, one per weekly folder."

Currently every `Week N` page has its own `attachments/` directory. A PDF
inserted via the "Insert → PDF" context action ends up duplicated per
week when the user is working through a 16-week course. The user wants
a single copy of the textbook per **course** that every week's page
references, plus a lightweight checklist tied to the course/week/task
unit so the textbook lives in one place and the pages link to it.

## Why this wasn't shipped in v1.6.11

The full feature crosses three subsystems (persistence layout, the PDF
drop-in, and a new checklist object) and the fix pass was scoped to
paste/rename/screenshot/Perplexity. A partial implementation would
have been worse than the status quo — a half-wired checklist with
broken links to a textbook the user thinks is shared would cost more
debugging than the duplication it replaces.

## Proposed layout (when implemented)

```
Noteometry/
  EE 301/                              # course = section
    _course/
      textbook.pdf                     # single shared PDF at course root
      syllabus.md
    Week 1.md
    Week 2.md
    …
    attachments/                       # shared per-course attachments
      …
```

Key change: `attachments/` moves up one level (course-wide) so sidebar
rename + PDF insert both see the same folder. `saveImageToVault` and
`savePdfToVault` would accept a `course` argument instead of the
current `section` (which is already the course in the current model).

## PDF drop-in changes

- Inserting a PDF stores it at `${root}/${course}/_course/<hash>.pdf`
  keyed on file-content hash, so re-inserting the same file is idempotent.
- The drop-in's `fileRef` is a course-relative path, not a page-local
  one, so every `Week N` page points to the same vault file.

## Checklist object (new canvas object type)

```ts
interface ChecklistObject {
  id: string;
  type: "checklist";
  x: number; y: number; w: number; h: number;
  title: string;                       // "Week 3 homework"
  items: { id: string; text: string; done: boolean; ref?: string }[];
  textbookRef?: string;                // vault-relative PDF path
  name?: string;
}
```

Rendering is a simple checkbox + text list with a "Textbook" link that
opens the PDF drop-in when clicked. Persistence slots into the
existing `CanvasObject` union in `src/lib/canvasObjects.ts` — same
(de)serialize path as tables/textboxes.

## UI affordance (minimal)

Add one context-menu entry on empty canvas: **Insert → Checklist**.
That's the complete surface area. Power users who want cross-page
checklists can use Obsidian wikilinks in the item text (already
supported since items are plain markdown strings).

## Why no UI affordance was added in this pass

Adding a disabled "Insert → Checklist" menu item (or a button that
pops a "coming soon" Notice) would take up menu real estate without
paying rent. If a future pass picks this up it should land as a
complete `ChecklistObject` including the vault-layout migration above
in a single PR, behind a feature flag on the settings page so the
course-layout migration is opt-in until validated.

## Migration risk

The vault-layout change (moving `attachments/` from per-week to
per-course) requires a one-way migration. Any user who has already
inserted images will see them relocate on plugin upgrade. Must ship
behind a migration guard that handles the interrupted case (partial
move, duplicate paths) cleanly — see `migrateBase64Images` in
`src/lib/persistence.ts` for the existing migration pattern.

## Decision

- **v1.6.11**: no feature code. Spec filed here. No UI affordance.
- **Next pass**: implement behind `settings.courseSharedAttachments`
  default-off flag, ship checklist object + migration together, then
  flip the default on after a version of real-world use.
