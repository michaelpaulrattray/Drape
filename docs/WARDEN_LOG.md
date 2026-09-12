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

---

## Run 2 — 2026-09-06 02:49–03:2x AEST (Warden, patrol #2)

Ran because `patrol-clocks.mts` read the seat **4 days overdue** with his
Security switch ON, and nothing in NEXT UP was takeable by an Opus shift (each
of the six read at the card: #543 waiting on his verdict, #534 built and
waiting on his eye, #391 money-path, #404 blocked on it, #508 and #535 both
carrying a proper `awaiting-fable` hold line under #541 rule 3).

Run 1 left this run a named brief and it is worked in order: `secrets.yml`'s
first scheduled run, the first `audit_logs` read, and the standing readings.

### A. Findings baseline — the readings

**Nothing was found. Every reading below is the artifact, not the claim.**

| reading | at | verdict | done with it |
|---|---|---|---|
| gitleaks, full history — the first SCHEDULED run (run 1's stated next step) | run **33439965525**, 2026-08-31T21:10:29Z, `2f623002`, cron `0 16 * * 1` | **3094 commits, 68.47 MB, `no leaks found`** | Read at the run's own log, not at its green tick — the conclusion and the finding are different questions (#219's lesson). Baseline moves 2668 → 3094 commits, still zero. Next scheduled run 2026-09-07. |
| semgrep, tree | run **33972169630**, `team/chips-write-box` (merged as `49acd1d1`), semgrep 1.174.0 | **`Ran 76 rules on 1770 files: 0 findings`**, step green | Population 1607 → 1770 files since run 1, same 76 rules, still zero. ⚠ **The LOCAL road is gone**: `pnpm warden:semgrep` on this Windows box now fails `'semgrep' is not recognized` — run 1 took a local reading and this seat could not. CI takes it on every PR, so the reading exists; the ledger entry below records which road it is. |
| access-control suites | `31940367`, 02:49 local | **4 files / 26 tests green** — `approvalGate` 11, `staffImageBoundary` 5, `publicInputStrictness` 6, `sessionIssuanceSites` 4 | Identical to run 1. Invariant 9's five mint sites still five. |
| **`audit_logs` — the first read (run 1's stated gap)** | production, `hayabusa…:23768`, 580 rows, 2026-07-10 → 2026-09-05 | **0 critical, 6 warning** — the six are three `credits.admin_added` + their three `admin.action` partners, all July, all `userId` 1, all his own credit adjustments | Read counts and shapes only; no metadata body printed, because a body is what the boundary is about. |
| `abuse.*` rows — the login-attack detector's own writes | same read | **zero, all time** | ⚠ **Zero rows is not evidence the wire is alive**, so it was checked rather than assumed: `noteFailedLogin` is called at **both** failed-login exits (`server/routes/emailAuth.ts:243, :293`) including the unknown-email exit, and `loginAttackAlert.test.ts` drives it **11/11 green**. So the alarm is live and nothing has crossed 50 failures in five minutes — expected on a 4-account beta. |
| **the metadata boundary, at the rows** | same read, keys and lengths only | **holds** — `masterPrompt\|technicalSchema\|preferences\|resultUrl\|imageUrl` appears in **0 of 580 rows** | The two casting writers are the volume (457 `casting.scan_miss`, 19 `casting.refusal` = 82% of the log) and both are clean by construction: `scan_miss` carries `{rescan, variantId, cacheSize}`, 53 chars max; `casting.refusal` carries enumerated reason tags only (`absorbed`, `wall_unfileable`, `gate_ink_document`, … longest 17 chars), `facet` null on every row, **nothing she typed**. |
| the bug-report exception (CLAUDE.md's one enumerated widening, #255) | `31940367` | **holds** — all three procedures `adminProcedure`, never `moderatorProcedure`; `.strict()` inputs; the audit row carries `Bug report #N: from → to` and **never the `description`** | `bugReportInbox.test.ts` 12/12. Population still zero rows. |
| invariant 5 — the public-endpoint allowlist | Atlas findings | **12, matching CLAUDE.md's enumerated list name for name** | Also read: `onboarding-endpoint` 2 (the two exemptions), `non-strict-input` 132 — both exactly the figures CLAUDE.md carries. No drift. |
| `blocked_ips` | production | **0 rows** | Consistent with the documented inert control (recorded, never checked on a request). Nothing changed; not re-filed. |
| the security surface's own diff since run 1 | `git log --since=2026-08-26` | **5 commits, 8 files** — read | Two money-path: `4b4a9dfd` (#531, Stripe returns) is configured-not-Origin-derived with wire arms both environments (`productionBaseUrl.test.ts` 10/10) — the header-trust trap named and avoided; `ce6c0cb9` (#401 toolKind). Nothing to file. |
| staff population | production | **1 admin, 3 users** | Recorded. |

⚠ **A false alarm that died at the artifact, recorded so nobody re-finds it:**
the newest `auth.login` row is **2026-08-25**, eleven days before this run, which
looks like an audit write that stopped. It is not. `SESSION_MAX_AGE_MS` is
**30 days** (`shared/const.ts:2`), both mints write `LOGIN_SUCCESS`
(`emailAuth.ts:345`, `googleAuth.ts` ×2), and the shifts mint their own cookies
rather than walking the login route. A live session covers the gap entirely.

⚠ **And an arithmetic trap in this seat's own instrument:** the `json_table`
key-fan-out read reports `casting.scan_miss` at **1371** where the row count is
**457** — one row per key, three keys. The two numbers are both right and only
one of them is a row count.

### B. Instrument ledger

Unchanged from run 1 and re-read at the workflow files rather than believed:
gitleaks in `gate.yml` (step *"Secret scan (gitleaks, this PR's commits)"*),
`actionlint + zizmor`, semgrep before install, and `secrets.yml`'s Monday cron;
`knip.yml` nightly is firing (last five scheduled runs all success, 08-31 →
09-04).

**One row changes: semgrep's local road.** Run 1 recorded a LOCAL reading
(`fcfee27e`, 08:20); semgrep is no longer on this box. **CI is now the only road
to that reading**, which is the same standing the ledger already gives actionlint
and zizmor. Stated rather than left to be discovered by the next seat wondering
why the command fails.

### C. Controls

No new control was built — the anti-boredom rule binds this seat hardest, and
nothing on the queue asked for one. The controls exercised were existing ones,
each driven rather than cited: `loginAttackAlert` 11/11 (the alarm can fire),
the four access-control suites 26/26, `bugReportInbox` 12/12,
`productionBaseUrl` 10/10.

### D. What this run leaves standing, and run 3's brief

Nothing was found, so nothing was filed — a clean weekly pass.

**Run 3 (~2026-09-13) takes, in order:**
1. `secrets.yml`'s 2026-09-07 scheduled run, read at its log.
2. The `audit_logs` read again, and this time **look at whether the two casting
   writers should be in this table at all** — 82% of a staff-readable security
   log is product telemetry. It is not a boundary breach (proven above) and it is
   not a finding; it is a question about whether the abuse signal is legible
   under the volume, and it belongs to a card someone writes deliberately, not to
   a patrol that noticed it.
3. Re-read the security-surface diff since this run, the same way §A did.

**Not a Warden brief and named so it is not re-proposed:** the in-memory hash
chain, the empty admin allowlist and unchecked IP blocks are all on CLAUDE.md's
"currently not enforced" list with their roads read; none of them moved.

**Side work this shift, not part of the patrol:** #420 (the staff account search
by id) — PR #569.

## Run 3 — 2026-09-13 00:25–01:1x AEST (Warden, patrol #3, crew run #201)

Ran because `patrol-clocks.mts` read the seat **DUE today** (7 days since run 2)
with his Security switch ON, NEXT UP empty, no replies, no taps. Run 2's brief
worked in order (the scheduled secrets run, the audit rows, the surface diff),
then the seat's own card #762.

**This run FOUND things, and the biggest one was not on any list.** The two
readings below marked ⚠ are the run's findings; everything else held.

### A. Findings baseline — the readings

| reading | at | verdict | done with it |
|---|---|---|---|
| gitleaks, full history — the 2026-09-07 scheduled run (run 2's item 1) | run **34155666238**, 2026-09-07T19:27Z, `18547497`, cron | **3390 commits, 73.57 MB, `no leaks found`** | Read at the log. Baseline 3094 → 3390 commits, still zero. Next scheduled 2026-09-14. |
| semgrep, tree | run **34697721696** (PR #853, merged `b13c3da3`), semgrep 1.174.0 | **`Ran 76 rules on 1850 files: 0 findings`** (1 suppressed) | 1770 → 1850 files. The one suppression is `//! nosemgrep` inside the vendored design-handoff prototypes under `docs/specs/…/support.js` — prototype tooling's own annotation, not product code. CI is still the only road (run 2's note stands). |
| access-control suites + the wired controls | `077ac809`, 00:31 local | **6 files / 52 tests green** — `approvalGate` 11, `staffImageBoundary` 5, `publicInputStrictness` **9** (was 6: the billing five's arms), `sessionIssuanceSites` 4, `loginAttackAlert` 11, `bugReportInbox` 12 | Recorded. Five mint sites still five. |
| `audit_logs` (run 2's item 2) | production, 625 rows, 2026-07-10 → 2026-09-09 | **0 critical, 6 warning** (the same six July credit adjustments); **45 rows since run 2, all `casting.scan_miss`**, max metadata 53 chars | Boundary keys (`masterPrompt`, `technicalSchema`, `preferences`, `resultUrl`, `imageUrl`, `description`) in **0 of 625** rows. `abuse.*` still **zero all time**. Newest `auth.login` still 2026-08-25 (the 30-day session, run 2's false alarm, unchanged). Run 2's question — should the casting writers be in this table at all — is still a card nobody has written, and this patrol does not write it. |
| `blocked_ips` / staff population | production | **0 rows / 1 admin, 3 users** | Unchanged. |
| the security surface's diff since run 2 | `git log --since=2026-09-05` over `server/security`, `_core`, the auth routes, billing, admin, the workflows, the merge tool | **30 commits** — read by title, three opened | `dad85ae5` (#800 Slack retired): an admin's Approve executes a sensitive change request inside `reviewChangeRequest` (`adminProcedure`); the request is raised by a moderator and reviewed by an admin, and with admins inheriting the moderator surface one account can raise and approve its own — that is the "genuine second factor is a NEW control and a founder decision" sentence CLAUDE.md already carries, not a finding. `2ba128d5` (#733) and `fd0660e9` (#727) tightened the admin gate; `3111741b` (#700) closed four spread-row reads (invariant 8). Nothing to file. |
| ⚠ **`pnpm audit --prod` — the first time this seat has read it** | `077ac809`, pnpm 10.28.2, lockfile at HEAD | **91 advisories: 3 critical, 21 high, 40 moderate, 8 low** (129 with dev) | Reachability read at the code for every high-or-worse row and written into **#857**. The reached one: **`sharp` 0.34.5** (two HIGH advisories, libvips + libheif, *"those processing untrusted input"*) decodes customer bytes at `inkUploadService.ts:354`, `referenceAttachService.ts:124` and the concept-upload road — all three doors at `users:1` on production, so today only his own uploads reach it, and every widening widens it. NOT reached: `drizzle-orm` identifier injection (zero `sql.identifier(` / dynamic `.as(` in `server/`), `path-to-regexp` ReDoS (no three-param segment), `nanoid` (no size argument), `fast-xml-parser` (R2's own XML), `protobufjs`/`ws` (gRPC path unused). `mysql2`'s auth downgrade needs a rogue server — low. **`streamdown` has no importer anywhere and carries 25 of the moderates** — delete, not patch. Express 4's `qs`/`path-to-regexp` rows are not patchable by any express 4 (4.22.2 still pins both). |
| ⚠ **the roads that should read a known CVE** | repository settings, the gate, Socket's PR comments | **All three shut.** `GET /repos/…/vulnerability-alerts` → **404** and `dependabot_security_updates: disabled` — Dependabot ALERTS are off (version-update PRs run; no security PR has ever been opened). The gate has no audit step. Socket **Warns** on a Critical CVE (§C). | ⚠ **He was told the opposite on #35, verbatim: *"Dependabot (already on) catches dependencies with a KNOWN CVE"*** — and `.github/dependabot.yml`'s header says *"security fixes arrive as their own PRs immediately"*. Law 7c, pointed at a report he made a decision on: the settings are the artifact. On his desk as **#858** with a recommendation. |
| the patch road | PRs #632 (7 Sep) → #748 → #831 (12 Sep), run 34698885026 | **RED six days** on `check:casting-tests`: `characterSheet.ts:235` `Cannot find namespace 'sharp'`, `termsPalette.mts:164/184` not callable — the `sharp` 0.35 type shape | The 60-package group PR that carries the `sharp`, `mysql2`, `drizzle-orm`, `@aws-sdk` and `jspdf` fixes cannot merge. **#857** (seat:warden, takeable, Opus): a security-first PR, the two type sites, delete `streamdown`, done-condition is the audit number. |

### B. Instrument ledger

Unchanged from run 2 and re-read at the workflow files: gitleaks in `gate.yml`,
`actionlint + zizmor`, semgrep before install, `secrets.yml`'s Monday cron.
`knip.yml` nightly still firing. **One row is ADDED to the seat's method, not to
the gate**: `pnpm audit --prod` is a reading this seat takes every run from now
on, beside the six above, and its number goes in the table. Whether it belongs
in the gate is #858's third line and is not this seat's to decide.

**And one control's honest sentence changed — Socket.** Run 2's ledger inherited
#761's *"it refuses when told to refuse, and we have never seen it told"*. Now
measured (§C): **it is told for Known Malware alone.** The reaction arms are
untouched and still proven.

### C. Controls — #762, the positive control, driven and closed

The card asked whether Socket's verdict ever goes red here, and warned that
the answer depended on the org's policy — which the crew cannot read (no Socket
login). It was read at two artifacts instead:

1. **PR #831** (dependabot, real): a **High** *Obfuscated code* alert on
   `drizzle-orm@0.45.2` → action **Warn** → check **success**, *"Complete with
   warnings"*. Rules out the Low Noise policy (no comment there) and shows a
   High supply-chain alert does not go red.
2. **PR #856** — a throwaway DRAFT, closed and branch deleted the moment the
   readings were in, never merged. ONE harmless well-known dev dependency the
   product never imports, `minimist@1.2.5` (Critical CVE-2021-44906, no install
   script), chosen because Socket's documented policies split exactly on it:
   Default → Warn, Higher Noise → Block. **Result: action Warn, check success,
   `pr-merge-in-order --dry-run` prints `socket=green`.** (The card's own
   sketch — a package with an install script — would have read NOTHING: an
   install script is not even a Warn under the Default policy.)

**So: this organisation's policy is Socket's Default — Block on Known Malware
only; Critical CVE, typosquat, git/GitHub/HTTP dependency, protestware and
obfuscated file all Warn, the check stays green, the merge tool merges.** A red
reading cannot be produced here without adding malware, and it will not be.
#762 CLOSED with both readings; the policy choice (recommend Higher Noise) is on
his desk in #858 with the `enforce_admins` line riding along.

### D. What this run leaves standing, and run 4's brief

Filed: **#857** (takeable — the patch road), **#858** (his desk — the three
shut roads and two switches). Closed: **#762**. Nothing else moved.

**Run 4 (~2026-09-20) takes, in order:**
1. `secrets.yml`'s 2026-09-14 run at its log.
2. `pnpm audit --prod` again — the number against 91/3/21, and whether #857
   landed; if #858 was answered, whether Dependabot's first security PR
   appeared and what Socket did to it.
3. The `audit_logs` read and the surface diff, as before.

**Not a Warden brief, named so it is not re-proposed:** an `audit` step in the
gate (his line on #858 first); the express 5 migration (#857 names it as its
own card if ever wanted); the change-request self-approval shape (CLAUDE.md's
"new control, founder decision" sentence already owns it).

**Spent: nothing.** One throwaway PR, one gate run, no money, no credits.
