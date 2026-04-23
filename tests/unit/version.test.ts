/** v1.6.13: Pin the version constant to the manifest so the in-app badge
 *  can never drift from the shipped release. If someone bumps manifest.json
 *  and forgets src/lib/version.ts (or vice versa), this test fails loudly. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { NOTEOMETRY_VERSION } from "../../src/lib/version";

describe("NOTEOMETRY_VERSION", () => {
  it("matches manifest.json", () => {
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as { version: string };
    expect(manifest.version).toBe(NOTEOMETRY_VERSION);
  });

  it("matches package.json", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    expect(pkg.version).toBe(NOTEOMETRY_VERSION);
  });

  it("has a new entry in versions.json", () => {
    const versions = JSON.parse(readFileSync("versions.json", "utf8")) as Record<string, string>;
    expect(versions[NOTEOMETRY_VERSION]).toBeTruthy();
  });
});
