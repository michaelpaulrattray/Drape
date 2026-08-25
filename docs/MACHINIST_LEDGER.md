# Machinist ledger — how long paid work takes, and what it costs the house

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

## Run 1 — 2026-08-26 08:33–08:56 AEST (Machinist, patrol #1, card #98)

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
| refines that failed and refunded | **8 of 52 (15.4%)**, 175 credits back | 32 of 222 (14.4%), 800 credits back |
| rolls partial or failed | 3 of 16, 240 credits back | 13 of 216 (6.0%), 1,440 credits back |
| candidates that survive as `failed content_policy` | 4 of 88 surviving | — |

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

- **Face scans**: 63 paid looks in 14 days (rows with `geometry.scanned:
  true`; 20 segmenter calls / $0.10 each = **$6.30**), 27 render-written
  carried-feature rows (`scanned:false`, $0.005 a region read). All time: 90
  rows over 72 faces — the scan table has held since 2026-08-17, so re-buys
  are structural now, not the 58-for-28 they were before it.
- 43 of the 90 rows landed on 2026-08-24 — the framing-trim and two-paths
  flips' day; the reader does not split paid/unpaid per day yet.

### D. Provider books

- **OpenRouter (text), the provider's own per-day books, account-wide**:
  **$159.41 over 14 days**, of which **$98.09 was 2026-08-15 alone** (10,107
  requests, 42.9M prompt tokens) — the campaign's own measured day (fable-693
  §1, fable-778 §2), not product traffic. Excluding it, **≈$4.70/day**; the
  next largest days, 08-20 $11.08 and 08-21 $9.73 at ~1,100 requests each,
  are court days too. All of it is `anthropic/claude-sonnet-5`. The rite's
  balance line read $7.52 of $250 at the last deploy (the founder's page
  already carries this).
- **fal (image), priced off OUR surviving rows** through the rite's own
  reader: **$10.96 over 14 days** — 88 roll renders $8.71, 20 refine renders
  $1.98, 53 SAM-3 reads $0.27, 3 birefnet $0.00 — a FLOOR, because only
  surviving variant rows contribute. ≈$0.78/day.
- **So text out-spends image about six to one on the account, and about
  five to one on product traffic alone** — which is the opposite of what
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

**One paid edit in seven fails and is refunded — 8 of 52 in the last 14
days, 32 of 222 over 60 — and the failure's CLASS is not durably recorded**
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

Reader: `scripts/machinist-ledger-read.mts` (new, branch `team/98-machinist-ledger`). Cards: #111 (the
worst number's brief). No instrument built beyond the reader the card ordered;
the client half of the charter is UNREAD and is named above rather than
assumed fine — its instrument is a Retro proposal, not a Machinist act, until
a card names it. Next run: ~2026-09-02, from this file.
