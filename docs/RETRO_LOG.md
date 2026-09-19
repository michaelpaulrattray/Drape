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

## Run 3 — 2026-09-12 01:29–02:2x AEST (Retro, patrol #3, run #186)

**Window:** 2026-09-05 12:40 (run 2's close) → 2026-09-12 01:29. **111 mailbox
files** — 97 seat-stamped entries (foreman/fable/retro/janitor/warden/
machinist), 4 `runner-close-*`, 10 `runner-escalated-*`. **154 PRs merged.**

**Why the Retro ran tonight.** NEXT UP empty, no replies, no taps; Bugs 0 and
Small fixes 0 under his switches; Process next in the risk order and its seat
**due today by its own clock** (7 days exactly — the reader says "DUE today",
not overdue, so standing exception 3 did not fire and the category order put
it here anyway). Janitor and Machinist are due the same day and each is its
own shift.

### A. Audit ledger

**The instrument first (working law 2), read anchored on the trailer heading
and never on a mention — run 2's own lesson, applied before believing a
count.** A phrase grep for `UNVERIFIED CLOSE` and the anchored read happen to
agree at **7** this week; they agreed by coincidence (three entries write
about the guard and three others carry it), which is why the anchored read is
the one recorded.

**7 UNVERIFIED trailers this window — and all 7 are false.** Each was opened
at its artifact:

| trailer | said | true |
|---|---|---|
| `retro-20260905-1240` | `RECEIPT_PLACEHOLDER present` | run 2's own report, naming the literal in backticks |
| `foreman-20260910-0710` | `RECEIPT_PLACEHOLDER present` | a sentence about #600's stub, literal in backticks |
| `foreman-20260908-2020` | `PR #683 claimed merged, gh says OPEN` | line 65: *"**PR #683 is open**… After #682 merged"* — the claim window crossed a full stop; the entry says OPEN three times |
| `runner-close-20260906-202021`, `-20260909-113132`, `-20260909-150822`, `-20260911-203906` | *"the shift wrote NO mailbox entry"* | `fable-*.md` written 37 s – 8 min before each stamp; the seat pattern omitted `fable-` (found and fixed by the relay 2026-09-11 20:42, recorded on #600) |

**The guard's precision since its 5 Sep repair is therefore 0 of 7.** That is
the run's main finding and it is §D.

**The claim class the trailer cannot see — card closures — read in bulk and
holds.** Every `#N … closed` pairing in the 97 entries (123 distinct numbers,
32 of them PR numbers by the extractor's over-reach, **91 issues**): **89
CLOSED, 2 OPEN — and both OPEN ones are the entry correctly saying so**
(#105 "would have closed"; #697 "stays open, eleven files remain"). **0 false
closure claims.** Run 2's figure was 68/68.

**Merge claims in the entries with no false trailer:** read by driving both
stamp copies over the corpus (§D) — every claim resolved `MERGED`.

**Verdict: no false claim by a shift this period.** Every false statement in
the record was written by the machine that checks the shifts.

### B. Recurrence ledger

| # | Repeat | Occurrences (evidence) | Class | Proposal | Status |
|---|---|---|---|---|---|
| **R6** (again) | **A guard infers a signal from PROSE** — two shapes the 5 Sep repair did not name | inline code (2: `retro-0905`, `foreman-0910-0710`); a claim window crossing a sentence (1: `foreman-0908-2020`); a seat list missing a seat (4 stubs, relay-fixed 09-11) | mention read as declaration | **Guard extended, not re-proposed**: inline code is quoting (rule a2); a merge claim is tested per SENTENCE with `open` in the polarity list; the driver's positive control becomes a real unmerged PR | **#813 FIXED tonight** (§D) |
| **R7** | **A shift dies and leaves no report** | **zero real instances** — all four `runner-close-*` files this week were the R6 seat-pattern false alarm above | shift death | none | **Two clear weeks.** Re-read next run |
| **R9** | **A successful `gh` read of nothing believed as a fact, on a signal that steers the team** | #725 (panel zero), #730 (park gate), #772 (desk sweep), #774 (digest **and** the standing-exceptions view, the fifth found by #775's own review) — five readers, four cards, five days | an empty answer indistinguishable from an outage | **Already converged** on one shared verdict (`emptyOrderedBandVerdict`, driven directly) rather than five patches; nothing to add | **Closed by the fixes.** Note the "fourth and last" in #775's first draft was wrong by one — see R10 |
| **R10** | **A law-7 sweep declares its remainder complete by HAND COUNT and the next shift finds more** | Refresh button: #747 → #759 (8) → PR #763 (10) → #766 "three hand sweeps, three wrong counts"; AUTO 30s: four times → #769; webhook db-verdict: #788 → #789 → #792 (six) → #796 (request path), 24 h; design-law walk: #782 → #799 → #805 → #809; mono law: #524 → #807 (the walk missed `dp-crew__ref` because his desk was empty that night); `gh` readers: "fourth and last" → fifth | a hand count stated as coverage | **No new law** — CLAUDE.md already says *"a clean run is a floor and not coverage"*, and the two open Retro cards **#766** and **#769** are exactly the source-derived guards this class wants. The transferable rule for shift reports, worth one line in the standing orders when they are next touched: **a remainder is named with the READER that produced it, or it is called a floor** | **Watch.** Two guard cards open; no third proposed until one of them lands and is measured |

**Also noted, not carded:** the seat list (`^(foreman|fable|manual|retro|janitor|warden|machinist)-`) now lives in **four** `.agents/foreman` files (`close-stamp.ps1`, `is-empty-shift.ps1`, `check-park.ps1`, the driver) — working law 4, recorded by the relay on #600. One more instance of it drifting is a card; tonight it is a line.

**Recurrence rate this period: 4 repeat classes over 111 entries / 154 PRs**
(run 2: 3 over 209 entries). One extended with a guard (R6), one closed by
convergence (R9), one quiet (R7), one watched with its guards already carded
(R10). **0 laws proposed.**

### C. The anti-boredom read

**154 PRs merged in the window, 154 trace** to a pre-existing card, a founder
word, a patrol on its clock, or standing exception 2. Mechanically, 149 cite a
card that predates the PR; the five that did not resolve by number all survive
by hand: **#533** the Machinist's patrol #2 on its clock; **#540** his terminal
order of 5 Sep, quoted verbatim in the body; **#596** the deploy-on-merge
rollback proof (#508 step 6); **#605** a revert on his word ("not required");
**#674** a red `server/crew` suite over a correct briefing — a gate blocking
every merge, standing exception 2. **No boredom finding.** No "hardening" PR
without a finding behind it.

### D. What was fixed tonight — #813, and what the fix cost

Filed first, then taken (a small `.agents/foreman/` change; the driver is its
only possible coverage because `.agents/` is gitignored — the same road run 2
and the relay took).

1. **`Get-DeclarationLines` strips inline code spans** before the head-of-line
   furniture strip (order matters: the old strip ate a span's opening backtick
   and left the span's body standing as a line-initial claim).
2. **The merge check runs per SENTENCE** (split at `.`/`!`/`?` + space, a
   closing `**` allowed between), and **`open` joins the polarity list.** A
   claim that begins the *second* sentence of a line is now caught — a true
   positive the line-based reader missed.
3. **The driver's positive control was not one.** `$OPEN_PR = 531` is an
   ISSUE; `gh pr view 531` fails; every "claims an OPEN PR merged" arm was
   passing through the `(gh failed)` road. It is **PR #779** now (closed,
   never merged — a state that cannot change) and a control arm asserts the
   trailer reads `gh: CLOSED`.

**Measured, driven through the real script:**

- **29/29 arms green** (`drive-close-stamp.ps1`, was 23): five #813 arms
  each driven against `close-stamp.before-813.ps1` first — **the three
  false-alarm shapes REPRODUCE on the pre-fix bytes**, the bare-placeholder
  positive control fires on both, and the second-sentence claim is caught only
  by the fix (`before-813: verified`). One arm's first cut reproduced nothing
  (the quoted claim sat mid-line, where neither copy saw it) and the driver's
  before-rule said so — kept in the arm's comment.
- **Corpus, 97 real entries through both copies under identical conditions:
  UNVERIFIED 3 → 0, verified → UNVERIFIED 0.** The `#683` entry is not among
  the three because `gh` answers about today (#683 has since merged) — run
  2's stated limit, unchanged; the driver arm carries its exact shape instead.
- ⚠ **One verdict moved for a reason worth stating:** `foreman-20260911-1620`
  read UNVERIFIED on the temp tree (no receipts there) under the old copy and
  verified under the new, because its only line-initial rite phrase was a
  *wrapped* `` `RITE EXIT STATUS: OK` `` continuing a sentence. The rite check
  was reaching that entry by a line-wrap accident; under the inline-code rule
  a quoted receipt token is a quotation. The trailer still prints the receipt
  line and its during-this-shift verdict regardless, so nothing is lost from
  the record — only an accidental trigger.

**Record hygiene:** the three uncorrected `runner-close-*` stubs (09-06, 09-09
×2) now carry the same correction trailer the relay put on the fourth,
pointing at the real `fable-*` entry.

### Clocks

Retro: run 1 2026-08-26, run 2 2026-09-05, **run 3 2026-09-12** (on the day).
Next due ~2026-09-19.

### E. Addendum, same sitting — his word landed mid-shift and R6 closed a third site

**Crew reply #177, 2026-09-11 15:52:52Z, on #721, verbatim and entire: "A"** —
*a cap is an error LINE, not a mention*. Read at 16:01Z on the post-rite reply
check, recorded at the top of the card's body with the hold struck, and built
in the same hour under §2x (executing his ruling is not deciding): the runner's
cap classifier (`classify-shift-failure.ps1`) now removes quotations — fenced,
blockquote, table row, inline code — strips head furniture, and requires the
cap wording to lead the line within 24 characters, the way an error message
opens. **Measured on all 3,145 shift logs: CAP 5 → 1, the one being the real
report; 70/70 driver arms; with the pre-fix copy swapped in as the subject,
exactly the ten #721 arms redden.** A fourth false log had joined the
population since the card was filed — the #495 shift's own report, as the card
predicted. **So R6 closed in THREE sites tonight** (#813's two shapes in the
close-stamp; #721 in the cap classifier), and the rule that did it is the same
one each time: strip what is quoted, then require the claim to lead the line.
Edition 349 carries his acknowledgement; his desk is clear.

## Run 4 — 2026-09-19 11:27–13:xx AEST (Retro, patrol #4, run #286)

**Window:** 2026-09-12 02:26 (run 3's close) → 2026-09-19 11:27. **116 mailbox
files** — 108 seat-stamped entries (100 foreman, 4 janitor, 3 machinist, 1
warden), 2 relay notes, 6 runner park/unpark notices, **0 `runner-close-*`, 0
`runner-escalated-*`**. **123 PRs merged.**

**Why the Retro ran today.** Its clock fired on the day (`patrol-clocks.mts`:
"DUE today", 7 days exactly since run 3); Process ON; NEXT UP empty; no reply,
no tap; every switched count at zero but Performance (three Machinist cards
filed this morning, none urgent). The Machinist took the same day's tie
yesterday-morning-AEST by alphabetical order and said so; this is the next
patrol. Nothing else was takeable.

### A. Audit ledger

**The instrument first (working law 2).** Read anchored on the LAST
`## Runner close-stamp` heading per entry — the template's own placeholder
heading sits above the runner's appended verdict, so a `grep -m1` reads 37
verified entries as bare. Corrected before counting.

**108 of 108 seat entries carry a `— verified` trailer. 0 UNVERIFIED.** The 8
files without one are the relay notes and the runner's park/unpark notices,
which are not shifts. So the guard repaired in run 3 (#813) has, this week, a
false-alarm rate of 0 of 108 — measured on the same corpus shape that gave it
0 of 7 precision last week.

**The claim class the trailer cannot see — card closures — read in bulk.** Every
`#N … closed` pairing in the 108 entries (112 distinct numbers; 15 are PR
numbers by the extractor's over-reach): **96 issues, 96 CLOSED, 0 OPEN** — the
one "open" number is `#209`, which the entry calls *"Shift row #209 closed"*, a
`crew_shift_runs` id and not a card. **0 false closure claims** (run 3: 89/91
with both exceptions correct; run 2: 68/68).

**Merge claims:** 24 trailers carry them and each resolves `MERGED` on the
trailer. Four sampled past the trailer, at the artifacts — PRs #840, #1007,
#1032, #853: `gh pr view` MERGED with a merge commit; each merge commit an
ancestor of `origin/main`; each named receipt present once in
`output/deploy-receipts/index.log` with its `OK`. All four hold.

**Verdict: no false claim by a shift this period, and none by the checker
either.** The one document found false was not a shift report — see R11: the
standing orders said `pnpm preflight` did not exist for two weeks after
`b9dc5eb8` created it.

### B. Recurrence ledger

| # | Repeat | Occurrences (evidence) | Class | Proposal | Status |
|---|---|---|---|---|---|
| **R6** (4th site) | **A reader infers a citation from PROSE** | `disposable-age`'s citation sweep counts a docblock naming a file as a KEEP — #975 → PR #980 moved the fixture names off the live population, and **PR #981 the same night** fixed the docblocks that explained the defect by quoting live names in full | mention read as declaration | **None new, and deliberately** — that reader is conservative by design (*a KEEP is a citation, never a judgement of value*; deletion is the one act a gate cannot give back), so the repair stays on the WRITER side: #980's arm refuses a fixture name that is a real file. The cost is a permanent KEEP per prose mention, and it is stated | **Watch.** Run 3's rule (strip what is quoted, then require the claim to lead the line) was applied to three instruments; this fourth chose the other side on purpose |
| **R7** | **A shift dies and leaves no report** | **zero instances — third clear week.** No `runner-close-*` file in the window at all (the four in the mtime listing are last week's stubs the Retro annotated) | shift death | none | **Closed as a recurrence.** Re-read only if a stub appears |
| **R10** (again, twice) | **A law-7 sweep declares its remainder by HAND COUNT and the next shift finds more** — both guard cards from run 3 LANDED this window (#766 → PR #837, #769 → PR #851) and the class recurred anyway in two places they do not cover | (a) **the crew switch count**: #893 (unreachable cards) → #904 (`blocked` out of the count, **typed by hand** while `CREW_HOLD_LABELS` already declared every hold) → #999 (PR #1000: *"leaves out every held card, not only blocked ones"* — derived from the list at last); (b) **the torn-write chain on the money path**: #855 → #868 → #896 → #955 → #956 → #994 → #995, **seven cards and twelve PRs in four days**, every card honestly *"found by the previous sweep"*, every remainder hand-read (*"Reachability is NOT measured"*) | a hand count stated as coverage; (a) is also *shape-match where a declaration exists* | **The transferable line is now IN the standing orders** (written this run, law-7 bullet): *a sweep's remainder is named with the READER that produced it, or it is called a floor.* No guard: a reader for "two ordered ledger-affecting writes with no shared transaction" is a design, and (b) was worked honestly — the defect is the word *complete*, not the sweeps | **Watch** with the line in force |
| **R11** (new) | **A guard whose population is DERIVED is invisible to preflight's reverse index — and the lesson was written three times to a place nothing reads** | gate runs `34667546203` (#836), `34869959271` (#966), `34906719794` (#983): three branches red on `server/childProcessTestTimeouts.test.ts:50` after three green preflights, 12–14 Sep; three entries (foreman-0912-1315, -0915-0330, -0915-0930) each say *"add the clock guards to the preflight list"* — in the MAILBOX. And the orders' PREFLIGHT paragraph said *"Until `pnpm preflight` exists"* while `package.json:14` had it since 2026-09-05 (#549) — **4 of 108 entries ran it; the rest hand-picked "the changed file and its neighbours"** | a subject with no literal to index; a lesson filed as a receipt | **Guard carded: #1037** — an always-run set in preflight, membership DERIVED by an arm that greps for the deriver idiom, sabotage stated. **Orders corrected tonight**: `pnpm preflight` IS the command; the two clock guards run by name until #1037 lands; a deletion or rename runs the FULL suite (1220's own finding, #1031's first gate) | **Open** — #1037 filed, Process, small |
| **R12** (new, and it spans two runs) | **A control arm pins the author's belief, so the guard cannot discover the mistake it was built for** | run 3's #813 (the driver's "positive control" was an ISSUE, so every arm passed through the `gh failed` road); **#912** (PR #914: `staffClock.test.ts`'s NEGATIVE control asserted `toLocaleDateString` never prints a clock — it does when asked for `hour:` — so the fifth shipping of the 12-hour defect passed a guard built after the fourth); **#975** (PR #980: the dater's arms pinned the live files they measured) | a control written from a premise rather than a specimen in the world | **No guard** — the shape is not mechanizable across instruments (#697's reader sees exactly the *assert-the-mock* shape and its table is exhausted, PR #882 last). Working law 2 already says a control is driven, and memory `instrument-discipline` indexes 69 of these. The Retro's line: **a control's specimen comes from the world — a real PR, a real file, the library's real output — never from the test's own declaration**; worth one line in the orders' close ceremony when they are next touched, not tonight (two lines went in already) | **Watch.** Three instances, three instruments, two weeks |

**Also noted, not carded:**

- **A spend record is a claim; the provider's books are the artifact** (the
  Machinist's #513 note this morning): the reviewer court's record said $13.48
  over 9 calls, OpenRouter's day total said **$16.74 over 12** — the roll-up
  file held only the last invocation. One instance, so not a row; written into
  the orders' spend bullet instead (*the ACTUAL is read from the books*).
- **The seat pattern in four `.agents/foreman` files** (run 3's line) did not
  drift this week; still a line.
- **The test-timing cluster** (PRs #828 #838 #945 #963 #966 #978 — six PRs
  on a harness sized for an idle box and run on a contended one) is NOT a
  repeat class: each traced to its own card, two root causes landed (8 workers,
  one libvips thread per worker), and the Machinist's row reads `pnpm test`
  **130 s green** for the first time. Converged, not recurring.
- **#976/#979 (three guards sweeping the DISK, not the repository)** is law 7
  working as written: the class named in the fix, the population measured
  before taking (*"the card understated its own population by 62×"*), the two
  guards that sweep untracked scratch ON PURPOSE named as exceptions. Not a
  finding.

**Recurrence rate this period: 5 repeat classes over 116 entries / 123 PRs**
(run 3: 4 over 111 / 154). One closed (R7), two watched with their line in
force (R10, R12), one watched on a deliberate choice (R6), **one carded
(R11, #1037)**. **0 laws proposed.**

### C. The anti-boredom read

**123 PRs merged in the window, 123 trace.** Mechanically, 122 cite a card that
predates the PR (`output/_retro4/trace.mjs`: every `#N` / `card N` in title +
body resolved at `gh api`, kept if an ISSUE created before the PR). The one
that did not resolve by number — **#838**, a per-arm 120 s on
`selfInvocationCheck`'s RUN DIRECTLY arm — is a rite refusal recorded by three
shifts (foreman-0910-1730 twice, -0912-1010 at 312 s): a red on the road every
docs push takes, standing exception 2. **No boredom finding.** No hardening PR
without a finding behind it; the week's sixteen `test(…)` and `fix(guard)` PRs
each name the gate red, the card, or the review finding they answer.

**Gate rejections, read for a shared cause (the third thing this seat reads
for).** 17 failed `gate.yml` runs in the window: 5 Dependabot, 12 on shift
branches — **9 on `Unit tests`**, 2 on workflow lint, 1 on #376's closing-
keyword arm. Of the nine: **three are one guard** (R11 above); four are text
guards that read across trees (#1031's three, `listedSource`, `token-guard`,
`auditLogCategoryAgreement`) — the class `pnpm preflight` already covers and
the shift did not run; two are their own (`refusalTag`, `hookDriver`). So
**seven of nine unit-test rejections were a preflight that did not run the
tool built to be the preflight**, and the orders were telling shifts it did
not exist.

### D. The predecessor's four items, and what each got

1. **#1006 — the Retro's own card.** `parked` struck; ruled **a LABEL, not a
   field** (every consumer already holds the row's labels from one `gh issue
   list` call; a Projects field is a second source — #718's drift). **Built:
   PR #1038** — `order:<n>`, one reader (`rankFromLabels`), the top limb of
   `compareOrderedBand`, all three consumers; that night's five cards are the
   fixture, reproducing the reverse without labels and his sequence with them;
   five arms redden under sabotage. Labels `order:1`…`order:8` created;
   PROGRAM.md's *"there is no pin-to-top mechanism"* paragraph replaced with
   the relay's instruction. The #203/#108 loose end is moot at the artifact
   (#108 lost `founder-ordered`; NEXT UP empty).
2. **#969's flake.** The card is CLOSED (PR #970, the prune race settled); the
   17 Sep comment records a DIFFERENT one-off — a `tree1` registration
   directory gone between creation and index write, 1 in 13+13+13 — not the
   prune race, not reproduced, recorded not carded. Correct; nothing to add.
3. **foreman-20260917-1220's three questions.** (a) `MODELS`/`FALLBACK`:
   the HOLD stands — §29e's floor says no row is dispositioned inert on a grep
   and the twins are held on one argument, which is the consistent reading;
   not a Retro matter to overrule. (b) `ProfileCover`: KEEP stands — the pin
   carries a stated stance from a founder-ordered section (03), which is what
   distinguishes it from the `WardrobeShortcutsBar` pin the same slice dropped;
   **but a recorded keep with no condition is a permanent KEEP by prose (R6's
   citation shape)**, so #108's close should put one line to him — *cover:
   keep or bin?* — rather than carry it forever. (c) `vitest run client/src`
   as a preflight: **forbidden for a deletion or rename — in the orders as of
   tonight** (R11's second bullet).
4. **#513's court-cost note.** In the orders' spend bullet (§B, "also noted").

### Clocks

Retro: run 1 2026-08-26, run 2 2026-09-05, run 3 2026-09-12, **run 4
2026-09-19** (on the day). Next due ~2026-09-26.

### E. The seat's own PR, audited the same way

PR #1038 took one review round, and the finding is an instance of the class
this run watches: `nextUpItems.mts`'s docblock said *"nothing here may add a
field that schema does not know"* and **no arm held it** — the sort rows'
`rank` rode a rest-spread into every item, the briefing schema is `.strict()`,
and the first non-empty NEXT UP would have degraded his whole page. TypeScript
does not see an extra key through a spread, and the PR's own arms mapped only
`.issueNumber` off the output, so they could not either. Fixed in `824dbbf6`
with the arm the reviewer asked for (the real schema parsing the real output,
seen red on the pre-fix bytes), and the schema's refusal of an extra key as its
control. **A constraint held by a docblock is R12's shape from the other side:
not a control pinning a wrong premise, but a premise with no control at all.**
Recorded here because a Retro that audits everyone else's reports and not its
own would be the process finding.
