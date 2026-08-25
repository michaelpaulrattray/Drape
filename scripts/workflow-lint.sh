#!/usr/bin/env sh
# The Warden's workflow lint (issue #35, third instrument) — one command,
# same bytes in CI and by hand, on the shape of scripts/secret-scan.sh.
#
#   scripts/workflow-lint.sh          lint every file under .github/workflows with actionlint, then zizmor
#   scripts/workflow-lint.sh fetch    download BOTH pinned linux binaries to /tmp (sha256-verified); prints nothing, exits 0
#
# actionlint answers "is this workflow well-formed" (unknown keys, bad
# expressions, wrong runner labels, shell mistakes via shellcheck where
# shellcheck is on PATH — it is on ubuntu-latest and usually not on a
# Windows dev box, so a local reading is a FLOOR of the CI one, declared
# here rather than papered over). zizmor answers "is this workflow SAFE"
# (unpinned actions, template injection, default-broad permissions,
# persisted checkout credentials). Both readings fail on ANY finding:
# actionlint exits 1 on an error; zizmor runs the PEDANTIC persona and
# exits non-zero on any finding at all, because every finding it had on
# 2026-08-26 was fixed at the site rather than suppressed, and a nit that
# arrives with a future edit is cheaper to fix than to argue about. An
# accepted finding is suppressed AT ITS LINE with a `# zizmor: ignore[..]`
# comment carrying its reason, never globally.
#
# THE PINS LIVE HERE AND NOWHERE ELSE: the gate calls `fetch`, so the
# versions cannot drift between a local reading and the gate's. Locally,
# `actionlint` / `zizmor` on PATH or ACTIONLINT=/path ZIZMOR=/path.
set -eu
cd "$(dirname "$0")/.."

ACTIONLINT_VERSION="1.7.12"
ACTIONLINT_LINUX_SHA256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"
ZIZMOR_VERSION="1.29.0"
ZIZMOR_LINUX_SHA256="dd96df044a6e8538d5f423790f453bdd03d49e5b2bcc38214acc41a2f1297839"

if [ "${1:-}" = "fetch" ]; then
  curl -fsSL -o /tmp/actionlint.tgz "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz"
  echo "${ACTIONLINT_LINUX_SHA256}  /tmp/actionlint.tgz" | sha256sum -c - >&2
  tar -xzf /tmp/actionlint.tgz -C /tmp actionlint
  curl -fsSL -o /tmp/zizmor.tgz "https://github.com/zizmorcore/zizmor/releases/download/v${ZIZMOR_VERSION}/zizmor-x86_64-unknown-linux-gnu.tar.gz"
  echo "${ZIZMOR_LINUX_SHA256}  /tmp/zizmor.tgz" | sha256sum -c - >&2
  mkdir -p /tmp/zizmor-bin
  tar -xzf /tmp/zizmor.tgz -C /tmp/zizmor-bin
  # The archive's layout is not promised; find the binary wherever it landed.
  ZZ="$(find /tmp/zizmor-bin -type f -name zizmor | head -n 1)"
  [ -n "$ZZ" ] || { echo "workflow-lint: zizmor binary not found in archive" >&2; exit 1; }
  cp "$ZZ" /tmp/zizmor && chmod +x /tmp/zizmor /tmp/actionlint
  exit 0
fi

AL="${ACTIONLINT:-actionlint}"
ZZ="${ZIZMOR:-zizmor}"

echo "workflow-lint: actionlint $("$AL" -version | head -n 1)"
"$AL" -no-color .github/workflows/*.yml
echo "workflow-lint: $("$ZZ" --version)"
# --offline: no GitHub API calls, so the reading needs no token and cannot
# vary with rate limits; the audits that need the network (e.g. whether a
# pinned tag has moved) are NOT run here — Dependabot's github-actions
# ecosystem is what keeps the pins current.
exec "$ZZ" --no-progress --color=never --offline --persona pedantic .github/workflows/
