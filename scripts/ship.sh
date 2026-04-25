#!/bin/bash
# Bump patch version, build, commit, tag, push.
# Usage: ./scripts/ship.sh "commit message"
set -euo pipefail
MSG="${1:?commit message required}"
cd "$(dirname "$0")/.."
CUR=$(python3 -c "import json; print(json.load(open('package.json'))['version'])")
NEW=$(python3 -c "v='$CUR'.split('.'); v[-1]=str(int(v[-1])+1); print('.'.join(v))")
echo "bump $CUR → $NEW"
python3 - "$CUR" "$NEW" <<'PY'
import json, sys, re
cur, new = sys.argv[1], sys.argv[2]
for f in ['package.json', 'manifest.json']:
    d = json.load(open(f))
    d['version'] = new
    json.dump(d, open(f, 'w'), indent='\t')
v = json.load(open('versions.json'))
v[new] = v.get(cur, '1.0.0')
json.dump(v, open('versions.json', 'w'), indent='\t')
ts = open('src/lib/version.ts').read()
pattern = r'export const NOTEOMETRY_VERSION = "[^"]+";'
if not re.search(pattern, ts):
    raise SystemExit('ship.sh: NOTEOMETRY_VERSION line not found in src/lib/version.ts')
open('src/lib/version.ts', 'w').write(re.sub(pattern, f'export const NOTEOMETRY_VERSION = "{new}";', ts))
PY
npm run build
git add -A
git commit -m "v$NEW: $MSG"
git tag "v$NEW"
git push origin main --tags
