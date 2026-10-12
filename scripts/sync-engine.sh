#!/usr/bin/env bash
# Copies the OSRS Wiki DPS calculator's engine, data and tests into vendor/osrs-dps-calc,
# then applies the small fixes in patches/. It stops if a patch no longer applies.
# Usage: scripts/sync-engine.sh [git ref]   (default: main)
set -euo pipefail

REPO="weirdgloop/osrs-dps-calc"
REF="${1:-main}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/vendor/osrs-dps-calc"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

SHA="$(curl -fsSL "https://api.github.com/repos/$REPO/commits/$REF" | sed -n 's/^  "sha": "\([0-9a-f]*\)".*/\1/p' | head -1)"
curl -fsSL "https://github.com/$REPO/archive/$SHA.tar.gz" | tar xz -C "$TMP"
SRC="$TMP/osrs-dps-calc-$SHA"

rm -rf "$DEST"
mkdir -p "$DEST/src/public/img" "$DEST/cdn"
cp -R "$SRC/src/lib" "$SRC/src/types" "$SRC/src/enums" "$SRC/src/tests" "$DEST/src/"
cp "$SRC/src/utils.ts" "$DEST/src/"
cp -R "$SRC/src/public/img/prayers" "$SRC/src/public/img/potions" "$DEST/src/public/img/"
cp -R "$SRC/cdn/json" "$DEST/cdn/"
cp "$SRC/LICENSE" "$DEST/LICENSE"
echo "$SHA" > "$DEST/COMMIT"
for p in "$ROOT"/patches/*.patch; do
  patch -s -p1 -d "$DEST" < "$p"
done
echo "Synced $REPO at $SHA"
