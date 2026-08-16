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

### Landing A — the settled list (no paid-path change at all)

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

### Landing C — the dispatch swap itself

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

### C's AMENDMENT — a `lockKey` on the candidate, and it is NOT built

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
- **Open, and it belongs to whoever rules C:** whether the lock is the right
  answer at all, or whether a fast receipt should simply return the IN-FLIGHT
  operation's receipt to the second tap — which is friendlier (the customer sees
  their edit running rather than an error) and is the same shape as the replay
  arm 1 already proves. That choice is a product decision about what a double
  tap MEANS, not a mechanical one.

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
