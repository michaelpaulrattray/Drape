#!/usr/bin/env sh
# The Warden's supply-chain scan (issue #35) — one command, same bytes in CI
# and by hand, so a local reading and the gate's reading cannot disagree.
#
#   scripts/socket-scan.sh              scan THIS repo's manifests (the gate's reading)
#   scripts/socket-scan.sh <target...>  scan the given dir/file instead — the road the
#                                       positive control takes (a manifest known to be bad)
#
# WHAT IT ADDS OVER WHAT WAS ALREADY RUNNING, honestly, because the answer is
# narrower than "we had no supply-chain scanning":
#   - Dependabot (already on) catches a dependency with a KNOWN CVE.
#   - `onlyBuiltDependencies` in package.json (already on) is an explicit
#     allowlist for install scripts — the most common npm vector, already shut.
#   - Socket adds BEHAVIOURAL analysis: a version that newly gained network or
#     filesystem access, obfuscated code, a typosquat — the brand-new malicious
#     package that has no CVE yet and is therefore invisible to Dependabot.
#
# `scan create --report` is what the CLI aliases as `socket ci`: it uploads the
# manifests, waits for the report, and exits NONZERO when the report is
# unhealthy under the organisation's security policy. `--report-level` defaults
# to `error`, so a policy WARNING does not redden the gate; only an error does.
#
# ⚠ EACH RUN SPENDS ONE QUOTA UNIT — the CLI's own `scan create --help` says so
# ("API Token Requirements — Quota: 1 unit"). That is why the gate step calling
# this is scoped to PRs that actually touch a manifest: the dependency set
# cannot change in a PR that does not, so a scan on every PR would buy nothing
# and spend the free tier's allowance on it.
#
# THE PIN LIVES HERE AND NOWHERE ELSE, so a hand run and the gate cannot drift
# onto different CLI versions. socket is an npm package rather than a released
# binary, so it is version-pinned through npm the way semgrep is pinned through
# pipx — there is no published checksum file to pin the way gitleaks and
# actionlint are pinned in their scripts. `--yes` keeps npx from prompting.
#
# ⚠ NO TOKEN AND NO ORG ARE TREATED AS A REFUSAL, NEVER AS A PASS (invariant 7:
# a control must refuse, not allow, when a dependency is missing or
# unconfigured — and this repository has four recorded controls that shipped
# inert). The CLI already exits 2 on a missing token (driven 2026-09-10), but it
# says so at the END of a page of banner, so the explicit check below is what
# makes the reason the FIRST thing a shift reads on a red gate.
set -eu
# Scan THIS repo whatever the caller's cwd — the CLI resolves targets relative
# to the working directory, so running it from elsewhere would scan that tree.
cd "$(dirname "$0")/.."

SOCKET_VERSION="1.1.170"

if [ -z "${SOCKET_CLI_API_TOKEN:-}" ]; then
  echo "socket-scan: REFUSING — SOCKET_CLI_API_TOKEN is not set." >&2
  echo "  In CI it is the repository secret of that name." >&2
  echo "  By hand: export SOCKET_CLI_API_TOKEN=… (or run \`socket login\`)." >&2
  echo "  This is a refusal, not a finding: nothing was scanned." >&2
  exit 1
fi

# No target given means this repo, which is what the gate wants. Asked BEFORE
# the org flag is prepended, deliberately: the first shape of this tested $1
# for a leading dash AFTER prepending `--org`, so a caller who DID pass a
# target got "." appended beside it and scanned the whole repo as well as the
# fixture — which would have made the positive control below scan a healthy
# tree alongside the bad one and report whichever verdict lost.
if [ "$#" -eq 0 ]; then
  set -- "."
fi

# The org slug is REQUIRED by the API endpoint unless the CLI can auto-discover
# it from the token (driven 2026-09-10: with neither, the CLI refuses by name).
# Passed only when set, so auto-discovery stays the default road.
if [ -n "${SOCKET_CLI_ORG_SLUG:-}" ]; then
  set -- --org "$SOCKET_CLI_ORG_SLUG" "$@"
fi

echo "socket-scan: socket@$SOCKET_VERSION scan create --report"
exec npx --yes "socket@$SOCKET_VERSION" scan create --report --no-interactive "$@"
