# Warden log — the findings baseline

**Clock:** every 7 days. (Machine-readable — `scripts/patrol-clocks.mts` reads
this line and the newest `## Run` date to tell a shift whether the seat is due.)

The Warden seat's record (PROGRAM.md, "THE CLOCKS"; first run ordered by the
founder 2026-08-26, *"do it"*). What lives here and nowhere else:

1. **The findings baseline** — every security reading the seat takes
   (gitleaks over the full history, semgrep over the tree, the
   access-control suites, the audit rows), with the verdict AT THE ARTIFACT
   (run id, commit, count) and what was done with each finding. A finding
   becomes a card the same day; a false positive is annotated at its line
   with its reason, never silenced globally.
2. **The instrument ledger** — which readers stand in the gate, at what
   version, and the control that proved each one can fail (working law 2:
   a green suite proves nothing if the checker cannot go red).

Every Warden run BEGINS by reading this file and ENDS by appending to it.
Findings are deduped against the queue, open and closed. The anti-boredom
rule binds the seat hardest of all: a security control is built only from a
card that predates the shift and names the finding it answers — "we could
also harden X" is a Retro proposal, not a Warden brief.

The instruments and their own record pages:

| reader | command | in the gate | record |
|---|---|---|---|
| gitleaks (this PR's commits) | `scripts/secret-scan.sh origin/main` | `gate.yml`, first step after checkout | `.gitleaks.toml` header |
| gitleaks (full history, weekly) | `scripts/secret-scan.sh` | `secrets.yml`, Mondays 16:00 UTC | `secrets.yml` header |
| gitleaks (the commits a rite push adds) | `scripts/secret-scan.sh <remote tip>` | `deploy-rite.mts`, before the push (#469) | the step's own docblock |
| actionlint + zizmor | `scripts/workflow-lint.sh` | `gate.yml`, second step | `scripts/workflow-lint.sh` header |
| semgrep (OSS rulesets) | `pnpm warden:semgrep` | `gate.yml`, before install (run 1) | `docs/WARDEN_SEMGREP.md` |
| access-control suites | `npx vitest run server/approvalGate.test.ts server/staffImageBoundary.test.ts server/publicInputStrictness.test.ts server/sessionIssuanceSites.test.ts` | inside `pnpm test` | CLAUDE.md, "Access control" |

---

## Run 1 — 2026-08-26 08:02–08:07 and 08:17– AEST (Warden, patrol #1, card #97)

Two seats: the first opened PRs #109/#110 at 08:07 and its process died
before any close; the second resumed at 08:17 from the artifacts alone (no
mailbox entry, no briefing existed) and finished the run. Close time is in
§D, stamped after the close.

Inherited: #97's list. Item 1 (merge PR #89) was already done by foreman-13
(`cda444ab`) before the card was cut; the run starts at item 2.

### A. Findings baseline — the readings

| reading | at | verdict | done with it |
|---|---|---|---|
| gitleaks, the rite's arm | driven by hand 2026-09-03 (PR #473), both refusal shapes | **passes clean, refuses on a plant** | A fake AWS-shaped key planted in a commit stopped the push and named the file, value redacted. ⚠ The FIRST fixture passed when it should have failed — it contained `EXAMPLE`, which gitleaks' default config allowlists, so it proved nothing; a positive control for this scanner must avoid every placeholder word. A missing (127) or non-executable (126) binary is reported as *could not run*, never as a finding. |
| gitleaks, full history | run 32888582030, hand-dispatched 2026-08-25 19:15Z, 2668 commits | **0 findings** under `.gitleaks.toml` | This is the baseline until `secrets.yml`'s first Monday run fires (next: 2026-08-31 16:00 UTC — the workflow was created 08-26, so no scheduled run has happened yet; the next Warden reads that run's verdict first). |
| semgrep, tree | `fcfee27e`, 08:20 local, semgrep 1.174.0, 76 rules, 1607 targets | **0 findings**, exit 0 | Row appended to `docs/WARDEN_SEMGREP.md`. The first entry on this baseline is the reading BEFORE it: the `heroProxy.ts` bare-index fix (#33's first reading, `833175a3` — `/api/hero/constructor` passed the unknown-asset door; fixed with `Object.hasOwn`, pinned by `server/heroProxy.test.ts`, the two sibling request-keyed lookups swept). New ceiling recorded: `react-unsanitized-method` timed out on `server/castingV2/refineService.test.ts`, so that rule did not read that file. |
| access-control suites | `fcfee27e`, 08:22 local | **4 files / 26 tests green** — `approvalGate` 11, `staffImageBoundary` 5, `publicInputStrictness` 6, `sessionIssuanceSites` 4 | Recorded; nothing to file. |
| audit rows | — | **not read this run** | #97 does not name them; the weekly clock's second run takes the first `admin_audit` read (the login-attack detector's `abuse.global_attack_detected` rows are the first thing to look for). Stated rather than skipped silently. |

### B. Instrument ledger — what this run put in the gate

- **semgrep gate step** (#33's open half): `gate.yml` "Static shapes
  (semgrep, OSS rulesets)" — `pipx install semgrep==1.174.0`, then
  `pnpm warden:semgrep`, before `pnpm install`. The rulesets and flags live
  in `package.json` alone (law 4); the version pin is in two places by
  necessity and `docs/WARDEN_SEMGREP.md` says so.
- **knip nightly** (#34's open half): `.github/workflows/knip.yml`, main at
  15:00 UTC nightly and by hand. A reading, not a gate: red only when knip
  cannot run; counts to the run summary; list as a 30-day artifact. Actions
  pinned by SHA on #89's shape (`upload-artifact` v7.0.1 →
  `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`, resolved at the tag by
  `gh api`).
- Local ceiling, stated: actionlint and zizmor are not on this Windows box,
  so the new workflow's lint reading is CI's alone — the gate's own
  workflow-lint step on the PR is the control for `knip.yml`'s shape.

- **Two review findings folded in before merge** (the gate's Fable review
  of PR #109): (1) `knip.yml` treated exit 1 as "knip listed issues", but
  pnpm itself exits 1 when the script it is asked for does not exist — a
  renamed `janitor:knip` would have left every nightly green with an empty
  table. A 1 now has to carry at least one `Category (N)` heading or the job
  reddens (the heading shape checked against a local reading: seven
  headings, every one matched by the pattern). (2) the semgrep step ran
  `pnpm` on the runner image's system Node, before `setup-node`; Node 24 is
  now set up first, and the step keeps its before-install property.

### C. Controls (working law 2 — seen to fail before it counted)

Recorded AT THE RUNS, by the second seat of this patrol (the first seat's
process died between opening the PRs and writing its close):

| control | branch / PR | run | outcome |
|---|---|---|---|
| **semgrep step — positive** | `team/warden-1-semgrep-plant` (PR #110, NEVER merged), `9ebe509a` = PR #109's commit + `server/_semgrepPlant.ts` (`res.send(eval(String(req.query.code)))` and `exec(req.query.cmd)`) | **32905105740** | gate-checks **FAILURE at step 7 "Static shapes (semgrep, OSS rulesets)"** — every step before it green, every step after it skipped. The log: `2 Code Findings` in `server/_semgrepPlant.ts`, both Blocking (`direct-response-write`, `code-string-concat`), `Ran 76 rules on 1608 files: 2 findings`, exit 1. |
| **semgrep step — negative** | `team/warden-1-ci-steps` (PR #109), `c211b901` — the same tree minus the plant | **32904675152** | gate-checks SUCCESS, step 7 green, `1607` files, 0 findings; typecheck, both atlases and the unit suite green after it. |
| **the ceiling, re-measured in CI** | same plant | same run | the `exec(req.query.cmd)` line produced **no finding** — only the `eval` did. Exactly what `docs/WARDEN_SEMGREP.md` recorded from the local plant (#33): these rulesets do not taint-track a shell command from a request. Not a regression; a known hole, stated twice now. |
| `knip.yml` shape | PR #109 | 32904675152, step 5 | actionlint + zizmor (pedantic) read the new workflow and passed it — the only lint reading this file has, since neither tool is on the Windows box. |
| `upload-artifact` pin | — | `gh api repos/actions/upload-artifact/git/ref/tags/v7.0.1` | resolves to `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` — a lightweight tag straight to the commit, re-resolved independently by the second seat (the review asked for one). |
| access-control suites | `fcfee27e`, re-run by the second seat 08:24 | — | 4 files / 26 tests green, same numbers as §A. |

The plant branch and PR #110 are closed and deleted once this row exists;
the run id is the artifact, and it outlives the branch.

### D. Close — 2026-08-26 08:28 AEST, stamped by a THIRD seat

The second seat pushed `7153ab86` at 08:21 and its process died too — the
gate still running, PR #109 open, no mailbox entry, no briefing edition, no
§D. The next shift (08:24) found the patrol at the artifacts alone, the
same way the second seat had, and closed it: gate on `7153ab86` completed
SUCCESS (run 32905724602 — semgrep step, workflow lint, typecheck, both
atlases, unit suite all green; Fable review pass), **PR #109 merged
`efa88ea0`**, the `team/warden-1-ci-steps` branch and its worktree removed,
card #97 closed. Verified before merging rather than believed: the diff was
re-read in full by the third seat (`gate.yml` +24, `knip.yml` new, the two
record pages), and PR #110's plant branch was already gone from origin.

What this patrol leaves standing: semgrep is a required gate check from
`efa88ea0` on (its positive control is §C, run 32905105740); knip reads
main nightly at 15:00 UTC — the first scheduled run is tonight, and the
next Janitor reads its summary; the findings baseline is §A. Nothing
spent. **Next Warden run ~2026-09-02**: read `secrets.yml`'s first Monday
run (08-31), the first `admin_audit` read (§A's stated gap), append run 2.

A process note for the Retro, not a Warden finding: one patrol, three
processes, two deaths mid-close — the R5 class (#101) twice in one card.
