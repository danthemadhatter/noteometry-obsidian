/**
 * MathDropin — v1.10 "123" output.
 *
 * Holds a single LaTeX string transcribed from a lasso. Renders the
 * result with KaTeX (via the existing renderer used elsewhere in the
 * app), supports inline edit so the user can fix a vision miss
 * without re-lassoing, and exposes a single "Solve" action that asks
 * the parent to spawn a chat drop-in seeded with this LaTeX and the
 * v12 preset.
 *
 * Lifecycle:
 *   - Created with `pending: true` while the vision call is in flight.
 *     Renders a small spinner + the original lasso preview if provided.
 *   - When vision returns, the parent flips `pending` to false and
 *     writes the LaTeX into the object.
 *   - User can click the rendered output to edit raw LaTeX in place.
 *   - User clicks "Solve" → parent spawns a ChatDropin offset to the
 *     right and feeds it the LaTeX + v12 system prompt.
 *
 * Chrome philosophy: the drop-in IS the chrome. No floating buttons
 * during normal viewing. The Solve button is part of the body — a
 * single full-width pill at the bottom — so it's never hidden behind
 * a hover state (Apple Pencil has no hover).
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { renderAsMathML } from "../../lib/mathml";

interface Props {
  latex: string;
  pending?: boolean;
  onChange: (u: { latex?: string }) => void;
  onSolve: () => void;
}

export default function MathDropin({ latex, pending, onChange, onSolve }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(latex);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Keep local draft in sync when parent overwrites latex (e.g. vision
  // call lands while the user happens to be in edit mode — extremely
  // rare but possible if they double-tap the spinner).
  useEffect(() => {
    if (!editing) setDraft(latex);
  }, [latex, editing]);

  useEffect(() => {
    if (editing) taRef.current?.focus();
  }, [editing]);

  const commit = useCallback(() => {
    if (draft !== latex) onChange({ latex: draft });
    setEditing(false);
  }, [draft, latex, onChange]);

  const cancel = useCallback(() => {
    setDraft(latex);
    setEditing(false);
  }, [latex]);

  return (
    <div className="noteometry-math-dropin">
      <div className="noteometry-math-body">
        {pending ? (
          <div className="noteometry-math-pending">
            <div className="noteometry-spinner" />
            <span>Reading…</span>
          </div>
        ) : editing ? (
          <textarea
            ref={taRef}
            className="noteometry-math-editor"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            spellCheck={false}
          />
        ) : (
          <div
            className="noteometry-math-rendered noteometry-katex-output"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to edit LaTeX"
            dangerouslySetInnerHTML={{ __html: renderAsMathML(latex || "\\text{(empty)}") }}
          />
        )}
      </div>

      {/* Solve action: full-width pill, always visible when not pending.
          Hidden during pending so the user can't double-fire while the
          first vision call is still landing. */}
      {!pending && (
        <button
          className="noteometry-math-solve"
          onClick={(e) => { e.stopPropagation(); onSolve(); }}
          disabled={!latex.trim()}
          title="Send through v12 → Solve in a new chat"
        >
          Solve
        </button>
      )}
    </div>
  );
}
