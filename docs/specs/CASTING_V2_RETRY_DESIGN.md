# The Retry button — one failed slice, rendered again (#122 shape 1)

**Status:** design + build, one PR, 2026-08-27 (foreman-31). Dark behind
`CASTING_RETRY_SCOPE`.

## The founder's word (verbatim, #122, 2026-08-26 evening)

> *"should we also allow a try option aswell?"* — YES, two shapes, per slice:
> (1) **Retry** on engine-error/didn't-arrive tiles — same prompt, one slice,
> 20 credits, refunded again on failure; ships with the chips. (2) **"Retry
> with softer wording"** on content-filter/copyright tiles — the rewrite road
> (#129/#93) … Both per slice, never per roll; a retry is a paid render and is
> never automatic beyond the loop's own single built-in retry.

This document is shape (1) and nothing of shape (2). Shape (2) waits on
#129/#93 exactly as his sentence says.

## What a customer sees

A tile that says **Engine error · refunded** (or **Didn't arrive · refunded**)
gains one quiet button: **Retry · 20 credits**. Tapping it charges 20
credits, the tile goes back to *casting*, and one render runs with the SAME
words that tile was painted from. It lands in the same slot — same number on
the sheet — or it fails again and the 20 credits come back, with the chip
saying why. A second tap while the first is running costs nothing and is told
so. The button is never shown on a CONTENT FILTER tile, a NOT A PORTRAIT tile,
a NOT CHARGED tile, or any tile of a cancelled roll.

Worked example: roll 240, slice 5 fails with a fal timeout → tile reads
*Engine error · refunded*, 140 credits net. She taps *Retry · 20 credits* →
120 net, tile 05 casts for ~60 s, lands → the sheet is 8/8 and the roll's
record moves from *partial* to *complete*. Had it failed again: 140 net, the
same tile, the same button.

## Measured population (why it is small and why it exists anyway)

Production census 2026-08-26 (#122) and the refusal patrol 2026-08-27 (#129):
**every failed candidate ever (13) is `content_policy`**; no engine-error tile
has been written on production. So shape (1)'s live population is ZERO today.
It is built because it is his order and because the classes it serves are
real writers on the roll road (`rollService.ts`, `rollRecovery.ts` — transport,
timeout, rate limit, provider account, capability, unknown, unrecovered) that a
provider outage would fill overnight. The patrol's own finding — that a
same-text retry rescues content-filter refusals 3/8 (roll 222) — is a
QUESTION for him (a Desk card), not a widening this build takes on its own:
his sentence puts content-filter tiles on shape (2).

## The one design decision: the failed row IS the slot

A sheet's slot is `(rollId, position)` and it is UNIQUE
(`uq_casting_candidates_roll_position`). A retry is *this tile again*, so the
retry **re-uses the failed candidate row** rather than inserting a sibling:

- `failed → queued` by CAS (`resetCandidateForRetry`), in ONE statement that
  also clears `failureClass`, `provider*`, and sets `pointsCost` to the retry
  price. Losing the CAS (a concurrent retry, a sweep, a cancel) is a FREE
  failure at the claimed finalizer — nothing charged.
- `attemptCount` (already on the row, incremented by `markCandidateDispatched`)
  becomes the honest attempt number. Migration: **none**.
- The render is the roll road's own `dispatchCandidate` — the same smoke
  alarm, trim, store, thumbnail, landing CAS, born-ink mint and per-slice
  refund. Nothing about what a delivered frame is changes; only who is paying
  for this one attempt.

Why not a new row: a sibling at the same position violates the unique index;
at a new position it is a ninth tile, which is a different product.

## Money — the retry is its own operation

- Kind **`castingV2.retry`** (new member of `GENERATION_OPERATION_KINDS`; every
  exhaustive map — replay family, landing recovery, public-result strategy,
  feature authority, stale recovery — gains its row, which the type system
  forces).
- Claim: `beginDirectOperation({ kind, clientRequestId, candidateLockPublicId })`
  — the candidate lock (#54's shape, ruled fable-974) is the double-tap cover
  AT THE WIRE: two taps, two request ids, the second answers CONFLICT free.
- Charge: `deductCredits(userId, 20, "generation", "Casting retry (pending)",
  operationChargeReference(retryOperationId))` — pinned to the operation, so a
  crash-replay cannot charge twice. Price is `CASTING_V2_RETRY_PRICE_CREDITS =
  CASTING_V2_COSTS.rollCandidate` (his "20 credits" IS one slice; derived,
  never a second literal).
- Refund on failure: `dispatchCandidate` refunds `candidate.pointsCost` under
  `candidateChargeReference(retryOperationId, candidatePublicId)` — a DIFFERENT
  reference from the original slice's (which was keyed on the roll's
  operation), so the original refund and this one can never collide or
  double-pay, and a retry of a retry gets a third.
- Charge failure (not enough credits): the row goes back to `failed` with its
  ORIGINAL failure class restored (not `unpaid` — the original refund stands
  and the tile must keep saying so), the operation closes as a free failure,
  the customer sees the credits sentence.
- Sequence, in the roll's own order: admit (free) → claim → reset CAS →
  running → pinned deduct → dispatch → settle → finalize. Rows before money;
  dispatch after money.

## Admission (all free, before the claim)

1. Flag: `CASTING_RETRY_SCOPE` off for this user → `NOT_FOUND` (the ink
   studio's shape). The config answers `retryEnabled` so the button is never
   drawn for an account that would be refused.
2. Candidate owned (in the WHERE), `status = failed`.
3. Failure kind retryable: `isRetryableFailure(candidateFailureKind(row.failureClass))`
   — **`engine` and `unknown`**, declared ONCE in `shared/candidateFailure.ts`
   and read by both the server door and the tile (working law 4). Content
   filter / render fault / unpaid refuse free with a sentence naming shape (2).
4. The roll is terminal and not cancelled (`complete` | `partial` | `failed`).
   A failed slice on a still-generating roll waits — the roll's own finalizer
   is about to write the roll status from its own settlements, and cancel is
   live on it. (The tile disables the button while the roll is casting.)
5. The row has a prompt (`internalPrompt.prompt`) — every roll candidate has
   one (#129 measured 144/144); a row without one refuses free.

## What is rendered

Prompt: the row's own `internalPrompt.prompt`, byte for byte. Size/quality:
the compiler's constants (`1024x1536`, `medium`), the same values every roll
uses; trim: `CASTING_FRAMING_TRIM_SCOPE` read ONCE for this request, exactly
as a fresh roll reads it. Born ink: `statedInk` read back from the roll's own
persisted `compiledBrief.intent.statedInk` (null when absent), so a retried
face keeps the disclosure its siblings got.

## After the render

- Ready → recompute the roll's status from its candidates: all `ready` →
  `complete`, else `partial` (`setRollStatus` gains a `from` that admits the
  terminal pair; `failed → partial` on the first rescued slice). Operation
  `succeeded`, charged 20, refunded 0.
- Failed → the tile shows the new class and the button again (if retryable);
  roll status untouched; operation closes `PRECONDITION_FAILED` with *"That
  tile didn't arrive again. 20 credits were refunded."*, charged 20, refunded
  20. `expired`/`skipped` cannot happen on a terminal roll (cancel is a no-op
  there) and are handled as failed-with-refund-if-owed anyway.

## Recovery — a crashed retry

The operation row carries no payload, and no roll points at a retry
operation. The link is the **candidate lock row** (`generation_operation_locks`,
`lockKey = casting-candidate:<id>`, unique per operation), written at the claim
BEFORE any money and deleted only by the finalizers — so for the whole window
recovery cares about it exists. `recoverCastingV2RetryOperation`:

- no lock row → `recovery_required` (fail closed, support reads it; never a
  guessed refund);
- candidate `ready` with bytes → `durable_success`;
- candidate settleable (`queued`/`dispatched`/`ready` without key) → CAS to
  `failed:unrecovered`, then: charged and not yet refunded → refund the
  difference under the retry reference (`readOperationLedger`, the roll's own
  reader, over one candidate) → `paid_failure`; not charged → `free_failure`.
  The row carries `unrecovered` either way — the ORIGINAL class is gone with
  the reset and the service is dead, so nothing can put it back; the tile
  reads *Engine error · refunded*, which is true of the original slice, and
  keeps the button. A known imprecision, stated in the adjudicator's docblock.
- candidate already `failed` (the service settled it before crashing) →
  ledger decides: charged & refunded → `paid_failure` with no second refund;
  charged & not refunded → refund now → `paid_failure`; not charged →
  `free_failure`.
- candidate in any other state (`discarded`, `signed`, `expired`,
  `cancelled`) → `recovery_required`: not this road's to settle.
- the row's owner is re-proven in code after the owner-scoped read, because
  this adjudicator moves money on the strength of that row.

## The flag

`CASTING_RETRY_SCOPE` — `off`/absent, `all`, `users:<ids>`; parent
`CASTING_V2_SCOPE` (a retry needs a roll to retry). Off: procedure answers
`NOT_FOUND`, config `retryEnabled: false`, not one line of the road runs.
Production lands `off` (`productionFlagPositions.mts`); `users:1` on his word.

## Tests (the arms that can fail)

Service (`retryService.test.ts`, the roll suite's fakes): content-filter
refused free with no claim; generating roll refused free; happy path
(sequence, 20 charged, row ready, roll `partial → complete`, receipt
succeeded); engine failure (20 charged, 20 refunded under the RETRY
reference ≠ the roll's, row failed with class, roll status untouched); charge
failure restores the original class and closes free; lost reset CAS closes
free with no charge; flag off → NOT_FOUND before any read. Recovery
(`retryRecovery.test.ts`): no lock → recovery_required; landed → durable;
dispatched + charged → refunded once, finalizer failure; dispatched +
uncharged → free_failure; already-refunded → no second refund. Kind maps:
the existing exhaustive-map suites redden until every map names the kind.
Sabotage: drop the reset CAS predicate → the "lost CAS" arm reddens.

## Spend

Build: $0. Drive: one dev roll under a failing fake is not possible through
the real entrance, so the drive is (a) the service suite and (b) a real dev
roll with the engine forced to fail one slice by a disposable harness, then a
real retry through the entrance — estimate ≤ $0.60 house, 0 credits. Actuals
on #122.

## What the drive found (2026-08-27, dev, seven real renders, ~$0.39 house)

The server half was right on the first tap: 20 charged under the retry's
own reference, the candidate lock held, the row `dispatched` (attempt 2),
landed at 58.8 s, roll `partial → complete`, operation `succeeded`, lock
released. **Four findings were on the client, each visible only at the
frame or the wire, each needing a live render to see** — which is why the
estimate (≤ $0.10) became ~$0.39:

1. **The button stretched to the column** (282 px). `align-self: flex-start`
   — the gear needed the same line (foreman-27).
2. **A single one-second nudge saw the old row.** Admission, claim, lock and
   reset are several round trips to the remote database; the row moves to
   `queued` after more than a second, so the tile sat on its failed face for
   the whole render.
3. **Nudging every two seconds never landed a refetch.** `getRoll` is ~2.2 s
   against the remote database, and react-query CANCELS the refetch in flight
   on each invalidate — measured: server said `casting` from 6.5 s, the tile
   flipped at 26 s, exactly when the nudging stopped and the last refetch
   completed. And `beginMutation` was the wrong tool on top of that: the
   store's `pending` set makes a tile IGNORE poll data until its mutation
   settles (right for a keep, wrong for a tile whose point is to change state
   mid-flight). The shape that works: `retrying` re-opens the roll query's own
   `refetchInterval` for the life of the request. Casting at 5.1 s on the
   final drive.
4. **A retried tile on an old sheet read "taking longer than usual" from its
   first second**, because the overdue caption is derived from the ROLL's age.
   A retry is on its own clock now (`retrying[id]` holds its start).

The second-failure path (refund under the retry reference, the chip back
with the new class, the button back) is proven by the service suite's fakes
and NOT at the real engine — a real engine cannot be told to fail one slice.
Declared here rather than implied by the frames.

## Known imprecisions (stated, not fixed)

- A charge that does not land restores the original **class** but not the
  original provider provenance (`provider`, `providerModel`, `providerRef`
  are cleared by the reset and not restored). Chip and refund read the class
  only; the loss is diagnostic (second review of #151, note 3).
- A true concurrent double tap from a second tab meets the candidate lock's
  shared sentence, which calls the retry an "edit" (evidence pack, last row).
