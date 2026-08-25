# Warden log — the findings baseline

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
| actionlint + zizmor | `scripts/workflow-lint.sh` | `gate.yml`, second step | `scripts/workflow-lint.sh` header |
| semgrep (OSS rulesets) | `pnpm warden:semgrep` | `gate.yml`, before install (run 1) | `docs/WARDEN_SEMGREP.md` |
| access-control suites | `npx vitest run server/approvalGate.test.ts server/staffImageBoundary.test.ts server/publicInputStrictness.test.ts server/sessionIssuanceSites.test.ts` | inside `pnpm test` | CLAUDE.md, "Access control" |

---

## Run 1 — 2026-08-26 08:02– AEST (Warden, patrol #1, card #97)

Inherited: #97's list. Item 1 (merge PR #89) was already done by foreman-13
(`cda444ab`) before the card was cut; the run starts at item 2.

### A. Findings baseline — the readings

| reading | at | verdict | done with it |
|---|---|---|---|
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

### C. Controls (appended after CI ran — see below)

_(pending at the time of this commit; the PR record and the next section
carry the run ids)_
