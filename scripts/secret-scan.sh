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
# `-v` (added with #469): without it this prints only `leaks found: 1`, and a
# refusal that will not say WHICH file or WHICH rule sends its reader hunting.
# Driven before it was added — under `-v` the Finding and Secret lines both
# still read `REDACTED`, so what the extra output names is the rule id, the
# file, the line and the fingerprint, and never the value.
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
# CACHED, and the cache is verified rather than trusted. ⚠ The first shape of
# this said exactly that and DID NOT DO IT (review finding on PR #473): the
# sha256 check sat inside the download branch, so on a cache HIT nothing was
# hashed at all - anything able to write to a world-writable TMPDIR could swap
# the binary and every later run would print `secret scan: ok` on its say-so.
# A comment is a report; the bytes are the fact.
#
# What happens now, EVERY invocation: the pinned ARCHIVE is sha256-checked and
# the binary re-extracted from it. The archive is downloaded only when it is
# missing or fails its hash, so the offline-after-first-success property holds
# - which matters, because a control the ceremony REFUSES on must not turn a
# flaky network into "no deploys tonight" - and a swapped or half-extracted
# binary is REBUILT from pinned bytes instead of run. The re-extract costs
# milliseconds and removes a whole class of "the cache is fine, surely".
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
  mkdir -p "$CACHE"
  # The pin decides whether the cached archive may be used, on every run.
  # `-c` is quiet-checked here only to choose the branch; the re-verify below
  # is the one whose failure is allowed to kill the script.
  if ! echo "${SHA}  $CACHE/$ASSET" | sha256sum -c --status - 2>/dev/null; then
    curl -fsSL -o "$CACHE/$ASSET" \
      "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${ASSET}"
    # Unguarded: a fresh download that does not match the pin is fatal, and
    # `set -e` is what makes it so. Nothing extracts from unpinned bytes.
    echo "${SHA}  $CACHE/$ASSET" | sha256sum -c - >&2
  fi
  # Re-extracted every time, from bytes that have just been hashed. This is
  # what a swapped or truncated $BIN is repaired by, and it is why the claim in
  # the docblock is now true of the code.
  if [ "$GL_OS" = "windows" ]; then
    unzip -o -q "$CACHE/$ASSET" gitleaks.exe -d "$CACHE"
  else
    tar -xzf "$CACHE/$ASSET" -C "$CACHE" gitleaks
  fi
  chmod +x "$BIN"
  echo "$BIN"
  exit 0
fi

GL="${GITLEAKS:-gitleaks}"
CONFIG=".gitleaks.toml"
if [ "${1:-}" != "" ]; then
  RANGE="$1..HEAD"
  echo "secret-scan: commits $RANGE"
  exec "$GL" git . --config "$CONFIG" --log-opts="--diff-merges=first-parent $RANGE" --redact=100 --no-banner -v --exit-code 1
else
  echo "secret-scan: full history"
  exec "$GL" git . --config "$CONFIG" --log-opts="--diff-merges=first-parent" --redact=100 --no-banner -v --exit-code 1
fi
