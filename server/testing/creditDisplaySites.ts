/**
 * WHERE A CREDIT NUMBER REACHES A CUSTOMER — the reader behind #1600's guard.
 *
 * `shared/creditDisplay.ts` is the only place a ledger number becomes a number
 * a customer reads. A type carries half of that promise: `formatCredits` takes
 * a branded `DisplayCredits`, so a raw ledger value cannot be formatted by
 * accident. This reader carries the other half — the two things a type cannot
 * see:
 *
 * 1. **A site that never calls the helper at all.** `{credits.toLocaleString()}`
 *    typechecks perfectly and shows a ledger number to a customer.
 * 2. **Scale arithmetic written out by hand.** A `/ 5` at a render site, or a
 *    `* 50` left over from the legacy multiplier, is a second copy of the
 *    scale — working law 4, on the number that quotes a price.
 *
 * # ⚠ This reader is RED BY DESIGN today, and its allowlist is the census
 *
 * P1-1 ships in slices. The helper lands first; the sites are routed with
 * P1-2's prices, because the ×10 display must never appear on today's prices
 * (the card's done-when 4). So `UNROUTED` below is the **measured census of
 * every site still to route** — not an excuse list. It only shrinks, and a
 * routing PR that does not shrink it has not routed anything.
 *
 * # What it reads, stated narrowly so the limit is visible
 *
 * **Rule 1 — a formatted credit number.** `X.toLocaleString()` where `X` is
 * named for credits, in a customer-visible file. `toLocaleString` is the
 * product's own idiom for "make this number readable by a person", so it is a
 * strong signal rather than a guess. The strict vocabulary is used here
 * BECAUSE there is no corroborating text: a bare `price` is excluded, since
 * `PLAN_TIERS.price` is **cents**, not credits, and indicting it would be the
 * false refusal this kind of guard is famous for.
 *
 * **Rule 2 — a credit number beside the word "credit".** An expression
 * interpolated into a template or JSX whose surrounding literal text says
 * "credit". Here a wider vocabulary is safe, because the word itself is the
 * corroboration — `` `${cost} credits` `` is unambiguous in a way `cost` alone
 * never is.
 *
 * **Rule 3 — scale arithmetic.** `/ 5`, `/ 50`, `* 50` against a credit-named
 * operand, anywhere outside the helper. This one runs on STAFF surfaces too:
 * they are exempt from displaying the customer scale, not from inventing it.
 *
 * # What it does NOT see, named rather than left to be discovered
 *
 * - A credit number rendered through a variable whose name says nothing
 *   (`const n = balance; <span>{n}</span>`). Names are the only handle a
 *   textual reader has; the brand on `formatCredits` is what covers this once
 *   a site is routed, which is why the two halves ship together.
 * - A number crossing the wire already divided by a server that did it wrong.
 *   Nothing here reads runtime values.
 * - Copy that states a price as a literal in prose. #1601 owns the price table
 *   and `server/architectureCreditCosts.test.ts` already reads every declared
 *   price out of the tree.
 *
 * So a clean run is a FLOOR, not coverage — and the population counts below
 * exist because a reader that silently stopped parsing reports zero sites,
 * which is byte-identical to a fully routed product.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";

import ts from "typescript";

import { readListedSource } from "./listedSource";

/** Trees that can put a number in front of a customer. */
export const SOURCE_ROOTS = ["client/src/", "server/", "shared/"] as const;

/**
 * Surfaces that stay in LEDGER units, by the card's own words: *"Admin and
 * moderator views stay in ledger units, labelled 'units'."* Staff are reading
 * the books, not being quoted a price.
 *
 * The list mirrors the review triage's own STAFF SURFACES
 * (`.github/customer-surfaces.sh`) deliberately — the same four shapes, so a
 * diff the reviewer treats as staff is a diff this guard treats as staff.
 */
export const STAFF_SURFACES = [
  "client/src/features/admin/",
  "client/src/features/moderator/",
  "client/src/pages/Admin",
  "client/src/pages/Moderator",
  "server/routes/admin/",
  "server/routes/moderator",
] as const;

/**
 * ⚠ `server/lib/adminActions/changeRequestActions.ts` is deliberately NOT on
 * that list, though its path says admin. The card names *"change-request
 * texts"* among the server strings a CUSTOMER sees — the action is staff's,
 * the sentence is the customer's, and the path is about who triggers it.
 */

/** The helper itself, which is allowed — required — to know the scale. */
export const THE_HELPER = "shared/creditDisplay.ts";

/** The functions that make a number safe to show. */
export const DISPLAY_HELPERS = [
  "displayBalance",
  "displayPrice",
  "displayRefund",
  "displaySpent",
  "formatCredits",
] as const;

/**
 * Names that mean credits with no other evidence needed (rule 1).
 *
 * ⚠ `price` is deliberately ABSENT. `PLAN_TIERS.price` is cents; indicting it
 * would make this guard refuse correct code, which is the failure mode that
 * gets a guard deleted rather than fixed.
 *
 * ⚠ **A BARE `cost` WAS ABSENT TOO UNTIL 2026-10-01, AND THAT HOLE SHIPPED THE
 * EXACT DEFECT THIS GUARD EXISTS TO CATCH** — found on PR #1649 by the founder's
 * engineering agent, verified here. The pattern was `[a-z]cost$`, which needs a
 * letter before "cost", so every compound name (`totalCost`, `actionableCost`)
 * matched and the four-letter `cost` did not. `ViewTabs.tsx` has four
 * `cost.toLocaleString()` sites: the two that say "credits" beside them were
 * caught by rule 2, and **the two GhostSlot/FailedSlot FACE LABELS — the number
 * a customer actually reads on the tile — were caught by neither rule and were
 * therefore absent from the census.** A routing slice working that census would
 * have routed the hover tooltip and left the face on the ledger scale: a Roll
 * tile reading 240 in its title and 1,200 on its face, silently, with the guard
 * clean either side.
 *
 * ⚠ **AND `spent$` JOINED IT ON 2026-10-01 (#1676) — ONE WORD, ARGUED AND
 * MEASURED, NEXT TO THREE STRUCTURAL CHANGES.** Seven of that card's fourteen
 * sites are the same quantity under the same two names: `cycle.spent` and
 * `(cycle.spent + cycle.remaining)`, in `AddCreditsModal`, `ChangePlanModal`
 * twice, and `UsageSection`'s per-day rate. **No window widening reaches them**,
 * because the word is genuinely not in the sentence: one says
 * *"{spent} of {total} spent with 4 days left in this cycle"* and another is
 * `<p className="dp-plan__credits">{spent} / {total}</p>`, where the word is in
 * a CLASS NAME — and letting a stylesheet decide what a guard indicts is a
 * worse rule than the hole.
 *
 * The argument is the product's own: **`displaySpent` is one of the five
 * `DISPLAY_HELPERS`.** A helper exists for converting a spent figure, so the
 * product has already declared that a spent figure is a ledger quantity. That
 * is the same kind of ground `cost` stands on, and it is not available to
 * `price` — whose cents arm is real (`PLAN_TIERS.price`).
 *
 * **Measured before it was chosen, over the guard's own population**: every
 * `toLocaleString` receiver on a customer surface mentioning a name ending in
 * `spent` or `remaining` is **eight sites, and all eight are credits** (the
 * seven above plus `UsageSection:121`, which rule 4 had just caught and which
 * rule 1 now catches on the stronger signal). `remaining$` is deliberately NOT
 * added: every site that mentions it also mentions `spent`, so it would be a
 * word carried for no measured site — which is the practice this card exists
 * to challenge. No cents-denominated `spent` exists anywhere in the tree.
 *
 * `cost` is admitted on rule 1's own stated ground rather than as an exception:
 * rule 1 fires ONLY on a `toLocaleString` receiver, and `toLocaleString` is the
 * corroboration — the product's idiom for *make this number readable by a
 * person*. `price` stays out because its cents arm is real and because a bare
 * `price.toLocaleString()` appears **nowhere** in customer code (derived at the
 * repair, over the guard's own population: of every `toLocaleString` receiver
 * mentioning cost or price, zero mention a bare `price`), so admitting `cost`
 * costs no false refusal.
 */
const STRICT_CREDIT_NAME = /credit|balance|pointscost|allowance|cost$|spent$/i;

/** Names that mean credits when the word "credit" is right beside them (rule 2). */
const LOOSE_CREDIT_NAME = /credit|balance|pointscost|allowance|cost|price|spent|remaining|refund|grant|amount$/i;

/** The scale multipliers a hand-written conversion would use. */
const SCALE_LITERALS = new Set([5, 50]);

/**
 * Does this text say "credits" in any spelling the product actually uses?
 *
 * ⚠ **`CR` IS THE PRODUCT'S OWN ABBREVIATION AND THE RULE COULD NOT SEE IT —
 * FOUND BY LOOKING AT THE RUNNING APP, NOT BY READING (#1600 slice 2).** The
 * casting entrance's receipt line WAS `` {price} CR ``, and it was the price of
 * the button beside it. Rule 1 cannot reach it (`price` is deliberately out of
 * the strict vocabulary, because `PLAN_TIERS.price` is cents) and rule 2 could
 * not either, because its text test was `/credit/i` and the word on screen is
 * two letters. **So the client routing slice rendered a balance of 3,688 next
 * to a roll price of 160 — two scales on one screen, which is the single state
 * P1-1's done-when 4 forbids — and every instrument was green.** Law 6 is the
 * only thing that was ever going to find it.
 *
 * `\bCR\b` is case-SENSITIVE on purpose and anchored on word boundaries.
 * Measured over the guard's own population before it was chosen: it reached
 * **exactly one site**, the one above. It does NOT match inside `CREDITS PER
 * $1` (the `\b` fails against the following `E`), and a case-insensitive form
 * would have started matching ordinary prose containing "cr".
 *
 * ⚠ **AND THAT ONE SITE IS GONE — #1908, 2026-10-07, so this branch now
 * reaches ZERO and the tense above is history.** His word, on Yuna's Desk
 * item *"Cost beside Cast it in plain words"*: the receipt spells out
 * `CREDITS`, because `CR` was the one abbreviation on the path to a
 * customer's first paid press and nothing on that path explained it.
 *
 * **The branch STAYS, and it is not dead machinery.** It was added because
 * nothing could see the product's own abbreviation; the repair that removed
 * its subject does not remove the abbreviation from the product's vocabulary,
 * and `CR` coming back on any credit figure is exactly what this branch is now
 * the only reader of. Its arms were always FIXTURES rather than tree readings
 * (`server/creditDisplayGuard.test.ts`, *"#1600 slice 2"*), so they are
 * unaffected by the site going — which is why removing the line left this
 * guard green and why this paragraph exists rather than a surprise later.
 * `CR` on the receipt specifically is refused by
 * `client/src/features/castingV2/section10-guard.test.ts`.
 */
function saysCredits(text: string): boolean {
  return /credit/i.test(text) || /\bCR\b/.test(text);
}

export type CreditSite = {
  /** Repo-relative, forward-slashed. */
  file: string;
  /** 1-indexed, so it is clickable. */
  line: number;
  /** Which rule caught it. */
  rule: "formatted" | "beside-the-word" | "named-on-the-way-out" | "scale-arithmetic";
  /** The offending expression's own source text, trimmed. */
  expression: string;
};

export type CreditDisplayReading = {
  sites: CreditSite[];
  /** Files read. A floor: zero means the walk found nothing to read. */
  files: number;
  /**
   * The shapes rule 1 is about: a `toLocaleString` call OR a display-helper
   * call, anywhere in the population. The rule-1 floor.
   *
   * ⚠ **IT COUNTS BOTH BECAUSE ROUTING REMOVES THE FIRST ONE.** This was
   * `toLocaleString` alone with a floor of 80, and #1600's first routing slice
   * took it to 44 by doing exactly what the card asks — every site routed turns
   * a `.toLocaleString()` into a `formatCredits(…)`. A floor that falls as the
   * work succeeds has to be either lowered every slice, which makes it no floor
   * at all, or counted over the shapes that do not move. Each routing edit
   * trades one of these for the other, so the SUM cannot fall; a parser that
   * gave up still reports zero, which is the only thing this number is for.
   */
  formatCalls: number;
  /** Templates and JSX texts seen. The rule-2 floor. */
  interpolations: number;
};

/**
 * THE CENSUS OF SITES STILL TO ROUTE — #1600's enumerated remainder.
 *
 * Every row is a real place a customer reads a ledger number today. **It only
 * shrinks.** A routing PR deletes the rows it routed; a row that cannot be
 * deleted because the site moved is re-measured, never edited to match.
 *
 * ⚠ It is keyed on (file, rule, expression) and NOT on a line number, which
 * was the first shape and was wrong: every routing PR moves the lines below it
 * and the allowlist would then excuse the wrong sites while reporting a clean
 * shrink. The expression text is what identifies a site across an edit.
 *
 * ⚠ **IT HAS RISEN TWICE, BOTH ON 2026-10-01, AND BOTH BECAUSE THE READER COULD
 * NOT SEE A SITE THE PRODUCT ALREADY HAD.** Neither rise is a new place a
 * customer reads a ledger number; each is a place that was always there and
 * was invisible. **A rise for any other reason is a defect, not a row.**
 *
 * **THE FIRST (#1649's sweep), 106 → 108.** Rule 1 could not see a bare `cost` (the constant above
 * carries the measurement), so two customer-read face labels in `ViewTabs.tsx`
 * were in no rule's reach and therefore in no row here. Widening the rule
 * re-measured the list rather than adding to it: **79 shapes either side**,
 * occurrences **106 → 108** (the two labels), and **four rows moved from
 * `beside-the-word` to `formatted`** — `ViewTabs` `cost.toLocaleString()`
 * (2 → 4, now covering all four of its sites), `PackageHealthDialog`
 * `(plan?.cost ?? 0)`, `CastModelModal` `plan.cost` and `IdentityChangeDialog`
 * `cost`, each of which rule 1 now catches on the name where rule 2 had been
 * catching it on the neighbouring word. No site was routed and no site was
 * excused: the same code is described by a stronger rule.
 *
 * **THE SECOND (#1676), 108 → 122, and it is the FIRST ONE'S CLASS rather than
 * its sibling.** That repair added a word to a list; this card asked whether
 * the list was the mistake, and measured that it was: **fourteen credit numbers
 * a customer reads were in no rule's reach**, called `delta`, `reward`,
 * `earned`, `cap`, `spent` and `perDollar` — and *"${delta} credits a month"*,
 * which says the word out loud, was invisible because `delta` was in no
 * vocabulary. **A credit number can be called anything.** So three of the four
 * causes are closed structurally and only one by a word:
 *
 * | the repair | what it reaches |
 * |---|---|
 * | rule 2 limb B — a formatted number inside a SENTENCE that says credits, no name required | `delta` ×2, `reward`, `earned` |
 * | `sentenceAround` follows nested templates to the outermost one | `cap` |
 * | rule 4 — the name the value is GIVEN (a `const`, or the function it is returned from) | `perDollar` in `formatCreditsPerDollar` |
 * | `spent$` in rule 1's vocabulary, argued from `displaySpent` and measured at 8 sites, all credits | the seven `cycle.spent` / `spend.spent` sites |
 *
 * **No existing row moved and no site was routed**, which was checked rather
 * than hoped: the sites outside the census before this change were 0, and after
 * it exactly these 14. The shrink that measures P1's work now starts from 122.
 *
 * ✅ **AND IT HAS NOW SHRUNK FOR THE FIRST TIME — 122 → 108 (#1605), BY
 * DELETION RATHER THAN ROUTING, which is why it could happen before the new
 * price table lands.** The seven `server/stripe/stripeProducts.ts` rows were
 * `PLAN_TIERS.<rung>.monthlyCredits.toLocaleString()` twice per rung — a
 * composed `description` ("200,000 credits/month with 75% rollover") sent to
 * Stripe as `product_data.description` on the checkout session, and a matching
 * first `features` bullet. **Both are gone at the source**, so there is nothing
 * left to rescale: a number that is not composed cannot be composed at the
 * wrong scale. The customer's plan line is `planBlurbs.ts` and the credits
 * figure under it renders from `credits`, which a later routing slice takes
 * through the helper.
 *
 * ⚠ **A ROW DELETED BECAUSE ITS SITE WAS DELETED IS THE ONLY CLEAN SHRINK
 * THERE IS; A ROW DELETED BECAUSE ITS SITE MOVED IS THE ROT THE STALE ARM
 * EXISTS FOR.** These seven are the first kind, and the proof is the negative
 * control rather than this sentence: with the rows gone, a re-composed
 * description is a site OUTSIDE the census and `creditDisplayGuard.test.ts`
 * refuses it.
 *
 * ✅ **AND IT HAS NOW SHRUNK BY ROUTING: 108 → 42 (#1600 slice 2).** Every
 * customer-visible credit number under `client/src/` goes through the helper.
 * What is left is 37 occurrences on the server, 2 in `shared/refundCopy.ts`,
 * and **FOUR CLIENT ROWS THAT ARE NOT WORK** — the first rows this list has
 * ever held that are not "still to route". They are named here rather than
 * left to be rediscovered later as a shrink that stalled:
 *
 * | row | why it stays |
 * |---|---|
 * | ~~`formatCreditsPerDollar(…)` ×2 — `AddCreditsModal` twice~~ (×3 until card 1773 took `ChangePlanModal`'s with the chip; **×0 since #1845 took both of Add credits's with the rate sentence on the plan pane**) | the conversion is INSIDE that function, so the rate a customer reads is already on their scale. The rules read a NAME and cannot see through a function boundary, which is a limit this file's header states. |
 * | `Math.round(perDollar).toLocaleString("en-US")` | a RATE. Through `displayBalance` it would be divided by five twice. |
 *
 * ⚠ **TWO OF THOSE ROWS CHANGED THEIR EXPRESSION IN #1755 AND NEITHER
 * CHANGED ITS VERDICT**, which is the case the stale arm exists to make
 * visible rather than to punish. `AddCreditsModal`'s billing interval became
 * `boolean | null`, so both of its rate call sites narrow with
 * `annual === true` where they read `annual`. **The site did not move and the
 * reason it stays is untouched**: the conversion is still inside
 * `formatCreditsPerDollar`, and rule 1 still indicts it only because `credits`
 * appears in the expression. A row updated here rather than deleted is what
 * keeps the count honest through a refactor.
 *
 *
 * ⚠ **IT WAS FIVE UNTIL #1607, AND THE FIFTH LEFT BY THE ONE CLEAN DOOR — ITS
 * SITE WAS DELETED.** The row was
 * `framesFor(plan.credits, costPerFrame).toLocaleString()` on
 * `ChangePlanModal`, excused as *"a count of FRAMES, not of credits"*, which
 * was true. P1-8 replaced that line with a count of finished CHARACTERS,
 * derived from the three prices the studio charges rather than from the legacy
 * studio's per-frame price, and the expression it is derived through carries no
 * `.toLocaleString()` beside a `credits` token — so no rule indicts the
 * replacement and there is nothing to excuse. **The ceiling fell 19 → 18 in
 * the same commit**, which is the ratchet doing its job: a row removed without
 * its budget leaves slack for the next unrouted site to ship green.
 *
 * ⚠ **So the client half of this census has a FLOOR OF THREE, and a later
 * slice that drives it to zero has done something wrong rather than something
 * thorough.** The honest repair for all of them is a rule that follows a value
 * through a function call, which is a different instrument from the one this
 * file is — it is not pretended here, and it is not filed as debt against the
 * routing, because routing is not what would fix it.
 *
 * ⚠ **IT READ FOUR UNTIL CARD 1773, AND THE FOURTH LEFT BY THE SAME CLEAN
 * DOOR AS THE FIFTH DID — ITS SITE WAS DELETED.** His word, 2026-10-02:
 * *"on the free card remove the free CREDITS PER $1 line thats stupid"*, then
 * *"yes i like this"* on the rate belonging to Add credits and not to a plan
 * card. So `ChangePlanModal`'s `formatCreditsPerDollar(priceOf(plan),
 * plan.credits)` is gone from the product, both where it printed — the card
 * chip and the compare table's `Credits per dollar` row. **The census's own
 * stale-row arm is what reported it** (budgeted 1, found 0) before the ceiling
 * was touched, and the ceiling fell 18 → 17 in the same commit. The two
 * `AddCreditsModal` rows are untouched and keep their reasons: his ruling moved
 * the rate's home, it did not route anything.
 *
 * ⚠ **THAT LAST SENTENCE WAS TRUE OF THE FILE AND FALSE OF THE SURFACE, AND
 * #1845 IS THE CORRECTION.** One of those two `AddCreditsModal` rows was the
 * rate on `PlanStepUpPane` — the pane a FREE account opens, which #1836 had
 * relabelled a plan surface the same hour (eyebrow `PLANS`, heading *Choose a
 * plan*). So his word had already reached it and this census could not say so,
 * because it keys on FILES and that file draws three surfaces. Both rows are
 * gone by the clean door and the ceiling fell 17 → 15; the stale-row arm
 * reported both at budgeted 1, found 0, before the number was touched.
 *
 * **Measured after: `AddCreditsModal.tsx` has no censused site and the reader
 * indicts none in it.** The rate's surviving home — the credit PACKS pane —
 * computes it through `rateFor`, a name the rules do not read, so it was never
 * censused and nothing was routed or excused to make that true.
 *
 * ✅ **THE ROUTING IS FINISHED — 42 → 16 (#1600 slice 3, 2026-10-02), AND THIS
 * LIST IS NOW A DIFFERENT KIND OF ARTIFACT.** 19 occurrences routed, 7
 * corrected in the reader; **not one row left means "still to route"**. So
 * `stays` below is REQUIRED on every row and the guard refuses a row without
 * one. `stays: null` means work outstanding, and a list holding none of them
 * means the routing is done — a fact a guard can check, where "the rows that
 * are left are fine, see the header" is a fact only prose can claim.
 *
 * **What the 19 were, and they were live rather than theoretical.** The price
 * table landed on production at `143e5b30` (2026-10-01 17:34Z), so from that
 * minute a refused Roll read *"Not enough credits. A roll costs 1200
 * credits."* on a screen whose every other number said **240**, and a
 * per-candidate refund of 30 display read *"150 credits were refunded."*
 * Twelve refusal sentences (`rollService`, `signService`, `refineService`,
 * `retryService`, `viewRetryService`, `boardOps` ×3, `mintPackage`,
 * `refreshSlots`, the evidence execution, the legacy imaging lane, and
 * `withAtomicCredits`'s own), four refund sentences, the Re-ask question and
 * its Yes option, the plan-change toast's two branches, and
 * `shared/refundCopy`'s one sentence behind four surfaces.
 *
 * ⚠ **AND THE NINE CORRECTED IN THE READER WERE NOT CREDIT NUMBERS AT ALL** —
 * `refundResult.refundId` ×2, `refundType` ×2, `(refundAmountCents /
 * 100).toFixed(2)` ×2, `f.refundReference`, and the two `(amount / 100)
 * .toFixed(2)` dollar figures `amount$` would otherwise have admitted: an id, a
 * word and four dollar amounts, each indicted because the sentence around it
 * says "credits" somewhere else. `isNotAnAmountName` and the `Cents` clause are the repair, and the
 * measurement sits on them. **A row that cannot be routed is worse than a
 * missing row**, because this list's only contract is that it shrinks and such
 * a row can never leave.
 *
 * ⚠ **AND THE SLICE FOUND THREE SITES THE CENSUS NEVER HELD, ALL THREE IN THE
 * SHARED CHARGE WRAPPER — the worst direction a reader can be wrong in.**
 * `server/casting/atomicCredits.ts` quotes a credit figure three times: the
 * generic *"Insufficient credits. Need N credits."* that `withAtomicCredits`
 * throws for BOARDS, MINT, the legacy imaging lane and rolls, and
 * `refundTruth`'s two — *"N credits were refunded."* and *"support will restore
 * the N credits."* Every one of them was the ledger number, and **no rule could
 * reach any of them, because the value is called `amount`.** That is #1676's own
 * sentence — *a credit number can be called anything* — paid for a third time,
 * after `cost` (#1649) and `delta` (#1676).
 *
 * `amount$` is now in rule 2's vocabulary, anchored at the END of the name so it
 * reads `amount`, `outcome.amount` and `creditAmount` and not `amountCents`.
 * **It was measured before it was kept**: over the whole population it reaches
 * **8 occurrences** — the 3 above, the admin's own change-request confirmation
 * (×2), the dispute webhook's `actions` line, and **two DOLLAR figures**,
 * `` `$${(amount / 100).toFixed(2)} ${currency}` `` in a sentence that also says
 * credits. Those last two are why `isFixedPointFormat` landed in the same
 * commit: a widening that trades one false negative for two false positives has
 * not been measured, it has been hoped for.
 *
 * # ⚠ THE ONE JUDGEMENT IN THIS SLICE: A STORED DESCRIPTION STAYS IN LEDGER
 *
 * Four rows below are the `description` written onto a `creditTransactions`
 * row — *"Monthly credit refresh (180000 credits + 0 rollover)"*, *"Credit
 * top-up: N credits"*, *"Annual credit grant — 12 months up front (N credits +
 * rollover)"*. The card names *"billing/webhook descriptions"* among the server
 * strings a customer sees, and **read at the code that is not where they go**:
 * the one live reader is the MODERATOR credit history, which prints the
 * description beside the ledger `amount` — and `credits.getTransactions`, the
 * customer-facing procedure, **has no client caller at all**. Routing them
 * would put a display figure beside a ledger amount on the one surface this
 * card says stays in ledger units, which is the two-scales-on-one-screen
 * defect wearing staff clothes.
 *
 * So they stay, and **the trap is filed rather than left in a docblock**: the
 * day a customer-facing transaction history is built, these descriptions arrive
 * carrying ledger numbers. That is #1736.
 */
export const UNROUTED: readonly {
  file: string;
  rule: CreditSite["rule"];
  expression: string;
  /** How many times this exact shape appears in this file. */
  count: number;
  /**
   * WHY IT IS STILL HERE — `null` means still to route, which is work.
   *
   * ⚠ Every row carried that meaning implicitly until slice 3, and the five
   * client rows that were never work had their reasons in the HEADER, where no
   * guard can read them. A reason in the DATA is checkable: the guard holds
   * every row to having one, and holds the still-to-route rows to being gone.
   */
  stays: string | null;
}[] = [
  { file: "client/src/features/settings/planMath.ts", rule: "named-on-the-way-out", expression: "Math.round(perDollar).toLocaleString(\"en-US\")", count: 1, stays: "the rate's own formatting, inside the function that has already converted. Through `displayBalance` it would be divided by five twice." },
  { file: "server/castingV2/reliabilityReport.ts", rule: "beside-the-word", expression: "report.creditsRefunded", count: 1, stays: "an OPERATOR diagnostic — a text table of delivery rates whose only consumers in the tree are its own suites. Ledger units, like every staff reading." },
  { file: "server/db/billing.ts", rule: "beside-the-word", expression: "creditAmount", count: 1, stays: "the `description` of a `creditTransactions` ROW. Its one live reader is the moderator credit history, which prints it beside the ledger `amount`; `credits.getTransactions` has no client caller. Ledger units, as the card asks of a staff surface. The trap when a customer history is built is #1736." },
  { file: "server/db/billing.ts", rule: "beside-the-word", expression: "monthlyCredits", count: 1, stays: "the `description` of a `creditTransactions` ROW. Its one live reader is the moderator credit history, which prints it beside the ledger `amount`; `credits.getTransactions` has no client caller. Ledger units, as the card asks of a staff surface. The trap when a customer history is built is #1736." },
  { file: "server/db/billing.ts", rule: "beside-the-word", expression: "rolloverCredits", count: 1, stays: "the `description` of a `creditTransactions` ROW. Its one live reader is the moderator credit history, which prints it beside the ledger `amount`; `credits.getTransactions` has no client caller. Ledger units, as the card asks of a staff surface. The trap when a customer history is built is #1736." },
  { file: "server/stripe/webhooks.ts", rule: "beside-the-word", expression: "Math.abs(priorRevoke.amount)", count: 1, stays: "the webhook's own `actions` array — its reply to Stripe and its log line. An operator reading, never a sentence. Reached only once `amount$` joined rule 2's vocabulary." },
  { file: "server/stripe/webhooks.ts", rule: "beside-the-word", expression: "creditsRestored", count: 1, stays: "a change-request review note, appended for staff after a Stripe refund failed." },
  { file: "server/stripe/webhooks.ts", rule: "beside-the-word", expression: "creditsToRestore", count: 2, stays: "the webhook's own `actions` array — its reply to Stripe and its log line. An operator reading, never a sentence." },
  { file: "server/stripe/webhooks.ts", rule: "beside-the-word", expression: "currentBalance", count: 1, stays: "the webhook's own `actions` array — its reply to Stripe and its log line. An operator reading, never a sentence." },
  { file: "server/stripe/webhooks.ts", rule: "beside-the-word", expression: "grantCredits", count: 1, stays: "the `description` of a `creditTransactions` ROW. Its one live reader is the moderator credit history, which prints it beside the ledger `amount`; `credits.getTransactions` has no client caller. Ledger units, as the card asks of a staff surface. The trap when a customer history is built is #1736." },
];

function isStaff(file: string): boolean {
  return STAFF_SURFACES.some((surface) => file.startsWith(surface));
}

/**
 * A LOG LINE IS NOT A CUSTOMER SURFACE, and rule 2 cannot tell one from a
 * sentence without asking.
 *
 * `log.info(\`[Webhook] Refreshed credits … ${grantCredits} …\`)` says "credits"
 * beside a credit-named value and reaches nobody but an operator. Two of the
 * first census's rows were exactly this, and a census row that can never be
 * routed sits in a list whose whole contract is that it only shrinks.
 */
const LOGGER_RECEIVERS = new Set(["log", "logger", "console"]);

function insideALogCall(node: ts.Node): boolean {
  for (let cursor: ts.Node | undefined = node.parent; cursor; cursor = cursor.parent) {
    if (!ts.isCallExpression(cursor)) continue;
    const callee = cursor.expression;
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
      if (LOGGER_RECEIVERS.has(callee.expression.text)) return true;
    }
    if (ts.isIdentifier(callee) && LOGGER_RECEIVERS.has(callee.text)) return true;
  }
  return false;
}

/**
 * Trailing property names that are never a credit amount, however
 * credit-named the object is. `refund.id` is an identifier; `plan.name` is a
 * word. Both tripped rule 2 in the first census.
 */
const NOT_AN_AMOUNT_WORDS = [
  "id",
  "name",
  "label",
  "title",
  "status",
  "kind",
  "type",
  "reference",
  "key",
  "error",
  "message",
  "reason",
  "description",
] as const;

/* The set is DERIVED from the list above, never typed out beside it — the
   suffix reading needs the order and the membership test needs the set, and
   two copies of thirteen words is working law 4 in miniature. */
const NOT_AN_AMOUNT = new Set<string>(NOT_AN_AMOUNT_WORDS);

/**
 * Is this NAME one of the words above, read as a camelCase TAIL?
 *
 * ⚠ **THE SET WAS MATCHED EXACTLY, AND ON A PROPERTY NAME ONLY, WHICH LEFT
 * THREE SHAPES OF ONE MISTAKE SITTING IN THE CENSUS** (#1600 slice 3,
 * 2026-10-02): `refundResult.refundId` (an id), `f.refundReference` (a
 * reference) and the bare identifier `refundType` (a word) — all three indicted
 * because the sentence they sit in says "credits" somewhere else, and none of
 * them a number. A census row that cannot be routed is worse than a missing
 * one: the list's whole contract is that it only shrinks, and a row nobody can
 * ever remove is a permanent excuse.
 *
 * It cannot silence a credit amount, and that is a property of the WORDS rather
 * than a hope: every one of them is a non-numeric noun, and nothing in this
 * product names a quantity `…Id`, `…Reference`, `…Type`, `…Status` or
 * `…Reason`. Measured over the whole population the hour it landed: **5
 * occurrences left the census, all five of them a string.**
 */
/**
 * Is this `x.toFixed(n)` — the idiom for a number with DECIMALS?
 *
 * ⚠ **THE LEDGER IS INTEGER-ONLY**, which is the whole reason `displayBalance`
 * floors and `displayPrice` ceils rather than returning a fraction. So a value
 * being formatted to decimal places is money or a percentage, never a quantity
 * of credits — `` `$${(amount / 100).toFixed(2)} ${currency}` `` in a sentence
 * that also says "credits" is the measured instance. Added with `amount$` in
 * rule 2's vocabulary, which is what made these two reachable at all; without
 * it the widening would have traded one false negative for two false positives.
 */
function isFixedPointFormat(node: ts.CallExpression): boolean {
  return ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "toFixed";
}

function isNotAnAmountName(name: string): boolean {
  if (NOT_AN_AMOUNT.has(name)) return true;
  for (const word of NOT_AN_AMOUNT_WORDS) {
    if (name.endsWith(word.charAt(0).toUpperCase() + word.slice(1))) return true;
  }
  return false;
}

/**
 * A shape that cannot be a number, so cannot be a credit number.
 *
 * Three, every one measured rather than imagined: a pluralising ternary
 * (`n === 1 ? "" : "s"`), which reads as an interpolation beside the word
 * "credit" and is punctuation; a property access or bare identifier whose name
 * is one of the words above; and **a figure in CENTS, which is money and not
 * credits** — `` `$${(refundAmountCents / 100).toFixed(2)} (${refundType}).
 * ${creditsToDeduct} credits deducted.` `` is one sentence holding a dollar
 * amount, a word and a credit amount, and only the last of the three is this
 * guard's business. `Cents` is this product's own suffix for money-in-cents and
 * it never names a quantity of credits.
 */
function cannotBeAnAmount(node: ts.Node): boolean {
  if (ts.isPropertyAccessExpression(node) && isNotAnAmountName(node.name.text)) return true;
  if (ts.isIdentifier(node) && isNotAnAmountName(node.text)) return true;
  if (namesIn(node).some((name) => /Cents$/.test(name))) return true;
  if (ts.isCallExpression(node) && isFixedPointFormat(node)) return true;
  if (
    ts.isConditionalExpression(node) &&
    ts.isStringLiteralLike(node.whenTrue) &&
    ts.isStringLiteralLike(node.whenFalse)
  ) {
    return true;
  }
  return false;
}

/**
 * Is this node a display helper call, or inside one?
 *
 * ⚠ **It starts at the node ITSELF and the first cut started at its parent**,
 * which made `{formatCredits(balance)} credits` — the fully routed shape — read
 * as an unrouted site. A guard that indicts the correct code is worse than no
 * guard, and this was caught by its own arm rather than by reading.
 */
function insideDisplayHelper(node: ts.Node): boolean {
  for (let cursor: ts.Node | undefined = node; cursor; cursor = cursor.parent) {
    if (ts.isCallExpression(cursor) && ts.isIdentifier(cursor.expression)) {
      if ((DISPLAY_HELPERS as readonly string[]).includes(cursor.expression.text)) return true;
    }
  }
  return false;
}

/** Is this node itself a call to one of the display helpers? */
function isDisplayHelperCall(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    (DISPLAY_HELPERS as readonly string[]).includes(node.expression.text)
  );
}

/** Is this node a `x.toLocaleString()` call? */
function isLocaleFormat(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "toLocaleString"
  );
}

/**
 * Does this expression do ALL of its person-readable formatting through the
 * helper?
 *
 * ⚠ **`insideDisplayHelper` ALONE INDICTED CORRECTLY ROUTED CODE, AND THE WAY
 * IT DID SO IS WORTH MORE THAN THE FIX.** It walks UP, so a helper call nested
 * inside a larger expression is invisible to it — and rule 2 limb A then fires
 * on the enclosing expression because `namesIn` finds a credit-ish name in it.
 * **The name it finds is `formatCredits` itself**: `/credit/i` matches the
 * helper, so routing a site *supplied the very name that re-indicted it*. Three
 * real sites hit this on #1600's first routing slice — a cap clause in
 * `ReferralBlock`, the sheet dock's "left" tail, and a per-day rate — each of
 * them correct code the guard called unrouted. This file's own docblock says it
 * twice: *a guard that indicts the correct code is worse than no guard*.
 *
 * The test is deliberately narrow rather than "contains a helper somewhere":
 * the expression must contain at least one helper call AND no credit number
 * RENDERED outside one. So a conditional whose branches route is routed, while
 * `` `${cost.toLocaleString()} of ${formatCredits(total)}` `` — half routed,
 * which is the shape that actually ships a mixed scale — is still indicted.
 *
 * ⚠ **"RENDERED" MEANS INTERPOLATED OR FORMATTED, AND THE FIRST CUT COUNTED
 * ONLY `toLocaleString` — WHICH LEFT A HOLE THE SABOTAGE FOUND.** With that
 * test, `` `${cost} and ${formatCredits(other)} credits` `` was EXCUSED: a raw
 * ledger number spliced bare into a sentence beside a routed one, which is the
 * mixed scale this whole guard is about. Two sabotage cases on the first cut
 * both SURVIVED, and the reason is worth more than the fix — the arms written
 * for them used `` `${spent.toLocaleString()} …` ``, which **rule 1 catches on
 * its own**, so they passed whatever this function did. An arm that another
 * rule satisfies is not a control on this one.
 *
 * A credit name in a CONDITION is deliberately not counted: `typeof balance
 * === "number" ? …` tests a value, it does not show it, and counting it would
 * re-indict the sheet dock this function exists to stop re-indicting.
 */
function routedThroughHelper(node: ts.Node): boolean {
  let helpers = 0;
  let bare = 0;
  const visit = (current: ts.Node): void => {
    if (isDisplayHelperCall(current)) {
      helpers += 1;
      /* Inside a helper nothing can be bare — stop descending. */
      return;
    }
    if (isLocaleFormat(current)) {
      bare += 1;
      return;
    }
    const rendered =
      current.parent !== undefined &&
      ((ts.isTemplateSpan(current.parent) && current.parent.expression === current) ||
        (ts.isJsxExpression(current.parent) && current.parent.expression === current));
    if (
      rendered &&
      (ts.isIdentifier(current) || ts.isPropertyAccessExpression(current)) &&
      namesIn(current).some((name) => LOOSE_CREDIT_NAME.test(name))
    ) {
      bare += 1;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return helpers > 0 && bare === 0;
}

/** Every identifier and property name an expression mentions. */
function namesIn(node: ts.Node): string[] {
  const out: string[] = [];
  const visit = (current: ts.Node): void => {
    if (ts.isIdentifier(current)) out.push(current.text);
    ts.forEachChild(current, visit);
  };
  visit(node);
  return out;
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function textOf(node: ts.Node, sourceFile: ts.SourceFile): string {
  return node.getText(sourceFile).replace(/\s+/g, " ").trim().slice(0, 160);
}

/**
 * The literal text around an interpolation — a template's own chunks, or the
 * JSX text beside an expression child.
 *
 * ⚠ **A FRAGMENT IS A HOST, AND READING ONLY `JsxElement` IS WHAT LET #1905 SHIP.**
 * `<>…{priceCredits} credits</>` and `<span>…{priceCredits} credits</span>` are
 * the same sentence to a customer and were not the same sentence to this
 * reader: a fragment is `ts.isJsxFragment`, never `ts.isJsxElement`, so the
 * window came back EMPTY, `saysCredits("")` was false, and rule 2 could not see
 * a raw ledger number printed beside the word "credits" in the concept-upload
 * review dialog. It read **~1,600 credits** where every sibling price line read
 * **~320** — the whole of #1905, and the census that is supposed to enumerate
 * exactly this reported **0 sites beyond the list** the entire time.
 *
 * ⚠ **The fix is the HOST, not the window.** The tempting widening — walk up to
 * the nearest JSX ancestor with text — is the one `sentenceAround`'s docblock
 * records as built, driven and thrown away: over a whole element it indicted
 * `working`, `onClose`, `option.id` and an inline arrow function. This changes
 * only which node counts as *the thing my siblings belong to*, so the window is
 * still ONE host's own immediate `JsxText` children and the name check still
 * guards limb A. Measured over the real tree: 0 new sites beyond the census
 * before, **1** after — the #1905 site itself, and nothing else.
 */
function surroundingText(node: ts.Node, sourceFile: ts.SourceFile): string {
  const parent = node.parent;
  if (parent && ts.isTemplateSpan(parent) && parent.parent && ts.isTemplateExpression(parent.parent)) {
    const template = parent.parent;
    return template.head.text + template.templateSpans.map((span) => span.literal.text).join(" ");
  }
  if (parent && ts.isJsxExpression(parent) && parent.parent) {
    const host = parent.parent;
    if (ts.isJsxElement(host) || ts.isJsxFragment(host)) {
      return host.children
        .filter((child) => ts.isJsxText(child))
        .map((child) => child.getText(sourceFile))
        .join(" ");
    }
  }
  return "";
}

/**
 * THE SENTENCE THIS NUMBER IS IN — rule 2's second limb (#1676).
 *
 * ⚠ **IT IS TEMPLATE LITERALS ONLY, AND THAT NARROWNESS IS THE WHOLE CONTROL.**
 * The obvious widening — read every literal under the enclosing JSX element —
 * was built, driven, and thrown away: with the name check also dropped it
 * indicted `working`, `onClose`, `option.id` and an inline arrow function in
 * `AddCreditsModal.tsx` alone, because the element they sit in says "credits"
 * somewhere. **A guard that indicts a callback is worse than the hole it
 * closes.** A template literal is different in kind: it is a SENTENCE, written
 * as one thing, and every expression spliced into it is a value that sentence
 * is about.
 *
 * It follows nested templates up to the OUTERMOST one in the same sentence and
 * stops at a JSX boundary, because an author splitting a sentence across a
 * nested ternary has not written two sentences. That is the whole of
 * `ReferralBlock.tsx:88`: `cap` lives in `` ` — up to ${cap} in total` ``,
 * spliced into *"They get ${reward} credits on their first signed cast, and so
 * do you${…}."* — one sentence a customer reads, two templates the old reader
 * read separately.
 */
function sentenceAround(node: ts.Node): string {
  let outermost: ts.TemplateExpression | null = null;
  for (let cursor: ts.Node | undefined = node.parent; cursor; cursor = cursor.parent) {
    /* A JSX boundary ends the sentence: markup is not prose. */
    if (ts.isJsxElement(cursor) || ts.isJsxExpression(cursor) || ts.isJsxFragment(cursor)) break;
    if (ts.isTemplateExpression(cursor)) outermost = cursor;
  }
  if (outermost === null) return "";
  const parts: string[] = [];
  const collect = (current: ts.Node): void => {
    if (ts.isTemplateHead(current) || ts.isTemplateMiddle(current) || ts.isTemplateTail(current)) {
      parts.push(current.text);
    } else if (ts.isNoSubstitutionTemplateLiteral(current)) {
      parts.push(current.text);
    }
    ts.forEachChild(current, collect);
  };
  collect(outermost);
  return parts.join(" ");
}

/**
 * THE NAME THIS VALUE IS GIVEN ON ITS WAY OUT — rule 4 (#1676).
 *
 * ⚠ **TWO SITES WERE IN NO RULE'S REACH BECAUSE NOTHING ABOUT THE EXPRESSION
 * SAYS CREDITS AND EVERYTHING ABOUT ITS DESTINATION DOES.**
 * `UsageSection.tsx:121` is `const creditsUsed = spend.spent.toLocaleString()`,
 * drawn under the label *Credits used*; `planMath.ts:369` is the `return` of
 * `formatCreditsPerDollar`. Neither is interpolated beside a word, so rule 2
 * cannot see it, and neither receiver is credit-named, so rule 1 cannot either.
 *
 * ⚠ **IT STOPS AT THE FIRST BINDING AND AT ANY JSX, AND BOTH LIMITS WERE
 * MEASURED RATHER THAN REASONED.** The first shape walked every ancestor and
 * reached the enclosing FUNCTION DECLARATION — which in a file called
 * `AddCreditsModal.tsx` is a function named `AddCreditsModal`, so it indicted
 * `framesNext` and `framesNow`, two FRAME COUNTS the card names among the
 * sites that must stay excluded. A component's name is not a name given to one
 * value inside it; a `const` is.
 */
function namedOnTheWayOut(node: ts.Node): boolean {
  for (let cursor: ts.Node | undefined = node.parent; cursor; cursor = cursor.parent) {
    /* Rendered inside markup: whatever the component is called, it did not
       name THIS number. */
    if (ts.isJsxElement(cursor) || ts.isJsxExpression(cursor) || ts.isJsxFragment(cursor)) return false;
    if (ts.isVariableDeclaration(cursor)) {
      return ts.isIdentifier(cursor.name) && STRICT_CREDIT_NAME.test(cursor.name.text);
    }
    if (ts.isPropertyAssignment(cursor)) {
      return ts.isIdentifier(cursor.name) && STRICT_CREDIT_NAME.test(cursor.name.text);
    }
    if (ts.isReturnStatement(cursor)) {
      /* The function this is the answer of — a declaration, or an arrow or
         function expression wearing the name of the const it is assigned to. */
      for (let fn: ts.Node | undefined = cursor.parent; fn; fn = fn.parent) {
        if (ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) {
          return fn.name !== undefined && ts.isIdentifier(fn.name) && STRICT_CREDIT_NAME.test(fn.name.text);
        }
        if (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) {
          const named = fn.parent;
          return named !== undefined && ts.isVariableDeclaration(named) && ts.isIdentifier(named.name)
            && STRICT_CREDIT_NAME.test(named.name.text);
        }
      }
      return false;
    }
  }
  return false;
}

export function creditSitesIn(file: string, source: string): CreditSite[] {
  type Located = CreditSite & { at: number };
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const sites: Located[] = [];
  const staff = isStaff(file);

  const visit = (node: ts.Node): void => {
    /* Rule 3 — scale arithmetic. Runs on staff surfaces too. */
    if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind;
      const isScaleOperator =
        operator === ts.SyntaxKind.SlashToken || operator === ts.SyntaxKind.AsteriskToken;
      if (isScaleOperator) {
        const right = node.right;
        const literal =
          ts.isNumericLiteral(right) && SCALE_LITERALS.has(Number(right.text))
            ? Number(right.text)
            : null;
        if (literal !== null && namesIn(node.left).some((name) => LOOSE_CREDIT_NAME.test(name))) {
          sites.push({
            file,
            line: lineOf(sourceFile, node),
            rule: "scale-arithmetic",
            expression: textOf(node, sourceFile),
            at: node.getStart(sourceFile),
          });
        }
      }
    }

    if (!staff) {
      /* Rule 1 — a credit number handed to toLocaleString. */
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "toLocaleString"
      ) {
        const receiver = node.expression.expression;
        if (
          namesIn(receiver).some((name) => STRICT_CREDIT_NAME.test(name)) &&
          !insideDisplayHelper(node) &&
          !insideALogCall(node)
        ) {
          sites.push({
            file,
            line: lineOf(sourceFile, node),
            rule: "formatted",
            expression: textOf(node, sourceFile),
            at: node.getStart(sourceFile),
          });
        }
      }

      /* Rule 4 — NAMED ON THE WAY OUT (#1676). It sits under rule 1's
         `toLocaleString` roof because the corroboration is rule 1's: the
         product is making this number readable by a person, and the name it
         gave the result says what kind of number it is. Only fires where rule
         1 did not, so one site is never two rows. */
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "toLocaleString" &&
        !namesIn(node.expression.expression).some((name) => STRICT_CREDIT_NAME.test(name)) &&
        !insideDisplayHelper(node) &&
        !insideALogCall(node) &&
        namedOnTheWayOut(node)
      ) {
        sites.push({
          file,
          line: lineOf(sourceFile, node),
          rule: "named-on-the-way-out",
          expression: textOf(node, sourceFile),
          at: node.getStart(sourceFile),
        });
      }

      /* Rule 2 — a credit number interpolated beside the word "credit". */
      const interpolated =
        (node.parent && ts.isTemplateSpan(node.parent) && node.parent.expression === node) ||
        (node.parent && ts.isJsxExpression(node.parent) && node.parent.expression === node);
      if (
        interpolated &&
        !insideDisplayHelper(node) &&
        !routedThroughHelper(node) &&
        !insideALogCall(node) &&
        !cannotBeAnAmount(node)
      ) {
        const around = surroundingText(node, sourceFile);
        /*
          ⚠ **TWO LIMBS, AND THE SECOND IS #1676's REPAIR.**

          The first is unchanged: the word somewhere in the surrounding text,
          AND a name from the loose vocabulary. Every census row this guard
          already holds was measured under it, so it stays exactly as it was.

          The second drops the NAME and narrows the TEXT instead, which is this
          rule's own stated ground used where it is actually true: *"the word
          itself is the corroboration"*. A template literal is a SENTENCE; a
          number spliced into a sentence that says "credits" is a credit number
          **whatever it is called**, and five of them were called `delta`,
          `reward`, `earned` and `cap` — words no vocabulary was ever going to
          hold, which is the card's whole point. **A fixed list of names cannot
          enumerate what a value may be called**, so this limb has no list.

          ⚠ What it does NOT do is drop the name check against the WIDE window.
          That was built and driven first: it indicted `working`, `onClose`,
          `option.id` and an inline arrow function in one file, because the JSX
          element they sit in mentions credits somewhere. A guard that indicts a
          callback gets deleted rather than fixed.
        */
        /* ⚠ **LIMB B REQUIRES `toLocaleString` ON THE VALUE ITSELF, AND THE
           MEASUREMENT THAT PUT IT THERE IS THE HARSHEST ONE IN THIS FILE.**
           Without it — a credit sentence alone — the reader indicted **74
           sites**, among them `refreshVerb`, `label`, `action`, `planName`,
           `userId`, `invoiceId`, `status`, `failureReason` and
           `currency.toUpperCase()`: every string, id and verb spliced into a
           sentence that happens to mention credits. **A sentence says
           "credits"; it does not say which of its holes is the number.**
           `toLocaleString` does, and it is the same corroboration rule 1 stands
           on — the product's own idiom for *make this number readable by a
           person*. With it, the reader indicts the four it was built for and
           nothing else. */
        const formattedHere =
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "toLocaleString";
        const inACreditSentence = formattedHere && saysCredits(sentenceAround(node));
        if (
          inACreditSentence ||
          (saysCredits(around) && namesIn(node).some((name) => LOOSE_CREDIT_NAME.test(name)))
        ) {
          sites.push({
            file,
            line: lineOf(sourceFile, node),
            rule: "beside-the-word",
            expression: textOf(node, sourceFile),
            at: node.getStart(sourceFile),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  /* ONE ROW PER SITE, keyed on the node's own START OFFSET.
     Two earlier shapes of this were both wrong, in opposite directions, and
     each was caught by driving rather than by reading:
       - (line, rule) let ONE site through twice, because
         `` `${x.toLocaleString()} credits` `` trips rule 1 AND rule 2 — 153
         rows over what turned out to be 106 real places.
       - (line, expression) collapsed TWO real sites into one when they shared
         a line and an expression, which is exactly what a planted second
         `creditsBalance.toLocaleString()` on an existing line looks like. That
         sabotage survived GREEN, which is the only reason the offset is here.
     `formatted` wins a tie because it is the stronger signal and the more
     useful thing to print. */
  const order: Record<CreditSite["rule"], number> = {
    formatted: 0,
    "beside-the-word": 1,
    "named-on-the-way-out": 2,
    "scale-arithmetic": 3,
  };
  const best = new Map<string, Located>();
  for (const site of sites) {
    const key = `${site.at}`;
    const held = best.get(key);
    if (!held || order[site.rule] < order[held.rule]) best.set(key, site);
  }
  return Array.from(best.values())
    .sort((a, b) => a.at - b.at)
    .map(({ at: _at, ...site }) => site);
}

/** The key a census row and a site are matched on: everything but the line. */
export function censusKey(site: { file: string; rule: CreditSite["rule"]; expression: string }): string {
  return `${site.file}|${site.rule}|${site.expression}`;
}

/**
 * The census as a budget rather than a set.
 *
 * ⚠ **A row carries a COUNT, and the first shape of this did not.** 106
 * measured sites collapsed to 79 distinct (file, rule, expression) keys — the
 * same shape really does appear several times in one file — so a set-shaped
 * list silently excused a NEW site whose text matched one already excused.
 * A budget catches the 107th occurrence of a shape budgeted for 3.
 */
function censusBudget(): Map<string, number> {
  const budget = new Map<string, number>();
  for (const row of UNROUTED) budget.set(censusKey(row), row.count);
  return budget;
}

/** Count the shapes the rules look at, so silence can be told from a clean tree. */
function countFloors(file: string, source: string): { formatCalls: number; interpolations: number } {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let formatCalls = 0;
  let interpolations = 0;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "toLocaleString"
    ) {
      formatCalls += 1;
    }
    if (isDisplayHelperCall(node)) formatCalls += 1;
    if (ts.isTemplateExpression(node) || ts.isJsxExpression(node)) interpolations += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { formatCalls, interpolations };
}

/** Every file this guard reads — exported so the suite can assert the population. */
export function creditDisplayPopulation(repoRoot: string): string[] {
  return execFileSync("git", ["ls-files", "*.ts", "*.tsx"], {
    encoding: "utf8",
    cwd: repoRoot,
    maxBuffer: 32 * 1024 * 1024,
  })
    .split("\n")
    .map((line) => line.trim().replace(/\\/g, "/"))
    .filter((line) => line.length > 0)
    .filter((line) => SOURCE_ROOTS.some((root) => line.startsWith(root)))
    .filter((line) => !/\.test\.tsx?$/.test(line))
    .filter((line) => !line.startsWith("server/testing/"))
    .filter((line) => line !== THE_HELPER);
}

export function creditDisplaySites(repoRoot: string): CreditDisplayReading {
  const sites: CreditSite[] = [];
  const budget = censusBudget();
  let files = 0;
  let formatCalls = 0;
  let interpolations = 0;

  for (const file of creditDisplayPopulation(repoRoot)) {
    const source = readListedSource(join(repoRoot, file));
    if (source === null) continue;
    files += 1;
    const floors = countFloors(file, source);
    formatCalls += floors.formatCalls;
    interpolations += floors.interpolations;
    for (const site of creditSitesIn(file, source)) {
      const key = censusKey(site);
      const left = budget.get(key) ?? 0;
      if (left > 0) budget.set(key, left - 1);
      else sites.push(site);
    }
  }

  return { sites, files, formatCalls, interpolations };
}
