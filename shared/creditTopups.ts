/**
 * THE TOP-UP LADDER — one declaration, read by the checkout and by the screen
 * that offers it (#1606, P1-7).
 *
 * # What a customer is buying
 *
 * Credits in **units of 5,000**, at a rate that falls as the order grows:
 * $12 for one unit, $11 each from two, $10 each from five. So the three packs
 * his design names are 5,000 for $12, 10,000 for $22 and 25,000 for $50, and a
 * slider between them is the same ladder read at any whole number of units.
 * Nothing here is a discount on a plan — every rate below is deliberately
 * worse than the cheapest plan's (the arm in `server/creditTopupLadder.test.ts`
 * holds it against `PLAN_TIERS`), which is what makes the surface's *a bigger
 * plan gives more for the money* line true rather than decorative.
 *
 * # Why the ladder is three STRIPE PRICES charged by quantity
 *
 * His own hand created exactly three one-off prices on 2026-10-02, and their
 * amounts are **per 5,000 credits** rather than per pack: 1200¢, 1100¢, 1000¢
 * under `klieg_topup_5000_v2`, `klieg_topup_10000_v2`, `klieg_topup_25000_v2`.
 * A checkout therefore sends ONE price with `quantity = units`, and which of
 * the three it sends is decided by how many units were asked for. A flat ladder
 * would have needed one price; three per-unit prices in his own brackets are
 * the artifact, and the artifact is what this module is derived from.
 *
 * ⚠ **AND THAT CORRECTS A SENTENCE IN THE RECORD, read at the artifact rather
 * than at the paraphrase (law 7c).** `.agents/foreman/PROGRAM.md` describes the
 * slider as *"charged as the 5,000 pack's Stripe price with quantity"*. That
 * was written while the ladder was FLAT ($12 / $24 / $60), where $12 × quantity
 * **is** the pack price, and it is no longer true under the volume ladder he
 * ruled the same day: $12 × 2 is $24 where his own 10,000 pack is $22. Taken
 * literally it would charge every slider position the worst rate on the ladder
 * and sell the identical number of credits for more money than the pack beside
 * it. The bracket is read from the unit count, so the slider and the pack at
 * the same size cost the same thing by construction.
 *
 * # The key is composed, never typed
 *
 * `klieg_topup_<bracket's own size>_v2` — the size being the display credits
 * the bracket's first order buys (1 unit → 5,000, 2 → 10,000, 5 → 25,000),
 * which is exactly how he named them. `server/stripe/stripePriceCatalogue.ts`
 * owns the composition for the same reason it owns the plan keys: Stripe's
 * dialect belongs on the server side of the wire, and the three composed keys
 * are pinned against the three real ones in its suite.
 */
import { LEDGER_PER_DISPLAY_CREDIT } from "./creditDisplay";

/**
 * The unit a top-up is sold in, on the customer's scale.
 *
 * It is the slider's step and the smallest pack, because those are one fact:
 * his design asks for *"a 5,000-step slider"* and *"the three packs"*, and a
 * step size that was not also the smallest pack would make the first slider
 * position unbuyable.
 */
export const TOPUP_UNIT_DISPLAY_CREDITS = 5_000;

/** The same unit in ledger credits — what `addTopupCredits` actually grants. */
export const TOPUP_UNIT_LEDGER_CREDITS =
  TOPUP_UNIT_DISPLAY_CREDITS * LEDGER_PER_DISPLAY_CREDIT;

/**
 * The largest single top-up, in units — 100,000 credits for $200.
 *
 * ⚠ **A BOUND IS NOT OPTIONAL ON THIS INPUT, and the number is the only part
 * of it that is a judgement.** `quantity` is what decides the charge, so an
 * unbounded unit count is an unbounded charge composed from a request body
 * (invariant 4's reason, on a money path). The figure is four times the biggest
 * pack and past it a plan is plainly the better buy, which is the surface's own
 * nudge — so this is where the ladder stops asking and starts pointing. His to
 * move; nothing is derived from it except the slider's end and this refusal.
 */
export const TOPUP_MAX_UNITS = 20;

/**
 * One rate band: from `fromUnits` upward, each unit costs `centsPerUnit`.
 *
 * There is no `toUnits`, because a band's end is the next band's beginning and
 * storing both is the second list this repository keeps being bitten by. The
 * last band has no end at all — it runs to {@link TOPUP_MAX_UNITS}.
 */
export interface TopupBracket {
  /** The smallest order this rate applies to, in units. */
  readonly fromUnits: number;
  /** What one unit costs inside this band, in cents. */
  readonly centsPerUnit: number;
}

/**
 * His ladder, in his own brackets: 1 · 2–4 · 5+ at $12 · $11 · $10 a unit.
 *
 * Ordered, ascending by `fromUnits`, with the rate falling at every step.
 * `server/creditTopupLadder.test.ts` holds all three of those shape facts, so a
 * band inserted out of order or a rate that rises reddens rather than quietly
 * charging the wrong customer the wrong money.
 */
export const TOPUP_BRACKETS: readonly TopupBracket[] = [
  { fromUnits: 1, centsPerUnit: 1200 },
  { fromUnits: 2, centsPerUnit: 1100 },
  { fromUnits: 5, centsPerUnit: 1000 },
];

/**
 * The display size a bracket's Stripe price is NAMED for — 5,000 / 10,000 /
 * 25,000. Derived from the band's own first order, never typed beside it.
 */
export function topupBracketPackSize(bracket: TopupBracket): number {
  return bracket.fromUnits * TOPUP_UNIT_DISPLAY_CREDITS;
}

/** Whether a unit count is one this product sells. */
export function isSellableTopupUnits(units: number): boolean {
  return Number.isInteger(units) && units >= 1 && units <= TOPUP_MAX_UNITS;
}

/**
 * The band an order of `units` falls in.
 *
 * Throws on a count this product does not sell, rather than answering for it:
 * every caller here decides money, and the honest answers to "what does zero
 * units cost" are a refusal and nothing else.
 */
export function topupBracketFor(units: number): TopupBracket {
  if (!isSellableTopupUnits(units)) {
    /* ⚠ The unit SIZE is deliberately absent from this sentence. It said
       "whole units of 5,000 credits", which put a credit-named constant inside
       a sentence saying "credits" — rule 2 of the credit-display guard, and a
       true indictment of a shape that is nonetheless a developer's refusal
       rather than a customer's. The bound is what a caller needs. */
    throw new RangeError(
      `topupBracketFor: ${String(units)} is not a top-up this product sells `
      + `(1 to ${TOPUP_MAX_UNITS} whole units)`,
    );
  }
  /* Last band whose floor the order reaches. Read from the end so the widest
     band wins without any band needing to know its own ceiling. */
  for (let i = TOPUP_BRACKETS.length - 1; i >= 0; i--) {
    if (units >= TOPUP_BRACKETS[i].fromUnits) return TOPUP_BRACKETS[i];
  }
  /* Unreachable while the first band starts at 1, which its own arm holds. */
  throw new RangeError(`topupBracketFor: no rate band covers ${units} units`);
}

/** What an order of `units` costs, in cents. */
export function topupPriceInCents(units: number): number {
  return topupBracketFor(units).centsPerUnit * units;
}

/** What an order of `units` grants, in ledger credits. */
export function topupLedgerCredits(units: number): number {
  if (!isSellableTopupUnits(units)) {
    throw new RangeError(
      `topupLedgerCredits: ${String(units)} is not a top-up this product sells`,
    );
  }
  return units * TOPUP_UNIT_LEDGER_CREDITS;
}

/** What an order of `units` is worth on the customer's scale. */
export function topupDisplayCredits(units: number): number {
  if (!isSellableTopupUnits(units)) {
    throw new RangeError(
      `topupDisplayCredits: ${String(units)} is not a top-up this product sells`,
    );
  }
  return units * TOPUP_UNIT_DISPLAY_CREDITS;
}

/**
 * THE THREE PACKS — derived from the bands, never declared beside them.
 *
 * ⚠ **THIS SYMBOL WAS WRITTEN IN SLICE 1 AND TAKEN BACK OUT, BY DESIGN, AND
 * THIS IS THE COMMIT THAT WAS WAITING FOR.** Its note read: *"the only thing
 * that would read it is the Add credits surface, which is this card's NEXT
 * slice … It arrives with the surface that draws it."* An export whose only
 * importers are its own tests is what `sweep-uncalled-exports-disposable.mts`
 * lists and what the deletion door then demands a verdict for — and the only
 * verdict that table has is *ruled for removal, waiting on a blocker*, which
 * would be false of a symbol about to gain a consumer. The consumer is
 * `client/src/features/billing/AddCreditsModal.tsx`, in this commit.
 *
 * **A pack IS a band's own first order.** 1 unit, 2 units, 5 units — his three
 * brackets read at their own floors, which is exactly how he named the Stripe
 * prices. So there is no second list of sizes to keep in step with the ladder
 * (working law 4), and a band he moves moves its pack with it.
 *
 * Ordered **biggest first**, because his design says so in terms: *"The three
 * packs, biggest first"*. The surface draws them in array order and holds no
 * opinion about it.
 */
export interface TopupPack {
  /** Units of {@link TOPUP_UNIT_DISPLAY_CREDITS}, which is what a checkout sends. */
  readonly units: number;
  /** What it costs, in cents, at this band's own rate. */
  readonly cents: number;
}

/*
 * ⚠ **THERE IS NO `displayCredits` ON A PACK, AND IT WAS WRITTEN AND TAKEN OUT
 * IN THIS SAME COMMIT.** It carried `topupBracketPackSize(bracket)` — the
 * 25,000 / 10,000 / 5,000 a customer reads — and the surface never read it: a
 * credit figure a customer sees has to come through `displayBalance` to be
 * printable at all (P1-1's rule, made structural by `DisplayCredits` being a
 * branded type), so the screen derives it from `topupLedgerCredits` and this
 * field was a second copy of the same number one conversion away. Working law
 * 4 bans exactly that, and the compiler happened to enforce it here.
 */
export const TOPUP_PACKS: readonly TopupPack[] = TOPUP_BRACKETS
  .map((bracket) => ({
    units: bracket.fromUnits,
    cents: topupPriceInCents(bracket.fromUnits),
  }))
  .reverse();

/**
 * WHICH ORDER SIZE IS THE BEST VALUE — the units behind the one badge, or
 * `null` when there is nothing to badge.
 *
 * ⚠ **A BADGE ON EQUAL RATES IS A LIE, AND THAT IS HIS DESIGN'S OWN WORDING**:
 * *"One badge only, Best value, on the pack with the best credits per dollar
 * once the finance figures give the packs different rates; today all three are
 * $12 per 5,000, so no badge until they differ."* That sentence was written
 * under the FLAT ladder; his volume ladder of the same day gives the three
 * bands three different rates, so the badge is earned — **but the condition
 * stays**, because it is the honest one and because a flat ladder is one price
 * word away from coming back.
 *
 * ⚠ **AND IT IS A PROPERTY OF THE BANDS RATHER THAN OF THE PACKS**, which is
 * what makes it true of the slider too. The slider charges a band's rate at any
 * whole number of units, so *best value* means *the cheapest band*, and the
 * surface can ask the same question of a slider position as of a pack.
 *
 * Returns the cheapest band's floor. With every band at one rate there is no
 * best, and the answer is `null` rather than the first or the last — a
 * tie-break would put a badge on a pack that is not better than its
 * neighbours.
 *
 * ⚠ **THE BANDS ARE A PARAMETER, AND THAT IS `castingSliceCredits`'s REASON
 * RATHER THAN A CONVENIENCE.** The no-badge branch exists for a ladder whose
 * rates are equal, and the live ladder's are not — so an arm over the real
 * constants can only ever drive ONE of the two answers, and the branch that
 * exists to stop a lie would be the untested one (working law 2: an arm over
 * numbers that cannot disagree proves nothing). `server/creditTopupLadder.test.ts`
 * hands it a flat ladder to see the `null`.
 */
export function bestValueTopupUnits(
  brackets: readonly TopupBracket[] = TOPUP_BRACKETS,
): number | null {
  if (brackets.length === 0) return null;
  const rates = brackets.map((bracket) => bracket.centsPerUnit);
  const cheapest = Math.min(...rates);
  if (rates.every((rate) => rate === cheapest)) return null;
  /* The FIRST band at the cheapest rate: two bands sharing one rate are one
     rate, and the smaller order reaches it sooner. */
  const band = brackets.find((bracket) => bracket.centsPerUnit === cheapest);
  return band ? band.fromUnits : null;
}

/**
 * THE WORD A CHECKOUT SESSION CALLS ITSELF BY, declared once.
 *
 * The session builder writes `metadata.type` and the webhook reads it to decide
 * whether a completed payment is a credit purchase. Two spellings of one word
 * across that wire is a grant that silently never happens — the session says
 * `topup`, the handler compares against `top_up`, the customer pays and nothing
 * arrives, and no test that owns only one side can see it. The existing
 * subscription road writes the string `"subscription"` in two places; this one
 * has a constant from its first commit.
 */
export const TOPUP_CHECKOUT_KIND = "topup";

/**
 * WHAT AN ACCOUNT WITH NO PLAN IS TOLD, and it is an offer rather than a wall.
 *
 * Top-ups are for plan holders (the card's own rule), so this sentence is read
 * by somebody who wanted to spend money and could not. It names what was
 * refused and what to do, in the customer's words — no tier id, no status, no
 * machinery (the disappearing-technology law's refusal clause).
 */
export const TOPUP_NEEDS_A_PLAN_SENTENCE =
  "Credit packs are for accounts on a plan. "
  + "Pick a plan and you can add credits any time you need them.";

/**
 * WHETHER AN ACCOUNT MAY BUY A CREDIT PACK — the card's rule, in one place.
 *
 * *"Plan holders only, enforced server-side."* So it is the plan RUNG and
 * nothing else, and the two things deliberately absent are worth naming
 * because each looks like diligence:
 *
 *  · **The Stripe status is not read.** A `past_due` or `unpaid` subscriber is
 *    a plan holder whose card needs attention, and refusing to sell credits to
 *    a customer trying to pay us is a wall the card never asked for. A
 *    subscription that truly ends takes the rung with it — the deleted-event
 *    handler downgrades the account to `free` — so the dead case is already
 *    answered by the rung alone.
 *  · **No separate sentence for a dying plan**, for the same reason: with the
 *    rung as the whole rule there is exactly one refusal, and a second sentence
 *    nobody can reach is a copy waiting to be edited into service.
 *
 * ⚠ **AND IT ANSWERS THREE STATES, NOT TWO, FOR THE REASON THIS SURFACE HAS
 * PAID EIGHT TIMES THIS WEEK** (#1703, #1725, #1727, #1730, #1741, #1747,
 * #1749, #1755 — every one of them a billing screen acting on a plan nobody had
 * read yet). A boolean would make an UNREAD plan false, which on this question
 * means *"you have no plan — pick one"*, and a Pro subscriber would read that
 * for the second their status is in flight. So the absence of an answer is its
 * own answer and the caller has to say what it does with it; the screen draws
 * neither the packs nor the offer until the plan is known.
 *
 * It takes the rung as a plain string so the client can ask it of whatever
 * `billing.getStatus` hands back without importing the plan table.
 */
export type TopupEligibility = "may-buy" | "needs-a-plan" | "unread";

export function topupEligibility(
  planTier: string | null | undefined,
): TopupEligibility {
  if (typeof planTier !== "string" || planTier === "") return "unread";
  return planTier === "free" ? "needs-a-plan" : "may-buy";
}
