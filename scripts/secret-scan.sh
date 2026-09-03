#!/usr/bin/env sh
# The Warden's secret scan (issue #32) — one command, same bytes in CI and
# by hand, so a local reading and the gate's reading cannot disagree.
#
#   scripts/secret-scan.sh <base-ref>   scan the commits base-ref..HEAD (the gate: a PR's own commits)
#   scripts/secret-scan.sh              scan the FULL history (the weekly run; the one-time 2026-08-26 reading)
#   scripts/secret-scan.sh fetch        download the PINNED binary for THIS os (sha256-verified), cache it, print its path
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
# Both sha256 values are copied from the release's own published
# gitleaks_8.30.0_checksums.txt, not from whatever a download happened to
# produce - a pin taken from the artifact in hand pins the tampering too.
GITLEAKS_LINUX_SHA256="79a3ab579b53f71efd634f3aaf7e04a0fa0cf206b7ed434638d1547a2470a66e"
GITLEAKS_WINDOWS_SHA256="54fe94f644b832dd08e8c3a5915efb3bfa862386d59fb27ca0792cb687a83573"

# WHY THIS MODE GREW AN OS (#469, 2026-09-03, his order: "Add the secret scan
# to the ceremony ... file it and get on with it"). The deploy rite runs on the
# founder's WINDOWS machine and it now calls this script, so `fetch` could no
# longer mean "the linux binary". Measured that day on that machine: no
# `gitleaks` on PATH, no `sh` on the Windows PATH, and no `curl.exe` - so the
# rite resolves Git Bash's own sh and everything below runs inside it, where
# curl, unzip and sha256sum all exist.
#
# CACHED, and the cache is verified rather than trusted: a hit still has to
# match the pin, so a truncated or swapped binary is re-fetched instead of
# being run. That is also what makes the rite work offline after its first run
# - which matters, because a control the ceremony REFUSES on must not turn a
# flaky network into "no deploys tonight".
if [ "${1:-}" = "fetch" ]; then
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) GL_OS=windows ;;
    *)                    GL_OS=linux ;;
  esac
  CACHE="${TMPDIR:-/tmp}/gitleaks-${GITLEAKS_VERSION}-${GL_OS}"
  if [ "$GL_OS" = "windows" ]; then
    BIN="$CACHE/gitleaks.exe"; SHA="$GITLEAKS_WINDOWS_SHA256"
    ASSET="gitleaks_${GITLEAKS_VERSION}_windows_x64.zip"
  else
    BIN="$CACHE/gitleaks";     SHA="$GITLEAKS_LINUX_SHA256"
    ASSET="gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
  fi
  if [ ! -x "$BIN" ]; then
    mkdir -p "$CACHE"
    curl -fsSL -o "$CACHE/$ASSET" \
      "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${ASSET}"
    echo "${SHA}  $CACHE/$ASSET" | sha256sum -c - >&2
    if [ "$GL_OS" = "windows" ]; then
      unzip -o -q "$CACHE/$ASSET" gitleaks.exe -d "$CACHE"
    else
      tar -xzf "$CACHE/$ASSET" -C "$CACHE" gitleaks
    fi
    chmod +x "$BIN"
  fi
  echo "$BIN"
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
