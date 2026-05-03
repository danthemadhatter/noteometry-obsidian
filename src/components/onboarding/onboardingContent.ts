/**
 * v1.11.0 phase-4 sub-PR 4.2 — onboarding cheatsheet content.
 *
 * Pure data + helpers, no React. Vitest is node-env (no jsdom), so the
 * cheatsheet table and visibility predicate are unit-testable here
 * while the React shell stays a thin wrapper.
 *
 * Why a cheatsheet, not a 3-step "force the user to perform each
 * gesture" tutorial (design doc §5 step 19):
 *   The forced interactive tutorial requires DOM event simulation
 *   inside an Obsidian Modal. The user explicitly green-lit shipping
 *   without empirical iPad testing ("assume. go"), so we ship the
 *   cheap-and-correct version: a one-screen visual cheatsheet that
 *   the user can dismiss in a single tap. The "force twice" interactive
 *   variant is parked for v1.12 once we have hardware feedback. This
 *   still satisfies design doc §6b — the Settings → Reset toggle gives
 *   the user a self-triggerable re-learn at day 30, which was the
 *   non-negotiable retention requirement.
 */

export type GestureFamily = "3-finger" | "4-finger" | "long-press" | "lasso";

export interface CheatsheetEntry {
  /** Stable id for testing & React keys. */
  id: string;
  /** Gesture pictogram, ASCII glyph (renders in any font). */
  glyph: string;
  /** Short verb phrase: "Swipe down with 3 fingers". */
  gesture: string;
  /** What the gesture does: "Open the tool layer". */
  effect: string;
  family: GestureFamily;
}

/**
 * Locked vocabulary from design doc §6b — 11 of the 12 ceiling.
 * We only show the ones that are NEW in v1.11 (3F, 4F, long-press
 * unification) plus the one returning gesture the user might have
 * forgotten (lasso radial). The two-finger pan/pinch and Pencil-tap
 * are intentionally omitted: they're already trained from v1.6.x.
 */
export const CHEATSHEET: ReadonlyArray<CheatsheetEntry> = [
  {
    id: "tool-down",
    glyph: "▼",
    gesture: "3 fingers swipe DOWN",
    effect: "Open tools (pen / eraser / colors)",
    family: "3-finger",
  },
  {
    id: "tool-up",
    glyph: "▲",
    gesture: "3 fingers swipe UP",
    effect: "Close the tool layer",
    family: "3-finger",
  },
  {
    id: "meta-right",
    glyph: "▶",
    gesture: "3 fingers swipe RIGHT",
    effect: "Open page meta (title, tags, links)",
    family: "3-finger",
  },
  {
    id: "meta-left",
    glyph: "◀",
    gesture: "3 fingers swipe LEFT",
    effect: "Close the meta layer",
    family: "3-finger",
  },
  {
    id: "freeze",
    glyph: "✋",
    gesture: "4 fingers TAP",
    effect: "Freeze the page — pause AI, brain-dump, or resume",
    family: "4-finger",
  },
  {
    id: "long-press",
    glyph: "●",
    gesture: "Long-press with pen (550 ms)",
    effect: "Contextual menu (copy / paste / clear)",
    family: "long-press",
  },
  {
    id: "lasso",
    glyph: "◯",
    gesture: "Draw a closed loop with the eraser tool",
    effect: "Lasso ink → 123 (math), ABC (text), or copy",
    family: "lasso",
  },
];

/**
 * Should the first-run modal show?
 *   - yes if `gestureTutorialSeen === false`
 *   - no otherwise
 *
 * Pure predicate so tests can lock the behaviour without rendering.
 */
export function shouldShowOnboarding(settings: {
  gestureTutorialSeen: boolean;
}): boolean {
  return settings.gestureTutorialSeen === false;
}

/**
 * Bucket the cheatsheet by family — used by the React shell to render
 * grouped sections without it owning the grouping logic.
 */
export function groupByFamily(
  entries: ReadonlyArray<CheatsheetEntry> = CHEATSHEET,
): Record<GestureFamily, CheatsheetEntry[]> {
  const out: Record<GestureFamily, CheatsheetEntry[]> = {
    "3-finger": [],
    "4-finger": [],
    "long-press": [],
    lasso: [],
  };
  for (const e of entries) out[e.family].push(e);
  return out;
}

/** Title + subtitle copy lives here so it's testable + i18n-able later. */
export const ONBOARDING_TITLE = "New gestures in Noteometry 1.11";
export const ONBOARDING_SUBTITLE =
  "Three layers, one gesture each. The canvas always stays under your fingers.";
export const ONBOARDING_DISMISS_LABEL = "Got it";
export const ONBOARDING_RESET_HINT =
  "You can replay this anytime: Settings → Reset gesture tutorial.";
