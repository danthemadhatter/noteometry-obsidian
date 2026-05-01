/** v1.6.13: single source of truth for the build version that's visible
 *  in-app. Updated alongside manifest.json / package.json / versions.json so
 *  the user can confirm at a glance that Obsidian isn't serving a stale
 *  cached main.js. Rendered into the Settings tab and the tools FAB title. */
export const NOTEOMETRY_VERSION = "1.7.2";

/** Called once at plugin onload — writes a banner line to the console so
 *  Dan can open DevTools and verify the running build without needing to
 *  trigger settings UI. Intentionally a plain `console.log` rather than a
 *  Notice so it doesn't spam the UI on every Obsidian reload. */
export function logVersionBanner(): void {
  const stamp = `%c[Noteometry] v${NOTEOMETRY_VERSION} loaded`;
  const style = "color:#4A90D9;font-weight:600;font-size:12px;";

  console.log(stamp, style);
}
