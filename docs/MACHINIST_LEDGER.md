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
| the client bundle read | `pnpm machinist:bundle` | how many bytes a visitor downloads, and whose they are | this file |
| the house-command bench | `pnpm machinist:bench` | what our own commands cost — check, atlas, build, suite | this file |

Two things the ledger read does NOT measure, stated so the absence is never
read as a zero (doctrine entry 1): the roll's per-slice timing (rolls log
their census to the container rather than persisting it — the operation's
wall is the whole roll's), and **anything about the client** — page load,
interaction latency, the canvas, the "laggy in general" half of the charter.

⚠ **THAT SECOND SENTENCE ENDED "No instrument records the client today", AND
IT IS NO LONGER TRUE OF ONE PART OF THE CLIENT — #35, 2026-09-10.** The
toolbelt remainder shipped two readers, and the correction is deliberately
narrow, because the tempting version of it is the false one:

- **`pnpm machinist:bundle` reads the BYTES SHIPPED** — the emitted JS and CSS,
  gzipped, plus who is responsible for them. That is now READ.
- **Page load, interaction latency and the canvas are still UNREAD**, and the
  bundle figure is not a proxy for any of them. A 600 kB bundle and a laggy
  canvas are different faults with different fixes; the charter's *"laggy in
  general"* half is about the second, and nothing measures it yet.

**The first readings, taken on the build shift rather than on a Machinist run**
(so they are dated evidence, not a patrol entry — the seat's Run 2 is still its
own act, on its own clock):

| reading | 2026-09-10, `team/toolbelt-remainder` |
|---|---|
| JS shipped, gzip | **637.0 kB** in **ONE** chunk |
| CSS shipped, gzip | 67.4 kB |
| heaviest owners (share of attributed bytes) | `recharts` 11.4% · `react-dom` 11.0% · `app: features/casting` 6.3% · `app: features/boards` 5.5% · `framer-motion` 4.8% · `lodash` 3.8% |
| `pnpm architecture:check` | 9.36 s median (3 runs) |
| `pnpm capability:check` | 1.52 s median (3 runs) |

⚠ **The bundle is ONE chunk, so every visitor downloads the admin panel, the
canvas and the casting studio before anything renders.** That is the largest
client number this project has ever had in writing, and it is a FINDING, not a
brief — what to do about it is the Machinist's to card and measure, and #744
holds it.

⚠ **And a warning that belongs beside the numbers rather than in a
docblock:** `rollup-plugin-visualizer`'s per-module byte counts sum to **2.27×**
the bundle actually emitted, because `renderedLength` is pre-minification and a
per-module `gzipLength` compresses each module against nothing but itself. The
reader takes its totals from the files on disk for that reason and reports the
plugin's numbers only as SHARES. **Never quote an owner's byte count as a
size** — `scripts/lib/bundleFold.mts` carries the measurement.

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
a roll or retry **in flight at read time** has unfinished slices nothing has yet
had a chance to refund — so slices whose **operation is still live** are now
reported separately and kept OUT of the "did not arrive" figure; and the two
tables are windowed on their own `createdAt`, so a slice near the boundary can
fall inside while its refund falls outside. **Only the first is a finding, and
only once the other two are ruled out by hand.**

⚠ **That second cause was measured by the WRONG SIGNAL in its first two shapes,
and the third review round caught it.** It asked whether the slice ROW was
younger than a six-minute constant — the lease plus one sweep, which is the
window before a **dead** operation's slices become refundable. A **live**
operation renews its lease every 30 seconds indefinitely and never becomes
eligible however long it runs. §A of this very run measures roll p95 at **343 s**
and a 60-day max of **1,495 s**, so a reading taken beside a live long roll would
have folded up to eight of its slices into "did not arrive" **and** printed a
false disagreement beside them. It reads `generation_operations.status` now —
`claimed`/`running`, the answer the engine already writes down, on the row the
query was already joining. **Clause 4 of the disappearing-technology law,
pointed at this one instrument three times in one sitting.**

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
| in-flight test widened to swallow every unfinished slice | 8 slices leave "did not arrive" → `20 (8.1%)`, `DIFFERS BY +8` | 28 (11.3%), AGREES |
| `castingV2.roll` dropped from the kind list | population empties → `DIFFERS BY +28` **through the empty branch** | 248 slices, AGREES |

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

**Carded this run:** two, both filed and not worked, per the anti-boredom rule —
**#532**, the delete road's erased failure reason (§D), and **#536**, the
cross-check's four refund sentences being a hand-copied MIRROR of four inline
literals in the writer modules (working law 4). The second is the reviewer's
last finding and it is correct: the comment's own *"a new sentence belongs in
this list in the same commit"* is a remembered rule, not a derived one, and the
whole run is a record of remembered rules failing silently over populations that
have not occurred. It is carded rather than fixed here because the fix touches
four server modules on the refund path, which is a different diff from a patrol's
own reader.

### I. Close

Seat: Machinist, patrol #2, one seat, shift `foreman-20260905-1010`. Clock: run
1 was 2026-08-26, so this run was 3 days past a weekly clock — the clock now
counts from today, and `scripts/patrol-clocks.mts` reads the `## Run` heading
above rather than a date typed anywhere else. Reader extended and its control
driven; ledger appended; #129 given its numbers; one card filed. Nothing spent.

## Run 3 — 2026-09-12 05:43–06:5x AEST (Machinist, patrol #3; weekly clock, on the day)

Nothing spent: every figure is a `SELECT` over rows that already exist, a call
to a provider's own books, a build, or a timed house command. Readers:
`scripts/machinist-ledger-read.mts` (14d / 60d / 7d), `pnpm machinist:bundle`,
`pnpm machinist:bench`, and two read-only disposables named where they are
quoted. Windows: **14d** = the 14 days to 2026-09-11 19:44Z, **60d** to the
same instant, against `hayabusa.proxy.rlwy.net:23768` (production) at
`aaefcd39`. Raw outputs in `output/_machinist3/` (untracked).

⚠ **The denominator, first, as run 2 ruled:** every operation in the 14-day
window is user 1's. Zero customer traffic. These are dogfood rates.

### A. Wall-clock per paid operation

| kind | window | n | median | p95 | max | statuses |
|---|---|---|---|---|---|---|
| `castingV2.roll` | 14d | 30 | **52 s** | 82 s | 341 s | 22 succeeded · 8 partial |
| `castingV2.roll` | 60d | 256 | 47 s | 126 s | 1,495 s | 229 · 22 partial · 5 failed |
| `castingV2.refine` | 14d | **3** | 106 s | 116 s | 116 s | 3 succeeded |
| `castingV2.refine` | 60d | 225 | 120 s | 285 s | 390 s | 192 · 33 failed |
| `castingV2.retry` | 14d | **3** | 41 s | 46 s | 46 s | 2 succeeded · 1 failed |
| `model.delete` | 14d | 58 | 1 s | 1 s | 20 s | 44 · 14 failed |

- **The refine road is nearly idle**: 3 refines in 14 days, 6 landed since
  2026-08-23. Its 60-day median is 120 s for the third run running; nothing new
  can be said about it from three rows, and this ledger does not pretend to.
  0 of 3 past the gateway wall; the 60-day count is the same 9 of 225 that
  runs 1 and 2 read — **no refine has crossed the wall since 2026-08-21.**
- **The roll's window p95 fell from 343 s to 82 s** — run 2's tail was the
  eight-slice creature courts, and the courts were quiet this fortnight.
- ⚠ **The retry road ran on production for the first time** — run 2 measured
  zero `castingV2.retry` operations all time. Three since (05 Sep ×2, 09 Sep),
  read at the rows (`scripts/_machinist3-retry-disposable.mts`): two arrived
  in 41 s and 46 s; one refused again (`PRECONDITION_FAILED`, 35 s), refunded
  20, with the honest sentence on the row — *"That tile didn't arrive again.
  20 credits were refunded."* The population run 2's cross-check was written
  for now exists, and the cross-check agrees over it (§B).
- **The 14 `model.delete` failures are run 2's 14** — the windows overlap on
  08-30/31, which is when #301/#308 stopped his Casts deleting. No delete has
  failed since 2026-08-31. All 14 still carry the replay fence (#532's fix
  reads them as erased rather than unexplained).

### B. The roll at slice grain — the worst number, re-read

| window | slices paid for | arrived | refused by the engine | stranded | **did not arrive** |
|---|---|---|---|---|---|
| 14d (run 3) | 243 | 232 | 9 (3.7%) | 2 (0.8%) | **11 — 4.5%** |
| 14d (run 2) | 248 | 220 | 20 (8.1%) | 8 (3.2%) | **28 — 11.3%** |
| 60d | 2,051 | 1,971 | 41 (2.0%) | 39 (1.9%) | **80 — 3.9%** |

**Cross-check on the money ledger: 11 refunds / 220 credits (14d), 80 / 1,600
(60d) — AGREES on both, now with a retry row in the population** (1 of the 9
refused is the retry above). **Every classified loss is still
`content_policy`**: 9 of 9 in the window, 25 + 1 of 41 over 60 days beside 15
`capability`. At the sheet: **8 of 30 rolls came back short a picture** — one
sheet in four, every missing tile a refusal. Run 2's 11.3% has more than
halved; the class has not moved at all. **#129 (open) is still exactly its
brief and now has a second fortnight of numbers.**

### C. The carried-geometry sentence, retired with its denominator

Runs 1 and 2 both printed *"rows holding carried geometry (the render's
writer, a010923d): 0"* as though it were a finding. Read this run with the
denominator beside it (`scripts/_machinist3-carried-disposable.mts`):
**6 refines have landed since the writer shipped (2026-08-23), on 0 faces
holding a library row — the library holds 2 rows over 1 face, all time.** The
writer fires only on a face that carries a library feature, and no such face
has been refined since it existed. **Zero over zero.** Not a dead writer, not
a finding; the sentence is kept in the reader because the day the population
exists it becomes one, but it is not to be quoted as a defect again without
this denominator beside it (run 2's own rule: enumerate the writer's
population before calling its output absent).

### D. Face scans — right on his cost model

**139 paid looks in 14 days = $13.90** (77 of them on 2026-09-05, 22 on 09-09).
His model when he widened the pair was *~$0.10/scan, ~$30/power-user-month*;
one account at $13.90 a fortnight is $30 a month, on the nose. Zero
render-written rows — the §C denominator explains why.

### E. Provider books — the ratio flipped, and the reason is the courts

- **OpenRouter (text), account-wide: $10.54 over 12 active days — ≈$0.88/day**
  (run 2: $2.82/day; run 1: $4.70/day). `grok-4.6` on three days (the #466 /
  #477 arms); otherwise `claude-sonnet-5` only.
- **fal (image), off our surviving rows: $18.04 — 179 roll renders + 3 edits
  + 4 SAM reads — ≈$1.29/day.** Still a floor; but the 60-day read shows 186
  renders total, so in THIS window nearly every row survives and the floor is
  close to the number.
- ⚠ **Image now out-spends text, $18.04 : $10.54 — the reverse of run 2's
  four-to-one.** Not a change in the product: text fell because no court ran
  this fortnight (run 2's text figure carried the author bench and the
  reader court), and image is what dogfood rolls cost at 20 slices a sheet.
  **With the courts quiet the house's steady-state spend is ≈$2.20/day, image
  first.** Two windows are not a trend; recorded so the next run can say
  whether it is.
- Balances are a reading for the rite's receipt, never a finding (his rule).

### F. The client and the house — the two readers the seat gained in #35

**Bundle** (`pnpm machinist:bundle`, read 2026-09-11 19:51Z at `aaefcd39`):
**636.9 kB gzip JS in ONE chunk**, 67.4 kB CSS — unchanged from the 09-10
reading to the decimal. `recharts` 11.4% · `react-dom` 11.0% · casting 6.3% ·
pages 5.8% · boards 5.5%. **#744 (open) holds it**; nothing new to add.

**House commands** (`pnpm machinist:bench`, hyperfine 1.20.0, this machine,
3 runs + 1 warmup unless stated, nothing else of mine running during the
timed commands except the ledger reads):

| command | median | σ | note |
|---|---|---|---|
| `pnpm check` | **116.3 s** | 0.9 s | every preflight, the gate's first red |
| `pnpm architecture:check` | 8.7 s | 0.1 s | 09-10 read 9.4 s |
| `pnpm capability:check` | 1.2 s | 0.0 s | 09-10 read 1.5 s |
| `pnpm build` | 9.4 s | 0.3 s | 2 runs |
| `pnpm test` | **refused to time** | — | see below |

⚠ **`pnpm check` is 116 s, and 67 s of it is one pass that re-checks work the
other passes already did.** Timed each of its four commands alone
(one run each, same box): `tsc --noEmit` **26 s** · `tsc -p
tsconfig.casting-tests.json` **14 s** · **`tsc -p tsconfig.scripts.json` 67 s**
· `check-cleanup-dispositions --strict` 8 s. The scripts config includes
`server/**/*` and `shared/**/*` beside `scripts/**/*`, so the whole server is
type-checked twice per preflight and `castingV2` three times. At 2.54 gate runs
per card (§G) and a preflight before each, that is several minutes of every
card. **Carded, not built** — the Machinist records the number and the brief
is its own card (filed this run, see §H).

⚠ **`pnpm test` could not be timed because it FAILS on `main`**, and the bench
refuses to time a failing command (*a failing command is fast, which would
read as an improvement*). Run directly afterwards with the JSON reporter:
**591 s wall, 3,519 files, 13,026 arms, 14 failed — every one of the 14 a
timeout (durations sitting exactly on 5,000 / 30,000 / the atlas's clock),
not one an assertion.** ⚠ That run was taken with this shift's own `pnpm
check` in the worktree running beside it, so it is a WORSE-load reading of the
class #743 already measured at 5 failures on a clean `main` — the same class,
not a new one. **#743 (open) holds it**; the reading is added there. The
consequence for this seat is stated rather than implied: **the bench's
`pnpm test` row cannot be taken until #743 is worked**, whatever machine it
runs on.

### G. The shift process — #543's two numbers, first reading on the clock

| figure | **7d — all post-rule** (since 09-04) | 14d (half pre-rule) | 3d read on #543 (09-08) | baseline (05 Sep) | target |
|---|---|---|---|---|---|
| cards landed per session | **1.73** (163 cards / 94 landing sessions of 97) | 1.51 | 1.73 | 1.18–1.27 | 3 |
| gate minutes per card | **20.0** (3,260 min / 163) | 21.5 | 19.3 | 23.2–28.25 | 10 |
| gate runs per card | **2.36** (384 / 163) | 2.54 | 2.41 | 3.1 | 1.5 |

**The post-rule week holds where the 3-day read put it**: cards per session
1.73 exactly, gate minutes per card 20.0 against 19.3, gate runs per card
2.36 against 2.41 — better than the baseline on all three rows, at target on
none. The 14-day column is worse on every row because half of it is
pre-rule, which is what it should show. The spread he asked for (one
wide-batch night moves the mean) cannot be read from this reader — it prints
means; noted, not carded (#543 is closed on his word). The 7-day column was
taken with the RETRIED reader on its first run after #824 merged; the same
read had blanked before it. Unattributed in it: #596 and #824 itself (this
shift's own row was still open when it read — the boundary artifact the
reader prints rather than drops). Over 14 days, 27 unattributed, 26 of them
28–30 Aug before `crew_shift_runs` existed. Overlapping runs 16/17 and
97/98, as every reading has said.

⚠ **THE INSTRUMENT, AND WHAT WAS BUILT THIS RUN (the seat's own reader, not a
new one).** Section G printed `UNREAD` on **three of the four** full readings
this patrol took — 14d ×2, 7d ×1 — each time because ONE of ~200 sequential
per-PR `gh api` calls returned `connectex … did not properly respond`, and the
reader threw the other 199 away. The 3-day read on #543 recorded the same
shape (*"four of five attempts today"*) and asked for one retry. **PR #824**:
every `gh` call is tried three times with a 1.5 s pause; a dead `gh` still
refuses and its reason now says how many times it was asked; three driven
arms, negative control exact (those three red on `main`'s reader, 24 green).
No classifier of "transient" — an auth failure retried thrice costs a second,
and a misread message would hand the old behaviour back on the one road this
exists for.

### H. Attempted and reverted; carded

Nothing attempted on the product. Carded this run, filed not worked:
**#825 — `pnpm check`'s scripts pass re-checks all of `server/` (67 of 116 s)** —
the measured brief is whether project references, `incremental`, or a
scripts-only include cuts it, measured before believed. Added to existing
cards rather than refiled: today's 14-timeout full run on **#743**; nothing new
on #744 (unchanged to the decimal) or #129 (the numbers above go on the card).

### I. THE WORST NUMBER — run 3

**One sheet in four came back short a picture — 8 of 30 rolls partial; 11 of
243 paid slices did not arrive (4.5%), and every classified one was the engine
refusing to draw it.** It is run 2's worst number more than halved (11.3% →
4.5%), on a fortnight with no creature courts in it, and its class has not
moved: `content_policy`, 9 of 9. **#129 is its brief and is open.** Runner-up,
unchanged: the client half of the charter — page load, click-to-paint, the
canvas — is UNREAD; the bundle reader (#35) reads bytes shipped and is not a
proxy for any of it. Run 1 said so, run 2 said so, run 3 says so; #555 is the
card.

### J. Close

Seat: Machinist, patrol #3, one seat, shift `foreman-20260912-0540`. Clock:
run 2 was 2026-09-05, so this run is on the day; the clock counts from today.
Reader hardened (PR #824) with its control driven; ledger appended; one card
filed; #743 and #129 given their numbers; two read-only disposables written and
guarded. Nothing spent.
