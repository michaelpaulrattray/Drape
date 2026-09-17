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

---

## Run 4 — 2026-09-09 02:07–03:xx AEST (Janitor, patrol #4)

Clock: run 3 was 2026-09-05, cadence 3 days, so this run was **1 day overdue** —
`patrol-clocks.mts` ranked this seat first and alone, and the founder's
Housekeeping switch is ON. Master switch ON, all seven categories on. NEXT UP
empty, urgent band empty, no new replies, no card intents waiting. Inherited:
run 3's "Next run" list (#526's mtime finding, the `Drape-census` owner
question, the `output/` citation pass, the knip re-read) and the fresh #689.

### A. #526 IS ANSWERED WITH AN INSTRUMENT — a disposable is dated at an artifact now

Run 3's finding was that the keep test reads an mtime and **270 of 307 mtimes
had been rewritten to one hour**, so nothing could ever be swept. It left the
question open and forbade any `scripts/` sweep dated from disk until it was
settled. It is settled: `scripts/disposable-age.mts` (PR #693) resolves a file's
age through the artifact its NAME points at — the card, at the issue's own close
on GitHub; a briefing edition, at the commit that first shipped it. Neither can
be re-stamped by anything on this machine. **A name it cannot read anchors at
nothing and the file is KEPT.**

**#526's option 1, taken as written, including its safety clause.**

### B. #689's NUMBER, and the finding worth more than the number

| | 2026-08-29 (run 2) | 2026-09-08 (#689) | **this run** |
|---|---|---|---|
| untracked disposables under `scripts/` | 379 | 732 | **856** |
| cited by another file — always KEEP | — | — | **99** |
| anchored at a card or an edition | — | — | **403** |
| unresolved by name — therefore KEEP | — | — | **453** |
| both readers call old, and uncited | — | — | **128** |

⚠ **The 453 are the finding, not the 128.** They are called `_probe-…`,
`_read-…`, `_edit-…`, `court-…`, and they are **permanent litter for want of
four characters at the front of a name** — no artifact anywhere records when
their work happened. So `scripts/SKELETON-disposable.mts` now says *name it for
its card*, with this measurement as its reason. That is the durable half; a
sweep is the one-off half.

⚠ **AND THE COUNT MOVES WHILE YOU READ IT.** Two runs fifteen minutes apart gave
131 and 128 — three cards crossed the 7-day boundary between them. A sweep
manifest must therefore be written by the SAME invocation that produced the
number it quotes, which is what `--list` is for.

### C. THE READER FOUND ITS OWN HOLE BEFORE IT DELETED ANYTHING, AND IT WAS A KNOWN ONE

Its first citation sweep was one `git grep`, which reads **tracked** files only.
Checked by an independent pass before any sweep ran: **of 131 candidates, 3 were
named by files being KEPT** — `_327-max-author-read` by `_466-authorread` and
`_477-court-read`, `_327-strip` by `_477-strip`, `_briefing-e81` by
`_patch195l`. All three would have been deleted out from under a script that
still names them.

**That is this log's own RESTORED lesson, reproduced in a new reader**: *a
citation index that excludes the population it is classifying cannot see that
population's internal edges* — twelve restored scripts, three rounds. `scripts/`
is an authority over itself now (cited 70 → 99), and the PR review then found
the same class **one shape over**: an untracked NON-disposable keeper was still
invisible. Every untracked file under `scripts/` is folded in; the excluded set
is empty rather than narrower.

⚠ **AND THE ARM FOR THAT FIX DID NOT EXIST UNTIL TWO SABOTAGES SAID SO.**
Narrowing the walk back reddened nothing (the arm drove the helper, which does
not care which list feeds it), and after extracting the walk, swapping only the
ARGUMENT still reddened nothing. Both are guarded now. **`derive-adds-a-hop`:
sabotage the helper AND assert its arguments.**

### D. Two things measured rather than argued

- The reader first **excluded `docs/JANITOR_LOG.md`** from the citation grep, on
  the reasoning that this file records deletions. Measured: it changed **3
  files' citation status and ZERO verdicts**. It bought nothing, `docs/` is an
  authority under the manifest, and excluding one in order to delete more leans
  the wrong way. Removed.
- Its first run, from a fresh worktree, printed **0 of everything, cheerfully** —
  identical to "the pile is gone". Hence `--root` and a refusal on an empty
  population.

### E. Litter ledger — outside the repository. 48 DIRECTORIES, 1.33 GB

| item | found | done |
|---|---|---|
| `%TEMP%/drape-rite-*` | **5 dirs, 1,332 MB.** #654 swept 32 (7.8 GB) by hand on 2026-09-08 and **4 had regrown within one day** — the leak measured live | **swept**, and the CODE repaired (PR #692, `31d65cb1`): a recursive fallback gated on a positive read that the junction is gone |
| `%TEMP%/drape-atlas-merge-*` (28), `drape-atlas-commit-*` (6), `drape-precommit-*` (9) | **a SECOND family #654 does not name**, from three test fixtures. All three already tear down in an `afterAll`; the leftovers cluster on four days, the signature of runs that never reached it. **43 dirs and 1.4 MB between them** | **swept**; filed as **#694** with that number in the second column, because it is the same shape and not the same cost |
| holders, registrations, junctions | no process named any of the 48 on its command line (`Win32_Process`); none registered in `git worktree list`; **no `node_modules` inside any of them** | safe to remove recursively — and the main tree's `node_modules` was read **before and after**: 77 entries, `.bin/vitest` present |
| `drape-tfjs-pose-spike` | holds a REAL `node_modules` (not a reparse point), 2026-08-06 | **left, and recorded** — outside #654's family, and a directory with a real install is not swept on a hunch. Run 5's question |
| `Drape-census`, `drape-pinned-42652964` | unchanged from run 3 | **KEEP** — the pinned tree is cited by `scripts/court-ink-carry-a-disposable.mts:19`; the census owner question is still open and is still run 5's |

### F. Dead-code reading — the climb STOPPED

Nightly `34153675089`, 2026-09-07, compact reporter:

| reading | files | deps | exports | types | duplicates |
|---|---|---|---|---|---|
| nightly 2026-09-04 (run 3) | 69 | 1 | 186 | 122 | 19 |
| **nightly 2026-09-07 (this run)** | **69** | 1 | **191** | **129** | **19** |

✅ **Run 3's one watch-item — unused files 51 → 69 in seven days — is answered,
and answered the right way: flat at 69 across three days.** Duplicates flat at
19. Exports and types moved by single digits, the ordinary drift of a week's
merges. Nothing proposed; recorded on #108.

⚠ **Run 3 never appended its row to `docs/JANITOR_KNIP.md`** — its reading lived
only in §F of this file, which is exactly the drift that table exists to
prevent. **Run 4 filled it in** rather than skipping it, and both rows are there
now, in date order.

### G. Anti-boredom check

Every act traces to an open card that predates this shift (#654, #526, #689,
#108), to run 3's own "Next run" list, or to a finding this patrol produced on
its own clock (#694, filed and NOT worked). **Nothing was spent** — no credits,
no house money, no render, no reader. Production writes: the crew run row, the
queue counts, nothing else. No instrument was built that a card did not ask
for: `disposable-age.mts` is #526's own recommended option 1.

**Next run (~2026-09-12):**

1. ⚠ **THE 128-FILE SWEEP WAS NOT RUN AND THAT IS DELIBERATE.** The manifest is
   written (`output/janitor-run4-sweep-manifest.txt`, and the full read beside
   it), the reader is merged and its verdicts are guarded — but the reader
   landed **this shift**, and a brand-new instrument's first act should not be
   an irreversible deletion of 128 untracked files that exist in no git history.
   **Run 5 re-runs it, compares the two readings, and sweeps what both agree
   on.** Working law 2's spirit: a verdict that survives a second independent
   run is worth more than one that is merely fresh.
2. The `Drape-census` owner question — commit or zip the census scratch, then
   the tree goes. Open since run 3.
3. `output/` is now **#527's citation pass** and still needs a written manifest.
4. `drape-tfjs-pose-spike` (§E) — a month old and holding a real `node_modules`.
5. Re-read knip from the nightly and watch whether `files` stays at 69.

## Run 5 — 2026-09-12 06:59–07:xx AEST (Janitor, patrol #5)

Clock: run 4 was 2026-09-09, cadence 3 days, so this run landed **on its day**
(`patrol-clocks.mts`: *DUE today*, not overdue — two earlier shifts the same
day read that line and worked the category order, which is what it says).
Master switch ON, all seven categories on, Housekeeping ON. NEXT UP empty,
urgent band empty, no new replies (177/177), no card intents waiting.
Inherited run 4's "Next run" list, all five items, in order.

### A. THE SWEEP RUN 4 WITHHELD — 368 disposables, two readings, two waves, and a fixpoint

Run 4 wrote its manifest (128) and refused to delete on a reader that had landed
that shift. This run re-ran `scripts/disposable-age.mts` first and compared:

| | run 4 (2026-09-09) | reading A (this run, 20:59Z) |
|---|---|---|
| untracked disposables under `scripts/` | 856 | **897** |
| cited — KEEP | 99 | 102 |
| anchored at a card or an edition | 403 | 426 |
| unresolved by name — KEEP | 453 | 471 |
| both readers old, uncited — SWEEP | 128 (manifest 131) | **359** |

**Of run 4's 131 manifest lines, 126 stood in reading A; the 5 that left it all
left in the KEEP direction** — `_327-max-author-read`, `_327-strip`,
`_briefing-e81` (the three run 4 itself found), plus `_368-queue` and
`_387-avatar-fixture`, kept by the reviewed reader's untracked-citer hop that
the manifest predates. The 233 new to reading A are cards that crossed the
7-day line since Tuesday (46 distinct cards) — **every one re-read by a second
road, `gh issue view <n>` per card, all CLOSED before `2026-09-04T21:00Z`**
(`output/_janitor5/anchors-independent.txt`). A wide citation grep over the
whole working tree plus `~/.claude` skills and memory (`wide-citers.txt`) named
only records: mailbox entries, `output/` shift drafts, the Janitor's own reads,
and **one live instruction** — `.agents/foreman/manual-lane-brief.md:11` names
`_399-session-disposable.mts` as the shape to mint a session from. **Kept by
hand**, outside the manifest's authorities, because a file a live brief tells
the relay to copy is not litter.

**Wave 1: 358 deleted** (manifest `output/janitor-run5-sweep-manifest.txt`,
written by the same invocation as reading A; zipped first to
`C:\Users\Admin\drape-disposables-sweep-2026-09-12.zip`, 358 files / 1.77 MB).

⚠ **Reading B, taken after wave 1, found 11 MORE — and that is a finding about
the reader, not the files.** Each was KEPT in reading A only because a
same-card sibling that wave 1 swept named it (a PR-body draft naming its
sabotage driver, a drive script naming its control). **The reader is one pass,
not a fixpoint**: a citation from a file that is itself sweepable is not a
keep. **Wave 2: 10 deleted** (`…-manifest-wave2.txt`, zip `…-wave2.zip`;
`_399-session` kept again). Reading C: 529 disposables, **1 sweepable** — the
hand-kept `_399`. Fixpoint. The fix is either a second pass in the reader or a
`kept only by a SWEEP candidate` column; it is a card, not this shift's work.

After both waves: `tsc -p tsconfig.scripts.json` exit 0, both script guards
18/18, `git status` shows no tracked change. **`scripts/` untracked disposables:
897 → 529.**

### B. THE ROOT FRAMES — the "still-not-mine pile" sixteen nights of foremen handed here

122 law-6 screenshots (`<card>-<surface>-<theme>-1440.png`, 11 MB) untracked at
the repository root, 26 cards. Read on the disposable-age doctrine by hand
(`output/_janitor5/png-anchors.txt`): **31 swept** (10 cards closed before
`2026-09-04T21:00Z`: #429 #434 #435 #487 #493 #494 #501 #505 #510 #512; 4.4 MB;
manifest `output/janitor-run5-root-frames-manifest.txt`; zip
`C:\Users\Admin\drape-root-frames-sweep-2026-09-12.zip`). **KEPT: the seven
`436-*` — cited by a tracked authority, `docs/specs/STAFF_DIALOGS_436_EVIDENCE.md`**;
#252's two (closed 22:29Z on 09-04 — ninety minutes inside the window); and
everything newer. 91 remain; the next run's line is at `2026-09-07T21:00Z`.
`mint.err` (174 bytes, a drive's stderr from 4 Sep, dev host only) deleted.
`FABLE_R7_*.md` stay — run 2's ruling, unchanged.

### C. `%TEMP%` — TWO NEW FAMILIES, AND THIS TIME THE CODE IS THE LEAK

| item | found | done |
|---|---|---|
| `drape-bundle-*` | **210 dirs**, 0.6 MB, 10–12 Sep — `server/bundleFold.test.ts` `emittedDir()`, 7 per run, **no teardown at all** | swept; **PR #826** adds the sibling suites' shape (record what you made, `afterAll` sweeps it) |
| `drape-hf-cache-*` | **122 dirs**, 0.06 MB — `server/benchCommands.test.ts`, 2 per run, **no teardown at all** | swept; same PR |
| `drape-tfjs-pose-spike` | in `%TEMP%` (run 4 had it beside the worktrees); the "real `node_modules`" is **80 KB**, 6 Aug | swept — a month old, a spike, and not an install |
| `drape-421*.log` ×2, `atlasdrv-*` ×3 | 2 Sep, dev-server logs and three empty driver dirs nothing in the tree names | swept |
| `drape-rite-*`, `drape-atlas-*`, `drape-precommit-*` (#654, #694) | **none** — three days after run 4's sweep, neither family has regrown | nothing; #654's repair holds, #694's numbers stay small |
| `playwright-artifacts-*` (44), `puppeteer_dev_chrome_profile-*` (41) | other tools' families, not `drape-*` | left and recorded — outside this seat's family; a run that wants them takes a manifest first |

347 entries, ~1 MB, manifest `output/janitor-run5-temp-manifest.txt`. Measured
rather than argued: **main's two suites add 7 + 2 per run (210 → 217, 122 →
124); the branch adds 0.** This is NOT #694's mechanism — those three suites
tear down and leak only when killed; these two never removed a directory in
their lives. Law-7 sweep: `mkdtempSync` in 21 test files, **19 already remove
what they make**; these two were the whole remainder.

### D. The `Drape-census` owner question — CLOSED by zipping, the tree is gone

Open since run 3. The branch `census/full-map` (`d2613b74`) is an ancestor of
`origin/main`, so every commit is already in main; the untracked remainder was
`output/capability-census/` — 15 probe scripts of 21–22 Aug plus `corpus.backup`
/ `generate.backup` (early shapes of what is now `scripts/capability-atlas-*.mts`)
— and `_vitest-full.log`; 2.3 MB, 26 files. **Zipped whole to
`C:\Users\Admin\drape-census-scratch-2026-09-12.zip`**, then `git worktree
remove --force` (unregisters, leaves the directory — the known 2.55 shape), then
**the `node_modules` junction was taken out with `rmdir` BEFORE the recursive
delete** — it pointed at the main tree's `node_modules`, and the main tree's was
read before and after: 67 entries, `.bin/vitest` present, both times. The
branch ref stays. Nothing is lost that the zip does not hold.

### E. Dead-code reading

Nightly `34631395445` (2026-09-11, `ac7c2cd7`, compact): **69 / 1 / 194 / 132 /
19**. Files flat at 69 for a week now; duplicates flat at 19; exports and types
single-digit drift. Row appended to `docs/JANITOR_KNIP.md` — in the table this
time, not after it (the first append landed below the prose and was moved).

### F. Anti-boredom check

Every act traces to run 4's own "Next run" list (items 1, 2, 4, 5 done; 3 —
`output/`, #527 — measured only: **7.0 GB now, 1,517 entries**, up from 6.5 GB,
its citation pass still unwritten and a whole run on its own), to an open card
(#694's class → PR #826), or to a finding produced on this patrol's clock (the
one-pass reader, §A — a card proposal, not worked). **Nothing spent.**
Production writes: the shift row, the queue counts. Every deletion has a
manifest written by the invocation that read it and a zip outside the
repository, so no act this run is unrecoverable.

**Next run (~2026-09-15):**

1. `output/` — #527's citation pass, with its own manifest. It is the only
   litter left that is measured in gigabytes and it grows every shift.
2. The reader's second pass (§A) — take the card if filed, or run
   `disposable-age.mts` twice and sweep both readings' agreement, which is what
   this run did by hand.
3. Root frames: 91 remain; re-read at the new line. `drape-shift-frames`
   (`C:\Users\Admin`, six #624 frames, 7 Sep, 488 KB) crosses 7 days on the 14th.
4. Watch `%TEMP%` for `drape-bundle-*` / `drape-hf-cache-*` regrowing — after
   #826 merges a nonzero count is a killed run, #694's shape, not a leak.
5. `drape-pinned-42652964` — still KEEP, still cited by
   `scripts/court-ink-carry-a-disposable.mts:19`; the question of whether that
   court will ever run again is a founder-adjacent one and stays open.

---

## Run 6 — 2026-09-15 05:46–06:30 AEST (Janitor, patrol #6, cards #925 + #265)

Clock fired on the day (`patrol-clocks.mts`: *"1 seat's clock has fired: Janitor
(due today)"*), Housekeeping switch ON, so standing exception 3 outranked the
category order. Run 5's "Next run" list is the provenance for items 2 and 3.

### A. The branch sweep (#925) — and the naive instrument was wrong about 108 of 126

Re-measured at the code rather than taken from the card, which was one day old
and already stale: **126** local `team/*`, not 113.

| reading | count |
|---|---|
| `git branch --list 'team/*' --merged origin/main` | **7** |
| the branch's own PR is MERGED | **115** |

⚠ **A safety check the card did not ask for, because a merged PR does not prove
a branch stopped moving**: each of the 115 tips compared against its PR's
`mergedAt`. **0 of 115** carry work past their merge. Its first run said **118 of
115** — `%cI` emits a local `+10:00` offset and `mergedAt` is UTC `Z`, so a
string compare disagreed by a whole day. Redone in epoch seconds and **driven
with a positive control** (a `commit-tree` commit made after a real merge), which
fired at +471 min. *A checker that cannot be seen to fire is not a check.*

**115 deleted, 126 → 11.** Manifest `output/janitor/run6-branch-manifest.txt`
with every tip sha. The 11 kept: five with OPEN PRs (both held auth branches
`team/emailauth-697` #882 and `team/googleauth-883` #885 among them), six whose
PR closed unmerged or never existed. **245 remote `origin/team/*` refs measured
and NOT swept** — local deletion was safe partly *because* origin still holds
them, and sweeping both in one act removes that net. Run 7's, with its own
manifest.

### B. The disposables (#925) — 580 → 568 across two passes

`scripts/disposable-age.mts` (#526) is the reader; mtime is still worthless here
(**417 of 580 share one timestamp**). Swept **10** with the zip taken and read
back first (`C:\Users\Admin\drape-janitor-run6-disposables-2026-09-15.zip`, 10
entries verified), manifest `output/janitor/run6-disposable-manifest.txt`. Two
more in an addendum after §D merged. Sweepable **0**, chain casualties **0**.

**453 of the population cannot be DATED at all** — their names carry no card
number, so the reader keeps them forever and the pile can only grow. That is the
structural finding behind this card's "grown every time it has been counted".

### C. The production bucket (#265) — it was 31, not five

Listed with `--service Drape` (`--service MySQL` injects database variables only
and R2 falls back to the LOCAL dev bucket — the wrong world entirely).

| | |
|---|---|
| objects under `crew-eye/` | **344** |
| named by some committed briefing edition or the tracked tree | **317** |
| **orphans** | **31**, 14,099,549 bytes |

The card's rule, built rather than listed: **430 commits of
`server/crew/crew-briefing.json` read at every revision**, unioned with a
`git grep` at HEAD. No second store exists (no schema column, no code path), so
a key outside that union has never been servable by
`/api/crew/eye-frame/:frameName` and cannot become so without a commit.

All 31 downloaded first — *asked 31, saved 31, byte total matching the listing
exactly* — then deleted, then **re-listed rather than trusted: 344 → 313,
orphans 0**. And the check that matters more: all **289** frame keys the live
edition names are still present, *referenced but not in the bucket: 0*.

⚠ **Seven upload bursts, 26 Aug – 6 Sep** — so this was never one shift's
`| tail -1` accident, which is why fixing that half (PR #846) did not stop the
count growing. **4 referenced keys are absent from the bucket**; none is named by
the live edition and two are test fixtures. Recorded for run 7, not acted on.

### D. #973 — the dater was reading a name nobody types (PR #974, `6393caa0`)

Found while classifying §B. The edition anchor was the single literal
`_briefing-e<N>`, which matched **2** files while **27** carried a readable
edition and sat in the permanent-KEEP bucket. Widened to the families actually in
the tree; deliberately **not** to a number-anywhere pattern, which would date
`_court177-grid-…` at a briefing edition. Anchored **67 → 94**.

Sabotage-driven with an unsabotaged control first: control 40/40, narrowing back
reddens 1 arm, loosening reddens 5, restored 40/40. ⚠ **A correction rode in the
docblock and the sabotage is what caught it** — the draft claimed
`_155-edition179-…` matched both shapes and inverted the test order to protect
it; driving the swap left the arm green, so the order went back as it was.

### E. The bill for §D, filed against itself (#975)

⚠ **The new arms quote 13 live disposable filenames, and the citation sweep
correctly reads a mention as a citation** — so those 13 are now permanent KEEPs.
Sweepable **4 → 2** across the merge; `cited by a file that stays` **101 → 114**.
The fix is real but worth about half what it looks like. Recommendation on the
card: fixture names in the arms, not a weakened citation reader. **The class is
wider than the arms — any tracked file quoting a `*-disposable.*` path pins it
forever, and a `cited by` line may be a mention rather than a use.**

### F. Anti-boredom check

Every act traces to an open card (#925, #265), to run 5's own "Next run" list, or
to a finding produced on this patrol's clock (#973, #975 — the second filed
against this shift's own work). **Nothing spent.** Production writes: the shift
row, the queue counts, and the 31 bucket deletions, each with a manifest and a
verified recovery copy outside the repository.

**Next run (~2026-09-18):**

1. **#975 first** — it is this run's own debt and it releases 13 files.
2. **245 remote `origin/team/*` refs**, manifest first, PR-state criterion, the
   five open-PR branches on the do-not-touch line.
3. `output/` — #527's citation pass, still the only litter measured in gigabytes
   (7.0 GB at run 5) and still unwritten. It is a whole run on its own.
4. The **4 referenced-but-absent** `crew-eye/` keys in
   `output/janitor/run6-crew-eye-manifest.txt` — two are test fixtures, two are
   not, and none is on his page today.
5. Root frames and `%TEMP%` families, as run 5 left them.

## Between runs — #527 worked off NEXT UP, 2026-09-16 (not a patrol; the clock had not fired)

**This is deliberately NOT a `## Run` heading**, because `scripts/patrol-clocks.mts`
reads the newest one as the seat's last run and this was not a patrol: the Janitor
was due 18 Sep. #527 came off NEXT UP on the founder's own word (*"527 do it"*),
so the seat's clock is untouched.

**`output/`: 7.2 GB → 6.9 GB, 1,650 top-level entries → 762. 889 removed, 0
failures.** Full record, method, controls and the complete manifest:
**`docs/specs/OUTPUT_CITATION_PASS_2026-09-16.md`**. Run 5's and run 6's "Next
run" item 3 (*"`output/` — #527's citation pass, still unwritten"*) is **CLOSED**.

**What a future run needs from this, in four lines:**

1. **The tree cannot get much smaller.** 6.71 of 7.08 GB is CITED evidence —
   courts, frames, verdicts he has looked at. Do not re-open this as a size
   problem; the answer is off-machine storage, not deletion. Zipping was priced
   at a real **4.5%** (`two-paths-court-round4`, measured).
2. **Zero `docs/specs` verdicts cite a missing frame.** The thing the card feared
   has not happened. Two apparent breaks were glob and line-wrap artifacts of the
   reader, run down to the bytes.
3. **Six frame-holding directories were SPARED by name** (`roll103-sheet`,
   `his-roll-216`, `verify-makeup-chip`, `refusal-viewer-rehearsal-control`,
   `_eyefix`, `_cinema-glyph` — 46.8 MB). Two readers said uncited; a picture is
   a paid render and 0.7% is not worth that risk. They are a one-word decision
   for him, not a judgement for the next run to re-make silently.
4. ⚠ **THE DISCIPLINE THIS RUN PAID FOR: A READING A FUTURE RUN NEEDS IS CITED
   BY PATH IN THIS LOG, OR IT IS NOT A RECORD.** Run 4's full read
   (`output/janitor-run4-full-read.txt`, 92 KB) and its `%TEMP%` manifest were
   swept, while the sweep manifest beside them survived — because line 576 cites
   the manifest by path and calls the other *"the full read beside it"*. **A
   path-based keeper cannot see a prose citation.** The verdicts survive in this
   log and run 5 superseded that sweep, so the loss is the working paper, not the
   finding — but it is this seat's own §C lesson (run 6) landing on this seat's
   own records, and the next reading written goes into the log with its path.

---
## Between runs — #105 worked off NEXT UP, 2026-09-16 (not a patrol; the clock had not fired)

**Not a `## Run` heading**, for the same reason as the #527 entry above: the
Janitor is due 18 Sep, and #105 came off NEXT UP on the founder's word
(*"105-108 clear them"*, 16 Sep). Shift foreman-20260916-2037, run #270.

**40 shadcn primitives and 33 packages DELETED — PR #1008, squash `ed7b0032`,
on production 11:16Z.** Manifest, every row with its three readers and its
history read: **`docs/specs/SHADCN_PRIMITIVES_PURGE_MANIFEST_2026-09-16.md`**.
Reviewer verdict PASS with no findings (run `35087932617`; it re-drove the
grep, the package grep, the held row and the lockfile rather than reading the
manifest). Card #105 CLOSED.

**What a future run needs from this, in four lines:**

1. **The population moved and the card was corrected before the branch (#909):
   40 → 41.** `table.tsx` had already gone in #407; `skeleton.tsx` and
   `switch.tsx` were un-wired on purpose by the staff briefs (06/09) and section
   03. Both un-wirings are REPLACEMENTS — the house loading state, three account
   surfaces — not dead controls; `section09-guard.test.ts` now refuses a
   moderator file importing skeleton. The history read (`git log -S` on the
   import string, all 41 rows) found 24 whose only importer ever was the
   bootstrap's `ComponentShowcase.tsx` (deleted 7 Feb) and 10 never imported at
   all.
2. **One row HELD, and the direction of the hold is the rule**: deleting a
   primitive under an importer that STAYS breaks the typecheck, so
   `dropdown-menu.tsx` + `@radix-ui/react-dropdown-menu` wait for #106, whose
   row `Navigation.tsx` is the importer. Deleting an importer whose dependency
   stays only makes an orphan (`useMobile.tsx`, already #106's row). The rider is
   written on #106; the next nightly's deps line should read exactly that one
   package.
3. **The deps went by `pnpm install --lockfile-only` after editing `package.json`
   by hand, never `pnpm remove` in the worktree** — the worktree's
   `node_modules` is a JUNCTION to the main tree's, so a remove there would have
   mutated the founder's tree under a package.json that still declared the
   packages. After the merge the main tree was synced with `--frozen-lockfile`
   (wouter patch intact, read at `node_modules/.pnpm`).
4. **Found on the way, carded not worked (#1009, `small-fix`)**: the full suite's
   one esbuild warning — `server/auth.me.test.ts` sets `approved: true` twice in
   one fixture. Harmless, one line, and it is the line that hides the next real
   warning. The stale `sidebar.tsx` lifecycle marker in the atlas generator was
   the reviewer's nit and went in the same PR; `Navigation.tsx`'s marker rides
   out with #106 the same way.

`docs/JANITOR_KNIP.md` carries the 2026-09-15 nightly row this was executed
against, with the expected next reading (files 69 → 29) written down so a
nightly that does not show the drop is a finding rather than a surprise.

## Between runs — #106 worked off NEXT UP, 2026-09-16 (not a patrol; the clock had not fired)

**Not a `## Run` heading**, as with the #527 and #105 entries above: the Janitor
is due 18 Sep, and #106 came off NEXT UP on the founder's word (*"105-108 clear
them"*, 16 Sep). Shift foreman-20260916-2214, run #271.

**9 files and 1 package DELETED — the eight non-shadcn orphans that were litter,
plus `dropdown-menu.tsx` + `@radix-ui/react-dropdown-menu` (the #105 rider).**
Manifest, every row with its three readers and its history read:
**`docs/specs/NON_SHADCN_ORPHANS_PURGE_MANIFEST_2026-09-16.md`**.

**What a future run needs from this, in three lines:**

1. **The history read is the reader that earns its place, and #106 is the
   specimen.** Eleven rows read "unused" on knip, the Atlas and the grep alike.
   `git log -S` on each import string separated them: seven whose last importer
   was deleted ON PURPOSE (a demo page, a dead layout, a redesign that inlined
   the barrel), three never imported at all — and ONE, `useReferralClaim.ts`,
   whose last importer was `pages/Dashboard.tsx`, deleted 2026-04-04 for a
   reason that had nothing to do with referrals. Settings still hands out the
   `?ref=` link that hook served. **HELD, carded as bug #1010 (`founder-review`,
   money-adjacent), and it leaves this card.** A reader that only asks "does
   anything import this" cannot tell those apart; the card's road asked the
   second question on every row and that is why it was asked.
2. **The population held: 11 rows, 2 excluded by the card, 1 held, 8 + the
   rider deleted.** Recorded on the card before the branch (#909). The two test
   populations naming `Navigation.tsx` were built to redden on its deletion
   (`accountMenuPopulation.test.ts`'s other-direction arm did) and lose their
   entry in the same commit.
3. **Nothing the Atlas kept lost its last inbound edge** (modules 992 → 983,
   edges 3957 → 3918, findings unchanged) — read at the regenerated json, not
   assumed from the deletion list.

`docs/JANITOR_KNIP.md` carries the expected next nightly reading: files 20,
deps 0, and exactly two unused files with a card each.

## Between runs — #108 slice 1 worked off NEXT UP, 2026-09-16 (not a patrol; the clock had not fired)

**Not a `## Run` heading**, as with the three entries above: the Janitor is
due 18 Sep, and #108 came off NEXT UP on the founder's word (*"105-108 clear
them"*, 16 Sep). Shift foreman-20260916-2348, run #272. Slice 1 of the card's
three — duplicates first, per its road.

**17 of the 19 duplicate exports GONE.** The reading with every row, its
consumers in all three import forms, and its history read is the card comment
posted before the branch (#909) and triage §35 for the ledger rows.

**What a future run needs from this, in three lines:**

1. **A `Name, default` pair is settled by the history, not the grep.** All 12
   client pairs read the same way — the named export consumed through a barrel
   or directly, the default consumed by nothing — and `git log -G` over the
   whole history says no file has EVER imported one of those defaults. Never
   wired, so the 12 lines go with nothing to repoint.
2. **A rename alias is settled by the un-wiring reading, and the death is the
   RENAME's.** Three `credits.ts` `*Points` aliases sat on the deletion ledger
   as `UNREVIEWED` (`died`, per the timeline) — true, and the thing that
   stopped importing them was `45eb2e5f`, the commit that created them as
   aliases. Not a control. Rows flipped to `TAKEN`, ceiling 20 → 17, in the
   same commit, because the checker's equality rule refuses either half alone.
   `initializeUserPoints` was NOT on the ledger — it had one live caller
   (`db/users.ts`, a dynamic import) — and was repointed rather than read dead.
3. **Two stay, and they are the floor.** `deductPoints` has SIX money-path
   callers and a dozen guard regexes spelling it, including one POSITIVE arm
   (`r7-strip-first-package-care.test.ts:110`): a rename, not a slice-1 act,
   and the negative guards that name only the old spelling are a finding
   (triage §35c; carded). `describeFace = describeWithTeeth` is a pinned bench
   pointer with a test arm asserting the identity on purpose — not a duplicate
   in the card's sense at all. `JANITOR_KNIP.md` states the floor as 2.

`docs/JANITOR_KNIP.md` carries the expected next nightly reading: duplicates
2; files/exports/types unmoved by this slice.

## Between runs — #108 slice 2 worked off NEXT UP, 2026-09-17 (not a patrol; the clock had not fired)

**Not a `## Run` heading**: the Janitor is due 18 Sep; #108 came off NEXT UP on
the founder's word (*"105-108 clear them"*, 16 Sep). Shift foreman-20260917-0200,
run #274. Slice 2 of three — exports through the un-wiring differ, never a hand
list.

**Written, not executed.** The reading is
`docs/specs/UNUSED_EXPORTS_PURGE_MANIFEST_2026-09-17.md`; the deletion it
prescribes is the next Janitor session's brief. Nothing came out of the tree
this session except one `UNREVIEWED` verdict (`isIpBlocked` → KEEP, triage
§36a, ceiling 17 → 16).

**What a future run needs from this, in three lines:**

1. **The differ reported a live symbol dead, and that was the finding.** Its
   30-day window named `blockIp` un-wired; `blockIp` has two callers, both
   `const { blockIp } = await import("../../db")`, a shape the reader did not
   read. 36 production-wired server exports counted zero — both login routers
   among them — and the reviewer found five more on the PR (`.then(({ x }) =>`,
   all four background workers and `completeReferral`): 41. PR #1017 repairs it; the full-history timeline was walked on
   both readers (216 s each) and the class counts moved exactly as predicted.
   **Run the differ, then read its first noisy finding at the code before
   believing its silences** — the noise is the only side of a blindness you
   can see.
2. **The population is three populations.** The differ reports `server/`
   declarations only, by design (the sweep's scope). Of 458 unused exports,
   218 are server (153 dark-born, 19 barrel lines, 29 read-by-hand, 2 died,
   15 on the ledger), 163 client, 18 shared, 57 scripts. Widening the
   reported scope grows the deletion ledger's `unread` by every client
   symbol — an instrument decision, carded on #108, not a Janitor act.
3. **"Self-used" needs comments stripped.** A `\bname\b` count over a module
   reads its own docblocks; 151 rows read self-used until comments were
   stripped, 147 after. The remaining six are the DELETE table.

The nightly was triggered by hand (`gh workflow run knip.yml`) because the
cron had not run since `35008863398`; the readings row above records the
measurement it produced, which landed every expectation the previous three
rows had written.

## Between runs — #108 slice 2b worked off NEXT UP, 2026-09-17 (not a patrol; the clock had not fired)

The manifest executed (foreman-20260917-0335, run #275). Re-derived first on a
fresh knip read and a fresh timeline: identical population, one cell moved.
Then 149 `export` keywords, 19 barrel lines, 9 declarations, 28 hand rows —
98 files, `pnpm check` green with the deletion door OPEN, the suite green but
for the atlas-freshness arms the commit hook regenerates. Measured after:
unused exports **193 → 102 files, 458 → 256 symbols**; server at its floor.
Three things worth the next Janitor's minute:

1. **A barrel line's "reached directly elsewhere" is a claim, and four were
   false.** knip lists ONE of a re-export pair, and the manifest inferred the
   declaration was reached because knip named the line and not the
   declaration. The strict ledger door caught all four the moment the lines
   went (`unread`) — run `pnpm check` BEFORE reading the hand rows, not after,
   because the door is the cheapest reader of what a barrel deletion exposes.
2. **A zero-self-use export can be a compile-time guard.** `IDENTITY_FIELD_AXES`
   was on the DELETE table on the numbers; its `satisfies` is what stops a new
   identity field compiling without an axis. Read the docblock of anything
   whose declaration ends in `satisfies` or `as const` before deleting it.
3. **knip's compact reporter can name a non-export.** `COILED_NONBINARY_STYLES`
   sits on its unused-export list as a plain `const`. The floor for the server
   population is therefore 16 on knip's count and 15 on the ledger's, and both
   are right about their own question.


## Between runs — #108 slice 4a: the differ's reported scope widened to `shared/` (#1022), 2026-09-17 (not a patrol; the clock had not fired)

The relay decided #1022 at 02:05Z (a Fable seat: *"an instrument decision,
not his"*) — `shared/` through the differ, `client/` by knip + a consumer
checker + tsc, `scripts/` out — and struck `seat:retro`, so the Janitor took it
(foreman-20260917-1220, run #280). One constant, `REPORTED_ROOTS =
["server/", "shared/"]`, and four arms in `server/unwiringDiffer.test.ts`; the
two that name `shared/` redden under the old gate (driven by sabotage before
commit), the `client/` arm holds the line the widening must not cross.

Two things the card had wrong at the code, recorded on it:

1. **The sweep already scanned `shared/`.** The reader's docblock said its
   `server/`-only scope was *"the same scope the sweep uses"*, and the sweep's
   `scanRoots` has been `["server", "shared"]` since 2026-08-24. So the ledger
   already held **16 `shared/` rows** (13 KEEP, 3 FILED) and the reader
   answered `null` for every one — measured on both trees: readable 0 → 16.
   A `HELD` or `TAKE` verdict on any of them would have refused as
   `unreadable`, and a `shared/` constant the server imports could have lost
   its last importer without the timeline saying a word.
2. **So the ledger grows by ZERO rows, not 18.** The card priced the widening
   as *"the ledger grows by 18 rows"*; the ledger is keyed on the sweep's
   list, the sweep's scope did not move, and `check-cleanup-dispositions`
   reads exactly as before (210 rows / 146 listed, OPEN). `decls` 2652 →
   2971 names; the second reader (`deletionDoorSecondReader.test.ts`) holds
   every new credit against the Atlas.
