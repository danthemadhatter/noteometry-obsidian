# Cross-Device Update Workflow (No Terminal)

> Goal: ship a Noteometry change to every device — iPad, Android, every
> Mac — without ever opening Terminal yourself.

The primary path is **Claude commits and tags → GitHub Actions builds →
BRAT pulls on every device**. Obsidian Sync is *not* the delivery
mechanism for plugin code; it only carries your settings (`data.json`).

This doc is the source of truth for that loop. There's an optional
fallback at the bottom for the case where you *do* want to build locally,
but the headline path requires no local tooling at all.

## How updates flow

```
You ask Claude to change something
        │
        ▼
Claude edits src/, bumps the version, commits, pushes a tag
        │
        ▼
.github/workflows/main.yml runs on the tag:
  npm ci  →  npm run build  →  attach main.js + styles.css + manifest.json
  to a GitHub Release named after the tag
        │
        ▼
BRAT on each device polls GitHub, sees the new release, downloads the
three files into .obsidian/plugins/noteometry/
        │
        ▼
Toggle Noteometry off/on once on each device → new code is live
```

Your only action is "ask Claude to do X." Everything below the first row
runs without you.

## One-time setup (per device)

Each device that should receive Noteometry updates needs BRAT installed
once. After that, BRAT auto-pulls forever.

1. Open Obsidian on the device → Settings → Community plugins → Browse.
2. Install **BRAT** ("Obsidian42 - BRAT") and enable it.
3. Open Settings → BRAT → Beta Plugin List → **Add Beta plugin**.
4. Paste the repo URL: `danthemadhatter/noteometry-obsidian`.
5. Leave "Auto-update at startup" **on** (BRAT default). This is what
   makes new releases land without you doing anything.
6. Confirm Noteometry shows up in Settings → Community plugins and is
   enabled.

Optional, on every device, if you want your settings (API keys, toggles,
last view) to follow you across devices:

- Settings → **Sync** → **Plugin data** ✅

You do *not* need "Installed community plugins" in Sync turned on for
this workflow — BRAT delivers the code, Sync only carries the settings.
Turning it on isn't harmful, but it can race with BRAT and create stale
file conflicts. Pick one delivery mechanism for code and stick with it
(BRAT, in this workflow).

## Daily cycle

You:

1. Ask Claude for a change.

Claude (in this sandbox):

2. Edits files in `src/`.
3. Bumps `manifest.json` (and `versions.json`).
4. Commits to a feature branch, opens or merges a PR per your normal
   review pattern.
5. Once the change is on the branch you ship from, pushes a tag like
   `v1.6.14`.

GitHub Actions (`.github/workflows/main.yml`):

6. Triggers on the pushed tag.
7. Runs `npm ci`, then `npm run build` (TypeScript check + esbuild
   production bundle).
8. Verifies `main.js`, `styles.css`, `manifest.json` all exist.
9. Creates a GitHub Release named after the tag, attaches the three
   files, generates release notes from PR titles.

BRAT (on every device, in the background):

10. Polls the repo at startup (and periodically).
11. Sees the new release tag matching `manifest.json`'s `version`.
12. Downloads the three files into `.obsidian/plugins/noteometry/`.

You, once on each device:

13. Settings → Community plugins → toggle Noteometry **off**, then **on**.
    (Obsidian caches `main.js` at load time; toggling clears the cache.
    Quitting and reopening Obsidian works too.)

That's the whole loop. Total wall-clock: ~3 minutes from "ask Claude" to
"running on iPad," dominated by the CI build (~2-3 min) and BRAT's poll
interval.

## What lives where

| File | How it gets to your devices | Notes |
|------|------------------------------|-------|
| `main.js` | GitHub Release → BRAT | the bundled plugin code |
| `manifest.json` | GitHub Release → BRAT | version + metadata; BRAT matches the tag against this |
| `styles.css` | GitHub Release → BRAT | all CSS lives here |
| `data.json` | Obsidian Sync ("Plugin data") | your settings (API keys, toggles, last view) |
| `src/**/*.ts` | NOT delivered to devices | source isn't shipped, only the bundle |

## Why BRAT, not Sync, for code

Two delivery systems racing for the same three files is the fastest way
to get version mismatch and "did this update or not?" confusion. We
picked one:

- **BRAT for code.** Versioned, atomic, tag-anchored. Easy to roll back
  (delete the release, BRAT will re-install the previous one). The plugin
  code is the high-stakes part.
- **Sync for settings.** Settings are small, frequently changing, and
  device-local in practice — exactly Sync's wheelhouse.

If you ever flip "Installed community plugins" on in Sync, expect
occasional stale `main.js` until BRAT next polls and overwrites it.

## Critical: version bump must precede the tag

BRAT compares the GitHub release tag against `manifest.json.version`. If
they don't match, BRAT silently refuses the install. Sequence:

```
1. edit manifest.json:  "version": "1.6.14"
2. edit versions.json:   add "1.6.14": "1.0.0"
3. git commit -am "v1.6.14: ..."
4. git tag v1.6.14
5. git push --follow-tags
```

(Note: `npm version patch` is supposed to do steps 1+2+3+4 in one shot
via the `version` script in `package.json`, but `version-bump.mjs` has a
bug — it skips appending to `versions.json` because the
`if (!Object.values(versions).includes(minAppVersion))` check is always
false when `minAppVersion` is constant. Until that's fixed, edit
`versions.json` by hand or run `npm version patch` and then add the new
entry to `versions.json` manually before pushing the tag.)

## Troubleshooting

**BRAT didn't pull the new release on iPad.**
Force a check: Settings → BRAT → "Check for updates to all beta plugins."
If the release exists on the [releases page](https://github.com/danthemadhatter/noteometry-obsidian/releases)
and BRAT still ignores it, the tag almost certainly doesn't match
`manifest.json.version` in that release's `manifest.json` file.

**Release page is empty after the tag push.**
Open the [Actions tab](https://github.com/danthemadhatter/noteometry-obsidian/actions)
and find the run for that tag. If `npm ci` failed, the lockfile drifted
from `package.json`. If `npm run build` failed, type errors snuck in
(reproduce locally with `npm run build`).

**Plugin still shows old behavior after BRAT pulled.**
You haven't toggled it off/on yet. Obsidian doesn't hot-reload plugin
code; it loads `main.js` once at app start (or at enable time). Toggle
off in Community plugins, toggle back on. On mobile, the toggle is in
the same place as desktop.

**Release notes are empty.**
`generate_release_notes: true` pulls titles from PRs merged since the
previous tag. If you committed straight to `main` without PRs, there's
nothing to generate. Either use PRs or pass an explicit body to the
release step.

**Two devices on different versions.**
BRAT's poll interval is per-device, so devices update on slightly
different schedules. Open BRAT → "Check for updates" on the laggard.

## Optional fallback: build locally

If you want to bypass CI and ship from the Mac (e.g. CI is down, you
don't want to wait 3 minutes for a one-line tweak), `npm run build` in
this repo already auto-deploys `main.js`, `styles.css`, `manifest.json`
to `~/Documents/Noteometry/.obsidian/plugins/noteometry/` (see
`deployToVaults()` in `esbuild.config.mjs`). From there you have two
options:

- **Sync delivers it.** Turn on Settings → Sync → "Installed community
  plugins" and Sync pushes the bundle to other devices. Toggle the
  plugin off/on on each device to reload. Caveat: if BRAT is also on,
  the two will fight; turn one off for the duration.
- **Manual copy.** Grab the three files from
  `~/Documents/Noteometry/.obsidian/plugins/noteometry/` and SCP /
  AirDrop / iCloud Drive them to other devices' plugin folders.

This is a fallback. The default and recommended path is the
Claude-codes / CI-builds / BRAT-delivers loop above.

## Why this is better than building inside Obsidian

- Type-checking still runs (`tsc -noEmit` is part of the CI build).
  In-vault esbuild-wasm builders skip this and let type errors ship.
- The build runs on a fast Linux runner, not your iPad. Bundling
  react + pdfjs + katex + html2canvas takes ~10s on a CI runner; minutes
  on a tablet, if it works at all.
- One canonical build environment, one place to debug build problems,
  one set of bytes shipped to every device.
- No dependency on a beta plugin you don't control.
