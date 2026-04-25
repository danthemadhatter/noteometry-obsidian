# Cross-Device Updates via Obsidian Sync

> Goal: build once on the Mac, every other device picks up the new plugin
> automatically. No Terminal on iPad, Android, or any second Mac — ever.

This is the supported, Sync-native workflow. It does **not** require any
in-vault build plugin (no "In-App Builder," no esbuild-wasm). It relies on
Obsidian Sync, which is already paid for, and on the auto-deploy step that
`npm run build` runs at the end of every production build.

## How the bytes flow

```
Mac (build host)              Obsidian Sync                Other devices
────────────────              ─────────────                ─────────────
  src/*.ts                                                  iPad
    │                                                       Android
    │ npm run build                                         other Macs
    ▼
  main.js + styles.css + manifest.json
    │
    │ esbuild.config.mjs auto-copies into the Sync'd vault
    ▼
  ~/Documents/Noteometry/
    .obsidian/plugins/noteometry/  ───►  Obsidian Sync  ───► every device
```

Two facts make this work:

1. `esbuild.config.mjs` deploys the three plugin files into the Sync vault's
   `.obsidian/plugins/noteometry/` folder at the end of every production
   build. (See `deployToVaults()` in `esbuild.config.mjs`.)
2. Obsidian Sync, with **Installed community plugins** turned on, propagates
   that folder to every device on the same Sync remote.

The build runs on the Mac. Sync moves the bytes. Nothing else has to happen.

## One-time setup (per device)

On **every** device that should receive Noteometry updates — including the
Mac that builds — open Obsidian and turn these on:

- Settings → **Sync** → **Installed community plugins** ✅
- Settings → **Sync** → **Plugin data** ✅ (only if you want `data.json`
  settings to follow you across devices; see "Settings vs. code" below)

That's the only one-time step. Don't toggle "Themes" or "CSS snippets"
unless you're using those for something else.

## Daily cycle

On the Mac:

1. Edit files in `src/`.
2. Run the build. Either:
   - `npm run build` in Terminal, **or**
   - bind a hotkey / Shortcut / Raycast script to that command and never see
     Terminal again.
3. Wait ~10 seconds. The build prints `[deploy] 3/3 files →
   ~/Documents/Noteometry/.obsidian/plugins/noteometry`.

On every other device:

1. Sync pulls the new files in the background.
2. In Obsidian, Settings → Community plugins → toggle Noteometry **off**
   then **on** to force-reload the new `main.js`. (Obsidian caches the
   plugin code at load time; toggling is the cheap way to clear that
   cache. Quitting and reopening Obsidian works too.)

That's it. No git, no SSH, no BRAT on follow-on devices.

## What's synced, what's not

| File | Sync'd by | Notes |
|------|-----------|-------|
| `main.js` | Installed community plugins | the bundled plugin code |
| `manifest.json` | Installed community plugins | version + metadata |
| `styles.css` | Installed community plugins | all CSS lives here |
| `data.json` | Plugin data | settings (API keys, toggles, last view) |
| `src/**/*.ts` | NOT synced | source isn't in the vault, nor should it be |

`src/` is in `~/noteometry-obsidian/`, which is **not** the vault. Sync
doesn't touch it and shouldn't.

## Settings vs. code

- **Plugin code** = `main.js` + `manifest.json` + `styles.css`. Synced via
  *Installed community plugins*. This is the part that changes when you
  ship a new version.
- **Plugin settings / data** = `data.json`. Synced via *Plugin data*. This
  is your API keys, auto-save toggle, etc. Most people want this on, but
  if you have device-specific settings (e.g. a different LM Studio URL on
  the Mac), leave *Plugin data* off and re-enter settings per device.

## Initial bootstrap on a new device

For Sync to *deliver* the plugin folder, the plugin folder must already
exist on that device — Sync doesn't conjure the folder structure for a
plugin Obsidian has never seen.

The quickest bootstrap on a fresh device:

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat).
2. Add `danthemadhatter/noteometry-obsidian`.
3. Let BRAT install the latest GitHub release once.
4. Enable Noteometry in Community plugins.
5. From this point on, Sync handles every future update — BRAT is no
   longer needed for *this* device.

(Or copy the three files manually from the Mac's `.obsidian/plugins/noteometry/`
to the new device. Either works.)

## Troubleshooting

**iPad / Android still shows the old plugin after I built on the Mac.**
Obsidian only loads `main.js` once at startup (or when the plugin is
toggled on). Sync delivers the file in the background, but Obsidian won't
reload it on its own. Fix: Settings → Community plugins → toggle Noteometry
off, then on. Or quit and reopen Obsidian.

**Sync says "uploading" forever.**
The build deploys three small text files. If Sync stalls, it's almost
always something else in the vault (a 500 MB attachment, a stuck PDF). Open
Settings → Sync → Logs and check what's actually transferring.

**`[deploy] skipping missing vault: ...` appears in build output.**
Obsidian Sync's local vault folder isn't where the build expects. Update
`VAULT_PLUGIN_PATHS` in `esbuild.config.mjs` to your actual path, or just
move/symlink the vault to `~/Documents/Noteometry/`.

**Version number didn't change after Sync ran.**
You probably forgot to bump `manifest.json`. Run `npm version patch` to
bump everything in lockstep, then build. (Sync delivers whatever bytes are
on disk — if the bytes are old, the version is old.)

**I want this without ever opening Terminal.**
Bind a hotkey or Shortcut to `cd ~/noteometry-obsidian && npm run build`.
On macOS, the cleanest options are: a Shortcuts.app shortcut with a "Run
Shell Script" action, or a Raycast script command. Either runs the build
silently in the background; you never see a terminal window.

## Why this is better than an in-vault builder

- Type-checking still runs (`tsc -noEmit` is part of `npm run build`).
  In-vault builders that use only `esbuild-wasm` skip this and let
  type errors ship.
- The Mac is fast at bundling react + pdfjs + katex + html2canvas. iPad
  and Android are not.
- One copy of the toolchain, one place to debug build problems.
- No dependency on a beta plugin you don't control.
