# Janitor log — the litter ledger

**Clock:** every 3 days. (Machine-readable — `scripts/patrol-clocks.mts` reads
this line and the newest `## Run` date to tell a shift whether the seat is due.)

The Janitor seat's record (PROGRAM.md, "THE CLOCKS"; first run ordered by the
founder 2026-08-26, *"do it"*). What lives here and nowhere else:

1. **The litter ledger** — what was on disk that should not have been, what
   was deleted, what could not be, and the count that the next run starts
   from. Deletions inside the repository go by MANIFEST (the shape is
   `docs/specs/CASTING_V2_LITTER_PURGE_MANIFEST.md`): a keep is a citation,
   never a judgement of value; the 7-day rule keeps anything recent.
2. **The dead-code readings** — knip's counts per run are in
   `docs/JANITOR_KNIP.md`'s table; this file records what was DONE with
   them (cards filed, ceilings found, attempted-and-reverted deletions).

Every Janitor run BEGINS by reading this file and ENDS by appending to it.
Findings are deduped against the queue, open and closed. knip, the Atlas
and the un-wiring differ are three readers with no shared resolver, and
none of them has deletion authority on its own.

---

## Run 1 — 2026-08-26 07:35–07:58 AEST (Janitor, patrol #1, card #96)

Inherited: the 294-file untracked litter the planner seat left, the `output/`
remainder (#8), knip's first reading (#34), and four items named on #96.

### A. Litter ledger — outside the repository

| item | found | done |
|---|---|---|
| Orphaned worktree directories `C:\Users\Admin\drape-relay-78`, `drape-relay-79`, `drape-shift-71-eol`, `drape-shift-crew-tab` | all four present (22–23 entries each), none registered in `git worktree list`, no `.env` inside, no process with the path on its command line (`wmic process`) | **deleted**, `rm -rf`, all four in one pass — Windows had let go |
| `drape-shift-73` (held a copied `.env`) | **already absent** | nothing to do; recorded so the `.env` is known gone |
| `output/.tok`, `.tok2`, `.tok3`, `.tok4` — minted session JWTs from drive scripts, 2026-08-08 | present, each starting `eyJ` (a JWT header); untracked, never committed (`git ls-files output` = 0) | **deleted** |
| `.playwright-mcp/` — 12 `console-*.log` + 4 `page-*.yml` | the "key-shaped string" on #96 was two 40+-char base64 blobs in one console log (`EQEAAADf…`, `EgAAAAAA…` — image/graph data, not a credential; no `eyJ…`, `sk-`, `AKIA`, `Bearer` or `app_session_id=` in any log) | **all 16 deleted**; directory empty |
| `.gitignore` | neither directory was ignored; both had 0 tracked files | **PR #104** adds `output/` and `.playwright-mcp/` |

### B. Litter ledger — the `output/` remainder (#8)

`output/_purge/outputdirs.txt` (760 paths): **37 still present at start; 4
deleted; then a single `rm -rf` hung past a 10-minute tool timeout** — the
machine condition #8 records, reproduced. **33 remain.** Untracked, uncited,
nothing at risk. Not retried by hand; run 2 retries ONCE and records the
count. Comment left on #8.

### C. Untracked litter inside the repository (inventory, not deleted)

`git status --porcelain -uall`: `output/` 4162 · `scripts/` 288 (all
`_*-disposable.*`, the class #8's manifest deletes by name) · root: 3
`_slice_*.txt` (2026-08-20, inside the 7-day rule) and 2 `FABLE_R7_*_REVIEW.md`
(July; CITED by `CASTING_V2_ARCHITECTURE_PLAN.md`, `CLEANUP_MILESTONE_TRIAGE.md`,
`CLAUDE_R7_3A_CAST_PROFILE_REVIEW_PROMPT.md` — so a KEEP under the manifest's
own rule, and a candidate for committing rather than deleting). No manifest
was cut this run: the disposable-script class already has one (#8) and the
rest is either kept-by-rule or in flight.

### D. Dead-code reading → cards

knip re-run at `c6273d0a`: **51 files / 34 deps / 7 devDeps / 173 exports /
115 types / 18 duplicates** — identical to the #34 first reading except one
export (174 → 173). Cross-checked before filing: the 11 non-shadcn files were
read at the Atlas (0 inbound edges on all 11; `Navigation.tsx` already
lifecycle `delete`, `features/casting/index.ts` lifecycle `retire`) and by an
independent import grep (every hit was a same-named DIFFERENT module).

- **#105** — 40 unused shadcn primitives + 21 `@radix-ui` deps + satellites.
- **#106** — 11 non-shadcn files, three readers agree; the retire-lifecycle
  barrel excluded (goes with #29).
- **#107** — 7 devDeps (`add`/`pnpm` = a mistyped `pnpm add` from bootstrap)
  + `semgrep` as an unlisted binary → `ignoreBinaries`.
- **#108** — 173 exports / 115 types / 18 duplicates, triaged through the
  differ (never-wired vs UN-wired), duplicates first.

**Ceiling found**: `scripts/lib/sabotage.mts` reads as unused because its
only importer is a `*-disposable.mts`, and disposables are ignored by
design. Recorded in `JANITOR_KNIP.md`; it is a KEEP.

### E. Anti-boredom check
Every act above traces to #96's own list or #8. No instrument built, no
manifest invented. Nothing spent.

**Next run (~2026-08-29)**: retry the #8 remainder once; re-read knip (counts
should not move until #105–#108 land); the `_slice_*.txt` files leave the
7-day window on 2026-08-27 and are uncited — delete then; decide whether the
two `FABLE_R7_*` reviews are committed under `docs/specs/` (they are cited
from there) or left; check whether `drape-shift-35`/`35b` still belong to a
live seat (#89 is merged).

---

## Run 2 — 2026-08-29 06:56–08:0x AEST (Janitor, patrol #2, card #96)

Clock: run 1 was 2026-08-26 07:35, cadence 3 days, so this run is due 07:35 and
the shift spans it. Inherited: run 1's own "Next run" list, the `output/`
remainder (#8), and the fifteen-file red list foreman-84 and foreman-86 posted to
#8 (both filed, neither worked, both explicitly deferred to this clock).

### A. ⚠ THE `output/` REMAINDER WAS NEVER A MACHINE CONDITION — IT WAS TWO ORPHANED `rm` PROCESSES, ONE OF THEM RUN 1'S OWN

**33 → 2.** Run 1 recorded *"a single `rm -rf` hung past a 10-minute tool
timeout"* and filed it as a property of the machine. It is not. Read at the
process table:

| pid | started | command |
|---|---|---|
| 17108 | **2026-08-26 07:35:57** | `rm -rf output/_facePanel.backup.ts` |
| 2056 | **2026-08-25 16:08:01** | `rm -rf -- output/_roll375.mts` |

**17108 is Janitor run 1's own hang, still alive three days later**, and 2056 is
a shift from the day before that. Each held a pending delete on its file, and
every later `rm` on the same path blocked behind it — which is why run 1's sweep
"hung", why this run's first loop deleted nothing in two minutes, and why a
`Remove-Item` from PowerShell hung identically.

**The controls that separated the file from the directory** (working law 2 — the
hang looked like an `output/`-wide condition, and it was per-file):

- a **fresh** file created and deleted in `output/` — instant, both directions;
- `stat`, a 40-byte read, and `mv` on the stuck files — all instant, so the
  bytes and the directory entry were both healthy;
- `rm` on two untouched purge files (`_view.mts`, `_atlas88.txt`) — instant.

Only the two paths with an ancient `rm` behind them refused. Five stuck `rm.exe`
processes were killed (three of them this run's own, queued behind the two old
ones); **31 of the 33 then deleted**, one path per `rm`, each logged before and
after so a hang names its own path rather than the whole run
(`scripts/_janitor-run2-purge-disposable.sh`).

**Two remain and they are the two that were held**: `output/_facePanel.backup.ts`
and `output/_roll375.mts`. Killing the holder did NOT release them — a delete
begun and interrupted leaves the file in Windows' delete-pending state, and
nothing short of a reboot is expected to clear it. They are recorded rather than
retried: a third and fourth stuck `rm` is a worse outcome than two files.

**The lesson is process hygiene, not disk**: a tool timeout kills the *tool call*,
not the process it started. A sweep that hangs must be followed by killing what it
left, or the next run inherits a file nothing can delete. Recorded on #8.

### B. Litter outside the repository

| item | found | done |
|---|---|---|
| `drape-shift-131c`, `131d`, `131e`, `drape-shift-71-verify` | unregistered in `git worktree list`, no process holding any (`wmic`), each holding **only** a `node_modules` symlink | **deleted** — link removed first (`rm` on the link, never `rm -rf` through it), then `rmdir`; main tree's `node_modules` verified intact (70 entries, `.bin/vitest` present) after each |
| `Drape-wt-166` | **a fifth orphan run 1 did not see** — completely empty, unregistered, 2026-08-27 | **deleted** |
| `drape-shift-35`, `drape-shift-35b` | registered worktrees, both clean (0 dirty, 0 untracked), branches `team/35-workflow-lint` / `-x` **both ancestors of `main`**, PR #89 MERGED | **removed** (`git worktree remove`) and both branches deleted. Run 1 asked exactly this. **An open card (#35 is still open) does NOT make a worktree live** — issues are the record of WORK; a worktree is disposable infrastructure and whoever takes #35 next mints a fresh one |
| `drape-debris-2026-08-19.zip`, `drape-untracked-2026-08-19.zip`, `drape-untracked-tail-2026-08-19.zip` | **KEEP — cited by `docs/specs/CLEANUP_MILESTONE_TRIAGE.md`** (lines 1743, 1885, 1946), a tracked document under a named authority | left, and recorded so the next run does not re-open it |
| 5 loose logs (`drape-71-check.log`, `drape-71-test.log`, `drape-shift-16-test{,2}.log`, `drape-shift-71-eol-install.log`, ~6 MB) | 2026-08-26, **inside the 7-day window** | left; deletable at run 3 (2026-09-01 onward) |
| `drape-pinned-42652964` (detached HEAD, 2026-08-21), `Drape-census` (`census/full-map`, merged, 2026-08-22) | registered, clean but for an untracked `output/`, nothing holding them | **record-and-leave.** Neither is holding a lock or a red suite, so there is no cost to asking rather than deciding: the pinned tree's name suggests the un-wiring differ's two-tree reading, and the census tree's `output/` may hold artifacts the census program cites. **Owner question for run 3** |

### C. ⚠ THE FIFTEEN REDS ARE CURED WITHOUT DELETING ANYTHING — THE KEEP TEST STAYS THE DATE

`pnpm test` was red in three suites and `pnpm check` in one, on the main tree, and
every offender was an untracked `scripts/_*-disposable.mts` from a shift that has
closed. **Measured mtimes: 2026-08-26 11:32 through 2026-08-29 03:54 — every one
of the fifteen is INSIDE the manifest's 7-day window.**

The disposition, and the reasoning that decides it:

1. **The mailbox is not a citation authority** (it is "receipts and handoffs,
   never state"), so foreman-86 naming its files *"a shape worth copying"*
   neither keeps them nor blocks their deletion. The only thing keeping these
   fifteen is guard (b), the 7-day rule.
2. **"The sitting is over" is not a keep test, and adopting it would be the
   wrong seat amending a ratified guard.** Guard (b) was added at authorization
   (fable-1676) with its own stated rationale — *"uncited is true of every
   document the day it is written"* — and a lone patrol cannot rewrite it
   mid-run to license tonight's deletion. Three of the fifteen were less than
   six hours old. If "closed sitting beats the window" is to become doctrine it
   is a manifest amendment and goes upward; it is filed as a card, not enacted.
3. **Narrowing the guards to tracked files is dead** for #8's own stated reason:
   a script that runs can take a false reading whether or not it is committed.

So the reds are cured the only way left — **compliance**, which is what both
guards' own messages ask for and which costs fifteen mechanical edits:

- **8 exits.** `process.exit(0)` appended to `_briefing-e78`, `_court177-grid`,
  `_drive-219-brief`, `_drive-author-5g`, `_ghost-grid`, `_ghost-restrip`,
  `_shift85-css-emitters`.
- **6 connections** routed through the one door (`scripts/lib/dbConnection.mts`):
  `_court177-anchor-verify`, `_court93-orc`, `_court93-rows`, `_founder-144-roll`,
  `_founder-register-roll`, `_ghost-restrip`. Each had exactly two `mysql`
  references and nothing else, and `resolveDatabaseUrl()` reproduces the
  `MYSQL_PUBLIC_URL ?? DATABASE_URL` each was already doing, so `assertSameWorld`
  passes under both `--service MySQL` and `--service Drape`.
- **1 literal.** `_briefing-e87` quoted the not-an-image sentence inside its own
  prose; it imports `BYTES_NOT_AN_IMAGE_MESSAGE` and interpolates now.
- **1 type.** `_briefing-e80`'s TS2353 was **its own local annotation**
  (`journal: { at: string }[]`), not drift in the product's briefing shape.

**All four checks green after**: the three suites 22/22, `pnpm check` exit 0 with
zero `error TS`.

⚠ **Editing a file resets its mtime and therefore restarts its 7-day clock.** The
ORIGINAL mtimes of all 307 disposables were recorded before a byte was touched
(`output/janitor-run2-disposable-mtimes.txt`) so **run 3 sweeps on the original
dates, not on tonight's repair date.**

### C-bis. ⚠ A GUARD FINDING, FOUND BY THE PATROL AND NOT FIXED HERE

`_shift83-tables-disposable.mts` ended `await db.end(); process.exit(0);` — **on
one line** — and `scriptExitDiscipline` refused it. Read at the code:
`terminalStatement` walks back to the last line beginning with an identifier and
`exitContract` then requires the statement to *start* with `process.exit(`, so a
semicolon-joined pair defeats it. **The script exits; the guard says it does
not.** The file was split onto two lines (the cheap half); the blind spot is a
card, because a guard that falsely refuses is how guards come to be worked
around, and fifteen files is what "worked around" looks like at scale. It errs
toward NOISE rather than silence, which is the safer direction and still costs a
shift a diagnosis.

### D. Root litter

- `_slice_body.txt`, `_slice_head.txt`, `_slice_rest.txt` (2026-08-20) —
  **deleted**: outside the window and cited by nothing (run 1's own instruction).
- `_commitmsg.txt` (2026-08-28) — inside the window, left.
- ⚠ `FABLE_R7_7D_D4D2_REVIEW.md`, `FABLE_R7_CASTING_STUDIO_UX_REVIEW.md` —
  **KEEP, untracked, and the question run 1 left open was already answered.**
  `docs/specs/CLAUDE_R7_3A_CAST_PROFILE_REVIEW_PROMPT.md` line 45 names
  `FABLE_R7_CASTING_STUDIO_UX_REVIEW.md` among the files that **must remain
  unstaged**, and `CLEANUP_MILESTONE_TRIAGE.md` line 1754 already ruled on the
  sibling: *"stays because its sibling is named must-remain-unstaged by a tracked
  prompt — untracked-and-live is a deliberate state in that family."* Committing
  them under `docs/specs/` would have contradicted a tracked instruction.
  **A patrol reads the triage's own refusals before re-asking one of its
  questions** — that is the durable half of this row.

### E. Dead-code reading → the reading table was mixing two reporters

knip re-read twice, on purpose:

| reading | files | deps | exports | types | duplicates |
|---|---|---|---|---|---|
| nightly `33128922917`, CI, 2026-08-28, `pnpm janitor:knip` | 51 | 1 file | 180 | 117 | 18 |
| this run, local, `pnpm janitor:knip` (compact) | 50 | 1 file | 178 | 117 | 19 |
| this run, local, **default reporter** | 50 | **34** | **443** | **250** | 19 |

⚠ **The compact reporter counts FILES; the default reporter counts SYMBOLS**, and
run 1's row took `files`/`deps`/`devDeps`/`duplicates` from one and
`exports`/`types` from the other. So *"173 unused exports, 115 unused types"* —
the headline of card **#108**, and of run 1's row — are **file counts**. The real
symbol population is **443 unused exports and 250 unused types**, 2.6× and 2.2×
what the card says. Nothing has grown; the instrument was read two ways.
Commented on #108; the table below states its reporter from this row on.

**Two real deltas since the nightly**, both explained rather than listed:

- `client/src/features/castingV2/conceptUpload.ts` — a **new duplicate export**
  (`CONCEPT_REVIEW_READING = CONCEPT_READING_LABEL`), landed in `e45e5611`
  (#196/#197). It is duplicate #19 and belongs to #108's first slice.
- `scripts/lib/sabotage.mts` reads unused in CI and **not** locally — the local
  tree holds an untracked importer (`_format-vocab-sabotage-disposable.mts`) that
  a clean checkout does not. The exact mechanism inside knip's `ignore` semantics
  is **not** established and is not guessed at; what is established is the
  doctrine: **a local knip reading is contaminated by untracked scratch, so the
  NIGHTLY is the authority.** The workflow's own header says the two "cannot
  disagree" because it is the same command — measured, they disagree by one row.

### F. Anti-boredom check

Every act traces to run 1's own "Next run" list, to #8, or to a finding this
patrol produced on its own clock. No instrument was built. Nothing was spent —
no credits, no house money, no render, no reader, no production change.

**Next run (~2026-09-01)**: the five loose logs leave the window on 2026-09-02;
the disposables outside the window number **36 as of this run** and need a
citation pass before any sweep (the manifest's own lesson — `scripts/` must be an
authority over itself); the two undeletable `output/` paths should be retried
once after a reboot and then declared; the owner question on
`drape-pinned-42652964` and `Drape-census`; and re-read knip from the NIGHTLY,
not locally.

---

## Run 3 — 2026-09-05 05:19–06:0x AEST (Janitor, patrol #3)

Clock: run 2 was 2026-08-29, cadence 3 days, so this run was **4 days overdue**
— `patrol-clocks.mts` ranked this seat first of four overdue seats and the
founder's Housekeeping switch is ON. Inherited: run 2's own "Next run" list, the
`output/` remainder (#8), the fifteen-red class (#335, which had grown), and the
orphan `drape-shift-435-hero` that foreman-20260905-0510 left named.

### A. ⚠ THE KEEP TEST IS KEYED ON A FIELD THAT ANYTHING CAN SILENTLY RESET — AND IT WAS RESET, ON 270 OF 307 FILES, IN ONE HOUR

**This is the run's finding, and it invalidates the plan run 2 wrote for run 3.**

Run 2 closed with an instruction that was exactly right in intent: *"Editing a
file resets its mtime and therefore restarts its 7-day clock. The ORIGINAL
mtimes of all 307 disposables were recorded before a byte was touched
(`output/janitor-run2-disposable-mtimes.txt`) so run 3 sweeps on the original
dates, not on tonight's repair date."* That record survived and was read.

**Measured against it, file by file:**

| | |
|---|---|
| recorded by run 2 | **307** |
| still on disk | **307** (deleted since: 0) |
| mtime unchanged | **37** |
| ⚠ **mtime MOVED** | **270** |
| what all 270 moved TO | **2026-08-30, hour 11** — a single hour |

**Every untracked disposable in `scripts/` now carries an mtime of 2026-08-30 or
later. Not one is older.** So on the disk's own evidence the entire population
sits inside the manifest's 7-day window and **nothing is ever sweepable** — the
guard fails in the direction where litter only accumulates, which is the
direction nothing ever complains about.

**What it was NOT** (controls run rather than assumed): not a line-ending
normalisation — the 270 touched and the 37 untouched are **all LF, zero CRLF**,
so the two groups are indistinguishable by content shape. No shift entry from
2026-08-30 claims a mass edit of the disposables. **The cause is not established
and is deliberately not guessed at** (law 7b).

**It is independently corroborated, and it also corrects a live card.** #335
dates its seven offenders at *"last modified 2026-08-30 11:13"* and reads that
as their age. Run 2's record has `_briefing-e88` at **2026-08-29 05:22** and
`_briefing-e89` at **2026-08-29 06:20**. The 11:13 stamp is the mass event, not
authorship — two artifacts, written for different reasons, agreeing on the hour.

⚠ **The durable lesson is bigger than this population: an mtime is not evidence
of age, it is evidence of the last thing that touched the file.** A keep test
built on one is a guard whose population can only grow. **This run did not amend
the manifest** — run 2's own ruling stands that a lone patrol cannot rewrite a
ratified guard mid-run — so the finding is a card, and the deletions below were
dated at an artifact the machine cannot reset instead.

### B. THE DATING THAT REPLACED IT — a committed artifact, not a timestamp

`pnpm check` was **RED on main**: 19 errors across 11 untracked disposables
(#335, matching foreman-200's 2026-09-04 reading exactly). Seven of the eleven
are spent one-shot briefing writers orphaned when `journal` left the schema.
They cannot be repaired: the field they write no longer exists and the briefing
schema is `.strict()`.

**#335's own recommendation is *"Delete the seven"*, and it names the condition:
*"that is a call for the Janitor seat with the switch on."* Both held tonight.**

Their age was established **at the editions they produced**, which are committed
to `server/crew/crew-briefing.json` and cannot be re-stamped by anything on this
machine:

| writer | edition it shipped | edition's first commit | date |
|---|---|---|---|
| `_briefing-e88-disposable.mts` | 88 | `3f282601` | 2026-08-29 |
| `_briefing-e89-disposable.mts` | 89 | (same series) | 2026-08-29 |
| `_briefing-e90-disposable.mts` | 90 | `2826a491` | 2026-08-29 |
| `_shift84-briefing-repair-disposable.mts` | (repair) | (same series) | 2026-08-29 |
| `_shift95-briefing-e99-disposable.mts` | 99 | `9f3a81d9` | 2026-08-29 |
| `_shift96-briefing-e100-disposable.mts` | 100 | `44ac97ef` | 2026-08-29 |
| `_shift98-briefing-e102-disposable.mts` | 102 | `1cf532e5` | 2026-08-29 |

**Seven days to the day, so outside the window, without trusting a single
mtime.** Tracked citations checked before each: **0 for all seven.** The
briefing stands at edition 246. **Deleted — 52,240 bytes. This table is the
manifest #335's bar asks for**; nothing was swept silently.

**The other four are INSIDE the window on genuine mtimes (2026-09-01 and
2026-09-03, both after the mass event) and were REPAIRED, not deleted:**

- `_381-after`, `_381-before`, `_382-frames` — `headless: "new"`, which this
  tree's `puppeteer-core` types as `boolean | "shell"`. Now `headless: true`.
  **This is the commonest offender in the whole class**, and the `verify` skill's
  own recipe still writes it.
- `_466-authorbench` — it **re-declared the product's `StatedAge` locally** as
  `{ band: string; phase?: string }` and passed it to code expecting the real
  union. Working law 4 inside a script: a mirror that compiles until the source
  moves. It **imports** `StatedAge` from `server/castingV2/seedFidelity` now,
  which immediately caught a fixture missing its required `phase`.

**`pnpm check` exits 0 on the main tree** — the first green baseline since
2026-08-31. #335's bar 1 is met.

### C. THE GUARD THAT WAS MISSING — #335's bar 3, and #249's structural ask

The prescribed shift close ran two guards over a shift's disposables and
**neither typechecks anything**, so a disposable passed the entire close
carrying a type error; CI never sees an untracked file, so the red landed only
on the next shift's local tree. That is why the population grew 15 → 18 → 19
across three re-measurements **while every shift reported a green close**.

Added in the same sitting, in both places a shift can meet it:

- **the close ritual** (`.agents/foreman/prompt.md`, gitignored — no PR exists
  for it) now names `npx tsc --noEmit -p tsconfig.scripts.json` beside the other
  two, with the measured numbers as its reason;
- **`scripts/SKELETON-disposable.mts`**, the copy site, gains it as guard 4 —
  #335's own second, smaller recommendation — and it names both offender shapes
  so the next author recognises them.

### D. Litter ledger — outside the repository

| item | found | done |
|---|---|---|
| `drape-shift-435-hero`, `drape-shift-492-strip` | unregistered in `git worktree list`, no process holding either (`Win32_Process`, matched on command line), **each holding ONLY a `node_modules` Junction into the main tree** | **deleted** — junction removed with `rmdir` FIRST, never `rm -rf` through it, then the empty parent. Main tree's `node_modules` verified at **77 entries with `.bin/vitest` present, before and after each** |
| 5 loose logs (`drape-71-check`, `drape-71-test`, `drape-shift-16-test{,2}`, `drape-shift-71-eol-install`, ~6 MB) | 2026-08-26, now **10 days old** — run 2 marked them "deletable at run 3" | **deleted**, one path per `rm`. Their only citations are the mailbox (**not an authority**), this log (which says delete), and untracked scratch |
| `drape-debris-2026-08-19.zip` and two siblings | **KEEP**, unchanged — cited by `CLEANUP_MILESTONE_TRIAGE.md` | left, and recorded so run 4 does not re-open it |
| `drape-pinned-42652964` (registered, detached) | ⚠ **run 2's owner question is CLOSED by a citation**: `scripts/court-ink-carry-a-disposable.mts:19` names the directory **by path, in a TRACKED file**. The un-wiring differ does not need it — its own docblock creates and removes throwaway trees | **KEEP.** 220 MB |
| `Drape-census` (registered, `census/full-map`) | branch is an **ancestor of main**; holds only an untracked `output/` (2.3 MB — `_vitest-full.log` and ~20 uncited census scratch scripts). **No tracked file cites the directory** — `server/preCommitGate.test.ts:122` creates a temp branch of the same NAME, which is not a citation of this tree | **record-and-leave.** 229 MB. The scratch inside is the only copy of a founder-ordered instrument's working files; **committing or zipping it is the decision, and then the tree goes.** The owner question stays open for run 4 rather than being answered by deleting it |

### E. `output/` — #8's stated remainder is ZERO, and a different remainder has grown

**The 760-path list is complete: 0 of 760 still present.** Run 2 left 2, both in
Windows' delete-pending state after an interrupted `rm`, and recorded that
"nothing short of a reboot is expected to clear it" — **one `rm` each cleared
both tonight**, so the expectation was right and the machine has since let go.
**#8's `⚠ PARTIAL` is closed at the measurement.**

⚠ **What has grown is a DIFFERENT population and must not be confused with it.**
`output/` is now **1,420 entries and 6.5 GB**, and it is court frames rather
than scratch:

```
1.1G  masked                     170M  _shift93          141M  view-reference-court
779M  framing-court              166M  glossary-court    134M  imagegen
170M  prompt-author-court-run3   156M  prompt-author-court-run2
```

**These are cited artifacts.** Court records under `docs/specs/` name strips
inside them, so a sweep here breaks a record's evidence — the disposition needs
a citation pass and a written manifest, which is a run of its own. Carded, not
touched.

### F. Dead-code reading — from the NIGHTLY, per run 2's doctrine

Nightly `33903445959`, 2026-09-04, compact reporter (**file** counts, not
symbols — run 2's correction):

| reading | files | deps | exports | types | duplicates |
|---|---|---|---|---|---|
| nightly 2026-08-28 (run 2) | 51 | 1 | 180 | 117 | 18 |
| **nightly 2026-09-04 (this run)** | **69** | 1 | **186** | **122** | **19** |

**Unused files 51 → 69 in seven days (+18)** is the delta worth a look; the
other three moved by single digits. Recorded on #108. **No deletion was proposed
from it** — knip, the Atlas and the un-wiring differ are three readers and none
has deletion authority alone.

### G. Anti-boredom check

Every act traces to run 2's own "Next run" list, to #8, to #335 (which named
this seat and this switch as its condition), or to a finding this patrol
produced on its own clock. **No instrument was built. Nothing was spent** — no
credits, no house money, no render, no reader. Production writes: the crew run
row and the queue counts, nothing else.

**Next run (~2026-09-08):** the mtime finding's card decides what replaces the
date guard, and **until it does, no `scripts/` sweep can be dated from disk** —
use the editions/commits road above; the `Drape-census` owner question (commit
or zip the census scratch, then remove the tree); the `output/` 6.5 GB citation
pass, which needs a manifest; and re-read knip from the nightly, watching
whether unused files keeps climbing.
