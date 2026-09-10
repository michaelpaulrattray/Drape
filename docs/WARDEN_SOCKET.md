# Warden instrument: Socket.dev (supply-chain / malicious packages)

`pnpm warden:socket` — the Warden's reader for a dependency that is *hostile*
rather than merely *vulnerable* (issue #35). It uploads this repo's dependency
manifests to Socket, waits for the report, and exits nonzero when that report
is unhealthy under the organisation's security policy. The CLI aliases the
same thing as `socket ci`; the flags and the version pin live in
`scripts/socket-scan.sh` alone, so a hand reading and the gate's reading cannot
disagree.

## What it adds, honestly — and it is narrower than "we had no supply-chain scanning"

Stated plainly because the card that ordered it assumed more:

- **Dependabot** (already on) catches a dependency with a **known CVE**.
- **`onlyBuiltDependencies`** in `package.json` (already on) is an explicit
  five-package allowlist for install scripts — the single most common npm
  supply-chain vector, and it was already shut.
- **Socket adds behavioural analysis**: a version that newly gained network or
  filesystem access, obfuscated code, a typosquat — the **brand-new malicious
  package that has no CVE yet**, and is therefore invisible to Dependabot.

That is a real gap, and that is the whole of the gap.

## Where it runs, and why not everywhere

`gate.yml`, step *"Supply chain (socket.dev, manifests only)"*, after
`setup-node` and **before install** (it needs no `node_modules`).

⚠ **It runs only on a PR whose diff touches `package.json` or
`pnpm-lock.yaml`.** Two reasons, both measured rather than assumed:

- **A scan costs one quota unit.** The CLI's own `scan create --help` says so
  under *API Token Requirements*. The account is a free tier.
- **The dependency set cannot change in a PR that touches neither file**, so a
  scan on every PR would spend the allowance re-reading bytes it already read.

The path filter is **derived, not trusted**: `server/socketScan.test.ts` reads
the repo's real manifests out of `git ls-files` and reddens if one of them is
not covered by the step's pattern. Today there are exactly two, both at the
root. A `client/package.json` arriving tomorrow turns that arm red on the day
it lands — because the failure it guards is silent: an uncovered manifest
means the step keeps printing *"No manifest touched"* over a PR that changed
dependencies.

## ⚠ His GitHub App already posts a check on EVERY PR — so this step may be the wrong answer

The Socket **GitHub App** is installed (2026-09-10 05:37Z) and posts two checks
on **every** pull request: *"Socket Security: Pull Request Alerts"* and
*"Socket Security: Project Report"*. Neither is a required check, so neither
blocks a merge today.

**Adding that check to branch protection would give blocking enforcement with
no script, no version pin, no extra token scope and no quota spent by this
repository.** That is the disappearing-technology law's clause 4 — *read what
the engine already gives you before reaching for a better one; a signal bought
and unread is the cheapest finding available*. **The decision is the founder's
and it is on his desk.**

### ⚠ The first version of this section argued the opposite, and it was wrong

Kept rather than replaced, because the mistake is more instructive than the
conclusion. It read: *"the App posts nothing at all on a PR that touches no
manifest — measured on #751, #750 and #746 — so requiring its check would leave
every non-manifest PR permanently pending."*

**All three of those PRs merged BEFORE the App was installed** — 05:12Z, 04:51Z
and 03:14Z against an install at 05:37Z. So "touched no manifest" and "had no
Socket App" were **perfectly confounded**, and the baseline could only ever have
returned the answer it did.

The clean comparison is two PRs opened *after* the install: **#753** (changes
`package.json`) and **#754** (changes no manifest at all). **Both carry two
Socket checks.** The App does not care about manifests.

### What still argues for the gate step, weakly

It is versioned in this repository and its behaviour is pinned by
`server/socketScan.test.ts`; the App's configuration lives in Socket's own
dashboard and can change without a commit here. That is a real fidelity
argument. It is not obviously worth a duplicate scan plus a token scope the
founder must add, which is why it is his call rather than a shift's.

## It blocks, and here is what that costs

A supply-chain scan that only labels is theatre, so this one is inside
`gate-checks` and a red is a red. The price of that choice, named here rather
than discovered on a bad night:

- It is a **third-party network call on a required check**. An exhausted quota
  or a Socket outage reddens a PR for a reason that is not in the tree. The
  manifest scoping is the mitigation — most PRs never call it at all.
- If the org's policy turns out noisy, **the one-line road to advisory** is
  `|| true` plus a `::notice::` in that step. Written down so nobody has to
  design it under pressure.
- `--report-level` defaults to `error`, so a policy **warning** does not redden
  the gate. Only an error does.

## Refusal, not a pass

⚠ **No token means REFUSE.** Invariant 7 — a control must refuse, not allow,
when its dependency is missing — and this repository has four recorded controls
that shipped green while doing nothing. `scripts/socket-scan.sh` checks the
token before it calls anything and exits 1 saying *"nothing was scanned"*, so a
red gate reads as a refusal rather than sending a shift hunting a malicious
package that was never looked for.

Driven 2026-09-10: the CLI on its own exits **2** with no token and no org, but
only after a page of banner, which is why the explicit check exists — the
reason is the first line a shift reads.

⚠ **The org slug is REQUIRED, and this was learned the expensive way round.**
The script passes `--org` only when `SOCKET_CLI_ORG_SLUG` is set, on the
assumption that the CLI could auto-discover the org from the token. **It
cannot** — driven on PR #753's first gate run, where the token reached the CLI
(`token: UqR5e*** (env)`) and it still exited 2 on *"Org name by default
setting, --org, or auto-discovered (missing)"*. The local drive could not
answer this, because with no token there was no token to discover FROM. The
gate sets `SOCKET_CLI_ORG_SLUG: klieg`, which is not a secret: it is in the URL
of the App's own check on every manifest PR, which is where it was read from.

That first red run is also the proof the refusal works end to end: a
misconfigured scanner reddened the gate instead of passing it.

## ⚠ The token needs `security-policy:read`, and until it has it this cannot merge

Driven on PR #753's second gate run, and it is the useful half of the finding —
**the scan itself worked**: the CLI authenticated (`org: klieg`, `token:
UqR5e*** (env)`), found and uploaded **7 manifest files**, and reported *"Scan
result: success."* It then failed on the report:

```
Socket API Request failed (403): Insufficient permissions
  Details: {"requiredScopes":["security-policy:read"]}
```

Deciding *healthy or not* means reading the organisation's security policy, and
the token he created carries full-scans, packages, report and repo scopes but
not that one. **It is one checkbox on his token at
`socket.dev/dashboard/org/klieg`.**

Two things follow, and the second is the one worth writing down:

- **The PR carrying this step is not merged until the scope exists.** With the
  scope missing the step reddens every manifest PR, and a refusal only the
  founder can clear would wedge the team.
- **Dropping `--report` is NOT the fix.** It would make the step green by
  creating scans that nothing ever reads — invariant 7, *a control that is not
  invoked does not exist*, wearing the costume of a passing check.

## By hand

```
export SOCKET_CLI_API_TOKEN=…      # or: socket login
pnpm warden:socket                  # this repo
sh scripts/socket-scan.sh <target>  # some other manifest — the positive control's road
```

## The pin

`SOCKET_VERSION` in `scripts/socket-scan.sh`, and nowhere else — the drift the
gitleaks pair was repaired for on PR #88, where the version had been copied
into each workflow. `socket` is an npm package rather than a released binary,
so it is version-pinned through npm the way semgrep is pinned through pipx;
there is no published checksum file to pin it the way gitleaks and actionlint
are pinned inside their own scripts. `server/socketScan.test.ts` asserts the
version string does not appear in `gate.yml`.

## Controls

`server/socketScan.test.ts`, five arms, each driven to red on its own sabotage
(2026-09-10) and green on every other:

| arm | sabotage that reddens it |
|---|---|
| covers every tracked manifest | drop `pnpm-lock.yaml` from the gate's pattern |
| is a real filter, not `.*` | widen the pattern to `.*` |
| the gate calls the script, with the secret | replace the call with `echo skipped` |
| the pin is in one place | copy the version into `gate.yml` |
| refuses with no token | make the script `exit 0` instead |

The refusal arm **executes the script** and reads its exit code; it does not
grep for the word, because a grep passes just as happily on a comment
promising a refusal the code does not perform.

## What is NOT here

- **No weekly full sweep.** gitleaks has one (`secrets.yml`) and Socket has a
  strong case for one — its value is largely *new intel about a version already
  installed*, which a PR-triggered scan can never see. It is a second thing and
  it costs a second workflow, so it is **filed as a card** rather than built
  unasked.
- **No `--reach`** (reachability analysis). It installs the dependency tree and
  runs a separate analyser; minutes, not seconds, on a required check.
- **No context flags** (`--repo`, `--branch`, `--pull-request`). The GitHub App
  install supplies the repository association; adding them is a dashboard
  nicety, not a control.
