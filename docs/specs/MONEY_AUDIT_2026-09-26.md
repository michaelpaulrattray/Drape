# Drape money-road audit — billing, credits, and the charge/refund layer

**Status:** current money-road document. Sibling of `docs/specs/SECURITY_AUDIT_2026-07-25.md`,
which it does not supersede — the July audit covers access control and the July findings; this
covers the money roads only, and the two are read together.
**Audit date:** 2026-09-26. **Tree:** `fa8ac509`. **Seat:** Warden, patrol #5 (`docs/WARDEN_LOG.md`),
card #1225, run as builder seat `seat2-20260926-171737`.
**Ordered by:** the founder, 2026-09-25 (terminal), verbatim: *"doesnt need to re-run now by it can
definitely land on the wardens table for whenver the warden runs"*.
**Method:** read-only source review at the bytes, every road's history read at `git log -S` rather
than asserted, plus the access-control and money suites driven. **No money was spent, no credits,
no production write.**

---

## Why it was due

The July audit predates every money rule now running. Since it was written: retries arrived on the
Sign road (#1208, #1220 — *you pay 50 for each view you keep*, which makes a **re-charge of a
refunded slice** a new shape on the credit layer); unjudged delivery became a charged state with no
verdict on the row (D-246); deploy-on-merge (#508) began settling in-flight paid work mid-deploy;
and every scope flag that went home under N2 widened a spendable surface from one account to all.

---

## The verdict in one line

**No live money loss was found, and no finding here can take or lose a customer's credits today.**
Four findings are real and none of them is a leak: two are enforcement gaps that a future change
would walk into, one is a second line of defence weaker than the line it sits in front of, and one
is an unreachable trap. The fifth entry is a standing decision, not a defect. What the layer does
well is recorded in **Verified healthy** so the next run does not re-read it.

| id | finding | severity | class | road |
|---|---|---|---|---|
| W5-A | Every credit **price** declaration sits outside both halves of the money-surface classifier | medium, latent | derived-list gap (working law 4) | **never covered** — read at `git log -S` |
| W5-B | The two **staff** procedures that move money carry open input schemas | medium | enforcement asymmetry | **never closed** — the 2026-08-23 sweep closed the customer's side only |
| W5-C | The Stripe webhook event-table idempotency is check-then-act and **fails open** | low, absorbed | check-then-act + fail-open (invariant 7's second clause) | wired, live, weaker than the layer beneath it |
| W5-D | Two **non-unique charge-reference fallbacks** | low, unreachable | dead defensive fallback | **path ONE — never reachable**, read at the caller's type |
| W5-E | No application-side fraud cap on credit purchases | decision, not a defect | — | deleted 2026-08-19 by founder-stated default |

---

## W5-A — every credit price sits outside the money-surface classifier

**The finding.** `.github/money-surfaces.sh` declares what this repository calls a money diff, in
two halves: `MONEY_PATHS` (where money is stored and bought) and `MONEY_SYMBOLS` (where money is
decided). **Neither half covers the modules that declare what a customer is charged.** Measured at
the tree, running the real declaration against each file:

| module | on `MONEY_PATHS` | lines naming a `MONEY_SYMBOLS` primitive |
|---|---|---|
| `server/casting/castingCreditCosts.ts` | no | **0** |
| `server/wardrobe/creditCosts.ts` | no | **0** |
| `server/casting/packagePricing.ts` | no | **0** |
| `client/src/features/casting/castingPrices.ts` | no | structurally excluded (see below) |
| `client/src/features/casting/constants.ts` | no | structurally excluded (see below) |

`server/casting/castingCreditCosts.ts` is the table holding `rollCandidate: 20`,
`CASTING_V2_ROLL_PRICE_CREDITS` (160), `CASTING_V2_REFINE_PRICE_CREDITS` (25),
`CASTING_V2_RETRY_PRICE_CREDITS` and the Sign decomposition — the numbers this program quotes most,
and the numbers a customer is actually billed.

**So a PR that changes what a customer pays — a roll from 160 to 200 — earns no `founder-review`
label and no full-CLAUDE.md reading, and merges on the gate alone.**

**The client half is excluded structurally, not by accident of pattern.** The gate's symbol reading
is `git diff -G"$MONEY_SYMBOLS" --name-only … -- server shared` (`.github/workflows/gate.yml:360`):
it is scoped to `server` and `shared`, and `MONEY_PATHS` has no `client/` entry.
`client/src/features/casting/constants.ts` holds a deliberate second copy of `CREDIT_COSTS` —
CLAUDE.md keeps it in the Atlas price list *because* of working law 4, on the stated ground that
"a price list that cannot show you a second copy of the prices cannot show you the thing about
prices that most matters". **That copy can be edited alone, and nothing reads the diff as money.**

**The class.** This is the same defect the symbol half was created to fix, one step over. #958's own
measurement found that paths alone caught 4 of 60 PRs and "NOT ONE credit-refund fix was among
them", so a symbol reading was added for where money is *decided*. **Where money is *priced* was
never added.** A file-path list is the second list working law 4 warns about; this is that list
still missing a member.

**The road: never covered, and the evidence is negative rather than asserted.**
`git log -S "castingCreditCosts" -- .github/money-surfaces.sh .github/workflows/gate.yml .github/workflows/review.yml`
returns **nothing** — no price module has ever been on any reader, on any branch, at any time. The
declaration file has exactly one commit in its history (`a71cada0`, #958/#986), and that commit is
where `MONEY_PATHS` was last widened. This is the gentlest of the three roads: written and wired for
other surfaces, this half never written.

**Why it has not bitten yet, stated so the severity is honest.** Driven over every commit touching a
price module since 2026-08-01 — for each, the real classifier against that commit's own file list:

```
caught  0a70840f  retire the POINT_COSTS alias                      (paths=1 symbols=1)
caught  b161ad7e  retry: one failed sheet slice rendered again       (paths=1 symbols=3)
caught  3b700956  Reapply "the refinement engine"                    (paths=0 symbols=2)
caught  e68cabda  Revert "the refinement engine"                     (paths=0 symbols=2)
caught  b7c69473  the refinement engine — one paid edit, one unit    (paths=0 symbols=2)
caught  dbac7383  the Sign ceremony                                  (paths=2 symbols=7)
```

**Six of six were caught — and every one of them only because a new price shipped beside the
machinery that spends it.** A price is introduced together with its refund adjudicator, so the
symbol half catches the commit for a reason that has nothing to do with the price. **A pure price
change has never happened in this repository, so the gap has not been paid for.** That is luck
rather than design — the same shape as the bug-report exception, whose live population at the fix
was zero rows all time — and it is the argument for closing it now rather than after the first
repricing.

**The fix, and what it must not be.** Add the price-declaring modules to `MONEY_PATHS`, and decide
deliberately whether the client's copy joins them (which means the symbol reading's
`-- server shared` scope, or a path entry, or both). ⚠ **Not a widening to whole directories** —
#958 measured `paths + whole casting dirs` at 17 of 60 PRs and rejected it as too noisy to be read.
The price modules are five named files. `server/moneySurfaceClassifier.test.ts` holds both workflows
to sourcing the one declaration and must be driven with the change.

---

## W5-B — the two staff procedures that move money carry open input schemas

**The finding.** Read at the bytes, and the Atlas raises both as `non-strict-input`:

- `server/routes/admin/users.ts:393-400` — `adjustCredits: adminProcedure.input(z.object({ userId, amount, reason }))` — **no `.strict()`**. This is the procedure that adjusts any user's credit balance: the largest single money authority in the product.
- `server/routes/admin/changeRequests.ts:47-52` — `reviewChangeRequest: adminProcedure.input(z.object({ id, action, reviewNotes }))` — **no `.strict()`**. This is the approval that executes a money change request.

Beside them, on the same reading: `admin.getChangeRequest`, `admin.listChangeRequests`,
`moderator.getMyChangeRequests`, `credits.checkBalance`, `credits.getTransactions`, and the six
`wardrobe.*` procedures that spend through `withAtomicCredits`.

**The class: an enforcement asymmetry.** On 2026-08-23 the five public endpoints and the five
billing procedures were closed, each read at its call sites first, and CLAUDE.md's rule going
forward is `.strict()` "on all new code and all public/auth/billing schemas now".
**`admin.adjustCredits` is a billing schema by any reading of that sentence, and the sweep did not
reach it** — the rule was applied to the customer's side of the money and not to staff's.

The severity is bounded and stated: `.strict()`'s absence means an unknown field is silently
dropped, not that a known field is misread, so this is not directly exploitable today. It is the
posture, not a hole.

**The road: never closed.** Both procedures have carried an open schema since they were written; the
2026-08-23 commits touched `billing.ts` and the public five, and neither admin module.

**The fix.** `.strict()` on both, call sites read first — the same discipline the billing five got,
and for the same reason: tightening a schema can reject an in-flight client. ⚠ **And the removal
contract now applies to these too** — CLAUDE.md's rule that a money input field is removed only
after clients have stopped sending it for one full deploy, never in the commit that stops sending it.

---

## W5-C — the Stripe webhook event-table idempotency is check-then-act and fails open

**The finding**, three properties at `server/stripe/webhooks.ts`:

1. **It fails open.** Lines 131-134: `catch (idempotencyErr) { … '[Webhook] Idempotency check failed, proceeding' }`, with the comment *"If idempotency check fails, proceed anyway (fail open)"*. A database blip during the SELECT means a replayed event is processed again. Invariant 7's second clause is explicit that a control "must refuse — not allow — when a dependency is missing or unconfigured".
2. **It is check-then-act.** The SELECT (116-130) and the INSERT (178-180) sandwich the handler switch, so two concurrent deliveries of one event can both pass the check. Stripe retries deliveries and can deliver concurrently.
3. **The record swallows its own failure.** `recordProcessedEvent` (191 onward) is wrapped in its own try/catch and is only called `if (result.success)`, so a handler that succeeded while its bookkeeping insert failed will be replayed.

**The mitigation, measured rather than assumed — and it holds.** Every money effect on the Stripe
road is keyed on a **deterministic** reference, so a replay is absorbed one layer down:

| effect | reference | at |
|---|---|---|
| change-request refund deduction | `cr-stripe-refund:${changeRequestId}` | `webhooks.ts:1035` |
| refund-failed restore | `cr-stripe-refund-failed:${changeRequestId}` | `webhooks.ts:1036` |
| chargeback freeze | `dispute_${dispute.id}` | `webhooks.ts:1121`, `:1259` |
| dispute-won restore | `dispute_restore_${dispute.id}` | `webhooks.ts:1260` |
| plan-change settlement (grant and unwind) | `settlementLedgerRef(stripeInvoiceId)` | `planChangeSettlement.ts:109` |
| the periodic credit grant | `stripe-invoice:${invoice.id}` | `webhooks.ts:724` |

The ledger's unique `(userId, referenceId)` index arbitrates each one: a duplicate **add** returns
success with `duplicate: true` and pays once (`server/db/credits.ts:195-204`), and a duplicate
**deduct** is **refused** outright — `success: false, error: "Credit charge already recorded"`
(`server/db/credits.ts:186-193`). Every caller above reads `.duplicate` before counting money as
moved. The grant itself goes through `refreshMonthlyCredits`, which uses the invoice-derived
reference as its ledger reference and classifies the duplicate on the unique-index error
(`server/db/billing.ts:113-200`).

**So this is a hardening item, not a loss**, and the honest framing is that the event table is a
cheap first pass whose three weaknesses are covered by a stronger mechanism beneath it. It is still
worth closing: the first pass is what a future handler with a *non*-deterministic effect would be
relying on, and nothing on the request path says so.

**The fix.** Make the check fail **closed** — a handler that cannot read the event table refuses,
and Stripe redelivers, which is the same "fail loud so it is visible" shape this file already chose
for the unreadable-period case at `:675-687` — and let the unique index on
`stripeWebhookEvents.eventId` arbitrate rather than a prior SELECT, which is the pattern the credit
ledger already uses two modules over.

---

## W5-D — two non-unique charge-reference fallbacks, unreachable today

**The finding.** Two paid roads default their charge reference to a value that is **constant per
model** rather than per invocation:

- `server/casting/refreshSlots.ts:240` and `:254` — the fallback is `legacy-refresh-` followed by the model id
- `server/casting/mintPackage.ts:627` — the fallback is `legacy-mint-` followed by the model id

Because a duplicate deduct **refuses** (W5-C's table), reaching either fallback twice for one model
would leave the customer's second refresh or mint permanently refused with *"Credit charge already
recorded"* — **a dead button, not a money loss.** The money direction is safe; the customer
direction is not.

**The road: path ONE — never reachable, read at the caller's type rather than at a grep.** The only
production caller is `refreshSlots: protectedProcedure`
(`server/routes/generation/castingExport.ts:1040-1049`), which passes `started.chargeReferenceId`;
`started` comes from `markGenerationOperationRunning`, whose return type is
`Promise<{ operationId: string; chargeReferenceId: string }>` — **non-optional** — and whose value is
`operationChargeReference(input.operationId)` (`server/db/generationOperations.ts:996`, `:1010`).
Unique per operation, so the fallback branch cannot be taken from production today.

**It is filed rather than shrugged at because it is a two-instance class, not an instance** (working
law 7): the same shape in two modules, and its failure mode is invisible — no error, no failing
test, and a customer who simply cannot press the button again. The trap arms itself the moment
anyone makes the field optional again or adds a second caller.

**The fix.** Drop the optionality (the type already guarantees it at the one caller), or make the
fallback unique per invocation. Either is one line per site; dropping the optionality is preferred
because it removes the branch rather than making it survivable.

---

## W5-E — no application-side fraud cap on credit purchases (a standing decision)

CLAUDE.md records this and it is **still true**: `getRecentTopupCount`, `getRecentTopupCredits`,
`SlackAlerts.velocityLimitHit` and `server/velocityLimits.test.ts` are gone (a grep returns only the
prose pointers in the test-discipline registries), deleted 2026-08-19 on a founder-stated default
because deciding what counts as too fast for a paying customer is a product design, not a wire-up.

⚠ **One correction to how that sentence reads, and it narrows the exposure rather than widening
it:** there is no one-time purchase surface at all. A repository-wide grep for
`createTopupCheckout` returns **nothing** — the product's only purchase road is a Stripe
subscription checkout, which Stripe's own controls rate-limit. So "no application-side fraud cap on
credit purchases" is accurate but describes a narrower surface than a reader would assume.

**No card, deliberately.** This is a decision already made and already written down; refiling it
without new evidence is the noise the patrol charter forbids. It is reported here so the next audit
does not read its absence as an oversight.

---

## Verified healthy — read at the bytes this run, so the next run need not

Recorded because a money audit that only lists problems tells the next reader nothing about what is
load-bearing.

- **The atomic credit layer** (`server/casting/atomicCredits.ts`, 261 lines) does what its docblock claims: the frozen-account check before anything; the charge **before** the expensive work; one charge id per invocation with a collision-resistant fallback (`pending-` plus the user id plus a `randomUUID()`); the refund under a **derived** reference (`refund:` plus the charge reference) so a refund retry is idempotent while never colliding with the charge row; and `RefundOutcome` distinguishing *recorded* from *recorded by me, now*, so a duplicate is never counted as a second payment. A refund that fails to record is never reported to the customer as "you weren't charged" — `refundTruth` gives them the reference to quote instead.
- **Charge/refund pairing.** Every paid road has its refund site, and every paid castingV2 road has a recovery module beside it: `rollRecovery`, `signRecovery`, `refineRecovery`, `retryRecovery`, `viewRetryRecovery`, plus the legacy `operationRecovery`. ⚠ **Instrument caveat for the next run:** a `grep -c "recordRefund("` count reads several of these as unpaired, because the house style is dependency injection — `(dependencies.refund ?? recordRefund)(` — and a naive count misses it. `viewRetryService.ts` reads as having neither a charge nor a refund and has both (`:315`, `:498`).
- **The view-retry re-charge**, which card #1225 flagged as a new shape, is built correctly. It charges under `operationChargeReference(operationId)` — a **fresh** operation per retry — so the re-charge of a refunded slice cannot collide with the original charge or its derived refund. The price is read from `offer.priceCredits` (`viewRetryService.ts:206`), the same projection the button renders, so the price on the button and the price at the till are one reading rather than two constants; `if (price > 0)` guards both the charge and the refund, so a free retry neither charges nor refunds.
- **The billing five are closed and the order is right.** `changePlan`, `createSubscriptionCheckout`, `previewPlanChange`, `getInvoices`, `getAllInvoices` all `.strict()`. On both invoice readers it is `.strict().optional()` — strict on the **object**, optional on the whole — which is the placement CLAUDE.md records and the one that matters, since `ZodOptional` has no `.strict` in zod 4 and strictness on the wrong object passes a rejection arm by rejecting customers.
- **Invariant 3 holds on every money road.** Every `input.userId` under `server/routes/` is an **admin** procedure acting on a target user (`admin/roles.ts`, `admin/users.ts`); the authority comes from `adminProcedure` and the actor is audited from `ctx.user.id`. No procedure scopes a customer's own spend, quota or rate-limit key to an id taken from input.
- **The periodic grant fails loud rather than granting zero.** An invoice whose bought period cannot be read refuses with `success: false` when the billing reason is `subscription_create` or `subscription_cycle` (`webhooks.ts:675-687`), so Stripe redelivers and the failure is visible — instead of a happy log over an empty grant.
- **Suites driven this run:** `approvalGate`, `staffImageBoundary`, `publicInputStrictness`, `sessionIssuanceSites`, `moneySurfaceClassifier` — **5 files / 74 tests green**; `atomicCredits`, `deployCollision` — **2 files / 19 tests green**.

---

## What this run did not read, named so the floor is not mistaken for coverage

- **The deploy-collision contract was driven, not re-reasoned.** `server/castingV2/deployCollision.test.ts` asserts money conserved and every candidate terminal in one pass, and it is green; this audit did not independently re-derive the conservation arithmetic in `rollRecovery.ts`.
- **No production ledger rows were read.** Conservation is asserted from the suites and the code, not from a sum over the credit-transaction rows. A row-level reconciliation against production is a separate reading and a bigger one.
- **Stripe's own dashboard was not opened** — webhook delivery-retry counts and any real replay history live there, and they would turn W5-C's severity from reasoned into measured.
- **The invariant 1 and 2 readings are the Atlas's findings plus spot reads**, not a statement-by-statement pass over every money procedure's SQL.
