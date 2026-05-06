# Release Checklist

> Single source of truth for shipping a Noteometry release. Every bump goes through these steps — no exceptions.

Current version: **1.14.11** (see [`manifest.json`](./manifest.json), [`package.json`](./package.json), [`versions.json`](./versions.json), [`CHANGELOG.md`](./CHANGELOG.md)).

---

## 0. Pre-flight (once per branch)

- [ ] Working tree clean (`git status` is empty)
- [ ] On `main` (or a feature branch that has been PR-merged into `main`)
- [ ] `npm install` has run at least once since the last `package.json` change
- [ ] `npm test` passes (vitest)
- [ ] `npm run build` passes (tsc + esbuild production bundle)

Lint (`npm run lint`) is currently known to fail on a dependency-side issue; do not block the release on it, but note it in the PR.

**On the deploy gate (v1.7.2+):** `esbuild.config.mjs production` only auto-copies the bundle into `~/Documents/Noteometry/.obsidian/plugins/noteometry/` when the current branch is `main`. On any other branch it logs `[deploy] branch is "..." not "main" — skipping vault deploy` and leaves the vault untouched. Override with `NOTEOMETRY_FORCE_DEPLOY=1 npm run build`. CI is unaffected (the vault path doesn't exist on the runner).

---

## 1. Bump metadata — one version string, everywhere

The authoritative version lives in `manifest.json`. Every other copy must follow.

| File | Field | Tool that keeps it in sync |
|------|-------|----------------------------|
| `manifest.json` | `version` | `scripts/ship.sh` |
| `package.json` | `version` | `scripts/ship.sh` |
| `versions.json` | key (`"X.Y.Z": "1.0.0"`) | `scripts/ship.sh` |
| `package-lock.json` | top-level `version` + root package `version` | `npm install` / `npm ci` |
| `README.md` banner | `# Noteometry vX.Y.Z` | manual |
| `README.md` architecture block | `Noteometry vX.Y.Z — System Architecture` | manual |
| `docs/FEATURES.md` header note | "Current as of **vX.Y.Z**" | manual |
| `docs/ARCHITECTURE.md` header note | "Current as of **vX.Y.Z**" | manual |
| `docs/DEVELOPMENT.md` header note | "Current as of **vX.Y.Z**" | manual |
| `docs/API.md` header note | "Current as of **vX.Y.Z**" | manual |
| `RELEASE.md` "Current version" line (top of this file) | bare `X.Y.Z` | manual |
| `AGENTS.md` BRAT example | `v` + `X.Y.Z` (in the prose example) | manual |
| `CHANGELOG.md` | new `## X.Y.Z — YYYY-MM-DD` section at the top | manual |
| `src/lib/version.ts` `NOTEOMETRY_VERSION` constant | bare `X.Y.Z` | `scripts/ship.sh` (pinned by `tests/unit/version.test.ts`) |

Do **not** edit `V3_SOURCE_TAG` in `src/lib/pageFormat.ts` — it is a persistence format tag (historical `noteometry-1.5.0`), not the plugin version. Changing it is a storage migration.

### Using `scripts/ship.sh`

The helper bumps the patch digit, builds, commits, tags with a `v` prefix, and pushes:

```bash
./scripts/ship.sh "one-line summary of what this release changes"
```

It does **not** touch README / docs banners or `CHANGELOG.md`. Those stay manual on purpose so the human writing the release notes also updates the user-visible strings.

---

## 2. Update `CHANGELOG.md`

Add a new section at the top:

```markdown
## X.Y.Z — YYYY-MM-DD

One-paragraph summary. Call out scope limits.

- **Change 1.** Why and what.
- **Change 2.** Why and what.
- **Tests:** which suites were added or updated; final pass/fail count.

Out of scope (hard constraints, untouched): Math v12 prompt, MathML generation, copy-to-Word, clipboard pipeline, right-click context hub concept.
```

Preserve every prior entry. Historical changelog entries are not current documentation and are free to reference older version numbers and old tool names — leave them alone.

---

## 3. Merge to `main`

- [ ] PR reviewed and merged to `main`
- [ ] Local `main` pulled (`git checkout main && git pull`)

---

## 4. Tag with the `v` prefix

**This repo uses the `v` prefix** — `v1.14.11`, not `1.14.11`. The release workflow fires on any pushed tag and uses `github.ref_name` as both the release name and tag name, so BRAT matches `manifest.json` `"version": "1.14.11"` against a release whose tag is `v1.14.11`.

```bash
git tag vX.Y.Z         # e.g. v1.14.11
git push origin main --tags
```

**Note on the current release pipeline:** since v1.14.x, `main` also has an auto-tag workflow (`.github/workflows/auto-tag.yml`) that reads `manifest.json` on every push to `main` and creates the matching `vX.Y.Z` tag server-side if it doesn't already exist, then builds and publishes the release in the same run. In practice that means a squash-merge to `main` produces a finished release in ~35–45 seconds; manual `git tag` + push is the fallback path.

`scripts/ship.sh` does this automatically.

Obsidian's official sample-plugin guideline recommends a bare-number tag. This project diverged early for compatibility with its existing release history and must keep the `v` prefix to avoid breaking BRAT users already on an older version. If you ever want to flip to bare numbers, migrate every prior tag first.

---

## 5. Verify the release workflow

`.github/workflows/main.yml` runs on any pushed tag. It:

1. Installs deps (`npm ci`)
2. Runs `npm run build`
3. Verifies `main.js`, `styles.css`, and `manifest.json` exist at repo root (bytes printed to the workflow log)
4. Creates a GitHub release whose tag and name both equal `github.ref_name` (e.g. `v1.14.11`)
5. Attaches `main.js`, `styles.css`, `manifest.json` as individual top-level release assets; `fail_on_unmatched_files: true` stops the job if any are missing

Open the Actions tab, confirm the green check, then open the Releases page and confirm:

- [ ] Tag is exactly `vX.Y.Z` (matches `manifest.json` version with the `v` prefix — e.g. `v1.14.11`)
- [ ] All three release assets present, each at the top level of the release (not zipped)
- [ ] `manifest.json` asset `version` field equals `X.Y.Z`

---

## 6. Smoke-test BRAT pull

On a test vault:

- [ ] BRAT auto-update pulls `vX.Y.Z`
- [ ] Obsidian reloads the plugin without errors
- [ ] Canvas opens with Pen as default tool (v1.6.9+)
- [ ] Right-click opens the hub; Clear Canvas is reachable near the top
- [ ] CanvasNav (Sections | Pages) renders at the top of the canvas; click section, click page, double-click rename, right-click delete with confirm (v1.14.9+)
- [ ] Right-clicking a CanvasNav row does NOT also pop the canvas tools menu (v1.14.11+)
- [ ] No Home view / no "Plugin no longer active" ghost tab restored from old workspace.json (v1.14.10 swept it)
- [ ] Core smoke flows still work: pen draw, lasso OCR round-trip, insert Calculator / Graph Plotter / Circuit Sniper, Math v12 solve, copy-to-Word from chat (do not modify these; just confirm they still work)

---

## Protected pipelines — do not touch in a release

The following are load-bearing and have dedicated regression tests. A repo-hygiene release must never modify them:

- **Math v12 DLP prompt** (`mathV12Preset.test.ts`)
- **MathML generation** (`mathml.test.ts`, `src/lib/mathml.ts`)
- **Copy-to-Word clipboard payload** (`clipboardPayload.test.ts`)
- **Right-click context-menu hub concept** (the action wiring may be repaired; the hub concept itself is stable)
- **Lasso stack behaviour** (multi-region stack, rasterize/composite pipeline)

If a release touches any of these, it is a feature release — call that out explicitly in `CHANGELOG.md` and in the PR description.
