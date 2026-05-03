import React, { useRef } from "react";
import type { TFile } from "obsidian";

interface Props {
  /** Currently-bound page file. Null while the view is loading. */
  file: TFile | null;
  /** Fired when the breadcrumb is tapped. Receives the screen-space
   *  coordinates of the breadcrumb's bottom edge so the parent can
   *  open the canvas right-click menu just below it. */
  onClick: (clientX: number, clientY: number) => void;
}

/**
 * v1.12.0 — Top-of-canvas page-name readout.
 *
 * Shows the current page's parent folder + filename as tracked-
 * uppercase mono, e.g. "EE 301 · WEEK 4 · LECTURE". Tap → opens the
 * canvas right-click menu (the same menu hosting the 📚 Pages
 * submenu), so the readout doubles as both an orientation cue and a
 * navigation entry point.
 *
 * Replaces the spatial role the deleted PagesPanel sidebar played.
 * The user always sees what page they're on without needing a leaf.
 */
export default function PageBreadcrumb({ file, onClick }: Props) {
  const ref = useRef<HTMLButtonElement>(null);

  if (!file) return null;

  // Build the segments: parent folder path (split on /) + the file's
  // basename. Skip empty segments. Vault-root pages just show their
  // basename. The chevron between segments is a thin middle-dot for
  // restraint — the breadcrumb is ambient chrome, not a heading.
  const parentPath = file.parent?.path ?? "";
  const segments = parentPath
    ? parentPath.split("/").filter((s) => s.length > 0)
    : [];
  segments.push(file.basename);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = ref.current?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : e.clientX;
    const y = rect ? rect.bottom + 4 : e.clientY;
    onClick(x, y);
  };

  return (
    <button
      ref={ref}
      className="noteometry-breadcrumb"
      onClick={handleClick}
      title="Tap to open page menu"
    >
      {segments.map((seg, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="noteometry-breadcrumb-sep" aria-hidden="true">·</span>}
          <span className="noteometry-breadcrumb-seg">{seg}</span>
        </React.Fragment>
      ))}
    </button>
  );
}
