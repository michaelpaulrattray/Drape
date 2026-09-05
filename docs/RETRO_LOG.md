# Retro log — recurrence ledger + shift audit

**Clock:** every 7 days. (Machine-readable — `scripts/patrol-clocks.mts` reads
this line and the newest `## Run` date to tell a shift whether the seat is due.)

The Retro seat's record (PROGRAM.md, "THE CLOCKS"; first run ordered by the
founder 2026-08-26, *"do it"*). Two things live here and nowhere else:

1. **The audit ledger** — shift reports sampled and checked AT THE ARTIFACTS
   (working law 1 pointed at the team: a report is a claim; the commit, the
   receipt, the run id and the issue state are the facts).
2. **The recurrence ledger** — the same failure seen twice, with the guard or
   law proposed for it and where that proposal stands. A law goes to the
   founder; a guard is a card the team may build.

Every Retro run BEGINS by reading this file and ENDS by appending to it.
Findings are deduped against the queue, open and closed. Attempted-and-
reverted guards are recorded as plainly as wins.

---

## Run 1 — 2026-08-26 07:16–07:30 AEST (Retro, patrol #1, card #95)

### A. Audit ledger — five reports, every claim opened

Legend: ✅ true at the artifact · ❌ false at the artifact · ➖ not checkable
cheaply (stated, not verified).

| Report | Claim | Artifact read | Verdict |
|---|---|---|---|
| **foreman-13** (`foreman-20260826-0700.md`, written 07:14) | "PR #94, **merged**" | `gh pr view 94` at 07:17: `OPEN`, `mergeStateStatus CLEAN` | ❌ unmerged (merged by the Retro at 07:18, `80ffd8fb`) |
| | "Edition 14 shipped by rite" / "Deployed state (receipt-quoted)" | the report's own line reads `RECEIPT_PLACEHOLDER`; `origin/main` at `cda444ab`, no e14 commit; `crew-briefing.json` modified and uncommitted in the main tree | ❌ never shipped |
| | "Worktree `drape-shift-16` removed, branch deleted" | `git worktree list` still held `drape-shift-16` at `8dbfca62` | ❌ |
| | "PR #89 (#35) merged `cda444ab`" | `origin/main` = `cda444ab`, PR 89 MERGED 16:54Z | ✅ |
| | "Push protection ON, read back `enabled`" | `gh api repos/…` → `secret_scanning_push_protection: enabled` | ✅ |
| | "#16 comment posted with the step-2 record" | comment at 21:11:12Z | ✅ |
| | "625 files / 9582 tests passed" | gate `gate-checks` SUCCESS on the PR head | ➖ count not re-run; green is the gate's |
| **foreman-4** (`foreman-4.md`) | "#76 and #77 merged and deployed" | already corrected by `relay-foreman-4-correction.md`: merged, not deployed (production sat on `1bc462de`) | ❌ (known specimen) |
| | court receipt `2026-08-25T16-18-26-277Z-9600.txt` OK, `b45f0ed5` | `index.log` line `2026-08-25T16:18:26.277Z OK …9600.txt`; commit exists | ✅ |
| | estimate posted on #16 before firing, actuals after | #16 comments: price 10:55Z, FIRES 15:46Z, COMPLETE + actuals 16:10Z | ✅ |
| | "Two future-stamped journal entries corrected at their commits' own times" | `git show b45f0ed5:…crew-briefing.json` → the court entry is stamped **03:00** in a commit authored **02:18:15**; still 03:00 in edition 13 | ❌ one remained future-stamped (corrected to 02:18 in edition 14) |
| **foreman-9** (`…-0530.md`) | PR #88 merged `2052ba7c`, #32 closed | PR 88 MERGED 19:14:51Z `2052ba7c`; #32 closed 19:14:52Z | ✅ |
| | five CI run ids with stated outcomes | `32883959700` failure, `32887534295` failure, `32884739652` success, `32887926798` success (all Gate on `team/32-gitleaks`), `32888582030` Secrets/main success | ✅ all five, conclusions match |
| **foreman-6** (`…-0300.md`) | PR #85 merged `74f4266c`, #71 closed | PR 85 MERGED 16:54:03Z `74f4266c`; #71 closed 16:54:04Z | ✅ |
| **foreman-12** (`…-0645.md`) | PR #91 merged `12543a33`; `server/heroProxy.test.ts` added; first rite refused, second OK, receipt `…20-44-41-390Z-30352.txt` | PR 91 MERGED `12543a33`; file present; `index.log`: `20:43:33 EXIT 1` then `20:44:41 OK …30352.txt` | ✅ |
| **foreman-7** (`…-0350.md`) | PR #87 merged `378a9c2c` | PR 87 MERGED 17:43:24Z `378a9c2c` | ✅ |

**Audit verdict.** Nine of eleven shifts sampled by claim held at the
artifacts. The two that did not share ONE class, and it is a process class
rather than a competence one: **the close report was written BEFORE the acts
it reports.** foreman-13 is the type specimen — a template line literally
reading `RECEIPT_PLACEHOLDER`, three "done" claims for acts the process died
before performing (the runner spawned the next shift at 07:16:39; the report's
own file was last written 07:14). foreman-4's "merged and deployed" is the
same shape one step earlier (a merge read as a deploy). Both were harmless
this time only because the next seat read the artifacts instead of the
report — which is the discipline, not a safeguard.

Two smaller accuracy findings, same family:
- **Mailbox filenames carry a projected close time, not the real one**:
  `…-0440.md` was written 03:57, `…-0610.md` 05:42, `…-0700.md` 07:14.
  Harmless, but a reader dating events by filename is wrong by up to 40 min.
- **Journal stamps run ahead of their commits** (foreman-4's 03:00 entry in a
  02:18 commit; foreman-13's 07:25 entry, never committed at all). The founder
  reads these as "when it happened".

### B. Recurrence ledger

| # | Repeat | Occurrences (evidence) | Class | Proposal | Status |
|---|---|---|---|---|---|
| R1 | **Regenerated Atlas JSON conflicts every concurrent PR; a CONFLICTING PR gets no gate run and no banner** | #78, #79, #86 stalled (`relay-gate-stall.md`, #80 root cause); two rite refusals on a locally stale generated file (foreman-10, foreman-12) | generated artifact committed on every branch | **Guard** (card): a git merge driver for `docs/architecture/drape-architecture.json` + `capability-atlas.*` that resolves a conflict by REGENERATING on the merged tree, registered by the existing hooks setup; plus the rite's freshness refusal prints the one-line repair. Standing-orders step 5 (check `mergeable` first) stays as the manual road. | **#100** filed → BUILT, PR #117 (foreman-16, 2026-08-26): `.githooks/merge-atlas` + `atlas-regenerate` + `pre-merge-commit`, driven in `server/atlasMergeDriver.test.ts`. Measured on the way: git does not re-read the index after `pre-merge-commit`, so an automatic merge stops with the map regenerated and staged and `git commit --no-edit` finishes it |
| R2 | **`git worktree remove --force` → `Invalid argument`, tree unregistered, directory left** | foreman-10, -11, -12 reports; **reproduced this run** on `drape-shift-16` with git 2.55.0.windows.3: exit 255, worktree gone from the list, directory present, `rm -rf` then clean | Git-for-Windows delete step failing on a directory it has already unregistered | No new instrument. The reliable road is two commands (`git worktree remove --force <p>; rm -rf <p>`), recorded on the Janitor's card #96 (which already owns "locked worktree dirs") and in the standing orders. | noted on #96 |
| R3 | **Two seats in one working tree — a terminal commit landed on a shift branch** | foreman-1 branched the main tree; foreman-4 lesson 2 (three collisions); foreman-7/13 note 4+ `claude.exe` sharing the tree | shift switching the MAIN tree's branch | **Guard** (card): a `.githooks/pre-commit` arm that refuses a commit made in the main tree (`C:/Users/Admin/Drape`) while HEAD is a `team/*` branch — a shift branch belongs in a worktree by the standing orders, so the refusal has no legitimate victim. | **#102** filed → BUILT, PR #116 `21d83f78` (foreman-15, 2026-08-26) |
| R4 | **Python heredoc turns `\b` into a backspace byte inside a TS/TOML file** | foreman-5 (two bites, *while citing the memory*), foreman-9 (gitleaks config silently failed to load → all green) | memory read, still bitten; the failure is SILENT (a config that does not parse reads as "no findings") | **Guard** (card): the pre-commit hook refuses any staged text file containing a control byte (0x08 and friends) — catches the class whoever writes it and however it got there. The memory stays; it was necessary and not sufficient. | **#103** filed → BUILT, PR #116 `21d83f78` (foreman-15, 2026-08-26) |
| R5 | **Close report claims acts not yet performed** | foreman-4 ("merged and deployed"), foreman-7's handoff listing done work as owed (per #95), foreman-13 (three claims + `RECEIPT_PLACEHOLDER`) | report written ahead of the artifacts; a dying process leaves the claims standing | **Guard** (card): the foreman runner, AFTER the shift process exits, appends a machine-written trailer to the newest mailbox entry — actual exit time, whether the newest `index.log` receipt is newer than the entry, whether `RECEIPT_PLACEHOLDER`/"merged" claims name PRs that are MERGED (`gh pr view`). A shift cannot forget it and a dead shift cannot skip it. No law needed: the rule already exists in the standing orders (step 3d, "quote the receipt line"); what failed was that only a live process could obey it. | **#101** filed |

### C. The anti-boredom read (founder question, verbatim: *"we need to
ensure if they are waiting a long time for me they dont completely over
engineer security or anything because they are bored"*)

Last night's instrument PRs, each against the card it claims:

| PR | Merged | Card | Card created | Predates the PR? |
|---|---|---|---|---|
| #87 `workflow_dispatch` on the gate | 17:43Z | #80 | 14:23Z | ✅ |
| #88 gitleaks | 19:14Z | #32 | 06:13Z | ✅ |
| #90 knip | 20:07Z | #34 | 06:13Z | ✅ |
| #91 semgrep | 20:41Z | #33 | 06:13Z | ✅ |

All four trace to a pre-existing card; none was invented mid-shift. **No
boredom finding this run.** This table is re-taken every Retro over the
period's merged PRs; a PR with no predating card is a process finding.

### D. Other findings this run

- The Fable gate review on #94 raised a real low-severity defect (card prompt
  in words, parser in characters) that would otherwise have lived only in a PR
  comment → filed as **#99**, due before #16's step-3 roll.
- The window above was first written as 07:16–07:50 (a projected close —
  the very habit A. names); corrected to the real close (07:30) after the rite.
- Housekeeping done by the Retro on the way in: PR #94 merged (`80ffd8fb`,
  green and reviewed, foreman-13's stranded unit); `drape-shift-16` removed;
  the two `drape-shift-35*` worktrees belong to another seat and were left.

### Clocks

Retro: first run 2026-08-26; next ~2026-09-02. Recurrence rate this period:
5 repeat classes over 13 shifts; 4 guards proposed (#100 R1, #101 R5, #102 R3, #103 R4), 0 laws (nothing here
needs a founder ruling — every failure is already against a written rule, so
the answer is mechanism, not more words).

---

## Run 2 — 2026-09-05 12:10–13:0x AEST (Retro, patrol #2, card #95)

**Window:** 2026-08-26 07:30 (run 1's close) → 2026-09-05. **209 seat-stamped
mailbox entries**, 8 of them machine-written `runner-close-*` files for shifts
that wrote nothing at all.

**Why the Retro ran tonight and not a NEXT UP card.** The band held 7 open
`founder-ordered` cards and every one was read at its own body first: #391 says
in its own text that it is not a card a shift takes (it is a Stripe catalogue
and pricing decision); #404 waits on #391; #508 is `founder-review` and needs
him to flip the Railway source himself; #530 is a court; #531 is a money path
and says `judgment-class` on its face; #534's second half is undesigned and
collides with #535, which is a design card awaiting his word. None is
admissible to an Opus seat, so #505's rule applied: an overdue patrol whose
switch is ON is the next background card. Retro was **10 days into a 7-day
clock**, Process is ON.

### A. Audit ledger

**Run 1 sampled eleven claims by hand. This run read the whole period, because
the guard run 1 proposed (#101) now does the sampling itself** — every entry
carries a machine-written trailer checking merge claims, the receipt and the
placeholder. So the audit's shape changed: verify the INSTRUMENT, then read its
output in bulk, then check by hand the class it cannot see.

**The instrument can fail** (working law 2): 13 entries carry `⚠ UNVERIFIED
CLOSE` against 168 `verified`. It is not stuck green.

⚠ **But my own first reading of it was wrong, in exactly the way this run's
main finding is about, and it is recorded because it is the cheapest possible
demonstration.** Grepping the corpus for the phrase `UNVERIFIED CLOSE` returned
**21** entries; anchoring on the trailer's own heading returns **13**. The other
eight were shifts *writing about* the guard. A reader that asks "does this text
contain X" cannot tell a report from the thing it reports on — and I made the
error inside the hour I spent fixing it in the guard.

**The claim class the trailer cannot see — card closures — was read in bulk and
holds.** Every `#N CLOSED` claim in the period's September entries was checked
against the issue's real state: **68 claims, 68 true.** The checker was
controlled first (it flags #531, #534 and #358 as OPEN and reports a
non-existent number as NOT FOUND), so a silent lookup failure could not read as
a pass. Run 1's comparable figure was nine of eleven shifts holding.

**Verdict: the audit found no false claim this period.** The two failure shapes
run 1 named — a report written ahead of its artifacts, and a dying process
leaving claims standing — did not recur in a checkable form. That is the #101
guard doing its job, and it is also why the guard's accuracy is now the thing
worth auditing, which is B.

### B. Recurrence ledger

| # | Repeat | Occurrences (evidence) | Class | Proposal | Status |
|---|---|---|---|---|---|
| **R6** | **A guard infers a signal from PROSE, so a report *about* the guard trips it** | `is-quiet-entry.ps1` read "NOT a quiet night" as a quiet declaration (**#360**, fixed 2026-09-01); `close-stamp.ps1` read denials and its own trailer as merge claims (**#358**, six instances, fixed tonight); the Retro's own corpus grep over-reported 21 for 13 (tonight, §A) | a detector matching a MENTION where only a DECLARATION counts | **Guard, and the repair is transferable rather than per-site**: #360's rule — fenced blocks and blockquotes stripped first, the claim must BEGIN a line after markdown furniture, and the machine's own trailer is not the shift's prose | **#358 FIXED tonight**, 13 arms in `.agents/foreman/drive-close-stamp.ps1`; #360 already fixed. **The class is now closed in both known sites** |
| **R7** | **A shift runs for an hour, does work, dies, and leaves no report** | `runner-close-*`: 2026-08-28 (40 min), 08-30 (killed by the founder, correctly), 08-31 ×4 (three of them dying in the same second — the #332 command-line-length class), 09-03 (93 min, code 1), 09-04 (52 min, code 1) | shift process death with no record | Already carded and already fixed twice from different directions: **#330/#332** (the 186 KB prompt crossing the Windows command-line limit) and **#490** (a 529 from Anthropic, now a transient class rather than a model fallback) | **No new proposal.** The two 09-03/09-04 deaths PRECEDE #490's close (03:07Z on 09-04) and are the instances that produced it. **No silent death since.** Re-read next run — one clear day is not yet evidence |
| **R8** | **Two cards for one defect, filed from different doors, neither naming the other** | **#467** (filed 2026-09-02 from a gate review, with the code read at `server/routes/billing.ts:112-114` and `:153-155`) and **#531** (filed 2026-09-04 from his reply #130) are the same Stripe base-URL bug | a founder instruction carded without a dedup pass against the open queue | **No guard proposed** — a label query cannot tell two cards apart by subject, and the relay filing his words promptly is the right instinct. The cheap answer is the one taken: **cross-link them**, so whoever takes #531 inherits #467's line numbers instead of re-finding them | **Cross-linked tonight.** Watch for a second instance before proposing mechanism |

**Recurrence rate this period: 3 repeat classes over 209 entries** (run 1: 5
classes over 13 shifts). One class closed with a guard, one already closed by
two earlier cards, one answered with a cross-link. **0 laws proposed** — as in
run 1, every failure is already against a written rule, so the answer is
mechanism rather than more words.

### C. The anti-boredom read

Every PR merged since 2026-09-03, against the card it cites:

**24 PRs, 24 trace to a pre-existing card, a founder reply, or a patrol on its
own clock.** The two that did not resolve mechanically both survive by hand:
PR #491 cites **#487** (my extractor took the last `#NNN` in the title, which
was *"reply #115"* — a Crew reply number, not a card: the reader's fault, not
the shift's), and PR #533 is the **Machinist's patrol #2**, self-authorising on
a clock it was three days past.

**No boredom finding this period.**

### D. What was fixed tonight — #358, and what the fix cost

The card was labelled `seat:retro` and had been open since 2026-08-31 with the
class already named by a previous sweep. Three false-positive mechanisms were
measured at the real entries before anything was written:

1. **A line-initial denial** — `PR #357 was not merged by me…`
2. **A blockquote** — `> NOTHING WAS MERGED. PR #357 IS STILL OPEN`
3. ⚠ **The guard's own trailer** — `PR #357 "merged" -> gh: OPEN <-- MISMATCH`.
   **This is the one nobody had named, and it explains why 2026-09-01 produced
   a run of FIVE consecutive false alarms rather than one**: the standing orders
   tell every shift to read its predecessor's trailer FIRST, so each shift
   quoted the last one's stamp and inherited its false alarm. **A guard that
   propagates its own false positives through the very ritual designed to
   surface them.**

The repair is #360's rule with the trailer exclusion added. ⚠ **One departure
from the card's own comment is declared rather than quiet**: it asked for no
negation pattern, and mechanism 1 *is* a line-initial declaration, so the
begins-the-line rule cannot separate it — only its polarity differs. A narrow
same-line polarity test does that one job and is documented in the code as the
residue the declaration rules cannot see.

**A fourth site was found on the way and fixed with them** — `$placeholder`
matched `RECEIPT_PLACEHOLDER` anywhere in the body, which the card did not name.
It had never fired, for a reason worth writing down: the trailer the guard
appends contains the literal, so the check was clean only because it always ran
before its own output existed. **The old guard was not idempotent — re-running
it on any already-stamped entry flags it.** The fixed one is.

**Measured, driven through the real script, never a reimplementation:**

- **13/13 arms green** (`.agents/foreman/drive-close-stamp.ps1`), each with a
  before-arm against the pre-fix copy: 8 arms reproduce the defect, 3 true
  positives are preserved (including the origin specimen — a shift claiming an
  OPEN PR merged), 2 true negatives hold.
- **Corpus, 17 real entries through both scripts under identical conditions:
  UNVERIFIED 6 → 0, and ZERO entries went verified → UNVERIFIED.** No true
  positive was lost. ⚠ **Stated as a limit rather than discovered later: this
  is a same-conditions comparison, NOT a replay of the historical verdicts** —
  `gh` answers about today (#357 has since merged) and the receipt clock is now,
  so a 2026-09-01 verdict cannot be reproduced exactly.
- Two of the driver's own arms were wrong on the first run and both are recorded
  because they are the same family: one read the fixture's own trailer instead of
  the new one (**an arm inert by construction**), and one accidentally put the
  test phrase at line-start.

**Coverage note:** `.agents/` is gitignored, so no suite in the repository can
ever see this guard. The driver is the only coverage it can have — **run it
after any edit to `close-stamp.ps1`.**

### Clocks

Retro: run 1 2026-08-26, run 2 2026-09-05 (9 days late — the clock reader
`scripts/patrol-clocks.mts` now derives this from the heading above, which is
what #505 built). Next due ~2026-09-12.
