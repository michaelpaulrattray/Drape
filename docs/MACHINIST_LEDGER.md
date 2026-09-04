# Machinist ledger — how long paid work takes, and what it costs the house

**Clock:** every 7 days. (Machine-readable — `scripts/patrol-clocks.mts` reads
this line and the newest `## Run` date to tell a shift whether the seat is due.)

The Machinist seat's record (PROGRAM.md, "THE CLOCKS"; charter #58,
founder-ruled 2026-08-25; first run ordered by the founder 2026-08-26, *"do
it"*, card #98). What lives here and nowhere else:

1. **The performance ledger** — every reading the seat takes of production's
   own rows and the providers' own books: wall-clock per paid operation,
   failure and refund rates, the paid reads the house buys, and the dollars
   per day. Each figure carries its window, its denominator and the reader
   that produced it. A figure quoted twice comes from a script, never a
   memory (`INSTRUMENT_DOCTRINE.md` entry 5).
2. **The worst number** — named at the end of every run, with its reading.
   The brief that targets it is a SEPARATE card, and it is measured before it
   is believed; this ledger never carries an optimisation, only the numbers
   that justify or refuse one.
3. **Attempted-and-reverted work** — a measured change that did not pay is
   recorded as explicitly as one that did, so no later seat retries it from
   ignorance.

Every Machinist run BEGINS by reading this file and ENDS by appending to it.
Findings are deduped against the queue, open and closed. The anti-boredom rule
binds: an optimisation is built only from a card that predates the shift and
names the number it moves — a number this ledger has not recorded is not a
brief.

The instruments and their record pages:

| reader | command | what it answers | record |
|---|---|---|---|
| the ledger read | `railway.cmd run --service MySQL -- npx tsx scripts/machinist-ledger-read.mts [--days 14]` | per-kind wall-clock, failures, refunds, paid scans, provider books | this file |
| the call census | `railway.cmd run --service MySQL -- npx tsx scripts/call-census-report.mts --since <iso>` | WHERE a refine's seconds go — by stage, model, and question | `call-census-report.mts` header |
| the deploy rite's balance block | every push (`scripts/deploy-rite.mts`) | today / week / month spend and the account balances, at each deploy | `output/deploy-receipts/` |
| the delivery-rate report (D-236) | `server/castingV2/reliabilityReport.ts` via `scripts/drive-self-walk.mts` | did the customer GET the thing — per class, with the false-pass bucket | `DECISION_LOG.md` D-236 |

Two things the ledger read does NOT measure, stated so the absence is never
read as a zero (doctrine entry 1): the roll's per-slice timing (rolls log
their census to the container rather than persisting it — the operation's
wall is the whole roll's), and **anything about the client** — page load,
interaction latency, the canvas, the "laggy in general" half of the charter.
No instrument records the client today. Until one does, that half of the
charter is UNREAD, not fine.

---

## Run 1 — 2026-08-26 08:33–08:55 AEST (Machinist, patrol #1, card #98; two seats)

Nothing spent: every reading below is a query over rows that already exist or
a call to a provider's books endpoint. Window: the 14 days to 2026-08-25
22:43Z unless a row says 60d. Full output: the reader's own print, run at
`ec21e8e1` against `hayabusa.proxy.rlwy.net:23768` (production).

### A. Wall-clock per paid operation (createdAt → completedAt on `generation_operations`)

| kind | window | n | median | p95 | max | statuses |
|---|---|---|---|---|---|---|
| `castingV2.refine` | 14d | 52 | **124 s** | 265 s | 384 s | 44 succeeded · 8 failed |
| `castingV2.refine` | 60d | 222 | 121 s | 285 s | 390 s | 189 succeeded · 33 failed |
| `castingV2.roll` | 14d | 16 | **43 s** | 302 s | 302 s | 13 succeeded · 2 partial · 1 failed |
| `castingV2.roll` | 60d | 216 | 46 s | 109 s | 1,495 s | 203 succeeded · 9 partial · 4 failed |
| `castingV2.sign` | 60d | 4 | 104 s | 142 s | 142 s | 2 succeeded · 2 partial |

- The refine figure agrees with the dispatch design's own reading (median
  121 s / p95 276 s over 180) — same population, four weeks on, unmoved.
- **Refines past the ~305 s gateway wall: 2 of 52 (14d), 9 of 222 (60d, 4.1%).**
  The design quoted 1.7%; the 60-day rate is higher because the tail grew, not
  because the median did. `CASTING_REFINE_DISPATCH_SCOPE` has been `all` since
  2026-08-25, so the lost-ANSWER defect is closed for every account — the WAIT
  is unchanged and is the customer's whole experience of a refine.
- The roll's 1,495 s max is the deploy-collision class (CLAUDE.md, "Deploying
  while a paid roll is in flight"): accepted by founder ruling, settles by the
  lease sweep, not a target. Its p95 of 109 s over 60 days is the roll's real
  tail.
- Where a refine's clock goes (the census, 19 renders with a census in the
  window, all 19 read): **render 70.0%** — one `gpt-image-2/edit` call at
  **95.7 s mean**; **read 25.3%** — 135 text calls, **7.1 per refine at 5.1 s
  each**, all serial (`sum ÷ wall = 0.95`, about one call in flight at any
  moment); segment 4.7% (56 SAM-3 calls at 2.3 s). Two of the read questions
  account for half the read seconds: `verify` (2.05/render, 28.5%) and
  `caption` (2.47/render, 23.5%).

### B. Failures and refunds

| reading | 14d | 60d |
|---|---|---|
| refines that FAILED (any terminal `failed` row) | **8 of 52 (15.4%)** | 33 of 222 (14.9%) |
| …of which REFUNDED (a charge was returned) | 7 of 52 (13.5%), 175 credits back | 32 of 222 (14.4%), 800 credits back |
| rolls partial or failed | 3 of 16, 240 credits back | 13 of 216 (6.0%), 1,440 credits back |
| candidates that survive as `failed content_policy` | 4 of 88 surviving | — |

- **Two definitions, stated once so both windows count the same way** (gate
  review of PR #112, finding 1): *failed* is every `failed` operation row,
  including the concurrent-edit CONFLICT that charged nothing; *refunded* is
  the subset that returned a charge. The 14d window holds one such CONFLICT
  (8 failed, 7 refunded); the 60d window holds one too (33 failed, 32
  refunded — table A's 33). §F quotes the REFUNDED figure.
- **Every failed refine is charged to the house twice and earns nothing**: the
  render (≈$0.099) and its reads, usually a second render for the "came back
  twice" class, then a full 25-credit refund. It is also the customer's worst
  minutes — a two-to-five-minute wait ending in an apology.
- **The class does not survive the row.** `errorCode` is `INTERNAL_SERVER_ERROR`
  on every refine failure but one (a `CONFLICT`); the class lives only in the
  customer-facing `publicMessage` sentence, and once the variant row is purged
  (only 19 variant rows survive of 222 refines — the rest expired on their own
  clock) the D-236 report has nothing to classify. In the 14-day window the
  sentences split: 4 × *"That refinement didn't come through"* (the generic
  sentence, class UNKNOWN from durable rows), 1 × *"came back twice without
  glasses"* (verification refusal), 1 × the pair-side sentence (a free
  refusal that still wrote a failed operation), 1 × *"That one didn't make
  it"*, 1 × the concurrent-edit conflict (0 refunded — correctly, nothing was
  charged).

### C. The paid reads the house buys outside a render

- **Face scans**: **90 paid looks** in 14 days (20 segmenter calls / $0.10
  each = **$9.00**) — 63 rows carrying `geometry.scanned: true` and 27 with
  NO `scanned` key, which the first seat filed as *"27 render-written
  carried-feature rows"* by subtraction. Read at the rows by the second seat:
  every one of the 27 holds `asked: 12, found: 12` — a full paid scan —
  written between 08-17 and 08-23 before `a010923d` (2026-08-23 13:52) added
  the key, and never rewritten since; *absent means true* is the rule the
  product's own reader applies (`keptFaceScan.ts`). **Render-written rows
  (`scanned: false`): 0. Rows holding carried geometry: 0 of 90** — and that
  is an EMPTY POPULATION, not an inert writer: no refine has run on
  production since 2026-08-23 02:59Z, 53 minutes before the writer landed.
  Unread until one does. All time: 90 rows over 72 faces — the scan table
  has held since 2026-08-17, so re-buys are structural now, not the
  58-for-28 they were before it.
- 43 of the 90 rows landed on 2026-08-24 — the framing-trim and two-paths
  flips' day (all 43 paid looks; there are no unpaid rows to split).

### D. Provider books

- **OpenRouter (text), the provider's own per-day books, account-wide**:
  **$159.41 over 14 days**, of which **$98.09 was 2026-08-15 alone** (10,107
  requests, 42.9M prompt tokens) — the campaign's own measured day (fable-693
  §1, fable-778 §2), not product traffic. Excluding it, **≈$4.70/day**; the
  next largest days, 08-20 $11.08 and 08-21 $9.73 at ~1,100 requests each,
  fell on days with 1 and 6 product operations respectively (section B), so
  they are house work, not customers. All of it is `anthropic/claude-sonnet-5`. The rite's
  balance line read $7.52 of $250 at the last deploy (the founder's page
  already carries this).
- **fal (image), priced off OUR surviving rows** through the rite's own
  reader: **$10.96 over 14 days** — 88 roll renders $8.71, 20 refine renders
  $1.98, 53 SAM-3 reads $0.27, 3 birefnet $0.00 — a FLOOR, because only
  surviving variant rows contribute. ≈$0.78/day.
- **So text out-spends image about fourteen to one on the raw account books
  ($159.41 : $10.96), about six to one once the $98.09 campaign day is
  excluded, and about five to one on product traffic alone** — which is the opposite of what
  "image generation is the cost" assumes, and it is the reads (7.1 per
  refine, the interpreter and the verify/caption pair) that carry it.

### E. Unit economics of one refine, from the rows above

fal render $0.099 + ~3 segment reads $0.015 + ~7 text calls at the account's
mean of $0.0095/request ≈ **$0.18 house cost per delivered refine**, against
25 credits charged; a failed one costs about the same or double and returns
the 25. Per-request text cost is the account mean and is stated as such — the
census prices 135 of 135 read calls by token, and a per-refine token figure
(438.7k tokens / 19 = 23k tokens) is the better number once a price per token
is read off the books rather than a rate card (doctrine entry 4).

### F. THE WORST NUMBER — run 1

**One paid edit in seven fails and is refunded — 7 of 52 refunded (8 failed)
in the last 14 days, 32 of 222 refunded (33 failed) over 60 — and the failure's CLASS is not durably recorded**
(every one is `INTERNAL_SERVER_ERROR`; the class lives in a sentence, and the
row that could classify it is purged). It is the worst on both halves of the
charter at once: the house pays for a render nobody receives, and the customer
waits the full refine median (124 s, often twice) for an apology. Nothing can
be optimised until the classes are named at the rows — the brief that targets
it is card **#111**, and it is a READING first: name the classes durably,
measure their share, and only then propose the fix for the largest.

**Runner-up, and the number the 2K brief answers**: the refine median of 124 s,
70% of which is a single engine call at 95.7 s mean. No caching, ordering or
parallelism reaches that 70% — only the tier/model choice does, which is the
approved 2K render-tier experiment (#58, *"the hybrid option is dead"*). The
25% that IS ours — seven serial text reads at 5.1 s — is a second, smaller
brief (parallelise or drop the `caption` pair), not attempted here.

### G. Attempted and reverted

Nothing attempted this run — the patrol builds the ledger and spends nothing
(#98). Prior measured work worth knowing before anyone retries it: the 760 px
viewer cap lift was withdrawn on measurement (height binds first — memory
`ordered-fix-measured-first`); the framing trim's margin clause was DELETED
because painted detail follows composition, not resolution (fable-1648).

### H. Close

Reader: `scripts/machinist-ledger-read.mts` (new, PR #112). Cards: #111 (the
worst number's brief). **Two seats**: the first built the ledger, opened PR
#112 at 08:45 and exited before the gate answered — no mailbox entry, no
edition, and this heading stamped with a projected close (the R5 class,
#101). The second seat folded the gate review's three findings (the
failed/refunded reconciliation above, the six-to-one clause, the reader's
unlabelled scan bucket), re-ran the reader against production itself before
believing the figures — every §A/§B/§D number reproduced, and §C's scan split
did NOT: the third finding's silent bucket had been holding 27 paid scans
as render-written rows ($6.30 → $9.00, corrected above) — merged, and
closed at the real time. No instrument built beyond the reader the card ordered;
the client half of the charter is UNREAD and is named above rather than
assumed fine — its instrument is a Retro proposal, not a Machinist act, until
a card names it. Next run: ~2026-09-02, from this file.

---

## Run 2 — 2026-09-05 08:52–10:5x AEST (Machinist, patrol #2; weekly clock, 3 days overdue)

Nothing spent: every figure is a `SELECT` over rows that already exist, or a
call to a provider's own books endpoint. Reader: `scripts/machinist-ledger-read.mts`
(extended this run — see §F). Windows: **14d** = the 14 days to
2026-09-04 22:52Z, **60d** = the 60 days to the same instant, run against
`hayabusa.proxy.rlwy.net:23768` (production) at `ba36999e`.

⚠ **THE DENOMINATOR FIRST, BECAUSE IT CHANGES HOW EVERY RATE BELOW READS: ALL
101 OPERATIONS IN THE 14-DAY WINDOW BELONG TO ONE ACCOUNT — user 1, the
founder.** Zero customer traffic. So these are dogfood and house-court rates,
not a customer reliability reading, and a rate measured over eight rolls of a
deliberately hard creature brief is not the rate a first customer will meet.
Run 1 did not say this and should have; it is now the first line of the run.

### A. Wall-clock per paid operation (createdAt → completedAt)

| kind | window | n | median | p95 | max | statuses |
|---|---|---|---|---|---|---|
| `castingV2.refine` | 14d | 12 | **120 s** | 174 s | 174 s | 11 succeeded · 1 failed |
| `castingV2.refine` | 60d | 222 | 121 s | 285 s | 390 s | 189 succeeded · 33 failed |
| `castingV2.roll` | 14d | 31 | **55 s** | 343 s | 359 s | 20 succeeded · 10 partial · 1 failed |
| `castingV2.roll` | 60d | 237 | 47 s | 126 s | 1,495 s | 215 succeeded · 17 partial · 5 failed |
| `model.delete` | 14d | 58 | 1 s | 1 s | 20 s | 44 succeeded · 14 failed |

- **The refine median has not moved in three weeks** — 120 s against run 1's
  124 s, on a fresh population of 12. Its 60-day figure (121 s) is unchanged to
  the second, which is what one expects of a number whose 70% is a single engine
  call.
- **Refines past the ~305 s gateway wall: 0 of 12 in the window.** The 60-day
  count is 9 of 222 — the same nine run 1 read, so **no refine has crossed the
  wall since 2026-08-21.** `CASTING_REFINE_DISPATCH_SCOPE` has been `all` since
  2026-08-25 and the lost-ANSWER defect is closed; this is the WAIT, and it is
  behaving.
- The roll's p95 of 343 s in the window is the 8-slice creature courts, not a
  regression: the 60-day p95 is 126 s over 237 rolls.

### B. THE ROLL AT SLICE GRAIN — the reading run 1 could not take

Run 1 read the roll only at the OPERATION, where a roll that lost one slice of
eight and a roll that lost seven both read as the single word `partial`. That is
the wrong grain for the only question worth asking about a roll: **how many of
the pictures he paid for actually arrived.**

| window | slices paid for | arrived | refused by the engine | stranded mid-flight | **did not arrive** |
|---|---|---|---|---|---|
| 14d | 248 | 220 | 20 (8.1%) | 8 (3.2%) | **28 — 11.3%** |
| 60d | 1,896 | 1,824 | 35 (1.8%) | 37 (2.0%) | **72 — 3.8%** |

The denominator is the row count, not `chargedCredits ÷ 20` — 248 rows against
31 rolls and 1,896 against 237 is exactly eight per roll with no price constant
that could drift. **The 46 days BEFORE this window ran at 44 of 1,648 = 2.7%,**
so the recent rate is **four times** the rate that preceded it.

**Both figures are confirmed by a second reader that shares no resolver with the
first**: the slice-refund sentences on `point_transactions` stand at **28 refunds
/ 560 credits** (14d) and **72 / 1,440** (60d) — agreeing exactly with the slice
counts on both windows. The reader prints that comparison every run.

⚠ **What that comparison does NOT prove was over-claimed TWICE in this run's own
instrument, and the two corrections are worth more than the agreement they
produced** (PR #533, both gate review rounds). The check first said a
disagreement meant one reader was wrong. It does not. Three benign populations
separate the two counts on a perfectly healthy window: a slice with
`pointsCost <= 0` or an **unrecorded** refund is a real loss with no ledger row;
a roll or retry **in flight at read time** has `processing` slices nothing has
yet had a chance to refund — so slices younger than the ~6-minute recovery window
are now reported separately and kept OUT of the "did not arrive" figure; and the
two tables are windowed on their own `createdAt`, so a slice near the boundary
can fall inside while its refund falls outside. **Only the first is a finding,
and only once the other two are ruled out by hand.**

⚠ **AND THE SUBJECT OF THE READING WAS WRONG, NOT JUST ITS CAVEAT — the second
round found the RETRY ROAD.** A retry is a separately paid picture and it settles
through the **same** writer (`retryService` calls `dispatchCandidate` with the
retry's own operation id), so a retried tile writes its own slice row and, when
it fails, refunds under the very sentences counted here. Reading
`castingV2.roll` alone dropped a paid picture that arrived nowhere out of the
headline while still counting its refund on the ledger side — **manufacturing a
disagreement out of a healthy window.** Both kinds are read now, each on its own
line, and every refund sentence on the slice path is counted (four of them,
quoted from their writers).

⚠ **BOTH GAPS SURVIVED EVERY DRIVEN CONTROL FOR THE SAME REASON, AND THAT IS THE
LESSON OF THIS RUN.** Neither population had ever occurred: the render-fault
sentence has not fired in 60 days, and **no `castingV2.retry` operation has ever
run on production, all time** (read at the rows — `CASTING_RETRY_SCOPE` is
`users:1`, so the one live population is the founder retrying exactly the refused
tiles this run measures). A control proves a checker *can* fire; it says nothing
about whether it fires for the right reasons, and **an arm over a population that
does not exist yet is green by construction.** What found both was enumerating
the call sites of `recordRefund` on the slice path — the same move §C credits for
finding the class in the first place. This is the same over-claim shape §C was
written to catch, committed twice in the very run that catches it, which is the
honest reason it is written down here rather than quietly fixed.

### C. AND THE CLASS WAS ALREADY WRITTEN DOWN — the ledger was not reading it

⚠ **All 20 of the refused slices in the window are `content_policy`. Every
single one.** The engine refused the picture; nothing timed out, nothing 500'd,
no provider limit was hit. Over 60 days the classified split is **20
`content_policy` + 15 `capability`**.

This is the part worth more than the number. Patrol #1 recorded that a roll
failure's class survives nowhere: `casting_candidates` is swept, and
`casting_candidate_variants.failureClass` is non-null on **zero** production
rows, all time. Both are true. **The conclusion drawn from them was wrong.**
`rollService.ts` writes the computed `failureClass` into the slice's own
`generations` row (`errorMessage`), and `generations` is purged only by account
or Cast deletion — so the class has been sitting there, in full, the whole time.

⚠ **And it survives a Cast deletion by an accident, not by a guarantee — stated
here because §D's own closing rule demands it.** `finalCastDeletion.ts` scrubs
`generations` as well: it NULLs `errorMessage` **and `operationId`** on every row
carrying the deleted `modelId`, which would erase the class *and* break the JOIN
this whole reading stands on. Roll slices escape only because `createGeneration`
writes them with **no `modelId`** (the `variation:` step). That is a property of
the writer. A slice that ever starts carrying one vanishes from this reading
silently, and the totals above simply get smaller — so the reader's comment block
names it beside the query rather than leaving it to be rediscovered.

**The ledger was buying that signal and throwing it away.** That is the
disappearing-technology law's clause 4 — *read what the engine already gives you
before reaching for a better one* — pointed at our own instrument, and it is the
second time this ledger has hit the shape: #111 found the refine's class on the
money ledger after run 1 filed it as unrecoverable. **Two runs, two "the class
is lost" findings, both false.** The rule this seat takes from it: before
recording that something is not measurable, enumerate every table the writing
path touches, not just the one the reader already opens.

No new card is filed for the refusal rate itself. **#129 is open and is exactly
its brief** — the refusal-loop patrol, founder-ordered 2026-08-26: log refused
and passed prompts, find the trigger words, measured word→replacement pairs into
the author's rewrite list. It now has a measured denominator instead of an
anecdote, and the numbers are recorded on it.

### D. `model.delete` reads 14 failed of 58 — and the reason was ERASED, not absent

Every one of the 14 carries `errorCode` NULL, `publicMessage` NULL, `modelId`
NULL, `result` NULL **and `subjectDeletedAt` stamped**; none of the 46 successes
carries the stamp. Read at the code: `finalCastDeletion.ts` scrubs every PRIOR
operation on a Cast when that Cast is permanently deleted (the R7-5 replay
fence) — nulling `errorCode`, `publicMessage`, `modelId` and `result` — and it
does **not** touch `status`. So a delete that failed and was then retried
successfully leaves behind a `failed` row with no reason on it.

**They did fail** — `status` was written before the scrub. What is gone is why.
The distinction matters because "never recorded" invites you to add a column and
"erased afterwards" tells you the column already existed and something else took
it. **Nothing here can be recovered by reading harder.**

The cause of these particular fourteen is not a mystery and is not refiled:
**#301 and #308, both closed** (2026-08-30 and 2026-08-31) — the referencePlates
substring guard and the evidence-key shape check, each of which stopped one of
his Casts deleting, on exactly the days these rows fall. What is new is that the
ledger could not have told you that, and would not be able to tell you next
time. Over 60 days **52 failures are fenced**, including **all 35
`evidence_candidate_generate` failures** that run 1's §A listed with no
explanation available. The reader now names them rather than printing them as
unexplained; the durable fix is carded, not built (see §H).

### E. Provider books, and what the house is actually spending

- **OpenRouter (text), the provider's own books, account-wide: $36.64 over the
  13 active days in the window — ≈$2.82/day**, against run 1's ≈$4.70/day
  excluding its campaign spike. Nothing resembling 08-15's $98.09 has recurred.
  `x-ai/grok-4.6` appears on three days (08-29, 09-02, 09-03) — the #466 author
  bench and #477's evidence — and is the only model other than
  `anthropic/claude-sonnet-5` on the account all window.
- **fal (image), priced off our surviving rows: $8.71 over 88 roll renders,
  ≈$0.62/day.** Zero refine rows survive in the window, so this is a floor, as
  it was in run 1.
- **Text still out-spends image, now about four to one ($36.64 : $8.71)** on
  house-and-product traffic combined. Run 1 measured five to one on product
  traffic alone; the direction has held across two independent windows, which is
  worth more than either ratio.
- **Face scans: 83 paid looks = $8.30**, 75 of them on 2026-08-29 alone.
  Zero render-written rows; zero rows holding carried geometry, all time. The
  carried-geometry writer (`a010923d`) has still never produced a row.

### F. What was built this run (the seat's own instrument, not a new one)

`scripts/machinist-ledger-read.mts` gains, in section C:

1. **every paid slice road at slice grain** — roll AND retry, each on its own
   line: paid / arrived / refused / stranded, with the class off
   `generations.errorMessage`, deliberately NOT folding `processing` into
   `failed` (a slice stranded when its operation died is refunded by the recovery
   sweep, not by `failCandidate`, and collapsing them would hide whichever one
   grew);
2. **the money-ledger cross-check** printed beside it — **every** slice-refund
   sentence, saying AGREES or reporting the difference **and naming what can
   benignly cause one**, rather than leaving a reader to compare two numbers by
   eye or to read a difference as a defect. **It runs even when the slice
   population is EMPTY**, because a reading whose population collapsed to zero
   while the money ledger holds refunds is the loudest form of exactly what the
   cross-check exists to catch — and the first shape of it went silent in that
   case, which the kind-filter control caught;
3. **the fence line** — failures whose `errorCode` a later Cast deletion erased,
   named as erased rather than printed as unexplained.

**The cross-check was proven able to fail before its verdict was believed**
(working law 2). Three controls, each driven against production and each restored
and verified disarmed at the bytes:

| arm | armed | disarmed |
|---|---|---|
| stranded slices dropped from the slice query | `20 … DIFFERS BY +8` | 28, AGREES |
| recovery window widened so every `processing` row reads as young | 8 slices leave "did not arrive" → `20 (8.1%)`, `DIFFERS BY +8` | 28 (11.3%), AGREES |
| `castingV2.roll` dropped from the kind list | population empties → `DIFFERS BY +28` | 248 slices, AGREES |

Every figure quoted above is reproducible by running the reader — no number in
this run came from a hand-written query that is not in the tree (doctrine
entry 5), and **no figure moved across any of the three corrections.**

⚠ **All three controls passed and the instrument was wrong twice anyway, which is
the lesson of this run and not a footnote.** A control proves a checker *can*
fire; it says nothing about whether it fires for the RIGHT reasons, and it cannot
speak at all about a population that has never occurred — which is precisely what
both gaps were. **A driven control is a floor, never coverage.** The reading that
actually improved the instrument, twice, was enumerating the writers.

**And the second and third defects were found by driving the fix for the first**
— the in-flight control printed *"still in flight"* against a **`failed`** row (a
settled outcome the reader was mislabelling, visible in real use on any window
containing a roll from the last six minutes), and the kind-filter control left
the cross-check silent on an emptied population. Neither was in the review; both
came out of running the correction rather than reasoning about it.

### G. Attempted and reverted

Nothing attempted. The patrol reads and records; it builds no optimisation. The
prior standing verdicts are unchanged and worth re-reading before anyone retries
them: the 760 px viewer cap lift was withdrawn on measurement (height binds
first), and the framing trim's margin clause was deleted because painted detail
follows composition rather than resolution.

### H. THE WORST NUMBER — run 2

**Eleven of every hundred pictures he paid for did not arrive — 28 of 248 slices
in fourteen days, against 2.7% over the 46 days before — and 20 of the 28 are
the engine refusing to draw them.**

It beats run 1's worst number on both halves of the charter. The house pays for
nothing (a refused slice bills no render) but the *customer* pays in the only
currency a casting sheet has: **he asks for eight people and gets seven, or
five.** Run 1's worst number — one paid edit in seven failing — is now a
*better* number than this one: the refine road ran 11 of 12 in the window with
its class recorded and its gateway wall untouched.

**Its brief is #129 and it already exists** — the refusal-loop patrol he ordered
on 2026-08-26. What run 2 adds is that #129 is no longer speculative: the
population is `content_policy`, it is 100% of the classified losses, and the
prompts that drew it are his own creature briefs. The card carries these
numbers.

**Runner-up, unchanged and still un-briefed: the client half of the charter is
UNREAD.** No instrument records page load, interaction latency or the canvas —
the *"laggy in general"* half of #58. Run 1 said so; run 2 says so again with
nothing new to add, because saying it twice is the honest alternative to letting
silence read as health.

**Carded this run:** one — the delete road's erased failure reason (§D), filed
and not worked, per the anti-boredom rule.

### I. Close

Seat: Machinist, patrol #2, one seat, shift `foreman-20260905-1010`. Clock: run
1 was 2026-08-26, so this run was 3 days past a weekly clock — the clock now
counts from today, and `scripts/patrol-clocks.mts` reads the `## Run` heading
above rather than a date typed anywhere else. Reader extended and its control
driven; ledger appended; #129 given its numbers; one card filed. Nothing spent.
