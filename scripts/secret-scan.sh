#!/usr/bin/env sh
# The Warden's secret scan (issue #32) — one command, same bytes in CI and
# by hand, so a local reading and the gate's reading cannot disagree.
#
#   scripts/secret-scan.sh <base-ref>   scan the commits base-ref..HEAD (the gate: a PR's own commits)
#   scripts/secret-scan.sh              scan the FULL history (the weekly run; the one-time 2026-08-26 reading)
#   scripts/secret-scan.sh fetch        download the PINNED linux binary to /tmp/gitleaks (sha256-verified) and print its path
#
# THE PIN LIVES HERE AND NOWHERE ELSE: both workflows call `fetch`, so the
# gate and the weekly run cannot drift onto different gitleaks versions
# under one config (review note on PR #88 — the pair used to be copied
# into each workflow). Locally, `gitleaks` on PATH or GITLEAKS=/path (any
# 8.28+, the [[allowlists]] grammar). Secrets are never printed: --redact
# hides the value, and the exit code is the verdict — 1 on any finding, 0
# on none.
#
# --diff-merges=first-parent on both ranges: git's default log emits no
# patch for a merge commit, so a secret introduced only in a conflict
# resolution was invisible (driven 2026-08-26 — default 0, first-parent 1).
set -eu
# Scan THIS repo whatever the caller's cwd: the config and the target must
# be the same tree (run from elsewhere it would scan that tree under these
# allowlists — review nit on PR #88).
cd "$(dirname "$0")/.."

GITLEAKS_VERSION="8.30.0"
GITLEAKS_LINUX_SHA256="79a3ab579b53f71efd634f3aaf7e04a0fa0cf206b7ed434638d1547a2470a66e"

if [ "${1:-}" = "fetch" ]; then
  curl -fsSL -o /tmp/gitleaks.tgz "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
  echo "${GITLEAKS_LINUX_SHA256}  /tmp/gitleaks.tgz" | sha256sum -c - >&2
  tar -xzf /tmp/gitleaks.tgz -C /tmp gitleaks
  echo /tmp/gitleaks
  exit 0
fi

GL="${GITLEAKS:-gitleaks}"
CONFIG=".gitleaks.toml"
if [ "${1:-}" != "" ]; then
  RANGE="$1..HEAD"
  echo "secret-scan: commits $RANGE"
  exec "$GL" git . --config "$CONFIG" --log-opts="--diff-merges=first-parent $RANGE" --redact=100 --no-banner --exit-code 1
else
  echo "secret-scan: full history"
  exec "$GL" git . --config "$CONFIG" --log-opts="--diff-merges=first-parent" --redact=100 --no-banner --exit-code 1
fi
