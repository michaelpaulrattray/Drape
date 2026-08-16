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

### Landing B — the sentence must survive the request

**This is the expensive landing and the one that needs the founder.**

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
| C | the dispatch swap behind its flag + idempotency proof | — |
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
