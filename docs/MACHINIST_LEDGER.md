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
| the interaction-latency drive (#555) | `pnpm machinist:latency --base <url> --token <owner's app_session_id> --session <sheet publicId> [--samples 8] [--spend] [--only follow] [--json …]` · its own proof: `pnpm machinist:latency --controls` (in the gate) | click → first visible change on the sheet's own actions — Keep/Unkeep (free), Roll again / Follow / Retry (`--spend`), the chip edit — p50/p95 per action against a declared bar | this file |

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
  ⚠ **ONE OF THOSE THREE IS READ NOW — INTERACTION LATENCY, #555, 2026-09-12.**
  The founder's own question (*"does the machinist measure things like how long
  a click takes to register? e.g if i click keep on a cast tile it can take
  around 2 seconds…"*) has an instrument: `pnpm machinist:latency` clicks each
  action on a real sheet and reads click → first visible change with a
  `MutationObserver` and `performance.now()`. **Its first readings are below.**
  Page load and the canvas are STILL unread; this narrows the sentence by one
  word, exactly as #35 did.

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

**The first interaction-latency readings, taken on the build shift (#555,
2026-09-12, `team/555-latency`) rather than on a Machinist run** — dated
evidence, not a patrol entry, for the same reason the bundle figures above are.
The fixture: the dev server on the shift worktree (`:3190`), the dev database
(remote, Railway), the test account `verify-bot-local` (823) on its own open
sheet (session 90, `c19610ad…`), the HOUSE road (no register scope in the dev
`.env`, so the sentence still draws pickers), headless Edge at 1440×900. The
number in each row is `frameMs` — the click to the animation frame that paints
the change; `--controls` reads an instant change at 6 ms and a 2 000 ms change
at 2 013 ms with a 50 ms clock ticking beside the target, and was driven under
sabotage (the clock read as a 13 ms change) before any of this was believed.

| action → what changes | bar | n | p50 | p95 | max | verdict |
|---|---|---|---|---|---|---|
| keep → tile ring | optimistic | 6 | 26 ms | 32 ms | 32 ms | under 100 ms |
| keep → dock face | optimistic | 6 | 26 ms | 32 ms | 32 ms | under 100 ms |
| unkeep → tile ring | optimistic | 6 | 25 ms | 27 ms | 27 ms | under 100 ms |
| unkeep → dock face | optimistic | 6 | 25 ms | 27 ms | 27 ms | under 100 ms |
| roll again → first skeleton | optimistic | 1 | 34 ms | 34 ms | 34 ms | under 100 ms |
| follow → rail pill | optimistic | 1 | 22 ms | 22 ms | 22 ms | under 100 ms |
| follow → family chip | server-bound | 1 | 18 328 ms | 18 328 ms | 18 328 ms | **OVER 1 000 ms** |
| retry → tile face | server-bound | 0 | — | — | — | absent — no failed tile on this sheet to retry |
| chip edit → the box or the sentence | optimistic | 1 | 15 ms | 15 ms | 15 ms | under 100 ms |

(Keep/Unkeep from the free walk at 13:20Z, 6 paired samples — two of the eight
tiles were already kept by an earlier walk; Roll again and the chip edit from
the spend walk at 13:25Z; Follow from the `--only follow` re-read at 13:29Z
after the chip probe was corrected — see the cost paragraph.)

**What the numbers say, in the founder's terms.** The Keep he measured at ~2 s
(#554) paints the ring AND the dock's face in the same frame, 26 ms after the
click — #554's fix is verified on the customer's hand, not on a reader's word.
Every optimistic action on the sheet paints in one or two frames. **The one
number over its bar is the family chip after a Follow: the rail's pill and the
skeletons answer at 22 ms, but the sentence that says FOLLOWING the new face
waits 18.3 s on this run (28.4 s on the run before it), because the chip is
derived from the roll on screen and the roll does not exist until the
interpreter has run (4.4 s and 14.5 s on those two runs) and the sheet's 2.5 s
poll has seen it.** The wait is SUPERVISED — pill and skeletons carry it — so
this is a reading, not a defect; whether the chip should move on the click
like the pill does is a design question for the seat, and the instrument is
what lets it be asked with a number. The remaining ~11 s between the
interpreter's log line and the poll seeing the roll is UNREAD by this
instrument (it reads the client; the call census reads the server) and is the
next thing to look at if the chip is ever a brief.
⚠ **READ ON RUN 4 (2026-09-19), AND IT IS THE FIXTURE, NOT THE PRODUCT.** The
third Follow sample put the chip at 28.1 s with the interpreter at 15.5 s, so
the remainder was 12.6 s (13.9 and 13.9 s on the first two) — and the same
roll's first tile was DISPATCHED 9 s after its operation row existed, on the
dev world's REMOTE database. On production, read off the timestamps every
roll already carries (`scripts/_machinist4-roll-phases-disposable.mts`, 256
rolls over 60 days): **operation row → first slice dispatched is 0 s at the
median and 1 s at p95.** The dev drive pays a round trip to Railway per
statement; production's database is beside the process. So the chip's wait on
a customer's screen is the interpreter plus one poll, and the "~11 s" above is
not a number to chase. Run 4 §D carries the table.

**What the instrument could not read, stated so an absence is never a zero
(doctrine entry 1):** Retry, because no tile failed on any of the five rolls;
the chip edit on the AUTHOR road (production's `users:1`), where the sentence is
read-only since #535 and the row will read *absent* by design; page load and
the canvas, which are not this instrument's.

**What it cost, estimate → actual.** Estimated on the card before it fired:
≈$1.70 (two rolls). Actual: **five rolls (110–114) and six interpreter calls ≈
$4.10 of house money, and 800 dev credits off the test bot (20 000 → 19 200)**
— the drift is the instrument's own defects found only by running it: a first
Roll again clicked while the sheet was still loading (nothing spent, one
interpreter call), the tile selector one level too deep (a whole spend walk
with no Keep sample), and a chip probe reading presence on a sheet whose chip
was already up (one extra Follow to read the text instead). Roll 111 is still
`generating` with two slices `queued` behind a dev-database
`ER_NET_READ_INTERRUPTED` under a lease the live process kept renewing — the
sweep cannot see a hung slice under a live heartbeat, and that class is carded
rather than fixed here.

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
silence read as health. ⚠ **Interaction latency came off this sentence on
2026-09-12 (#555; the table is in the header). The other two have not.**

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
card. ⚠ **#555 LANDED THE SAME DAY (2026-09-12, evening): click-to-paint is
READ — the first table is in the header's first-readings block. Page load and
the canvas remain the runner-up.**

### J. Close

Seat: Machinist, patrol #3, one seat, shift `foreman-20260912-0540`. Clock:
run 2 was 2026-09-05, so this run is on the day; the clock counts from today.
Reader hardened (PR #824) with its control driven; ledger appended; one card
filed; #743 and #129 given their numbers; two read-only disposables written and
guarded. Nothing spent.

## Run 4 — 2026-09-19 10:33–11:3x AEST (Machinist, patrol #4; weekly clock, on the day)

Readers: `scripts/machinist-ledger-read.mts` (14d / 60d / 7d), `pnpm
machinist:bundle`, `pnpm machinist:bench` (all five rows, the test row for the
first time), `pnpm machinist:latency` (the free walk, then `--spend --only
retry` and `--only follow` on the dev bot), the gate's own step timings off four
runs, and three read-only disposables named where they are quoted. Windows:
**14d** = the 14 days to 2026-09-19 00:34Z, **60d** and **7d** to the same
instant, against `hayabusa.proxy.rlwy.net:23768` (production) at `d9e04659`.
Raw outputs in `output/_machinist4/` (untracked). **Spent: ≈$0.81 of house
money and 160 dev credits off verify-bot** (estimate on the shift row before it
fired: ≈$0.95 + 180 — the Retry arm found no tile and spent nothing).

⚠ **The denominator, first, and it is smaller than run 3's:** **no paid
operation has run on production since 2026-09-09.** Every window read this
morning ends on that day; the 7-day window holds ZERO generation operations.
The 14-day window is therefore run 3's LAST week re-read (25 ops, all user 1),
and nothing in §A–§B is new evidence — it is the same rows, quoted so the
fortnight is on the record. Ten idle days is not a defect; it is the N1 gate
waiting on his eye (his sequencing ruling), and this ledger does not pretend a
quiet fortnight moved a number.

### A. Wall-clock per paid operation

| kind | window | n | median | p95 | max | statuses |
|---|---|---|---|---|---|---|
| `castingV2.roll` | 14d | 19 | 46 s | 341 s | 341 s | 14 succeeded · 5 partial |
| `castingV2.roll` | 60d | 256 | 47 s | 126 s | 1,495 s | 229 · 22 partial · 5 failed |
| `castingV2.refine` | 14d | 3 | 106 s | 116 s | 116 s | 3 succeeded (run 3's three) |
| `castingV2.refine` | 60d | 225 | 120 s | 285 s | 390 s | 192 · 33 failed |
| `castingV2.retry` | 14d | 3 | 41 s | 46 s | 46 s | 2 · 1 failed (run 3's three) |
| `model.delete` | 14d | 0 | — | — | — | run 3's 58 have left the window; none since 08-31 |

- The 60-day roll and refine rows are IDENTICAL to run 3's (same n, same
  medians) — the window's leading edge moved from 07-14 to 07-21 over days
  that held nothing, and its trailing edge gained nothing.
- The 341 s roll is the window's p95 now because the window shrank to 19
  rolls; it is one roll whose settlement waited 294 s on a stranded slice's
  lease (§D's phase read), not a change in the road.
- Refine: 0 of 3 past the wall in the window; 9 of 225 over 60 days — the
  fourth run to read the same nine. No refine has crossed the wall since
  2026-08-21, and none has run since the three run 3 read.

### B. The roll at slice grain — the worst number, re-read on the same rows

| window | slices paid for | arrived | refused by the engine | stranded | **did not arrive** |
|---|---|---|---|---|---|
| 14d (run 4) | 155 | 147 | 6 (3.9%) | 2 (1.3%) | **8 — 5.2%** |
| 14d (run 3) | 243 | 232 | 9 (3.7%) | 2 (0.8%) | **11 — 4.5%** |
| 60d | 2,051 | 1,971 | 41 (2.0%) | 39 (1.9%) | **80 — 3.9%** |

**Cross-check on the money ledger: 8 refunds / 160 credits (14d), 80 / 1,600
(60d) — AGREES on both.** Every classified loss `content_policy` (6 of 6 in
the window; 25 + 1 of 41 over 60 days, beside 15 `capability`). At the sheet:
**5 of 19 rolls came back short a picture — one sheet in four**, exactly run
3's ratio on the subset of its rows that survive in the window. **#129 is still
the brief and is `blocked`** (waits on `founder-ordered`); the fortnight's
numbers are on the card. The class cannot move until the card is taken.

### C. Face scans and the carried-geometry sentence

**1 paid look in the window (2026-09-08), $0.10; 0 render-written; library 2
rows over 1 face, all time; carried-geometry writer 0 over 0** — run 3's §C
denominator stands and the sentence is not quoted as a defect. His $30/month
model is unexercised this fortnight because nothing was exercised.

### D. Where a roll's seconds go on PRODUCTION — read for the first time, off timestamps the rows already carry

The header has said since run 1 that a roll's per-slice timing is UNREAD
(rolls log their census to the container). The rows carry three timestamps
that bracket it anyway — the operation's `createdAt` (written at `begin`,
AFTER the interpreter), each slice's `generations.createdAt` (written at
dispatch) and `completedAt`, and the operation's `completedAt` — and
`scripts/_machinist4-roll-phases-disposable.mts` reads them (second
resolution, read-only):

| phase | 14d (19 rolls) p50 / p95 / max | 60d (256 rolls) p50 / p95 / max |
|---|---|---|
| pre-dispatch: operation row → first slice asked for | **0 / 0 / 1 s** | **0 / 1 / 8 s** |
| dispatch spread: first → eighth slice | 0 / 0 / 0 s | 0 / 0 / 2 s |
| render: first dispatch → last slice done | 46 / 53 / 54 s | 47 / 76 / 350 s |
| post: last slice done → operation completed | 0 / 0 / 294 s | 0 / 0 / 1,155 s |
| operation total | 46 / 54 / 341 s | 47 / 124 / 1,495 s |

**So on production a roll's wall IS the render** — eight slices asked for
inside the same second, the slowest of the eight answering at ~46 s — and the
database work around it is under a second. **What is NOT in this table is the
interpreter**, which runs before the operation row exists and persists no
timing (the dev log read it at 4.4 / 14.5 / 15.5 s over three Follows); it is
the only server-side second the customer waits on that no production row
records. The two long tails are settlement waiting on a stranded slice's lease
(294 s and 1,155 s — the deploy-collision class CLAUDE.md names as accepted).

⚠ **This table CORRECTS the header's "~11 s" sentence and the correction is
written beside it.** The dev drive's chip remainder (12.6–13.9 s over three
samples) is the dev world's REMOTE database — the same roll's first tile was
dispatched 9 s after its row existed on dev, against 0 s here.

### E. Provider books — one court, ten idle days

- **OpenRouter (text), account-wide: $20.91 over 8 active days** — but
  **$16.74 of it is one day, 2026-09-13, 12 requests on `openai/gpt-6-astra`:
  the reviewer court (#513).** Without it: $4.17 over 7 days, ≈$0.60/day, all
  `claude-sonnet-5`, and since 09-09 only 27 requests / $0.30 in total (the
  crew and rite text calls). ⚠ **The court's own record says $13.48 over 9
  calls; the provider's books say $16.74 over 12.** Three requests and $3.26
  the record does not carry — most likely the first five re-run when the
  court's cost reading was corrected, the roll-up file holding only the last
  invocation. Recorded on #513 as a comment (the card is closed and stays
  closed); noted for the Retro, whose clock fires today: **a court closes its
  spend line at the provider's day total, never at the sum of the calls it
  remembers.** Estimate → record → books: *"single-digit"* → ~$12 → $13.48 →
  **$16.74.**
- **fal (image), off our surviving rows: $0.40 — 4 roll renders.** A floor
  and this fortnight a very low one: candidate rows are purged at expiry, and
  the last roll is ten days old, so 151 of the window's 155 slices have no
  surviving row to price. Run 3's "the floor is close to the number" held
  because run 3 read a live fortnight; this one is a cold one.
- **Steady state with nothing running: ≈$0.04/day of text** (crew and rite).
  Run 3's ≈$2.20/day was a dogfood fortnight; this is what the house costs when
  nobody rolls. Balances are a reading for the rite's receipt, never a finding.

### F. The client and the house — every reader, and the bench's first full row

**Bundle** (`pnpm machinist:bundle`, 2026-09-19 00:47Z at `d9e04659`): **21
chunks, 651.6 kB gzip JS in total, entry chunk 452.4 kB**, CSS 58.3 kB (67.4
on run 3). Run 3 read ONE chunk of 636.9 kB; **#832 (closing #744) split the
ten staff pages out on 12 Sep and measured the entry at 451.8 kB** — this run
reads it 0.6 kB heavier a week later, i.e. flat. `AdminOverview` is its own
116 kB chunk carrying `recharts` and its lodash; `DrapeStudio` 28 kB;
`ModeratorDashboard` 15 kB; `AdminCrew` 12 kB. Shares (never sizes):
`recharts` 11.3% · `react-dom` 11.0% · casting 6.3% · pages 5.8% · boards
5.4% · framer-motion 4.8% · lodash 3.8%. **#744's close left three things for
this seat**: a bundle budget the gate reads (nothing reddens if the entry
grows back) — **carded, #1035**; the customer-route split measured as a
navigation trade, never assumed — **carded, #1036**; `three` with no importer
— already gone from `package.json` (#108's slices), nothing to file.

**House commands** (`pnpm machinist:bench`, hyperfine 1.20.0, this machine,
3 runs + 1 warmup unless stated; the ledger reads were the only other load,
and the test row ran alone):

| command | run 4 median | run 3 median | note |
|---|---|---|---|
| `pnpm check` | **24.2 s** | 116.3 s | #830 (closing #825) runs the four passes in parallel — the seat's own bench confirms the card's 28 s |
| `pnpm build` | 8.4 s | 9.4 s | |
| `pnpm architecture:check` | 7.6 s | 8.7 s | |
| `pnpm capability:check` | 1.1 s | 1.2 s | |
| **`pnpm test`** | **130 s (2 m 10 s, 1 run)** | refused (red on main) | **the row's first reading**: green on `main` at `d9e04659`; #743 closed 09-11 |

Run 3's direct `pnpm test` read 591 s with 14 timeouts under a concurrent
`pnpm check`; alone and after #743 it is 130 s. **On the gate's runner the
same suite is 190–302 s** (§G) — the runner is roughly half this machine.

**Interaction latency** (`pnpm machinist:latency`, dev server on `:3000` from
the main tree, dev database, verify-bot 823 on session 90 — `c19610ad…`, open
until 2026-09-19 13:30Z — headless Edge 1440×900; the seat's FIRST reading on
its own clock, the 09-12 table being the build shift's):

| action → what changes | bar | n | p50 | p95 | max | verdict | 09-12 |
|---|---|---|---|---|---|---|---|
| keep → tile ring | optimistic | 8 | 24 ms | 28 ms | 28 ms | under 100 ms | 26 |
| keep → dock face | optimistic | 8 | 24 ms | 28 ms | 28 ms | under 100 ms | 26 |
| unkeep → tile ring | optimistic | 8 | 23 ms | 27 ms | 27 ms | under 100 ms | 25 |
| unkeep → dock face | optimistic | 8 | 23 ms | 27 ms | 27 ms | under 100 ms | 25 |
| chip edit → the box | optimistic | 1 | 20 ms | 20 ms | 20 ms | under 100 ms | 15 |
| follow → rail pill | optimistic | 1 | 16 ms | 16 ms | 16 ms | under 100 ms | 22 |
| follow → family chip | server-bound | 1 | 28,076 ms | — | — | **OVER 1 000 ms**, known, under the 45 s regression line | 18,328 / 28,4xx |
| retry → tile face | server-bound | 0 | — | — | — | absent — roll 111's two failed tiles are not the roll on screen (114); the drive reads the active roll only | absent |
| roll again → first skeleton | — | 0 | — | — | — | not re-read (`--only`); 34 ms on 09-12 | 34 |

Keep/Unkeep hold at one or two frames on the seat's clock as they did on the
build shift — #554's fix is still on the customer's hand. The chip's third
sample (28.1 s; interpreter 15.5 s on the dev log) is what produced §D: the
remainder is the fixture, and on production the chip waits the interpreter
plus one 2.5 s poll. The Retry row is a limit of the instrument, stated: it
will read only when the ACTIVE roll holds a failed tile, which on a fixture
sheet means a Roll again that happens to lose a slice. Roll 115 (this run's
Follow) landed 8/8 in 57 s; verify-bot 19,200 → 19,080 (−160, +40 from roll
111's two slices settled since 09-12).

### G. The shift process — #543's numbers, third reading on the clock, and where a gate run's minutes go

| figure | **7d** (to 09-19) | 14d | run 3's 7d (to 09-12) | baseline (05 Sep) | target |
|---|---|---|---|---|---|
| cards landed per session | **1.38** (109 / 79 landing of 93) | 1.58 (274 / 173 of 190) | 1.73 | 1.18–1.27 | 3 |
| gate minutes per card | **13.85** (1,510 / 109) | 17.43 | 20.0 | 23.2–28.25 | 10 |
| gate runs per card | **1.65** (180 / 109) | 2.05 | 2.36 | 3.1 | 1.5 (aim) |

**Gate runs per card fell 2.36 → 1.65 and is within a tenth of the card's
aim** — preflight (`pnpm preflight` exists now) and #830's 24 s `pnpm check`
are the likeliest movers, and the 14d column (2.05) sits between the two weeks
as it should. **Gate minutes per card fell 20.0 → 13.85** on the same lever.
**Cards per session fell 1.73 → 1.38** — a week of Janitor slices and one-card
shifts against a week of batches; the reader prints means and the spread is
not in it (noted on run 3, still not carded — #543 is closed on his word).
Unattributed in the 7d: #952 (2026-09-15, merged outside any closed row); in
the 60d: 105, all but two before `crew_shift_runs` existed. Overlap 97/98, as
every reading has said. The reader read on the first attempt all three times
— #824's retries are in and were not needed today.

**Where a run's minutes go** — the seat's first reading at STEP grain, off the
`gate-checks` job of the last four green runs (`gh run view --json jobs`; ids
35203275641 · 35184393989 · 35180775578 · 35176080211, 17 Sep):

| step | four readings | share |
|---|---|---|
| Unit tests | **302 · 189 · 287 · 290 s** | ~50% |
| Static shapes (semgrep) | 103 · 66 · 98 · 100 s | ~18% |
| Typecheck (`pnpm check`) | 45 · 28 · 41 · 42 s | ~7% — was 86–94 s serial before #830 |
| Design-law controls | 29 · 20 · 27 · 28 s | ~5% |
| checkout · install · atlas · capability · the rest | the remainder | |

The job is ONE serial chain (`gate.yml` L170–327); semgrep needs neither the
install nor the build and runs in front of the tests on the same runner. With
runs-per-card at its aim, **the wall-clock of one run is the only lever left
on the 10-minute target — carded, #1034**: a parallel job for semgrep (and the
two browser controls if it pays), measured over ten runs before and after; a
vitest shard as the second arm, its doubled runner minutes stated.

### H. Attempted and reverted; carded

Nothing attempted on the product. **Carded this run, filed not worked: #1034
(the gate's serial job, §G), #1035 (a bundle budget the gate reads, §F), #1036
(the customer-route split measured, §F)** — the last two are #744's close
comment's own list for this seat, the first is this run's reading. Receipts
as comments, no reopen: #513 (the court's $13.48 against the books' $16.74),
#129 (the fortnight's numbers). Not filed: the interpreter's unpersisted
latency (§D) — a number this ledger has now named three times from a dev log
and never from a production row; it becomes a card the day the chip or the
roll's wall is a brief, and the roll census already carries a
`stage: "interpreter"` log line that a persisted column could read from.

### I. THE WORST NUMBER — run 4

**Unchanged from run 3, on the same rows, because nothing new ran: one sheet
in four came back short a picture — 5 of 19 rolls partial, 8 of 155 paid
slices did not arrive (5.2%), every classified one the engine refusing to
draw it (`content_policy`, 6 of 6).** #129 holds it and is `blocked` on a
label, so the seat states plainly that this number CANNOT move until that
card is taken. **Runner-up, and the one this seat can move: gate minutes per
card at 13.85 against 10, with runs-per-card already at its aim — #1034.**
The client half of the charter: click-to-paint READ on the seat's own clock
now (Keep 24 ms); page load and the canvas STILL unread, and #1036 is the
first brief that would read page load on its way to its own answer.

### J. Close

Seat: Machinist, patrol #4, one seat, shift `foreman-20260919-1033`. Clock:
run 3 was 2026-09-12, so this run is on the day; the clock counts from today.
No PR. Ledger appended; header corrected beside its own sentence (§D); three
cards filed; two receipts. Three read-only disposables written and guarded
(`_machinist4-sheet-`, `_machinist4-roll-phases-`, `_machinist4-spend-`).
One dev server on `:3000`, killed; `dev-servers` reads none. Spent ≈$0.81
house + 160 dev credits, both recorded before and after.

## Run 5 — 2026-09-26 04:43–06:0x AEST (Machinist, patrol #5; weekly clock, on the day)

Readers: `scripts/machinist-ledger-read.mts` (14d / 60d / 7d), `pnpm
machinist:bundle` and `scripts/bundle-budget.mts`, `pnpm machinist:bench` (all
five rows, then `check` and `test` re-read ALONE as a load control, then
`build` and `capability:check` re-read on the MAIN tree as a junction control),
the `gate-checks` job of the last ten green gate runs at step grain
(`gh run view --json jobs`), and two read-only disposables named where they are
quoted. Windows: **14d**, **60d** and **7d** all to 2026-09-25 18:44Z, against
`hayabusa.proxy.rlwy.net:23768` (production). The client and house readings are
taken in a worktree at **`origin/main` 655a496a** — the main tree is 15 commits
behind and 4 ahead (#1249), so a reading taken there would not describe what
ships. **Spent: nothing.** No render, no credit, no text call, no paid arm —
every figure below is off rows, files and runs already paid for.

⚠ **Run 4's denominator was zero and this one is not: the fortnight is LIVE.**
Run 4 read a window in which no paid operation had run since 2026-09-09 and
said so. Since then production has taken **50 rolls, 402 paid slices, 302 face
scans and 2 Signs across four days (22, 23, 24, 25 Sep)**, all on user 1 — the
switch sitting widened the author road to every account on 09-24, and the
engine comparison and the wardrobe-line court were driven through the real
entrance in the same stretch. So every number in §A–§C is new evidence, and
most of it moves.

### A. Wall-clock per paid operation

| kind | window | n | median | p95 | max | statuses |
|---|---|---|---|---|---|---|
| `castingV2.roll` | 14d | 50 | **34 s** | 60 s | 391 s | 35 succeeded · 14 partial · 1 failed |
| `castingV2.roll` | 60d | 306 | 45 s | 109 s | 1,495 s | 264 · 36 partial · 6 failed |
| `castingV2.viewRetry` | 14d | 6 | 75 s | 114 s | 114 s | 6 succeeded |
| `castingV2.retry` | 14d | 2 | 38 s | 38 s | 38 s | 2 succeeded |
| `castingV2.sign` | 14d | 2 | 134 s | 134 s | 134 s | 1 succeeded · 1 partial |
| `castingV2.refine` | 14d | **0** | — | — | — | **none ran** |
| `castingV2.refine` | 60d | 225 | 120 s | 285 s | 390 s | 192 · 33 failed |

- **The roll's median fell 46 s → 34 s** on 2.6× the rows. That is the first
  reading of the roll road since `CASTING_ROLL_ENGINE_SCOPE`'s Sunburst rolls
  became most of the traffic, and it is a real improvement, not a shrunken
  window: 50 rolls against run 4's 19.
- **`castingV2.viewRetry` appears for the first time** — six of them, median
  75 s. That is #1235's Try again road carrying live traffic.
- **No refine ran in fourteen days.** The 60-day refine row is unchanged from
  runs 3 and 4 (same n, same medians) — it is the fifth reading of the same
  225 operations. No refine has crossed the ~305 s gateway wall since
  2026-08-21.

### B. The roll at slice grain — the worst number, and it moved

| window | slices paid for | arrived | refused by the engine | stranded | **did not arrive** |
|---|---|---|---|---|---|
| 14d (run 5) | 402 | 346 | 51 (12.7%) | 5 (1.2%) | **56 — 13.9%** |
| 14d (run 4) | 155 | 147 | 6 (3.9%) | 2 (1.3%) | 8 — 5.2% |
| 60d (run 5) | 2,453 | 2,317 | 92 (3.8%) | 44 (1.8%) | **136 — 5.5%** |
| 60d (run 4) | 2,051 | 1,971 | 41 (2.0%) | 39 (1.9%) | 80 — 3.9% |

**Cross-check on the money ledger: 56 refunds / 1,120 credits (14d) and 136 /
2,720 (60d) — AGREES on both.** At the sheet, **14 of 50 rolls came back short
a picture — better than one in four.** Classified losses over 60 days: 76
`content_policy` roll, 15 `capability`, 1 `content_policy` retry.

⚠ **13.9% is the honest headline and it is NOT the underlying rate — read the
days** (`scripts/_98-machinist5-refusals-disposable.mts`):

| day | slices | refused | rate |
|---|---|---|---|
| 22 Sep | 256 | 42 | **16.4%** |
| 23 Sep | 56 | 0 | 0% |
| 24 Sep | 24 | 2 | 8.3% |
| 25 Sep | 64 | 7 | 10.9% |
| **without 22 Sep** | **144** | **9** | **6.25%** |

**22 Sep carried 31 of the fortnight's 51 rolls across four engine ids on the
same brief family** — it is the matched engine comparison #1134 closed on, and
its fixtures are the deliberately hard ones: every roll that lost a slice is a
cyborg, a cyber-goth, a cyberpunk assassin or an android (the brief text is on
each row). **So the fortnight's 13.9% is a court's number, not a customer's,
and the underlying rate outside that day is 6.25%** — still above run 4's 5.2%
and the 60-day 5.5%, and on a population that cannot be called normal usage
either, because production's only caster is the founder. **#129 still holds
this class and is `blocked`; the fortnight's numbers are on the card.**

⚠ **One reading to NOT take off this table, re-derived and then discarded
here so the next seat does not spend an hour on it.** `casting_candidates.
providerModel` looks like the engine and groups beautifully: seven values, and
every `fal:`-prefixed one refuses 100% of the time while every bare one refuses
0%. It is not an engine reading. Dispatch writes the engine's own id
(`` `fal:${model}` ``, `server/providers/falImages.ts:166`) via
`markCandidateDispatched` (`rollService.ts:1381`); landing OVERWRITES it with
the bare endpoint from the provider's provenance (`rollService.ts:1535`,
`falImages.ts:230`). **So the prefix records whether the row LANDED, not what
rendered it** — 51 of 51 refusals carry it, 0 of 346 arrivals do, and both
appear inside the same roll. **Both readers in the tree already normalise it
and say so in their own comments** (`scripts/lib/falSpend.mts:526`,
`scripts/fal-picture-price.mts:96`), so there is nothing to fix and nothing
filed. A hand-written `GROUP BY providerModel` is the thing that goes wrong.

### C. Face scans — the fortnight's largest house line, and #38's ceiling holds

**Every face scan this product has ever taken but one was taken in the last
four days: 302 rows all time, 301 of them in this window, $30.20 of house
money.** Run 4 read ONE, on 08 Sep, and said his $30/month model was
unexercised. It has now been exercised (`scripts/_98-machinist5-facescans-disposable.mts`):

| day | scans | rolls covered | scans / roll |
|---|---|---|---|
| 22 Sep | 189 | 31 | 6.1 |
| 23 Sep | 43 | 8 | 5.4 |
| 24 Sep | 13 | 3 | 4.3 |
| 25 Sep | 56 | 9 | 6.2 |
| **window** | **301** | **51** | **5.90** |

**302 rows over 302 distinct candidates — one scan each, no candidate paid for
twice**, one `userId`, one `versionKey`. All 302 sit on `ready` slices (2 since
signed); none on a failed one.

**#38's cost model is CONFIRMED, not contradicted, on 3.3× its population.**
That card (founder-ordered, *"don't guess the cost — model it"*) measured 90
scans over 9 days in August: 8.2 scans/roll against a structural ceiling of 8
($0.80/roll), $1.00/day at founder intensity, ≈$30/user-month. This fortnight
reads **5.90 scans/roll = $0.59/roll**, comfortably inside that ceiling, and
$30.10 over four days because four days held 51 rolls rather than because the
per-roll cost moved. **Nothing is filed**: the model holds, and #38's one
remaining obligation is explicitly *"the re-read of the real usage distribution
before public launch"*, which this is not — the only account casting is still
the founder's. A receipt is on the card.

**What is worth carrying forward is the comparison, because it is not
intuitive:**

| house line | 14d | 60d |
|---|---|---|
| **face scans** | **$30.10** | **$30.20** |
| fal renders (priced floor) | $17.26 | $18.35 |
| OpenRouter, product + crew only | $5.39 | — |
| OpenRouter, incl. the 13 Sep reviewer court | $22.13 | $38.73 |

**Looking at faces costs the house more than rendering them does** — over the
whole 60 days, and by 1.7× over the fortnight. A scan is $0.10 (twenty
segmenter calls, `castingV2Scope.ts:474`); a Sunburst picture is about $0.015
and an eight-slice roll about $0.12 (#1134). So a customer who opens all eight
faces of a roll costs the house ~$0.59–0.80 against ~$0.12 to make them. That
is not a defect — the scan is what fills the refine panel, it is idempotent per
version, and the founder widened the pair on exactly this arithmetic — but it
is the line that will grow fastest with a second account, and this run is the
first time it has ever been visible.

### D. Provider books

- **OpenRouter, account-wide: $22.12 over 7 active days (14d), $38.73 over 22
  (60d)** — but **$16.74 of the fortnight is still the 13 Sep reviewer court
  (#513)**, now the fourth ledger run to carry it. Without it the fortnight is
  **$5.38**, and its shape changed: 09-22 alone is $3.70 over 298 requests on
  `claude-sonnet-5`, which is the courts and the crew, against run 4's
  ≈$0.04/day steady state with nothing running.
- **fal, off our surviving rows: $17.26 priced (14d), $18.35 (60d) — a floor**,
  and **24 flare calls are still UNPRICED** (fal publishes an opaque `units`).
  240 Sunburst calls at the $0.015 measured by #1134, 141 GPT Image 2 at
  $0.099, 8 edits.
- Balances are a reading for the rite's receipt and never a finding (his
  standing rule).

### E. The client and the house

**Bundle** (`pnpm machinist:bundle` at `origin/main` 655a496a, 2026-09-25
19:02Z): **JS 674.3 kB gzip over 31 chunks** (run 4: 651.6 kB over 21), CSS
45.9 kB (58.3). **First-paint JS — the number that matters — is 260.3 kB**,
read by the gate's own `scripts/bundle-budget.mts`, against run 4's 452.4 kB.

⚠ **The first download fell 192 kB (−42%) in a week and its budget did not
follow — carded, #1265.** `b2be5a95` (#1036, 19 Sep) split the board page out
and its own commit subject says `entry chunk 450 → 246 kB gzip (−45%)`;
`6b61430d` (#1035, the same day) set `FIRST_PAINT_JS_BUDGET_BYTES` to 480 kB on
the 452.4 kB measured against an 18 Sep tree. **So the guard has had 219.7 kB
of slack — 84% growth — since the day it shipped**, and the regression it was
built to catch (an eager staff page, measured at +103.5 kB) could now land
twice and pass. Total JS rose 22.7 kB while first paint fell 192 kB, which is
the navigation trade #1036 was asked to measure, landing the right way round.

✅ **CLOSED 2026-09-26 (#1265) — and the slack was worse than arithmetic said.**
The budget is 290 kB on **266,595 B (260.3 kB)** re-measured at `0ba7f9e4`, with
29.7 kB of room. The patrol's estimate above used the 19 Sep sabotage cost
(+103.5 kB); the sabotage was **re-driven on the new tree** and the eager
`AdminOverview` now costs **+116.0 kB** (385,370 B against 266,595 B). ⚠ **At
the old 480 kB line that sabotage read `OK, headroom 103.7 kB` — the guard
passed its own positive control, which is the finding in its strongest form.**
Also closed with it: the gate's own comment restated the number and had been
wrong for a week (it now points at the declaration instead), and the suite gained
the arm that would have reddened on 19 Sep — the declared reading is pinned to
the driven control byte count, so the pair cannot go stale silently again.

**House commands** (`pnpm machinist:bench`, hyperfine 1.20.0, this machine, 20
logical processors):

| command | run 5 | run 4 | change |
|---|---|---|---|
| `pnpm test` | **3m 00s** (179.6 s, 1 run) | 130 s | **+38%** |
| `pnpm check` | **30.2 s** | 24.2 s | +25% |
| `pnpm build` | **11.47 s** (worktree) · **11.22 s** (main tree) | 8.4 s | +34% |
| `pnpm architecture:check` | 9.86 s | 7.6 s | +30% |
| `pnpm capability:check` | 1.27 s (worktree) · 1.26 s (main tree) | 1.1 s | +15% |

⚠ **Every row rose, including commands with nothing in common, so three
explanations were driven out before the table was believed** — and none of them
is the cause:

1. **Concurrent load.** The first pass ran beside a production DB read.
   `check` and `test` were re-read with nothing else running: **179.577 s
   against 179.571 s** — six milliseconds apart — and 30.18 s against 30.61 s.
   Load is not it.
2. **The worktree's junctioned `node_modules`.** `build` and
   `capability:check` were re-read on the MAIN tree, which owns its install:
   11.22 s against 11.47 s, and 1.26 s against 1.27 s. **The two trees agree
   within 2%.** The junction is not it.
3. **Stale processes.** Four `node` processes survive from 22 and 24 Sep
   (pids 18336, 30752, 32740, 37448). All four measured at **0% of one core**
   over a 1.5 s sample, 1–60 MB working set. They are litter for the Janitor,
   not a load.

**So the rise is real and its cause is NOT established, and this ledger will
not guess one.** The tree gained 191 commits and a net 6 test files (835 → 841)
in the week, which does not obviously buy 38%; the bundle gained 10 chunks,
which plausibly buys some of `build`. **Run 6 re-reads all five rows first and
that is the number it opens on** — two readings a week apart on one machine are
a trend, one is an anecdote.

### F. The shift process — and #1034's owed after-reading

| figure | **7d** (to 09-25) | 14d | run 4's 7d | run 3's 7d | baseline (05 Sep) | target |
|---|---|---|---|---|---|---|
| cards landed per session | **1.50** (99 / 66 landing of 85) | 1.46 | 1.38 | 1.73 | 1.18–1.27 | 3 |
| **gate minutes per card** | **9.90** ✅ | 12.13 | 13.85 | 20.0 | 23.2–28.25 | **10** |
| gate runs per card | **1.35** ✅ | 1.51 | 1.65 | 2.36 | 3.1 | 1.5 (aim) |

⚠ **#1034 closed with an instruction addressed to this run, and it is
discharged here.** Its close: *"The ten-run AFTER reading is the Machinist's on
its clock (ledger run 5); if it misses the 10 gate-minutes-per-card target the
seat cards the second arm."* **It does not miss: 9.90 against 10, on the 7-day
window that sits entirely after the fix.** So the second arm — a vitest shard,
with its doubled runner minutes — is **NOT carded**, by the card's own
condition. Gate minutes per card has now fallen 28.25 → 20.0 → 13.85 → **9.90**
across four readings, and the 14d figure (12.13) is higher only because that
window straddles the fix.

**The ten-run after-reading at step grain** (`gate-checks` of runs
36141044145 … 36172684433, all green, 25 Sep):

| step | run 5 median of 10 | run 4 median of 4 |
|---|---|---|
| **Unit tests** | **284 s** | 289 s |
| Typecheck (`pnpm check`) | 39.5 s | 41.5 s |
| Design-law controls | 27 s | 27.5 s |
| Static shapes (semgrep) | **not in this job** | 99 s |
| **whole `gate-checks` job** | **394 s (6m 34s)** | ~580 s |

**What #1034 actually bought: semgrep and the bundle budget left the critical
path.** `bundle-budget` is now its own job at 30–37 s, semgrep no longer
appears in `gate-checks` at all, and the job fell ~32%. **Unit tests did not
get faster — they went from ~50% of the job to 72% of it**, which is the whole
reason the shard was named as a second arm. Its trigger for run 6, stated so
nobody has to re-derive it: **card the shard when gate minutes per card crosses
10 again, or when Unit tests cross ~320 s** — at 72% of the job the suite is
now the only lever left.

**Cards per session (1.50 against a target of 3) is the one process figure
still missing**, and it is the least moved of the three: 1.18–1.27 → 1.73 →
1.38 → 1.46 → 1.50. 11 merged PRs in the 7d fit no closed session's window and
are outside the figures; the reader prints them rather than dropping them.

⚠ **The 60-day §G reading is degraded and is not quoted above.** The reader hit
repeated GitHub API timeouts walking per-branch workflow runs (eight
`dial tcp … connectex` failures observed), so its 60d gate figures rest on a
partial read. The 7d and 14d reads completed without them.

### G. What was NOT read this run

Stated so the absence is not read as a zero (doctrine entry 1):

- **Interaction latency** (`pnpm machinist:latency`). Run 4 read it on this
  seat's clock — Keep/Unkeep at 23–24 ms, Follow's family chip server-bound at
  28 s. It needs a dev server, a dev session and dev credits, and this run
  spent its time on a fortnight of live production rows that run 4 did not
  have. **Owed to run 6**, and the charter's page-load and canvas halves remain
  unread by anything.
- **The roll's phase decomposition** (run 4's §D). Not re-read; nothing
  suggests it moved, and the roll's median fell rather than rose.

### H. Attempted and reverted; carded

Nothing attempted on the product; this run wrote no product code and opened no
PR against it. **Carded, filed not worked: #1265** (the first-download budget's
84% slack, §E). **Deliberately NOT carded, each with its reason:** the
`providerModel` prefix (§B — already normalised by both readers in the tree,
with comments saying so); the face-scan house line (§C — #38's model holds and
its remaining obligation is a pre-launch re-read this is not); the vitest shard
(§F — #1034's own trigger is not met). **Receipts as comments, no reopen:**
#1034 (the after-reading), #38 (the confirming usage), #129 (the fortnight's
slice numbers). **For the Janitor:** four orphaned `node` processes from 22 and
24 Sep, idle, pids in §E.

### I. THE WORST NUMBER — run 5

**One paid slice in seven did not arrive: 56 of 402 (13.9%), against run 4's
5.2% — and the honest version of that sentence is 6.25%,** because 22 Sep
carried 31 of the fortnight's 51 rolls on a matched engine comparison whose
fixtures are the briefs chosen for being hard to draw. Both numbers are real
and neither is a customer's, because the only account that has ever cast is the
founder's. The 60-day rate rose 3.9% → 5.5% on the same event. **#129 holds the
class and is `blocked`, so this cannot move until that card is taken** — the
fourth run in a row to end on that sentence.

**Runner-up, and the one the seat can move: nothing on the gate any more.** The
10-minute target is met for the first time (9.90). The new runner-up is **the
unit suite at 72% of a gate run and `pnpm test` up 38% locally in a week**,
with its cause unattributed and its trigger written down in §F.

**Best news of the run, stated because a ledger that only records faults is
not a measurement:** the roll's median wall fell 46 s → 34 s on 2.6× the rows,
the first download fell 192 kB, and gate minutes per card crossed its target.

### J. Close

Seat: Machinist, patrol #5, one seat, shift `machinist-20260926-0443`, run row
#370. Clock: run 4 was 2026-09-19, so this run is on the day; the clock counts
from today. Ledger appended. **One card filed (#1265), three receipts, three
findings explicitly declined with reasons.** Two read-only disposables written,
guarded and deleted (`_98-machinist5-refusals-`, `_98-machinist5-facescans-`;
a third, `_98-machinist5-schema-`, read `SHOW COLUMNS` and is deleted with
them). Readings taken in a worktree at `origin/main` 655a496a, removed at close.
No dev server started. **Spent: nothing** — no render, no credit, no text call.

## Run 6 — 2026-10-03 03:41–05:0x AEST (Machinist, patrol #6; weekly clock, on the day)

Readers: `pnpm machinist:bench` (all five rows, in a worktree at `origin/main`
`dd817079`), `scripts/machinist-ledger-read.mts` (14d / 7d / 60d), `pnpm
machinist:bundle` and `scripts/bundle-budget.mts`, the `gate-checks` job of the
last ten green gate runs at step grain (`gh run view --json jobs`) plus CI's own
vitest tally off two run LOGS a week apart, and seven read-only disposables named
where they are quoted. Windows: **14d**, **7d** and **60d** to 2026-10-02
17:53Z, against `hayabusa.proxy.rlwy.net:23768` (production); the dev readings
in §G against `:52008`. **Spent: nothing** — no render, no credit, no text call,
no paid arm. Every figure is off rows, files, runs and logs already paid for.

⚠ **Run 5 told this run what to open on, and the answer overturns run 5's own
§E.** *"Run 6 re-reads all five rows first and that is the number it opens on."*
Four of the five fell back; the fifth did not, and the fifth turns out to be a
number this machine structurally cannot see. §E is therefore the run's spine and
§I's worst number comes out of it.

### A. Wall-clock per paid operation

| kind | window | n | median | p95 | max | statuses |
|---|---|---|---|---|---|---|
| `castingV2.roll` | 14d | 59 | **30 s** | 60 s | 391 s | 44 succeeded · 14 partial · 1 failed |
| `castingV2.roll` | 60d | 118 | 43 s | 126 s | 391 s | 86 · 29 partial · 3 failed |
| `castingV2.sign` | 14d | 12 | 134 s | 319 s | 319 s | **7 partial** · 5 succeeded |
| `castingV2.viewRetry` | 14d | 17 | 71 s | 131 s | 131 s | 17 succeeded |
| `castingV2.refine` | 14d | **2** | **53 s** | 53 s | 53 s | 2 succeeded |
| `castingV2.refine` | 60d | 226 | 120 s | 285 s | 390 s | 193 · 33 failed |
| `castingV2.retry` | 14d | 2 | 38 s | 38 s | 38 s | 2 succeeded |

- **The roll's median fell again, 34 s → 30 s**, on 59 rolls against run 5's 50.
  Two consecutive falls now (46 → 34 → 30) across the stretch where Sunburst
  became every account's roll engine.
- **A refine ran for the first time in a month** — two of them, both succeeded,
  **median 53 s against the long-run 120 s**, and **0 of 2 past the ~305 s
  gateway wall**. n=2 is an anecdote and is recorded as one; what it ends is run
  5's *"no refine ran in fourteen days"*.
- **`castingV2.sign` is the fortnight's biggest mover: 12 operations, 7 of them
  `partial` (58%), 950 credits refunded**, against run 5's n=2. §B2 reads it at
  view grain, because `partial` says a view did not arrive and never which or
  why.
- **`castingV2.viewRetry` nearly tripled its population** (6 → 17) and every
  operation succeeded at the operation grain; its losses are at view grain,
  inside.
- ⚠ **The 60-day refine row is the SIXTH reading of almost the same operations,
  and the window is now actively losing rows.** 226 against run 5's 225 — two
  new refines arrived and one aged out. More sharply: **60d rolls fell 306 → 118
  and 60d slices 2,453 → 949** in one week, because candidate rows purge with
  their session. **The 60-day window is not a stable denominator and must not be
  trended.** The 14d and the per-day readings are the comparable ones. Stated
  here because run 5 trended it in good faith.

⚠ **AND NOTHING HAS BEEN CHARGED AT P1's NEW PRICES — 0 operations since the
release merged** (`_98-machinist6-newprices-disposable.mts`). P1's scale change
landed 2026-10-01 17:34:53Z (squash `143e5b30`); the last operation that charged
anything is **2026-10-01 09:30:16Z, a refine at 25 credits** — the old scale,
eight hours earlier. The three most recent charges are that refine and two Signs
at 450. **So every credit figure in this ledger is priced at the OLD table, and
the new one is live and unexercised.** A later run comparing credit figures
across this boundary is comparing two scales.

### B1. The roll at slice grain — the best news of the run, and it is rigorous

Run 5 ended on *"one paid slice in seven did not arrive"* for the fourth run
running. Read per UTC day (`_98-machinist6-slices-disposable.mts`):

| day | slices | arrived | failed | stranded | did not arrive |
|---|---|---|---|---|---|
| 22 Sep | 258 | 211 | 42 | 5 | 47 — 18.2% |
| 23 Sep | 56 | 56 | 0 | 0 | 0 |
| 24 Sep | 24 | 22 | 2 | 0 | 2 — 8.3% |
| 25 Sep | 64 | 57 | 7 | 0 | 7 — 10.9% |
| 26 Sep | 8 | 8 | 0 | 0 | **0** |
| 27 Sep | 40 | 40 | 0 | 0 | **0** |
| 28 Sep | 24 | 24 | 0 | 0 | **0** |
| **since 26 Sep** | **72** | **72** | **0** | **0** | **0 — 0.0%** |

**72 paid slices have rolled since run 5's window and every one arrived.** The
fortnight's 51 `content_policy` failures and 5 stranded slices are *the same 56*
run 5 measured: the denominator grew by 72 and the numerator did not move by
one. So the headline fall — 56 of 402 (13.9%) → **56 of 474 (11.8%)** — is
arithmetic on a growing denominator, and the real statement is the zero. Money
cross-check agrees exactly: 56 refunds / 1,120 credits, all *"Casting candidate
did not arrive"*.

**22 September is still the whole of it**: 47 of 56 on the one day, the matched
engine comparison #1134 closed on. Outside it the fortnight is **9 of 216 =
4.2%**, against run 5's 6.25% on 144. 60d: 949 slices, 100 did not arrive
(10.5%) — on the shrinking denominator above. Nothing has rolled since 28 Sep.
Still one caster: all of it `userId 1`. Receipt on **#129**, which stays
`blocked`.

### B2. The Sign at view grain — 7 of 50 views dropped, all on the axes #1612 hands over

`_98-machinist6-signs-disposable.mts`, over the 10 Signs that produced view rows
(two more carry `subjectDeletedAt` and hold none):

| view | arrived | dropped |
|---|---|---|
| frontFull | 10 | 0 |
| sideClose | 10 | 0 |
| closeUp | 8 | 2 |
| threeQuarter | 8 | 2 |
| **backFull** | 7 | **3** |
| **total** | **43** | **7 — 14%** |

**4 dropped on wardrobe** (*"This view came back in the wrong clothing"* —
backFull ×3, threeQuarter ×1), **3 on framing** (*"This view didn't come back at
the angle it should"* — closeUp ×2, threeQuarter ×1), **0 on identity.**

⚠ **This is a BEFORE baseline, not a live fault, and the dates are what settle
it.** #1612's rule — only identity refuses; framing and wardrobe deliver charged
with a free Try again — merged in PR #1775 at 2026-10-02 12:48:38Z (#1771 at
11:26:40Z). **The last Sign ran 2026-10-01 09:xx UTC.** So all 12 predate both,
and every one of the seven would now be delivered rather than refunded. Checked
at the code rather than inferred from the merge: `viewConformanceRefuses` reads
`REFUSING_AXIS = "identity"` and nothing else (`viewConformance.ts:808-814`),
and both refusal sentences above no longer exist anywhere in the tree.

⚠ **A working assumption of this run was wrong and the code corrected it.**
`viewConformance.ts:605-607` folds all three axes into `pass`, and
`viewConformance.ts:599` says `identity` and `wardrobe` are *"untouched, by name
and on purpose"* — read together those argue that wardrobe still refuses, and
this patrol had drafted that as a finding. It is false: `pass` is a derived
projection for downstream readers, and the REFUSAL reads one axis. **Law 7c paid
for itself in the gap between a grep and opening the file** — the card would have
told a founder-ordered card that half of it was unbuilt.

The retry road says the same thing one step on: 7 of the window's refunds are
*"… didn't arrive when asked again"* (closeUp ×3, threeQuarter ×3, side profile
×1) — the same two axes. **No Sign has run since the fix, so the AFTER is
unmeasured and is owed.** Receipt on **#1612**.

### C. Face scans — #38's ceiling confirmed a third time

**350 rows in 14d, $35.00 of house money; 351 all time over 349 faces.** 49 new
scans since run 5 (26 Sep ×8, 27 Sep ×39, 29 Sep ×1, 1 Oct ×1). At 59 rolls that
is **5.93 scans/roll = $0.59/roll**, against run 5's 5.90 and #38's structural
ceiling of 8 ($0.80/roll). **The model holds on a third reading** and nothing is
filed; #38's one remaining obligation is still the pre-launch re-read of real
usage, which this is not.

**And looking at faces still costs the house more than rendering them:**

| house line | 14d | 60d |
|---|---|---|
| **face scans** | **$35.00** | **$35.10** |
| fal renders (priced floor) | $18.10 | $18.50 |
| OpenRouter, account-wide | $32.73 | — |

### D. Provider books

- **OpenRouter, account-wide: $32.73 over 11 active days (14d)**, against run
  5's $22.12. Run 5's dominant line (the 13 Sep reviewer court, $16.74) has aged
  out of the window; the new shape is **two spikes — 26 Sep $13.34 over 719
  requests and 30 Sep $8.06 over 476** — on days production took **one roll and
  zero rolls**. ⚠ **So neither spike is customer traffic**; beyond that the
  attribution is NOT established here, and the account is shared by courts, crew
  readers and the product's own text calls.
- **fal, off our surviving rows: $18.10 priced (14d), $18.50 (60d) — a floor.**
  296 Sunburst text-to-image at the $0.015 measured by #1134, 130 GPT Image 2 at
  $0.099 (retired engine, an upper bound), 8 edits. **24 flare calls and 18
  Sunburst EDIT calls are still UNPRICED** — fal publishes an opaque `units`,
  and the edit door is now the wardrobe plate's engine under path E, so the
  unpriced set is no longer only a retired curiosity.
- Balances are a reading for the rite's receipt and never a finding (his
  standing rule).

### E. The client and the house — run 5's unattributed rise, settled

**House commands** (`pnpm machinist:bench`, hyperfine 1.20.0, this machine, 20
logical processors, worktree at `origin/main` `dd817079`):

| command | run 6 | run 5 | run 4 | r5 → r6 |
|---|---|---|---|---|
| `pnpm test` | **2m 59s** (178.8 s) | 3m 00s (179.6 s) | 130 s | **−0.5%** |
| `pnpm check` | **24.12 s** | 30.2 s | 24.2 s | **−20%** |
| `pnpm build` | **9.45 s** | 11.47 s | 8.4 s | **−18%** |
| `pnpm architecture:check` | **7.87 s** | 9.86 s | 7.6 s | **−20%** |
| `pnpm capability:check` | **1.03 s** | 1.27 s | 1.1 s | **−19%** |

⚠ **Run 5 reported every row up 15–38% with its cause "NOT established", and
refused to guess one. That was the right call: four of the five have fallen back
to within 2% of run 4 and the rise was transient.** It was not load — run 5 drove
that out, and this run's readings were taken *under* a concurrent production
database read and came out LOWER, which is the confound pointing the wrong way to
help. It was not the junction and not the stale processes either, both of which
run 5 also drove out. **No cause is offered for a week-long transient that
reverted; what matters is that the standing table is run 4's again and only one
row is real.**

**`pnpm test` is that row, and this machine cannot see what it is hiding.** 178.8
s wall at **User 1,131 s + System 468 s = 1,599 s CPU — ≈8.9× parallelism.** On a
CI runner the same suite runs at **≈2.4×**. §F reads the consequence.

**Bundle** (`pnpm machinist:bundle` and `scripts/bundle-budget.mts`, same tree):

| reading | run 6 | run 5 |
|---|---|---|
| **first-paint JS (the one that matters)** | **261.2 kB** gzip, budget 290.0 kB, **headroom 28.8 kB** | 260.3 kB, 29.7 kB |
| JS shipped (gzip L9) | 711.8 kB over 33 chunks | 674.3 kB over 31 |
| CSS shipped (gzip L9) | 46.2 kB | 45.9 kB |

**First paint moved 0.9 kB in a week and #1265's budget holds with 10% room** —
the guard re-pinned at run 5's close is doing its job. Total JS rose 37.5 kB
(+5.6%) over two new chunks, which is deferred weight rather than first-download
weight. Largest single chunk 261.2 kB, which is the entry. Attribution unchanged
in shape: react-dom 11.6%, recharts 10.3%, `features/casting` 5.7%.

### F. The gate at step grain — the suite is the only lever left, and its trigger is met

Ten most recent green `gate.yml` runs (all 2026-10-02): 37036750361,
37035109792, 37029532952, 37027696891, 37027138571, 37026907975, 37019386043,
37017928655, 37017837406, 37015800081.

| step | run 6 median of 10 | run 5 median of 10 | run 4 median of 4 |
|---|---|---|---|
| **Unit tests** | **402.5 s** | 284 s | 289 s |
| Typecheck (`pnpm check`) | **65 s** | 39.5 s | 41.5 s |
| Design-law controls | 20 s | 27 s | 27.5 s |
| **whole `gate-checks` job** | **533.5 s** | 394 s | ~580 s |

Unit-test step, sorted: 253, 318, 320, 364, 401, 404, 408, 412, 412, 413. **Unit
tests are 75% of the job** (run 5: 72%, run 4: ~50%).

⚠ **Run 5's own written trigger is met: *"card the shard when gate minutes per
card crosses 10 again, or when Unit tests cross ~320 s."*** Gate minutes per card
has NOT crossed 10 (below). Unit tests have, by 80 seconds on the median.
**Carded: #1799.**

**Why, read at vitest's own decomposition off two CI logs a week apart** rather
than guessed — and it is not simply "more tests":

| | 25 Sep (run 36172684433) | 2 Oct (run 37036750361) | change |
|---|---|---|---|
| Test Files | 840 | 982 | +142 (+17%) |
| Tests | 13,740 | 16,679 | +2,939 (+21%) |
| wall `Duration` | 220.4 s | 319.1 s | +45% |
| `import` | 285.6 s | 357.3 s | +25% |
| `tests` | 233.5 s | 422.8 s | **+81%** |

Tracked test files at the two trees agree with CI: **841 at `655a496a` → 983 at
`dd817079`**. Worker-seconds went **519 → 780 (+50%)** against a +45% wall, so CI
is spending the new work rather than losing it — at a flat ≈2.4×. **Per-test work
rose 37.8 → 46.8 ms (+24%): the fortnight's new tests are heavier than the
suite's average**, which is how +17% more files bought +42% more wall.
`gate.yml`'s Unit tests step did not change (diffed; one new step landed BEFORE
typecheck, the eye-frame presence check, at 0–1 s).

⚠ **And `import` is 357 s of the 780 — 46% of the suite's cost is module import,
not assertions.** The shard redistributes the wall at doubled runner minutes;
that number reduces the work. **#1799 names both levers with their sizes and
chooses neither** — this ledger carries numbers, not optimisations.

**The shift process** (`machinist-ledger-read.mts` §G):

| figure | **7d** (to 10-02) | 14d | run 5's 7d | run 4's 7d | target |
|---|---|---|---|---|---|
| **cards landed per session** | **2.72** (231 / 85 landing of 159) | 2.19 | 1.50 | 1.38 | 3 |
| gate minutes per card | **9.45** ✅ | 9.63 | 9.90 | 13.85 | 10 |
| gate runs per card | **1.25** ✅ | 1.29 | 1.35 | 1.65 | 1.5 (aim) |

**Cards per session rose 1.50 → 2.72 (+81%) — the figure run 5 called "the one
process figure still missing" and "the least moved of the three".** The target is
3. Four builder seats per pass (`MAX_SEATS = 4`, his order) is the obvious mover
and this ledger does not claim it as the only one. **Gate minutes per card held
at 9.45 despite the job growing 35%**, which is the same arithmetic: more cards
per run amortises a slower run. 43 merged PRs in the 7d fit no closed session's
window and are printed by the reader rather than dropped.

### G. What was NOT read — and interaction latency now has a MEASURED reason

Stated so the absence is not read as a zero (doctrine entry 1):

- ⚠ **Interaction latency — UNREAD for the second run, and this time the reason
  is read at the rows rather than being a budget decision.** Run 4's fixture
  (verify-bot 823, session 90, `c19610ad…`) is now `expired` with 0 candidates.
  The whole dev world holds **7 `ready` candidates on 5 sheets, and every road to
  them is shut**: three sheets (69, 79, 80 — 2, 1, 1 tiles) belong to user
  **28601, frozen since 2026-08-25 13:05Z**; one (96, 2 tiles) is unfrozen but is
  a **#1098 non-UUID publicId**, a guaranteed `BAD_REQUEST`; one is `abandoned`.
  Keep/Unkeep needs tiles and the chip edit is absent on the author road since
  #535, so **the free walk reads nothing at all.** **The class is worth more than
  the instance: run 4's reading sat on an inherited fixture that the product's
  own retention then expired, silently — nothing goes red.** **Carded: #1800**,
  which proposes a fixture the instrument MINTS rather than inherits and
  deliberately does not decide between that and a real dev roll.
  ⚠ **This patrol refused to clear `users.frozenAt` on a shared dev row to take a
  reading**, and wrote the refusal into its own disposable rather than leaving it
  to judgement — the precedent script for this job cleared it as a side effect.
- **Page load and the canvas** remain unread by anything, as every run has said.
- **The roll's phase decomposition** (run 4's §D) — not re-read; the roll's
  median fell again rather than rose.
- **`pnpm machinist:latency --controls`** was not run: it is in the gate on every
  PR, so running it here would have proven nothing new.

### H. Attempted and reverted; carded

Nothing attempted on the product; this run wrote no product code and opened no PR
against it.

**Carded, filed not worked:** **#1799** (the gate's unit suite, §E/§F) and
**#1800** (the latency instrument's lost fixture, §G) — both `seat:machinist`,
one work label each.

**Receipts as comments, no reopen:** **#1612** (the Sign view-grain BEFORE
baseline, §B2), **#129** (the fortnight's slice numbers and the zero since
26 Sep, §B1).

**Deliberately NOT carded, each with its reason:**

- **The four house-command rows that fell back** (§E) — a transient that reverted
  leaves nothing to fix; carding it would be carding run 5's week.
- **The 58% Sign partial rate** (§B2) — #1612's fix is merged and live, the
  measurement is its BEFORE, and no Sign has run since. A card would be asking
  for work already done.
- **Face scans** (§C) — #38's model holds on a third reading.
- **The 60-day window's shrinking denominator** (§A) — a property of retention
  working as designed, not a defect; it is a reading instruction, and it is
  written into §A where the next run will meet it.
- **An `import`-cost fix** — a lever inside #1799, not a separate card.
- **The two unpriced fal models** (§D) — #1196 owns the price court; nothing new.
- **A wardrobe-axis finding** (§B2) — drafted and withdrawn at the code. Recorded
  because a withdrawn finding is worth as much to the next seat as a filed one.

**For the Janitor:** nothing. No orphan process was created by this run; the
disposables are deleted at close and the worktree removed.

### I. THE WORST NUMBER — run 6

**The gate's unit-test step: 402.5 s of a 533.5 s job, up 42% in a week, and this
machine reads the same suite as unchanged.** The suite gained 142 files and 2,939
tests; CI's worker-seconds grew 50%; a 20-core preflight absorbed all of it at
8.9× parallelism while a CI runner at 2.4× did not. **The defect is not that the
suite grew — it is that the only instrument every shift runs before pushing is
structurally blind to the growth, so the cost lands on the gate with no local
warning.** Run 5's trigger is met and **#1799** carries it, with `import` at 46%
of the cost named as the larger and less obvious lever.

**Runner-up: nothing on the paid road, for the first time in five runs.** Run 5's
worst number was one paid slice in seven not arriving, and **72 slices have since
arrived with zero losses**. #129 is no longer the sentence this ledger ends on.

**Best news of the run, recorded because a ledger that only carries faults is not
a measurement:** 72 of 72 slices arrived; the roll's median fell 34 s → 30 s, a
second consecutive fall; cards landed per session rose 1.50 → 2.72, the process
figure that had never moved; first-paint JS held at 261.2 kB with 10% budget room;
a refine ran again and took 53 s against a long-run 120 s; and #38's face-scan
cost model held on a third, larger reading.

### J. Close

Seat: Machinist, patrol #6, one seat, shift `machinist-20261003-0341`, run row
#529. Clock: run 5 was 2026-09-26, so this run is on the day; the clock counts
from today. Ledger appended. **Two cards filed (#1799, #1800), two receipts,
seven findings explicitly declined with reasons, one finding withdrawn at the
code.** **Seven** read-only disposables written, guarded and deleted
(`_98-machinist6-signs-`, `-slices-`, `-devcensus-`, `-devmodels-`, `-sheet-`,
`-mint-`, `-newprices-`); scratch in `output/_machinist6/`. ⚠ This sentence and
the header above both read *"six"* when this run was first pushed, over a list
of SEVEN names — caught in the close's own recount, against the `ls` taken
before the deletion. One off a count nobody would have re-derived, in the
document whose whole discipline is that its numbers are right. Readings taken in a
worktree at `origin/main` `dd817079`, removed at close. No dev server started.
**Spent: nothing** — no render, no credit, no text call, no production variable,
no flag, no migration.

⚠ **One method note, paid for in re-work and worth the next seat's thirty
seconds: a `DATE` column off mysql2 renders as `"Tue Sep 22"`, not ISO.** This
run's per-day slice reader split its window with `String(row.day).slice(0,10) >=
"2026-09-26"`, which is string garbage — **the per-day rows were correct and only
the derived total was wrong**, which is exactly the shape that ships. Formatted in
SQL (`date_format(…, '%Y-%m-%d')`) and re-run, so the receipt in §B1 is the text
that ran rather than a number corrected by hand. Its sibling: the operation
table's timestamps render in LOCAL time (UTC+10) even though `dbConnection.mts`
parses them correctly as UTC — a Sign printed at `Oct 01 19:xx` ran at `09:xx`
UTC, which is what settles §B2's before/after.

### K. Addendum — #1799's two levers, MEASURED (builder seat `seat1-20261003-051104`, 2026-10-02)

Not patrol 6's own reading. Run 6 filed **#1799** naming two levers and
deliberately choosing neither; this is the measurement that chooses, taken by the
builder seat that took the card. §F above is the before and is unchanged.

**The question run 6 left open, verbatim from the card:** *"`import` is 357 s of
the 780 worker-seconds — 46% of the suite's cost is module import, not
assertions. 954 files each importing a graph. This lever reduces the work rather
than redistributing it, and nothing has ever measured it here."*

#### K.1 · Method, and the noise floor that decides what is readable

Four arms, **interleaved round-robin** (A,B,C / A,B,C / A,B,C) rather than three
runs of each in turn, because this box's own load moves across a sitting —
`server/testing/workerCap.ts` records a 429 s reading an hour after a 179 s one
on the same tree. Interleaving makes a drifting box show up as spread in every
arm instead of as a win in one. Each arm is a full `vitest run` on `origin/main`
`f876d5d9`, 983 files, this box (20 cores, 8 workers), nothing else running.

⚠ **The noise floor was read FIRST and it governs every verdict below.** Two
back-to-back baselines earlier the same night agreed to **0.6%** on `import`
(420.2 s, 417.7 s) while their wall differed **8%** (179.5 s, 164.9 s) — so
`import` worker-seconds, not wall, is the figure this card is read on. **Over the
26-minute interleaved sitting the same baseline spread 416–471 s, which is 13% of
its mean.** So: a lever under ~13% cannot be resolved on this box in one sitting,
and only an effect far outside that band is decision-grade here.

#### K.2 · The four arms

| arm | `import` med / mean | `tests` med / mean | work (i+t) med / mean | wall med / mean | `import` range | green? |
|---|---|---|---|---|---|---|
| **baseline** | 438.1 / **442.0** | 675.1 / 697.6 | 1109.9 / **1139.6** | 169.2 / 173.7 | 416–471 | 955 pass, 0 fail |
| `deps.optimizer.ssr` | 421.4 / **445.5** | 714.5 / 709.0 | 1177.8 / **1154.6** | 176.8 / 175.8 | 418–497 | 955 pass, 0 fail |
| `pool: "threads"` | 375.3 / **401.2** | 678.4 / 690.4 | 1108.6 / **1091.6** | 164.8 / 164.3 | 375–453 | **2 files fail, all 3 rounds** |
| `isolate: false` | 81.9 / **80.1** | 618.9 / 621.9 | 700.8 / **702.0** | 91.6 / 92.4 | 64–94 | **54–70 files fail** |

Against baseline means: optimizer `import` **+0.8%**, work +1.3%, wall +1.2% ·
threads `import` **−9.2%**, work −4.2%, wall −5.5% · `isolate: false` `import`
**−81.9%**, work −38.4%, wall −46.8%.

**1 · Dependency pre-bundling does nothing, and that is the headline for lever 2.**
`deps.optimizer.ssr.enabled` is vitest's own documented answer to a high import
cost, and here it is inside the noise in the wrong direction. So the 46% is **not**
dependency resolution — it is not something a config setting can bundle away.

**2 · The threads pool redistributes rather than reduces.** `import` falls 9.2%
and `tests` is unchanged, so total work is 1091.6 against 1139.6 — a 4.2% move
with ranges that overlap (375–453 against 416–471), i.e. **inside the noise floor
of §K.1 and not decision-grade.** It also reddens two files in every round, both
for the reason threads exist: `sharpTestCeiling` (the `VIPS_CONCURRENCY` ceiling)
and `unwiringDiffer`'s relative-root arm (`process.chdir` is unavailable in a
worker thread). Not worth two suites for an unreadable 4%.

**3 · `isolate: false` is the ceiling probe, and it sizes the prize exactly.**
It instantiates each module once per worker instead of once per test file, which
is the only setting that removes the work rather than moving it. `import`
**438 → 82 s**, wall **169 → 92 s**. ⚠ **It is a PROBE and not a candidate:** it
lets module state leak between files and **54–70 of 983 files go red.**

#### K.3 · What the measurement settles

**The 46% is real, it is per-file re-instantiation of FIRST-PARTY modules, and
~355 import worker-seconds of it are genuinely removable — but not by
configuration.** The price is making ~60 suites isolation-independent, which is a
porting programme and several cards, not a flag. **So lever 2 is measured to a
conclusion and it is not available to this card.** That is the one thing run 6
asked for and could not answer.

#### K.4 · Lever 1 re-costed — run 5's "doubled runner minutes" is WRONG, and the real blocker is somewhere else

Measured by driving the shard rather than reasoning about it: `--shard=1/2` and
`--shard=2/2` on the same tree, **both green**.

| | files | `import` | `tests` | wall |
|---|---|---|---|---|
| shard 1/2 | 477 pass, 15 skip (492) | 210.1 | 315.4 | 80.1 |
| shard 2/2 | 478 pass, 13 skip (491) | 222.8 | 327.6 | 83.1 |
| **both** | **983** | **432.9** | 643.0 | — |

**The work is SPLIT, not duplicated** — 432.9 s of `import` across the two
shards against 438.1 s in one run — and the two halves balance within **4.7%**.
With the gate's own per-job setup measured at **26 s** (run 37036750361: set-up 2
+ checkout 11 + pnpm 5 + node 4 + install 4), a two-way shard beside
`gate-checks` reads:

- each shard job ≈ 26 s + ~201 s = **~227 s**; `gate-checks` without its test
  step = 533.5 − 402.5 = **131 s**; `static-shapes` 126 s
- gate wall **533.5 s → ~227 s, −57%**
- runner-seconds **533.5 → 585 s, +9.7%** — because only the 26 s setup is paid
  twice. ⚠ **Run 5 priced this as "doubled runner minutes" and that is wrong by
  a factor of ten**; doubling would need each shard to run the whole suite.

⚠ **AND THE REAL REASON THIS ADDENDUM SHIPS NO SHARD: IT IS NOT A `gate.yml`
EDIT.** `gate-checks` is a **required status check on `main`**
(`docs/specs/PUSH_PATHS_TO_MAIN.md`: *required checks [gate-checks,
founder-gate]*), and `enforce_admins` is **off** (#460) — so, in this file's own
words beside `static-shapes`, *"a job of its own is a decoration unless something
reads it"*. `scripts/lib/prMergeOrder.mts` reads each gate job **by exact name**
(`checkStateOf(rollup, name)`), with its own `PrReading` field and three roads
(running waits, red stops, absent judged after mergeability), pinned in
`server/prMergeOrder.test.ts`. **Moving `pnpm test` out of `gate-checks` without
that reader would make the unit suite stop blocking any merge while the check
still went red on the PR page** — the "installed and never connected" class this
repository has now been bitten by five times, and the shape #1034 wrote that
warning about.

So lever 1 is a **merge-road contract change** wearing a performance card's
name: gate.yml, plus a new state on the reading every seat's merge flows through,
plus its guard. It is carded on its own rather than folded in here. **The simpler
path, declined and named as the fidelity law requires: edit `gate.yml` alone and
stop. It would have halved the gate's wall tonight and quietly cost the suite its
power to block a merge.**

#### K.5 · Close

Nothing shipped against the gate, deliberately; **the lever that is cheap is not
safe to take inside this card, and the lever that is safe is not available to
it.** Spent: nothing — no render, no credit, no text call, no production
variable, no flag.

**16 full-suite runs and 2 half-suite shard runs, all local** — counted at the
logs (`grep -c 'Duration '`): 1 + 1 + 2 standalone baselines, 12 in the arm
runner (9 interleaved + 3 for the probe), 2 shard. Four disposables named with
the card (`_1799-arms-`, `_1799-armD-`, `_1799-summarise-`,
`_1799-import-attribution-`) and **three** arm configs, all deleted at close;
the baseline arm needed no config of its own, which is why there are four arms
and three configs.

⚠ **That sentence read *"14 full-suite runs"* and *"the four arm configs"* when
this addendum was first pushed, and both were wrong** — the runs were never
counted, and the config count was the arm count written down twice. Caught in
this seat's own close by counting at the logs and by `ls`, which is the same
recount that caught run 6's `six`-over-seven one section above. **Two unforced
count errors in one document in one night, from the same cause: a number
remembered instead of read.** Left visible rather than quietly edited, because
the correction is the only part of this that teaches anything.
---

## §F's AFTER — the shard landed (#1811, `foreman-20261003-0700`, 2026-10-02)

⚠ **NOT A PATROL RUN.** Appended by the Foreman shift that built #1811, because
run 6 §F's trigger is the reason the card exists and its before/after belongs
beside the before. Run 7 owns the next full reading.

**Read at step grain on PR #1816's own two gate runs** (`gh run view --json jobs`),
which is the same instrument §F used, and the step is still named `Unit tests`
so the series is continuous.

| job | run 6 before | after (run 37068536821) | change |
|---|---|---|---|
| `gate-checks` (whole job) | **533.5 s** | **143 s** | **−73%** |
| `unit-tests-1` | — | 235 s (492 files) | new |
| `unit-tests-2` | — | 236 s (492 files) | new |
| `static-shapes` | 126 s | 145 s | +15% |
| **gate WALL** (the longest parallel job) | **533.5 s** | **236 s** | **−55.8%** |
| **runner-seconds** (the three jobs above) | **533.5 s** | **614 s** | **+15.1%** |

**The split is exact and balanced**: 492 + 492 = 984, and the tree collected 984
because `558af8636` (#1808) landed one new test file while the run was queued —
983 the hour before. Halves within 0.4%.

⚠ **TWO NUMBERS THE CARD PREDICTED AND MISSED, STATED RATHER THAN ROUNDED
AWAY.** #1811 priced the wall at ~227 s (got 236 s, close) and the runner cost
at **+9.7%** (got **+15.1%**). The gap is per-job setup: the card measured 26 s
from run 37036750361's set-up/checkout/pnpm/node/install steps, and the real
figure for a job that installs is nearer 40 s — `gate-checks` also came in at
143 s against the predicted 131 s. **The direction and the size of the trade
hold; the second decimal did not.** −57% predicted, −55.8% measured.

⚠ **AND THE FIRST GATE RUN IS THE ONE WORTH READING, because it was GREEN in
the way that matters least.** `pnpm test -- --shard=N/2` — the documented
separator — makes pnpm 10 discard everything after it, so both jobs ran all 983
files and the gate got SLOWER while every tally stayed green. The wall figures
from that run (4m38s, 7m12s) are readings of the whole suite, not of a half.
**A lever that silently does not engage looks exactly like a lever that
engaged.** Both defects (that, and the suite's undeclared need for
`fetch-depth: 0`) now have driven arms in `server/prMergeOrder.test.ts`.

### The independent reading, which is the one to trust

PR #1816's figures are the change measuring itself. **PR #1817 is somebody
else's card** (`seat1`, #1813) and was the first ordinary pull request to meet
the sharded gate, half an hour later — run `37070037313`:

| job | seconds |
|---|---|
| `gate-checks` | 123 |
| `unit-tests-1` | 211 |
| `unit-tests-2` | 163 |
| **wall** | **211 s against 533.5 s — −60%** |

⚠ **Its halves are 211 s and 163 s — 29% apart, against 0.4% on #1816.** The
file split is fixed and exact; the *time* split is not, because vitest shards by
file count and files are not equal work. **So −57% is the shape of the win and
not a constant**, and the wall on any given run is the slower half. A future
seat reading one run should expect that spread.

And the merge road reads them: `pr-merge-in-order --pr 1817 --dry-run` prints
`units=green/green` beside `gate=green`, which is the half that actually binds
a merge here.

**Still not taken, and still the bigger prize:** §K.3's ~355 removable `import`
worker-seconds behind an isolation port of ~60 suites. The shard redistributes
the work; only that removes it.

## Run 7 — 2026-10-10 00:00–01:1x AEST (Machinist, patrol #7; weekly clock, on the day)

Readers: `scripts/machinist-ledger-read.mts --days 14` (production,
`hayabusa.proxy.rlwy.net:23768`, window to 2026-10-09T14:08:45Z); the `gate.yml`
job grain of ten green runs plus five of those runs' own vitest tallies off the
CI **logs**; `git ls-tree` and `git diff --name-status` over `f40dd404c` →
`2083426c8` as the second reader on suite growth; three read-only disposables
named where they are quoted. **Spent: nothing** — no render, no credit, no text
call, no paid arm, no production write, no variable, no flag. Every figure is off
rows, logs and trees already paid for.

⚠ **Run 6 named the gate as its worst number and #1799 sharded it. The shard
worked and has already been half given back; §H is this run's spine and §I comes
out of it.** The paid road, by contrast, produced the two best readings this
ledger has carried.

⚠ **Method note, and it cost this run a re-read: the ledger reader's output was
captured through a backgrounded shell and arrived MISSING SECTIONS A AND B** —
the file began mid-§C and looked like a complete document. The wall-clock table
is the ledger's spine, so it was re-taken with an explicit redirect before
anything was written down. A capture that loses its head reads exactly like a
reader that has nothing to say about wall-clock.

### A. Wall-clock per paid operation — 68 operations, 14d

| kind | n | statuses | median | p95 | max | charged | refunded |
|---|---|---|---|---|---|---|---|
| `castingV2.packageRedo` | 20 | 15 succeeded · 5 failed | 63 s | 314 s | 314 s | 0 | 0 |
| `castingV2.sign` | 15 | 8 succeeded · 7 partial | 115 s | 319 s | 319 s | 36,500 | 850 |
| `castingV2.roll` | 14 | 12 succeeded · 1 failed · 1 partial | **26 s** | 68 s | 68 s | 7,840 | 400 |
| `castingV2.viewRetry` | 11 | 11 succeeded | 71 s | 131 s | 131 s | 500 | 350 |
| `castingV2.packageRedoPress` | 4 | 3 succeeded · 1 failed | 158 s | 314 s | 314 s | 13,000 | 3,250 |
| `castingV2.refine` | 2 | 2 succeeded | 53 s | 53 s | 53 s | 50 | 0 |
| `model.delete` | 2 | 2 succeeded | 1 s | 1 s | 1 s | 0 | 0 |

- **The roll's median fell a third consecutive time: 46 → 34 → 30 → 26 s.**
- **Two operation kinds appear in this table for the first time** —
  `castingV2.packageRedo` and `castingV2.packageRedoPress`, the paid sheet redo.
  They are §C.
- `castingV2.refine` ran twice again, 53 s, **0 of 2 past the ~305 s gateway
  wall**. Still an anecdote at n=2, and identical to run 6's reading.

✅ **RUN 6's OPEN NOTE IS CLOSED: the new prices are live and exercised.** Run 6
recorded *"nothing has been charged at P1's new prices — 0 operations since the
release merged"*, so every credit figure it carried was priced at the old table.
Not any more, and it moved twice in two days: **Signs on 2026-10-08 charged
8,500** (P1's scale) and **Signs from 2026-10-09T03:02:41Z charge 3,250**
(#1968's flat price, PR #2105, merged 01:58Z that day). Per-day charges went from
610–2,125 across the fortnight's first week to **31,900 on 8 Oct and 19,500 on 9
Oct**. A later run comparing credit totals across 2026-10-08 is comparing three
scales, not two.

### B. The Sign, split at #1612 instead of blended across it — the best reading in this ledger

The 14d blend says 15 Signs, 7 partial, 47%. **#1612 (the view checker: measured
framing, refusal only on identity) closed 2026-10-07T22:43:31Z, inside the
window**, so the blend compares two different machines — run 6's own lesson about
the 60-day refine row, one boundary later.

| | ops | partial | median wall | wall spread | charged | refunded |
|---|---|---|---|---|---|---|
| **before** #1612 | 10 | 6 — **60%** | ~145 s | 89 → 319 s (**230 s**) | 4,500 | 850 |
| **after** #1612 | 5 | 1 — **20%** | **65 s** | 63 → 67 s (**4 s**) | 32,000 | **0** |

- **The Sign got 2.2× faster — ~145 s to 65 s** — and that is the headline.
- ⚠ **The variance collapse is the more interesting half: a 230-second spread
  became a 4-second one** (63, 65, 65, 66, 67). Five samples landing inside four
  seconds is not a faster machine, it is a machine that **stopped waiting on
  something variable** — consistent with per-view checker calls leaving the
  Sign's critical path. n=5, so it is recorded as the strong anecdote it is, and
  the next run has the population to confirm it.
- The partial rate fell 60% → 20%. **At n=5 that is one operation**, and it is
  reported as one operation rather than as a rate.
- The single `after` partial (2026-10-09T08:19:17Z) charged 3,250 and **refunded
  0, which is correct** under the flat price — credits come back only on a total
  loss (#2125, `castingCreditCosts.ts:391`), not per missing view.

### C. The paid sheet redo, on its first day — read at the rows, and correct

A brand-new paid road showed **5 of 20 `packageRedo` failed** and **1 of 4
`packageRedoPress` failed with 3,250 refunded**, which reads like a 25% failure
rate on a money surface. It is not a defect. The arithmetic closes —
`CASTING_V2_PACKAGE_REDO_PRICE_CREDITS` is a flat **3,250**, 4 × 3,250 = 13,000
charged, one total loss refunded exactly 3,250 — but *"the five failed views
belong to the refunded press"* was an **inference from 15 = 3 × 5**, so it was
read at the rows:

| press | status | charged | refunded | its views | failed |
|---|---|---|---|---|---|
| `e16e6d17…` Cast 70, 03:04Z | succeeded | 3,250 | 0 | 5 | 0 |
| `fc2849e9…` Cast 71, 08:46Z | **failed** | 3,250 | **3,250** | 5 | **5** |
| `9894c22e…` Cast 71, 09:53Z | succeeded | 3,250 | 0 | 5 | 0 |
| `8535bc86…` Cast 71, 11:05Z | succeeded | 3,250 | 0 | 5 | 0 |

**The one failed press owns exactly its own five failed views, was refunded its
whole flat price, and the view rows carry 0 money between them** — the money is
on the press, which is the design. One total loss in four presses, n=4, the
total-loss road firing exactly once and paying back in full.

⚠ **The reading that nearly shipped instead** was "25% failure on the newest
money path". The three `PRECONDITION_FAILED` throws in `packageRedoService.ts`
are all **free refusals before any claim** and belong to the *press* entrance, so
they cannot be what a per-view row records — which is what sent this to the rows
rather than to a card.

### D. Paid slices — a second clean fortnight

**104 slices paid for · 102 arrived · 2 failed (1.9%) · 0 stranded mid-flight.**
Both failures are `content_policy`. Cross-checked on the money ledger: **2
refunds for 400 credits — AGREES**. Run 5 ended on *"one paid slice in seven did
not arrive"* for the fourth run running; run 6 read 72 of 72; this reads 102 of
104 with both losses refused rather than lost. **#129 has now not been this
ledger's closing sentence for three runs.**

### E. Face scans · F. Provider books

69 rows in window = **69 paid looks, $6.90** (20 reads at $0.10). All time 371
rows over 369 faces; 0 render-written. #38's cost model holds a fourth time.

OpenRouter, the provider's own books, **account-wide** (courts and product share
one account): **$29.55 over 11 active days**, 1,728 requests, every one
`anthropic/claude-sonnet-5`. The two spikes are courts, not traffic — 26 Sep
$13.34 / 719 req and 30 Sep $8.06 / 476 req; the last seven days total **$2.18**.
fal, off our own rows: **$1.32 priced** (88 `sunburst/text-to-image` at the
measured $0.015), and **two endpoints still UNPRICED** — 18 `sunburst/edit` calls
and 8 `unrecorded-roll-engine` — so **$1.32 is a floor and not a total**,
unchanged from run 6.

### G. The shift process — the one figure that went backwards

| | run 6 | run 7 | target |
|---|---|---|---|
| cards landed per landing session | 2.72 | **1.85** | 3 — MISS |
| gate minutes per card | — | 8.49 | 10 — OK |
| gate runs per card | — | 1.26 | 3.1 baseline — OK |

270 closed sessions, 230 of them landed something, 426 cards, 538 gate runs /
3,615.1 gate minutes. **Cards per session fell 2.72 → 1.85** — run 6 recorded
that figure rising 1.50 → 2.72 as *"the process figure that had never moved"*,
and a week later it has given most of that back. Recorded, **not** carded: the
denominator is sessions-that-landed-something and the seat population changed
across the window, so this is a number to watch for a third reading rather than
one to act on. Its neighbours both pass.

### H. The gate — run 6's win, half given back in seven days

Job grain, what a shift actually waits for. Baseline is run `37070037313`
(2026-10-02), the figure run 6 §K recorded; today is the median of ten green
`gate.yml` runs on 2026-10-09.

| | 2026-10-02 | 2026-10-09 (median of 10) |
|---|---|---|
| `unit-tests-1` | 211 s | 256 s |
| `unit-tests-2` | 163 s | **304 s** |
| **wall** (the slower half) | **211 s** | **304 s — +44%** |

Vitest grain, five runs' own tallies off the CI logs:

| | 2026-10-02 | 2026-10-09 (median of 5) |
|---|---|---|
| test files | 985 | 1,068 — +8.4% |
| shard 1 `tests` / shard 2 `tests` | 222.9 / 185.7 s | 277.7 / **422.5** s |
| both shards' `tests` | 408.6 s | **700.2 s — +71%** |
| both shards' `import` | 358.3 s | 543.1 s |

**Second reader, not sharing a resolver:** `git ls-tree -r --name-only` counts
`*.test.ts(x)` at **985** on `f40dd404c` and **1,071** on `2083426c8`. CI's
vitest tally and git's tree agree.

⚠ **One sampling trap, caught by sampling.** The first run read (`37936339900`)
showed shard 1 *falling* to 154.6 s — it is an outlier; the other four sit at
220.9–236.1 s. **n=1 on a CI job is an anecdote**, and on that one run the
imbalance would have been reported as 2.2× rather than the 1.52× it is.

What grew is **ours**: 95 test files added, 9 deleted. **Ten of the 95 spawn
child processes or drive a real filesystem/git**, and every one of those ten is a
guard on the crew's own tooling rather than on product behaviour — so the gate
gets slower each time a shift fixes a tooling bug, a loop with nothing damping
it. Two separable costs, and only the first is big: **growth** (`import` is 543 s
of the 700 s — #1799 §K.3's still-untaken ~355 removable `import` worker-seconds
behind an isolation port of ~60 suites) and **imbalance** (`vitest --shard`
splits by **file count**; the halves are exactly 535/535 while their test-seconds
are 1.52× apart, worth ~24 s of today's 304 s). Run 6's addendum predicted the
imbalance and did not card it. **Carded now: #2164.**

### H2. The gate that refused this run's own push — found by being refused by it

`.githooks/pre-push` ARM 2 refused the ledger append above with *"the working
tree is clean and the generated maps are STALE"*. **The maps were not stale.**
The worktree was cut with plain `git worktree add` and had no `node_modules`, so
`tsx` was absent and the checker could not execute — and the hook reads **only
the exit code**, so *"the generator ran and found a stale map"* and *"the
generator could not run"* are one answer to it.

The before/after, with nothing in the commit changed between the two readings —
only whether the checker could run:

| | verdict |
|---|---|
| plain worktree, no `node_modules` | **REFUSED — "the generated maps are STALE"** |
| after one junction to the main tree's install | `architecture:check` **OK**; `capability:check` **OK — 67 doors, 61 corpus rows, 0 error**; push accepted |

⚠ **The remedy it printed cannot work**: `pnpm architecture:generate` needs the
same missing `tsx`, so an author who obeys the instruction gets the identical
error. This is the shape the hook's own comment records having shipped once
before — *"a sentence that was false, above a remedy that was wrong"* (review of
PR #610, finding 5) — one question earlier: it asks whether a staleness verdict
is about the commit or the worktree, and never whether the check executed.
It is live for every seat right now, because #2148 is repairing the shared
install that every junctioned worktree reads. **#2167.**

### I. THE WORST NUMBER — run 7

**The gate's unit wall is back to 304 s from the 211 s the shard delivered seven
days ago — 29% of the win given back in one week, and the suite's test-seconds
grew 71% on 8.4% more files.** At this rate the shard buys nothing by early
November. The growth is the crew's own tooling guards, which is a loop that
closes on itself; `import` remains 78% of the cost and the named remedy has now
gone un-taken for a second run. **#2164.**

**Runner-up: cards per session, 2.72 → 1.85** (§G) — recorded, not carded, and
wanting a third reading.

**Nothing on the paid road, for a second run running.** 102 of 104 slices
arrived, both losses refused rather than lost and both refunded; the new paid
redo road was read at the rows and is correct; the Sign is 2.2× faster.

**Best news of the run, recorded because a ledger that only carries faults is not
a measurement:** the Sign's wall fell ~145 s → 65 s with its spread collapsing
from 230 s to 4 s; the roll's median fell a third consecutive time (46 → 34 → 30
→ 26 s); 102 of 104 paid slices arrived; the first-day money on the sheet redo is
conserved exactly; and the last seven days of OpenRouter cost **$2.18**.

### J. Close

Seat: Machinist, patrol #7, one seat, shift `machinist-20261010-0000`, run row
**#638**. Clock: run 6 was 2026-10-03, so this run is on the day; the clock counts
from today. Ledger appended. **Three cards filed — #2164 (the worst number), #2165
(a five-shift recurrence handed to the Retro, whose clock fires 2026-10-11) and
#2167 (§H2).** One finding investigated and **withdrawn at the rows** (§C). Three
read-only disposables written, guarded and deleted; scratch removed. Readings
taken from the main tree (read-only) and a worktree at `origin/main`
`2083426c8`. No dev server started. **Spent: nothing.**

⚠ **What was NOT read this run, and the reason is one a later seat should know.**
`pnpm machinist:bench` and `pnpm machinist:bundle` both need the shared install,
and **#2148 was being repaired by a live builder seat (`seat1`, run row #637)
throughout this shift** — the main tree's `node_modules` still carried the
`cookie@1.0.2` skew and was about to be replaced. A bench taken across that is
measuring neither tree. The nearest honest figure is the **previous** shift's
hand-run 24 minutes before this one began (`foreman-20261009-2312`): bundle
budget 267.2 kB gzip against 290.0, after-paint 243.7 against 280.0 — **cited as
theirs, not re-taken as mine.** Interaction latency is still blocked on #1800's
fixture. The gate readings above need none of this: they are CI's own logs.

### L. Addendum — #2164's two levers, MEASURED (builder seat `seat1-20261010-005320`, 2026-10-10)

Not patrol 7's own reading. Run 7 filed **#2164** naming two levers — the
isolation port (growth) and cost-weighted sharding (imbalance) — and
deliberately chose neither; this is the measurement that chooses, taken by the
builder seat that took the card. §H above is the before and is unchanged.

**It chose a THIRD thing, which the card listed and run 7 did not expect to
win: one more shard.** It is 3.4x the prize of the best cost-weighting that
could ever exist, and it is two jobs' worth of YAML.

#### L.1 · Method — CI's own logs, not this box, and a simulator with controls

⚠ **The local box is not admissible for this question and §K.1 is why.** It runs
the suite at ~8.9x parallelism against the gate's 2.5x, which is how #1799's
local bench read a 42% gate rise as flat. ⚠ **And it could not have been used
tonight anyway: #2148 IS STILL OPEN AND THE SHARED INSTALL IS STILL SKEWED** —
read at the bytes at 01:1xZ, `node_modules/cookie` is a symlink into
`.pnpm/cookie@1.0.2` while `pnpm-lock.yaml` pins **2.0.1**, and `cookie@2.0.1`
is not in `.pnpm` at all. Seven files are red on `main` on this machine for that
one reason (`googleAuth`, `sessionCookieHeaderRead`, `sessionLookupFailure`,
`sessionFailureRoutes`, `useAuth`, `typecheckGate`, `atlasCommitHook`), and two
of them are *inflated* by it — `googleAuth` took **210.6 s** locally against
**1.4 s** in CI. Run 7's close said the install "was about to be replaced"; it
has not been. A duration read off this box would have been 37% one broken file.

So both readings come from **CI run `37945774253`** (a green `gate.yml` run on
`main`, 2026-10-09 — the same population §H measured):

1. **Per-file `tests` cost for all 1,070 files**, scraped from the two shards'
   own reporter lines. ⚠ **Its control is internal and exact:** the scrape sums
   to **289.0 s** and **429.6 s**, against the `Duration` lines' printed
   `tests 289.04s` and `tests 429.63s`. 0 unmatched candidate lines.
2. **A reimplementation of `BaseSequencer.shard` + `calculateShardRange`**, read
   out of the bytes of `node_modules/vitest/dist/chunks/coverage.DM_a_rWm.js`
   (vitest 4.1.11) rather than from the docs.

⚠ **Two things that reading settles, and the first would have invalidated the
whole model if it had gone the other way.** `shard()` builds its key as
`resolve(slash(root), slash(moduleId)).slice(root.length)` — and `resolve` is
**`pathe`'s**, not `node:path`'s, so it is forward-slashed on every platform and
shard membership is identical on Windows and Linux. And the slice is by **equal
FILE COUNT** over a sha1-sorted list: there is no cost weighting anywhere in it,
and the within-shard `sort()` falls back to **file size**, because CI's duration
cache is empty on a fresh checkout.

**Controls on the simulator, before any prediction off it was believed (working
law 2):**

| control | result |
|---|---|
| reproduces CI's real `unit-tests-1` membership | **yes** — 535/535, symmetric difference **0** |
| reproduces CI's real `unit-tests-2` membership | **yes** — 535/535, symmetric difference **0** |
| NEGATIVE: hashing the path *without* its leading slash reproduces it | **no** (as it must not) |
| the wall model against the real job seconds | `unit-tests-2` **307 s modelled / 299 s measured** (+2.6%); `unit-tests-1` 251 / 266 (−5.7%) |

The wall model is `26 s setup + (import + tests) / 2.51`, where 26 s is §K.4's
measured per-job setup and 2.51x is this run's own parallelism (1,266 worker-
seconds over 532 s of job wall). Import is taken as 0.512 s x files, which needs
no assumption beyond the average: shards carry equal file counts, and CI's own
split was 266.9/280.8 on 535/535 — 2.5% off even.

#### L.2 · The answer, at job grain

| scheme | shard `tests` | slowest job | runner-seconds |
|---|---|---|---|
| **two shards (as it was)** | 289.0 / 429.6 | **299 s measured**, 307 modelled | 557 s |
| **THREE shards** | 212.5 / 279.2 / 227.0 | **210 s — −30%** | 583 s (**+4.7%**) |
| four shards | 158.8 / 131.3 / 254.0 / 174.6 | 182 s | 609 s (+9.3%) |
| perfect cost-weighting, two shards | — | **279 s — the CEILING on lever 2** | 557 s |
| perfect cost-weighting, three shards | — | 195 s | 583 s |

**1 · LEVER 2 (imbalance) IS REFUSED, AND BY A BIGGER NUMBER THAN DRIFT.** The
card priced perfect balance at ~24 s and expected drift to be the objection — a
committed per-file weight list is a second list shadowing the tree (working law
4), and vitest reads no such thing, so it would need a custom `sequencer`. **It
is refused on the prize instead: longest-processing-time packing with PERFECT
per-file knowledge — which no implementation can beat — buys 28 s (9%), against
the third shard's 89 s (30%).** At three shards it is 16 s. Cost-weighting is
the smaller lever at every width, and it stays smaller.

**2 · THE FOURTH SHARD IS MEASURED AND DECLINED, with its numbers here so the
next run need not re-take them.** Its extra 28 s comes with a worse spread (the
heaviest shard **42%** above the mean against **31%** at three) and a fourth
parallel job on the one Actions budget every seat and the crew share. And
`gate-checks` at **151 s** is the next floor under the gate wall, so the headroom
past three is both small and getting lumpier.

**3 · LEVER 1 (the isolation port) IS RE-SIZED AND STILL REFUSED for this
card.** `import` is **547.7 s of 1,266 worker-seconds — 43%**, down from run 6's
46% not because import shrank but because `tests` grew faster. At §K.2's measured
−81.9% it would take the three-shard wall from 210 s to **151 s**: real, and
**60 s** rather than the headline the card implies. The price is §K.3's ~60
suites made isolation-independent — and the risk it carries is not porting
effort, it is that a non-isolated suite can pass for the WRONG reason, with
leaked state making an assertion true. That is a trade against the gate's own
trustworthiness, and it is not made inside a sharding card.

#### L.3 · What the measurement found that was on NEITHER lever, and is bigger than both

| | `tests` |
|---|---|
| all 1,070 files | **719 s** |
| the **ten** heaviest | **355.8 s — 50%**, on 0.9% of the files |
| `server/capabilityAtlas.test.ts` alone | **128.9 s — 17.9%** |
| the 800 files that finish under 100 ms | 21.3 s — 3% |

Per-file: p50 **27 ms**, p75 105 ms, p90 0.70 s, p99 11.8 s, max 128.9 s.

**The suite has no broad cost problem. It has ten files, and not one of them is
a product test** — every one is a guard on the crew's own tooling, slow for the
same reason: it drives a real `git`, a real `tsc`, or another child process.
That is precisely the loop §H named, and this is where it lands.

⚠ **And one file is a HARD FLOOR under every scheme in L.2.** 128.9 s cannot be
divided, so no sharding of any width can put a shard below **~78 s**. Filed as
**#2172**, with the ten and the questions to ask of each.

#### L.4 · What shipped, and where its own after is read

`gate.yml` only: `unit-tests-3`, a byte-identical copy of its sibling, and the
three denominators moved to `/3`. **No TypeScript at all** — `unitShardJobNames`
derives the names from the workflow, which is what #1811 built it for, and every
arm in `server/prMergeOrder.test.ts` is derived from that list and went green on
three without an edit.

One arm was ADDED, and it is the price of the copy rather than tidiness: the
three forty-line blocks are maintained by hand, every field in them is
load-bearing, and exactly **one** of them had a guard (`fetch-depth`). A copy
that lost the `ref:` pointing at `resolve`'s merge ref would gate the branch head
instead of the merge with main — PR #87's review finding 5, a job that passes on
bytes nobody proposed — and it would go **green**, because every other reading
here is derived from the job NAMES and a drifted body keeps its name. Driven
under sabotage, each case anchored inside the block it damages and its landed
diff printed:

| case | arm that reddened |
|---|---|
| 0 · no edit (control) | none — green |
| 1 · `unit-tests-3` loses `persist-credentials: false` | the new drift arm |
| 2 · `unit-tests-2` on node 22, siblings on 24 | the new drift arm |
| 3 · `--shard=3/4` beside `1/3` and `2/3` | #1811's gap/overlap arm **and** the drift arm |

⚠ **Case 1's first attempt proves its own method note:** the anchor was found by
counting `persist-credentials: false` across the file and taking the third,
which is `unit-tests-2`'s — `gate-checks` holds one too. A containment assertion
caught it; without one it would have edited the wrong job, survived green, and
read as *the guard does not catch this*.

**The after is NOT read on this card's own PR** (its diff is the change). It is
read on the next ordinary PR's `gate.yml` run, at job grain, against the **299 s
measured** above — run 8's §H is where it belongs.

## §L's AFTER — the third shard, read on ordinary PRs (#2164, `seat1-20261010-162527`, 2026-10-10)

⚠ **NOT A PATROL RUN, and deliberately not a `## Run` heading** — `scripts/patrol-clocks.mts`
reads the newest `## Run N — YYYY-MM-DD` to decide whether this seat is due, so
an after-reading appended under that spelling would silently reset the
Machinist's clock. This is §F's AFTER's shape, for §F's AFTER's reason: §L
closes by saying its own after belongs on the next ordinary PR, and the
before deserves its after beside it. Run 8 still owes the next full reading.

**Read at job grain** (`gh run view <id> --json jobs`, each unit shard's
`completedAt − startedAt`), on **ordinary PRs' own `gate.yml` runs** — never on
this box, which runs the suite at ~8.9× parallelism against the gate's 2.5× and
is how #1799's local bench read a 42% rise as flat.

### The instrument's control, taken BEFORE its verdict was believed (working law 2)

The same reader was pointed at **nine green pre-shard runs** (2026-10-09, before
`2175` merged at 15:51Z) and reproduced the figure §L measured by a different
route:

| | this reader, n=9 | §L / #2164 |
|---|---|---|
| median gate WALL | **299 s** | **299 s** measured / 304 s (card's median of 10) |
| `unit-tests-1` median | 256 s | — |
| `unit-tests-2` median | 299 s | — |

**Exact on the wall.** §L scraped vitest's own reporter lines and modelled the
job; this reads the job clock. Two readers, no shared resolver, same answer — so
the after below is a reading rather than a hope.

### The after

**Ten green `gate.yml` runs on ordinary PRs, 2026-10-09T21:57Z → 2026-10-10T07:17Z**
(`team/relay-2152`, `-2153`, `-2181`, `-2185` ×2, `-2187`, `-2190`,
`team/face-scan-cap-number-2170`, `team/persona-door0-2137`):

| | two shards (before) | three shards (after) | change |
|---|---|---|---|
| **gate WALL** (slowest unit job) | **299 s** | **197 s** | **−34%** |
| `unit-tests-1` median | 256 s | 167 s | −35% |
| `unit-tests-2` median | 299 s | 158 s | −47% |
| `unit-tests-3` median | — | 174 s | new |
| wall spread (min–max) | 267–320 s | 133–207 s | — |

⚠ **§L predicted 210 s and the gate delivered 197 s — the model was 6.6%
CONSERVATIVE, which is the direction a prediction should miss in.** Its
companion prediction for two shards (307 s modelled against 299 s measured,
+2.6%) was the same sign, so the model reads slightly slow at both widths rather
than having got lucky at one.

⚠ **AND THE WIN HELD WHILE THE SUITE KEPT GROWING, which is the half #2164 was
actually about.** The card's finding was a 71% rise in test-seconds over seven
days with nothing damping it; the after window sits a day further along that
curve and the wall is still 197 s. The shard did not stop the growth — nothing
here claims it did — it bought back more than the growth had taken.

### ⚠ What is NOT in that −34%, stated because the obvious attribution is wrong

**#2179 merged inside the window** (2026-10-09T17:30Z — `capabilityAtlas.test.ts`
31 builds → 4, measured −85.5% on that file locally), so every one of the ten
runs above carries it as well as the third shard. Isolated at the two green runs
that fall between the two merges — three shards, no atlas fix:

| | n | median wall |
|---|---|---|
| three shards, **before** #2179 | 2 | **199 s** |
| three shards, **with** #2179 | 10 | **197 s** |

**So the third shard did essentially all of it, and an 85% cut to the single
heaviest file moved the gate wall by about 2 s — inside the noise of a 133–207 s
spread.** The n of 2 makes this indicative rather than settled, and shard
membership reshuffles as files land (`BaseSequencer.shard` slices a sha1-sorted
list by equal file COUNT), so the atlas file is not pinned to one shard between
runs.

⚠ **The lesson is #2172's, not this card's, and it is worth carrying there:
making one file cheap only moves the WALL if that file is on the slowest shard.**
The wall is `max()` of three jobs; a file cut from 129 s to 19 s on a shard that
was not the longest buys runner-seconds and no wall at all. #2172's remaining
three Class A files should be judged against the wall, not against their own
`tests` figure.

### Where the floor is now

`gate-checks` ran a median of **138 s** across the same ten runs (97–159 s). §L
named it *"the next floor under the gate wall"* when arguing the fourth shard
down; at 197 s the unit shards are still **59 s above it**, so that floor has not
bound yet and the fourth shard's case is unchanged.

### #2164's done-when, against the card's own words

| the card asked for | answer |
|---|---|
| a measured decision on **growth** (the isolation port) | **REFUSED with its number** on PR #2175: `import` is 43% of worker-seconds and the port would take the three-shard wall 210 → 151 s, against the risk of a non-isolated suite passing for the *wrong* reason. Re-sized, not dismissed. |
| a measured decision on **imbalance** (cost-weighted sharding) | **REFUSED on the prize**: perfect cost-weighting that no implementation can beat buys 28 s (9%) at two shards and 16 s at three, against the third shard's 89 s. |
| the before/after **at job grain on an ordinary PR** | **this section** — 299 s → 197 s, n=9 and n=10, with the instrument's control taken first. |
