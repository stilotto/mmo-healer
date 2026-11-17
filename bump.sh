#!/bin/sh
# Stamp every module with a fresh version so browsers fetch new files after a
# push instead of serving cached ones. Run before each commit: ./bump.sh
set -e
cd "$(dirname "$0")"
V=$(date +%Y%m%d%H%M%S)
python3 - "$V" <<'PY'
import sys, re, glob, json
v = sys.argv[1]
T = '0.186.1'  # three.js version; tools/shot.mjs must match
imports = {
  'three': 'https://cdn.jsdelivr.net/npm/three@%s/build/three.module.js' % T,
  'three/addons/': 'https://cdn.jsdelivr.net/npm/three@%s/examples/jsm/' % T,
}
for f in sorted(glob.glob('js/*.js')):
  if f != 'js/main.js':
    imports['./' + f] = './' + f + '?v=' + v
html = open('index.html').read()
block = '<script type="importmap">' + json.dumps({'imports': imports}, indent=1) + '</script>'
html = re.sub(r'<script type="importmap">.*?</script>', lambda m: block, html, flags=re.S)
html = re.sub(r'js/main\.js(\?v=\d+)?"', 'js/main.js?v=' + v + '"', html)
open('index.html', 'w').write(html)
PY
echo "version $V"
