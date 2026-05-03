/**
 * OnboardingModal — v1.11.0 phase-4 sub-PR 4.2.
 *
 * First-run cheatsheet. Renders when `shouldShowOnboarding(settings)`
 * is true. Dismiss flips `settings.gestureTutorialSeen = true` and
 * persists via the supplied `onDismiss` callback (which calls
 * `plugin.saveSettings()` upstream).
 *
 * Why a presentational shell with externally-owned dismiss:
 *   The modal sits inside NoteometryApp, but the persistence path is
 *   owned by the Obsidian Plugin instance. Same pattern as autoSave /
 *   fingerDrawing — the React tree reads `plugin.settings.*` and
 *   delegates writes upward. Keeps the React component free of
 *   Obsidian API imports so it stays compilable in node-env tests.
 *
 * Accessibility:
 *   - Uses role="dialog" with aria-modal so screen readers trap focus.
 *   - The dismiss button gets aria-label and is keyboard-focusable.
 *   - Esc key dismisses (handled by the upstream container's keydown
 *     listener — we only render the button + role hint here).
 */

import React from "react";

import {
  CHEATSHEET,
  ONBOARDING_DISMISS_LABEL,
  ONBOARDING_RESET_HINT,
  ONBOARDING_SUBTITLE,
  ONBOARDING_TITLE,
  groupByFamily,
} from "./onboardingContent";

export interface OnboardingModalProps {
  visible: boolean;
  onDismiss: () => void;
}

const FAMILY_LABEL: Record<string, string> = {
  "3-finger": "3-finger swipes",
  "4-finger": "4-finger tap",
  "long-press": "Pen long-press",
  lasso: "Lasso (already in v1.10)",
};

const FAMILY_ORDER: ReadonlyArray<keyof ReturnType<typeof groupByFamily>> = [
  "3-finger",
  "4-finger",
  "long-press",
  "lasso",
];

const OnboardingModal: React.FC<OnboardingModalProps> = ({
  visible,
  onDismiss,
}) => {
  if (!visible) return null;

  const grouped = groupByFamily(CHEATSHEET);

  // Esc key dismisses. Bound on the dialog itself so we don't pollute
  // window-level keydown listeners (NoteometryApp already has many).
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onDismiss();
    }
  };

  return (
    <div
      className="nm-onboarding-backdrop"
      role="presentation"
      onClick={onDismiss}
    >
      <div
        className="nm-onboarding-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nm-onboarding-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        <h2 id="nm-onboarding-title" className="nm-onboarding-title">
          {ONBOARDING_TITLE}
        </h2>
        <p className="nm-onboarding-subtitle">{ONBOARDING_SUBTITLE}</p>

        <div className="nm-onboarding-cheatsheet">
          {FAMILY_ORDER.map((family) => {
            const rows = grouped[family];
            if (!rows.length) return null;
            return (
              <section
                key={family}
                className="nm-onboarding-section"
                aria-label={FAMILY_LABEL[family]}
              >
                <h3 className="nm-onboarding-section-title">
                  {FAMILY_LABEL[family]}
                </h3>
                <ul className="nm-onboarding-rows">
                  {rows.map((row) => (
                    <li key={row.id} className="nm-onboarding-row">
                      <span
                        className="nm-onboarding-glyph"
                        aria-hidden="true"
                      >
                        {row.glyph}
                      </span>
                      <span className="nm-onboarding-gesture">
                        {row.gesture}
                      </span>
                      <span className="nm-onboarding-arrow" aria-hidden="true">
                        →
                      </span>
                      <span className="nm-onboarding-effect">{row.effect}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="nm-onboarding-reset-hint">{ONBOARDING_RESET_HINT}</p>

        <div className="nm-onboarding-actions">
          <button
            type="button"
            className="nm-onboarding-dismiss mod-cta"
            aria-label={ONBOARDING_DISMISS_LABEL}
            onClick={onDismiss}
            autoFocus
          >
            {ONBOARDING_DISMISS_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
