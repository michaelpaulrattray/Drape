#!/usr/bin/env sh
# The Warden's secret scan (issue #32) — one command, same bytes in CI and
# by hand, so a local reading and the gate's reading cannot disagree.
#
#   scripts/secret-scan.sh <base-ref>   scan the commits base-ref..HEAD (the gate: a PR's own commits)
#   scripts/secret-scan.sh              scan the FULL history (the weekly run; the one-time 2026-08-26 reading)
#
# Needs `gitleaks` on PATH (or GITLEAKS=/path/to/binary). Pinned in the
# workflows to 8.30.0 by sha256; locally any 8.28+ (the [[allowlists]]
# grammar). Secrets are never printed: --redact hides the value, and the
# exit code is the verdict — 1 on any finding, 0 on none.
set -eu
GL="${GITLEAKS:-gitleaks}"
CONFIG="$(dirname "$0")/../.gitleaks.toml"
if [ "${1:-}" != "" ]; then
  RANGE="$1..HEAD"
  echo "secret-scan: commits $RANGE"
  exec "$GL" git . --config "$CONFIG" --log-opts="$RANGE" --redact=100 --no-banner --exit-code 1
else
  echo "secret-scan: full history"
  exec "$GL" git . --config "$CONFIG" --redact=100 --no-banner --exit-code 1
fi
