#!/usr/bin/env bash
# Runs scripts/prerender.mjs on a built copy of the site (sitemap.xml and the
# prerendered pages) with Node: $NODE, or `node` from the PATH. Without
# Node, it only warns: the site works without these files, but search
# engines get less.
#
# Usage: scripts/prerender.sh <dir>
# Environment: NODE, PRERENDER_API, SKIP_PRERENDER=1, PLAYWRIGHT_MODULE,
# PLAYWRIGHT_BROWSERS_PATH, CHROMIUM, LD_LIBRARY_PATH (see prerender.mjs).
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
dir="${1:?usage: scripts/prerender.sh <dir>}"
node="${NODE:-node}"
if ! command -v "$node" >/dev/null 2>&1; then
  echo "warning: Node.js not found (set NODE): no sitemap.xml and no prerendered pages" >&2
  exit 0
fi
"$node" "$here/prerender.mjs" "$dir"
