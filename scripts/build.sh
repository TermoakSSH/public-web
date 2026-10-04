#!/usr/bin/env bash
# Builds the public site alone into one directory for the server's
# `[web] dir`: a copy of site/ plus sitemap.xml and the prerendered pages
# (scripts/prerender.sh). termoak.com is built by the private web app
# instead, which runs the same step over both.
#
# Usage: scripts/build.sh [out-dir]          (dist/ by default)
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$root/dist}"
case "$(cd "$(dirname "$out")" 2>/dev/null && pwd)/$(basename "$out")" in
  / | "$root" | "$root/site" | "$root/scripts") echo "error: refusing to build into $out" >&2; exit 1 ;;
esac

rm -rf "$out"
mkdir -p "$out"
cp -R "$root/site/." "$out/"
"$root/scripts/prerender.sh" "$out"
chmod -R a+rX "$out"
echo "Built $out (public-web $(git -C "$root" describe --always --dirty 2>/dev/null || echo unknown))"
