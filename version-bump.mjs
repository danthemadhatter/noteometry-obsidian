import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;

// Bump manifest.json to the target version, preserving everything else.
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

// Append the new version to versions.json if it isn't already there.
// The previous check looked at Object.values (the minAppVersion strings)
// instead of Object.keys (the versions), so it almost never appended.
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
if (!(targetVersion in versions)) {
	versions[targetVersion] = minAppVersion;
	writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));
}

// Keep src/lib/version.ts in lockstep so the in-app version badge can't
// drift from the shipped manifest (tests/unit/version.test.ts enforces this).
const versionTsPath = "src/lib/version.ts";
const versionTs = readFileSync(versionTsPath, "utf8");
const versionRe = /export const NOTEOMETRY_VERSION = "[^"]+";/;
if (!versionRe.test(versionTs)) {
	throw new Error(
		`version-bump: NOTEOMETRY_VERSION line not found in ${versionTsPath}`,
	);
}
const updated = versionTs.replace(
	versionRe,
	`export const NOTEOMETRY_VERSION = "${targetVersion}";`,
);
if (updated !== versionTs) {
	writeFileSync(versionTsPath, updated);
}
