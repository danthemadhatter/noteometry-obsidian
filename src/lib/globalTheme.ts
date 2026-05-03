/**
 * v1.11.1 — Global Noteometry theme.
 *
 * Injects a `<style id="noteometry-global-theme">` element into the
 * document head whose CSS targets Obsidian's chrome (sidebar, tab
 * bar, status bar, command palette, ribbon, modals) so the entire
 * window feels like one app instead of "Obsidian containing a
 * Noteometry plugin".
 *
 * Why a runtime style injection rather than putting it in styles.css:
 *   styles.css is plugin-scoped by Obsidian; rules in there target
 *   plugin views well but fight the user's active theme on chrome
 *   because of cascade ordering. A late <style> in <head> wins
 *   reliably without `!important`. We can also remove it cleanly on
 *   plugin unload or when the user toggles the setting off.
 *
 * The rules use Obsidian's own CSS variables (--background-primary
 * etc.) so the user's Light/Dark choice is respected — we just unify
 * the *palette* across light and dark to match Noteometry's tokens.
 */

const STYLE_ID = "noteometry-global-theme";

function buildCss(): string {
  return `
/* ════════════════════════════════════════════════════════════════════
 * Noteometry global theme — applies to all of Obsidian.
 * Injected by the plugin at runtime. Removed on unload or when
 * Settings → "Apply Noteometry theme to all of Obsidian" is off.
 * ════════════════════════════════════════════════════════════════════ */

/* ── Tokens (light) ───────────────────────────────────────────────── */
body:not(.theme-dark) {
  --background-primary: #FAFAF7;
  --background-primary-alt: #F2F2EE;
  --background-secondary: #F0EFEA;
  --background-secondary-alt: #E8E7E0;
  --background-modifier-border: rgba(0, 0, 0, 0.08);
  --background-modifier-hover: rgba(0, 0, 0, 0.045);
  --background-modifier-active-hover: rgba(74, 144, 217, 0.14);
  --interactive-accent: #4A90D9;
  --interactive-accent-hover: #5A9DE6;
  --text-accent: #4A90D9;
  --text-normal: #1A1A2E;
  --text-muted: #5C6371;
  --text-faint: rgba(26, 26, 46, 0.55);
}

/* ── Tokens (dark) ───────────────────────────────────────────────── */
body.theme-dark {
  --background-primary: #1E1E22;
  --background-primary-alt: #25252B;
  --background-secondary: #18181B;
  --background-secondary-alt: #16161A;
  --background-modifier-border: rgba(255, 255, 255, 0.09);
  --background-modifier-hover: rgba(255, 255, 255, 0.05);
  --background-modifier-active-hover: rgba(90, 160, 232, 0.18);
  --interactive-accent: #5AA0E8;
  --interactive-accent-hover: #6AB0F0;
  --text-accent: #5AA0E8;
  --text-normal: #E8E8EC;
  --text-muted: #9DA1AC;
  --text-faint: rgba(232, 232, 236, 0.55);
}

/* ── Sidebar + ribbon ────────────────────────────────────────────── */
.workspace-ribbon,
.workspace-ribbon-collapse-btn,
.mod-left-split,
.mod-right-split {
  background: var(--background-secondary) !important;
}

.workspace-ribbon .side-dock-ribbon-action:hover {
  background: var(--background-modifier-hover);
  border-radius: 6px;
}

/* ── Tab bar ─────────────────────────────────────────────────────── */
.workspace-tab-header-container {
  background: var(--background-secondary);
}

.workspace-tab-header.is-active {
  background: var(--background-primary) !important;
  border-top: 2px solid var(--interactive-accent);
}

.workspace-tab-header .workspace-tab-header-inner-title {
  color: var(--text-normal);
  font-weight: 500;
}

/* ── Status bar ──────────────────────────────────────────────────── */
.status-bar {
  background: var(--background-secondary-alt);
  border-top: 1px solid var(--background-modifier-border);
  color: var(--text-muted);
  font-size: 11px;
}

/* ── Command palette + modals ────────────────────────────────────── */
.modal,
.suggestion-container,
.prompt {
  background: var(--background-primary) !important;
  border: 1px solid var(--background-modifier-border) !important;
  border-radius: 10px !important;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28) !important;
}

.suggestion-item.is-selected,
.prompt-results .is-selected {
  background: var(--background-modifier-active-hover) !important;
  color: var(--text-normal) !important;
}

/* ── File explorer rows (so Obsidian's tree matches ours) ────────── */
.nav-file-title.is-active,
.nav-folder-title.is-active {
  background: var(--background-modifier-active-hover) !important;
  color: var(--text-normal) !important;
}

.nav-file-title:hover,
.nav-folder-title:hover {
  background: var(--background-modifier-hover) !important;
}

/* ── Typography ──────────────────────────────────────────────────── */
.workspace,
.modal,
.prompt,
.suggestion-container,
.menu {
  font-family: "IBM Plex Sans", -apple-system, BlinkMacSystemFont,
               "SF Pro Display", "Segoe UI", system-ui, sans-serif;
}

/* iPad-friendly tap targets in chrome */
.workspace-tab-header,
.side-dock-ribbon-action,
.nav-file-title,
.nav-folder-title {
  min-height: 32px;
}

@media (pointer: coarse) {
  .workspace-tab-header,
  .side-dock-ribbon-action,
  .nav-file-title,
  .nav-folder-title {
    min-height: 40px;
  }
}
`;
}

/** Idempotent — calling twice replaces the existing style element. */
export function applyGlobalTheme(): void {
  removeGlobalTheme();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = buildCss();
  document.head.appendChild(style);
}

export function removeGlobalTheme(): void {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
}

export function isGlobalThemeApplied(): boolean {
  return document.getElementById(STYLE_ID) != null;
}
