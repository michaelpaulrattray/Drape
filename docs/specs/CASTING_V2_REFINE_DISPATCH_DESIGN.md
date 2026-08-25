# Refine: stop holding the request — a design

**Status: DESIGN ONLY. No code on the paid path until Fable countersigns**
(granted fable-835 §2, design-first; the priority ruling that opened it rests on
the slots reading in `POST_SIGN_ROADMAP.md` §1).

**What it retires.** `castingV2.refine` is one long-held mutation: it awaits the
entire render before it answers, so the customer's exposure is the operation's
own life. Measured off production (opus-616, n=180 worker-settled refines, all
user 1 — the only account that has ever bought one): **median 121 s, p95 276 s,
max 390 s, and 1.7% answered past the observed ~305 s gateway wall.** Past that
wall the socket carrying the answer is gone before the answer exists. The money
is safe (LOST_CONTACT promises the refund, the recovery sweep keeps it); **the
reason and the way forward are lost.**

The bridge fix (`e459092d`) made those 1.7% arrive *late* instead of *wrong*.
This retires the class instead of covering it.

---

## 1. The seam, and why it is already drawn in the code

The swap is **not** "make refine async". It is a split, and the line it splits on
already exists in `refineCandidateCounted` with a comment banner over it:

```
/* ---- free refusals: nothing claimed, nothing charged ---- */
```

and a flag that tracks the crossing, `attempt.claimed`, written for a different
purpose (counting refusals that never reached a charge). **That the boundary was
already worth marking for an unrelated reason is the evidence it is a real
seam and not one drawn to suit this design.**

| | before the claim | after the claim |
|---|---|---|
| what happens | ownership, scope, catalogue and interpreter doors; **questions/re-asks** | charge, dispatch, render, verify, land |
| cost | free | 25 credits |
| duration | sub-second to a few seconds | **median 121 s, max 390 s** |
| crosses the wall | never | **1.7% of the time** |
| **after this change** | **stays synchronous, unchanged** | **returns a receipt; settles on the surface** |

**The free half must stay synchronous, and that is a design commitment rather
than a convenience.** A re-ask (`kind: "asked"`) is a question with an answer
path — the panel shows it and the customer types back. Deferring a free question
to a poll would add seconds to the one interaction that is currently instant,
and D-180 forbids a question that cannot be answered.

**The paid half returns a receipt:**

```
{ kind: "dispatched", variantId, operationId }
```

The render proceeds in the background; the outcome arrives on the surface like
every other durable fact.

## 2. What the surface already has, and the one thing it does not

Most of this is built. That is the good news and it is why the item is worth
opening at all.

**Already there:**

- **Durable operation rows** with a real lifecycle — `claimed → running →
  succeeded | partial | failed | recovery_required` — plus a 5-minute lease and
  a 30 s heartbeat (`markGenerationOperationRunning({ heartbeat: true })`), all
  written by the refine path *today*, inside the held request.
- **A recovery sweep** on a 60 s interval, started at boot
  (`server/_core/index.ts:327` → `operationRecovery.ts`), which already settles
  refines whose lease expired and refunds them. **The machinery for "an operation
  outlives its request" exists and is in production.**
- **A polling surface.** The bridge polls `generation.activeOperations`; the
  sheet separately polls its own variants.
- **An in-flight list, from the database rather than from client mutation
  state** (D-161): `pending` = variants with `status IN ('queued','dispatched')`,
  carrying the customer's own sentence and the version being redrawn. Built
  because a refine that outlived the panel used to become invisible and the
  founder bought the same edit twice.

**The one thing missing — and it is exactly the hole this design has to fill:**

```
casting_candidate_variants.status : queued | dispatched | ready | failed | expired
the sheet's two lists             : status = 'ready'      (the versions)
                                    status IN (queued, dispatched)  (pending)
                                                    ↑
                                    'failed' and 'expired' are in NEITHER
```

**A terminally failed refine leaves the payload entirely.** That is the same
sentence `outcomeShown.ts` opens with, and it is the reason the bridge had to be
taught to speak at all. Today the held request papers over it: the failure
arrives as a thrown error on the socket. **Take the socket away without filling
this hole and the outcome reaches nobody, always — a strictly worse product than
the 1.7% we are fixing.**

## 3. Ordering — this is the part that must not be got wrong

**Three landings, in this order, each safe on its own.** The whole risk of this
item is doing them in any other order.

### Landing A — the settled list (no paid-path change at all) — ✅ **BUILT AND LIVE**

✅ **The marker above was added 2026-08-24 and its absence was the finding.**
Landing B's heading carries a strike and Landing C's carries a tick, so a reader
scanning the three landings read A as the one that had not happened. It had:
`server/db/castingV2Variants.ts` holds the projection
(`inArray(castingCandidateVariants.status, ["failed", "expired"])`) and
`client/src/features/operations/surfaceOwnership.ts` says it in as many words —
*"Landing A gave the sheet a third list — recently settled terminal failures."*
It is unconditional, on either side of `CASTING_REFINE_DISPATCH_SCOPE`.

The sheet gains a **third list**: recently settled terminal outcomes, unread.
Server-side projection over `status IN ('failed','expired')` within a recency
window, scoped to the owner in the statement that reads (invariant 1), returning
the variant, the customer's own sentence, and the outcome.

Ships **dark to behaviour**: while the request still holds, the panel answers
from the mutation exactly as it does today, and this list is drawn only when the
panel has no answer of its own — which today is the 1.7%. **So Landing A alone
is already a fix for the class**, without touching the paid path.

**Two decisions inside Landing A, recorded here because both are load-bearing**
(ordered fable-837 §2):

- **INNER join on the operation, where the pending read uses LEFT.** The
  difference is the point. `listPendingVariants` must never lose a row to a
  missing operation: a charge is out, and silence there reads as *"nothing is
  happening"* — the D-161 defect that had the founder buy the same edit twice.
  The settled read has nothing to say without the operation, because **the
  operation IS the sentence**. A failed variant whose operation cannot be found
  has no outcome to report, and inventing one would be worse than staying quiet.
- **It does not filter on `landingAcknowledgedAt`.** That flag already has an
  owner: `GenerationOperationBridge` acknowledges every terminal operation
  within one poll of it settling. Keying the read on it would empty the list
  seconds after the outcome exists — and **always** after a reload, which is the
  case the read is for. A one-hour recency window bounds it instead and the
  surface owns whether it has been seen.

### Landing B — ~~the sentence must survive the request~~ **DELETED. It already does**

**This landing does not exist, and with it goes the migration, the column and
the founder ceremony.** Kept as a heading because the price changed and the
reason is worth reading.

The sentence already survives on **`generation_operations.publicMessage`** —
written on every terminal path, and
`finalizeClaimedGenerationOperationFailure` **throws** on an empty one. Verified
at the artifact against production rather than read off the code:

```
RETENTION  199 refine operations · oldest 13.4 days old and UNPURGED
           31 terminal failures still on the table, oldest settled 2026-08-04
COVERAGE   31 of 31 terminal failures carry a sentence · 0 missing
           6 distinct lengths, every one > 24 chars, up to 227
```

That last line also kills the cheap option on the data rather than on taste: the
sentence **varies per request**, so the `varchar(24)` `failureClass` could never
have reproduced it. One source, a second reader — the opposite of law 4's mirror.

**Price: four shifts and a founder ceremony becomes three shifts and no founder
gate** (four if §4's idempotency proof fails).

*The original reasoning is kept below, because it is why the third option was
worth looking for.*

**~~This is the expensive landing and the one that needs the founder.~~**

Today the *class* is durable (`failureClass`, `varchar(24)`) and the *sentence*
is not. The actionable half — *"came back twice with glasses still in the
picture… Try saying it a different way"* — is composed from the thrown error's
own message and exists only on the response and in the ledger's refund
description (`refundDescriptionFor`).

Two ways, and they are not equal:

- **(a) Derive the sentence from `failureClass` on read.** Free, no migration,
  law 4 (derive, never mirror). **But it silently downgrades the sentence**: a
  24-character class cannot carry "twice, with glasses still in the picture", so
  every outcome collapses to its category. That is the precise half this whole
  arc exists to deliver.
- **(b) Persist the outcome detail on the variant row.** A new nullable column.
  Costs a production migration — a founder ceremony — and it is bound by
  **migration-before-code**: the column lands first, the writer second.

**Recommendation: (b).** (a) would ship a fix that reads as complete and hands
the customer a worse sentence than the one they get today on the 98.3% path,
which is the shape of defect this program keeps paying for.

**Do not read the ledger's refund description to get the sentence.** It is a
receipt in a different register, written for support and reconciliation, and
binding the panel's copy to it would be a mirror that drifts (law 4) — and it
would put a money artifact on the rendering path.

### Landing C — the dispatch swap itself — ✅ **BUILT, flag-dark (countersigned fable-973)**

**What shipped, and where the seam actually went.** The paid block is three
thousand lines inside one `try`, so lifting it into a deferred function would
have re-indented all of them to express one sentence — *answer now, finish
afterwards*. Instead the attempt signals **outward**: `RefineAttempt` carries a
`dispatched` callback, fired at the first moment the receipt is TRUE (straight
after `markVariantDispatched`, which is when the row the panel's pending list
draws says so), and `refineCandidate` races that announcement against the
settled render. Flag off, nothing is ever set, nothing announces, and the code
that runs is the code that shipped.

Five arms in `refineService.test.ts`, each reddening alone under its own
sabotage: the held path unchanged with the flag off; the receipt arriving with
the **paint held open on a latch the test opens itself** (a receipt that merely
arrives fast is a receipt that might have waited); a background failure landing
durably on the rows; the census logged at SETTLEMENT with the render's own wall
clock; and the catch at the top of detached work.

#### ✅ WALKED IN THE RUNNING APP — one real paid refine, and one honest number

`scripts/drive-refine-dispatch-walk-disposable.mts`, against a dev server with
the flag armed, on the dev fixture account (verify-bot — never a customer):
25 dev credits and one render of house money.

```
ok  the answer came back before the render could have — the refine response
    arrived after 20.0s (a render is 120-280s)
ok  and it is a RECEIPT rather than a picture — the body carried "kind":"dispatched"
ok  the panel says the edit is running — the submit button reads "Refining…"
ok  and it does NOT claim an outcome it has not got — the outcome slot held null
ok  the render finished with nobody holding the request — the newest variant
    settled READY 79s after the ask, 59s after the answer
ok  and it was charged exactly once — balance 445375 → 445350
```

**The honest number is the 20 seconds, and it is not a disappointment — it is
the design.** The free half stays synchronous on purpose (a re-ask is a question
with an answer path, and D-180 forbids one that cannot be answered), so what the
customer still waits on is the interpreter and the doors, not the paint. On this
walk the request's life fell from 79s to 20s; on the population it falls from a
median of 121s and a p95 of 276s to whatever the free half costs — and the
**tail past the gateway wall goes away entirely**, which is the thing this
landing was bought for.

Photographed at both ends and looked at (law 6): at the receipt the blurred
frame carries her own sentence — *"colour her hair copper · in line · usually
three to four minutes"* — with the ghost chip spinning in the rail; afterwards
the picture is there, copper, same face, two takes in the rail, the box empty
and no stale outcome. `output/refine-dispatch-walk/`.

⚠ **Two instrument notes worth more than the arms.** (1) A dying render does
**not** reject the detached promise — `censusOfAttempt` returns the failure as a
value — so an arm that only kills the paint passes with every guard deleted.
(2) Even a genuine post-receipt rejection is not an *unhandled* one: the receipt
arrived through `Promise.race`, which has already attached handlers to the same
promise, so a late fault is **silently discarded** rather than thrown. The catch
therefore exists for the RECORD, not for the crash, and its arm asserts the log
line. Both were found by driving the sabotage rather than by reasoning.



Only now does the mutation stop holding. Behind its own scope flag
(`CASTING_REFINE_DISPATCH_SCOPE`, `users:1`, off by default and inert when off),
so **the held path remains intact and reachable at every moment**, and a park
mid-way leaves a working product rather than half a paid path.

## 4. Failure modes, including across a park

| mode | today | after | verdict |
|---|---|---|---|
| render outlives the gateway wall | outcome lost (1.7%) | outcome on a row, read whenever she returns | **the fix** |
| deploy lands mid-render | request dies, sweep refunds, ~6 min wait | **no socket to break**; sweep unchanged | **improved** |
| park mid-item | — | flag off ⇒ held path, unchanged | **contained by C's flag** |
| she never reopens the sheet | outcome lost with the socket | durable, waiting | improved |
| **double buy on retry** | long hold makes a retry unlikely | **a fast receipt invites one** | **NEW — see below** |
| outcome shown twice | — | needs an acknowledge/dismiss | precedent exists |

**The double-buy risk is the one this design introduces, and it must be closed
before Landing C, not after.** Today a customer who retries is usually still
watching a spinner. A mutation that returns in 200 ms makes a double tap, a
flaky network retry, or an impatient second click cheap — and each one is 25
credits and a render. `clientRequestId` and `assertClientRequestId` already exist
on this procedure; **what must be proven is that a repeat of the SAME
`clientRequestId` returns the first receipt rather than claiming a second
operation** — driven directly, not inferred from the field's presence. If that
proof fails, it is a fourth landing and it comes before C.

### ✅ THE PROOF IS DRIVEN — and it passes the question above while failing the one that matters (2026-08-17, opus-630; ordered fable-841 §3)

`scripts/prove-refine-idempotency-disposable.mts`, three arms through the REAL
claim seam (`refineCandidate` → `beginDirectOperation` →
`claimGenerationOperation`) against the dev database, everything downstream of
the claim stubbed so nothing is painted and no credit moves. The charge is
COUNTED at the pinned deduct, which is where each arm's first call is held so a
second call arrives while the first is genuinely claimed and charged.

```
CONTROLS  POSITIVE two different ids, sequential → 2 operation rows   saw 2  pass
          NEGATIVE a face that does not exist    → 0 ops, 0 charges   saw 0/0 pass

ARM 1  same id, sequential      operations 1 · variants 1 · charges 1
       → the design's question, ANSWERED YES: the replay returns the first
         receipt and claims nothing new.
ARM 2  same id, concurrent      operations 1 · variants 1 · charges 1
       → the second call is refused with "This action is already in progress.
         Operation b041b86c…" — the network-retry case is closed too.
ARM 3  TWO TAPS, different ids, same face, concurrent
                                operations 2 · variants 2 · charges 2
       → **the double tap buys twice.**

LEDGER unmoved in every run (129 rows, net 26,445 both ends); every operation
and variant the run created was deleted with the leftover count printed as 0.
```

Each arm reddens ALONE under its own sabotage — arm 1's second call given a
fresh id (→ NOT IDEMPOTENT, others unchanged), arm 2's likewise (→ CLAIMED
TWICE), arm 3's two taps given ONE id (→ refused the second tap) — so no
verdict here is a shared-state artifact.

**What this means for the price.** The named blocker is CLEARED: the
`clientRequestId` machinery does exactly what the design hoped, so no fourth
landing is owed for it. But arm 3 is the case a fast receipt actually invites,
and idempotency is structurally blind to it: **the client mints a fresh uuid on
every submit** (`CastingSheet.tsx:1422`), so a second tap is not a repeat of
anything. Today that is covered by the long hold — the panel is busy for ~200 s
and `refineBusy` folds in the server's pending list — and **the hold is what C
removes.**

### C's AMENDMENT — a `lockKey` on the candidate — ✅ BUILT 2026-08-18 (`1423e03a`), and this heading said NOT built for a week after

⚠ **THE CORRECTION FIRST, BECAUSE THIS SECTION'S OWN CHECK IS WHAT KEPT IT
WRONG (2026-08-25, foreman shift 3, issue #54).** The amendment below was
built the day after fable-974 ruled it: `refineService.ts` passes
`candidateLockPublicId` at the claim, `acquireCastingCandidateOperationLock`
resolves it to a row owned by the operation's user in the statement that reads
it and derives `casting-candidate:<internal id>`, the refusal is the spoken
customer sentence ("That edit is already being made — it finishes before the
next one starts. Nothing extra was charged."), and arm 3 of
`scripts/prove-refine-idempotency-disposable.mts` — tracked, not disposable
despite its name — is the regression. Taken on BOTH roads, not only behind the
dispatch flag, so the 2026-08-25 widening of `CASTING_REFINE_DISPATCH_SCOPE`
to `all` opened no double-submit window: the control was already live on
production. Re-driven the day the record was corrected — arm 3: two taps, two
ids, concurrent → operations 2 (one CONFLICT, never charged) · variants 1 ·
charges 1, ledger unmoved, cleanup 0.

**How a built control got filed as URGENT-missing a week later**: this
section's reproducible check was `grep -rn "lockKey" server/castingV2/*.ts`
returns nothing — and the ruled fix's caller DELIBERATELY never says that
word (the caller passes a candidate publicId; the server derives the key, so
there is no lockKey to grep for at the call site). The grep still reproduced
on 2026-08-24 and §9 below celebrated it as the exemplary row; the excavation
then filed issue #54 off it as an open money-path hole. **A negative grep must
name a token the BUILT thing would contain, not the token the unbuilt sketch
was called** — checked against the fix's actual shape the day it lands, or it
becomes a machine for re-discovering a solved problem. The suite now pins the
wire itself: `server/operationLockWire.test.ts`'s refine arm reddens if the
begin call stops passing `candidateLockPublicId`.

What follows is the section as it stood when the amendment was open — kept as
the record of why the lock has the shape it has.

Filed here rather than fixed (fable-841 §3d): the machinery already exists and
the concept is already in the tree, so this is a wiring decision that belongs to
C's own ruling rather than to the shift that found it.

- **What.** `beginDirectOperation` already takes a `lockKey` and answers
  `resource_busy` → `CONFLICT` when another operation holds it. The whole R7
  evidence family passes `model:<id>`. **No castingV2 caller passes one** —
  `grep -rn "lockKey" server/castingV2/*.ts` returns nothing — so roll, sign and
  refine are all unguarded at that seam. Refine would pass the candidate.
- **Price.** One argument at `refineService.ts:2954`, plus the arm-3 case added
  to this proof as a regression (it flips from 2 operations to 1), plus a
  customer-facing sentence for the refusal — the existing one ("Another
  operation is already changing this Cast") is written for staff, not for
  someone who tapped twice. **Half a shift.**
- **Not a client debounce.** The contract is at the wire; a disabled button is
  not a guard, and a second tab, a retried request or a slow network all get
  past it.
- #### ⚠ THE AMENDMENT'S PRICE WAS READ OFF A SIGNATURE — the lock refuses a refine

Driven 2026-08-18 (`scripts/prove-refine-lockkey-disposable.mts`, controls
first, rows deleted): `beginDirectOperation` takes a `lockKey`, and **the lock
itself would refuse every refine at two gates** — `assertOperationLockKey`
admits `^(model|board-item):[1-9][0-9]*$` and nothing else, and
`acquireGenerationOperationLock` builds its allowlist from the operation ROW's
`modelId`/`originItemId`, both of which a `castingV2.refine` claim leaves null.
Both refusals are plain errors rather than the translated `resource_busy`, and
both fire AFTER the claim: the one-argument version would have answered **500 on
every refine**. The negative control (a well-formed `model:<real id>` key against
that same claim) separates the empty row from the key's shape.

**Ruled fable-974 §2: the DERIVED candidate lock.** The caller passes the
candidate's `publicId`; a new function beside the existing one resolves it to a
row owned by the operation's user *in the statement that reads it* and takes
`casting-candidate:<internal id>` — one alternative added to the validator's
grammar, a key the caller never supplies and cannot forge. Stronger than the
road it copies (the `model:` path trusts a number the caller handed the claim);
release needs nothing new, because all four finalizers already delete the lock
row with the operation. Price: **about one shift, not half.**

**Open, and it belongs to whoever rules C:** whether the lock is the right
  answer at all, or whether a fast receipt should simply return the IN-FLIGHT
  operation's receipt to the second tap — which is friendlier (the customer sees
  their edit running rather than an error) and is the same shape as the replay
  arm 1 already proves. That choice is a product decision about what a double
  tap MEANS, not a mechanical one. ✅ **Answered by the build (`1423e03a`): the
  lock, refusing free in her own voice** — the second tap gets the spoken
  sentence above, its operation row finalized CONFLICT in the same statement,
  nothing charged. The friendlier return-the-receipt shape was not taken and
  remains available as a later product refinement if a real customer ever meets
  the sentence and finds it wanting.

**Acknowledgement.** A settled outcome must be shown once and then dismissed, or
the panel re-announces a week-old failure every time the sheet opens.
`acknowledgeGenerationOperation` and `dismissGenerationOperationLanding` already
exist for operations and are the precedent to follow rather than reinvent.

## 5. What the panel shows between dispatch and settlement

**Almost nothing new is owed here, which is the cheapest part of the item.** The
waiting state is already built and already reads from the database:

- the `pending` list (D-161) drives the busy panel and the rail's ghost chip;
- past `LONG_WAIT_MS` a still-casting tile says so and names the outcome, so the
  wait reads as supervised rather than broken;
- the spinner ring on the blurred chip shipped after the founder said it read as
  broken rather than working.

The one copy change: **the running line's promise moves from "your answer is
coming back on this request" to "it is being made, and it will be here."** The
founder has already ruled the running copy honest at *"usually three to four
minutes"* with the unusual note at ~5 minutes, so this design does not reopen it.

## 6. How it composes with the bridge fix (`outcomeShown`)

The bridge fix and this item are the **cover** and the **retirement** of one
class, and they compose in one direction only.

`outcomeShown` is a per-request, in-memory client fact — *did the surface show
the SERVER's sentence or its own fallback* — deliberately not surviving a reload.
`bridgeShouldSpeak` speaks only when the true sentence reached nobody.

After Landing C, a paid refine's outcome **never** arrives on the request. So:

- `markOutcomeShown(requestId, "server")` on the paid resolve becomes vacuous —
  there is no paid resolve;
- the surface itself now represents terminal refine failure (Landing A), which is
  precisely the condition under which `surfaceOwnership` would put
  `castingV2.refine` **back on the kind list** — the list it was taken off, for
  the reason that the surface could not represent that outcome. **The fix is not
  undone by this; its own stated premise is what changes.**

**Sequencing, and it is a hard constraint:** the bridge keeps speaking for refine
until Landing A is live and proven. Retiring it earlier reintroduces the exact
1.7% by hand. Retiring it *later* costs only a duplicate sentence, which is why
the safe order is A → B → C → retire.

⚠ **THAT CONDITION IS MET — Landing A is live (see its heading), so the `until`
above no longer holds anything back.** The clause is kept because the ORDER it
names is still the order, and the *live and proven* half is worth reading as two
halves: A is live, and whether it has been PROVEN against a real lost socket is a
different question this document does not answer. B is deleted, C is built and
flag-dark at `users:1`, so what remains of the sequence is the retirement itself.

The free half keeps `outcomeShown` unchanged and still needs it: a free refusal
still answers on the request and can still, in principle, lose its socket.

## 7. Price, honestly

| | work | gate |
|---|---|---|
| A | settled-list projection + panel read + tests | — |
| B | migration, writer, sentence derivation | **founder ceremony** |
| C | the dispatch swap behind its flag + ~~idempotency proof~~ **(the proof is DONE and passed, 2026-08-17 — see §4)** + the double-tap answer, which is a decision before it is a build (§4's amendment, ~half a shift if it is the `lockKey`) | — |
| D | drive both roads in the running app, sabotage the driver, re-read the wall-crossing rate | — |

**Four shifts and one founder ceremony**, assuming the idempotency proof in C
passes; **five if it does not** and the repeat-receipt has to be built.

**What is deliberately NOT in this price:** a job queue. There is none today —
`createRoll` also awaits its whole render, and the only background execution in
the app is the 60 s recovery sweep and the cleanup worker. This design does not
introduce a queue; the render continues in the same process that received the
request, and the customer simply stops waiting on it. **A queue is a different,
larger item** and pretending otherwise would be the third time this program
priced an architecture change as a one-liner.

## 8. Open questions for the countersign

⚠ **TWO OF THE THREE ARE ANSWERED, AND BOTH ANSWERS ARE INSIDE THIS FILE
(2026-08-24).** The section keeps its questions and its recommendations because
the reasoning is the record of how the answers were reached — but a heading that
says *open* about settled questions is the shape that parks a decision somebody
has already made. (1) **Landing B's column** is moot: B is struck DELETED above,
along with its migration and its founder ceremony, because the sentence already
survives on `generation_operations.publicMessage`. (2) **Landing A alone first**
was the executor's recommendation and it is what happened — A is live and
unconditional, B never existed, C is built and flag-dark. (3) **`createRoll`** is
the one still genuinely open, and its answer is still *not yet, and here is why*.

1. **Landing B's column, or the derived sentence?** The recommendation is the
   column and it costs a founder ceremony. If Fable prefers (a), the fix ships
   sooner and the sentence is worse, and that trade should be made out loud.
2. **Does Landing A ship on its own first?** It is a real fix for the 1.7% with
   no paid-path change, and it is the safest thing in this document. The
   executor's view: **yes, ship A alone and measure it** before committing to B
   and C.
3. **Does `createRoll` follow?** A roll takes a bit over a minute and does not
   cross the wall, so it is not owed. Named here so the answer is "not yet, and
   here is why" rather than an omission.

---

## 9. The stale-row reading this document was swept by (2026-08-24, opus-1175)

Six candidate state claims read, **two stale**, both repaired above: Landing A's
missing status marker (with §6's `until` clause that depended on it) and §8's
heading over two answered questions.

⚠ **The best row in this document is a HOLDS and it earned the sweep's
respect**: *C's AMENDMENT — a `lockKey` on the candidate, and it is NOT built …
`grep -rn "lockKey" server/castingV2/*.ts` returns nothing.* That grep was run
again on 2026-08-24 and **still returns nothing**. A claim that ships with its
own reproducible check, and reproduces two weeks later, is the shape every row
in every document here should aspire to — it cannot go quietly stale, because
checking it is one command that the document itself supplies.

⚠⚠ **AND THAT ROW WAS FALSE ON BOTH DATES IT REPRODUCED — the sharpest
correction in this document (2026-08-25, issue #54).** The amendment had been
BUILT since 2026-08-18 (`1423e03a`), six days before the sweep re-ran the grep
and celebrated it. The grep reproduced because the ruled fix's caller never
contains the word it searches for: fable-974 §2's whole design is that the
caller passes a candidate publicId and the SERVER derives the lock key, so
`lockKey` is absent from `server/castingV2/` by construction, control present
or not. A reproducible check is only as good as what its token would prove —
this one tested the unbuilt sketch's vocabulary and could not see the built
thing, which makes it worse than no check: it lent six days of false
confidence, survived a sweep, and produced an URGENT money-path issue about a
control that was already live on production. The durable repair is not a
better grep but the suite arm (`server/operationLockWire.test.ts`, the refine
arm), which reads the call site's actual arguments. See the correction block
under the amendment's own heading in §4.

⚠ **This sweep is PHRASE-ANCHORED and is a FLOOR, not coverage.** Measured on
the one population where truth was already known (V3B's six stale rows, found by
hand): a mechanical not-yet-phrase grep matched **three of the six** while
producing nearly three times the noise, and one of the three it missed carried no
stale-claim word at any point. The per-row read of this document is not retired
by this and is not claimed to be.
