import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PLAN_TIERS } from "../../../../drizzle/schema";
import { OFFERED_PLAN_ORDER } from "../../../../server/stripe/stripeProducts";
import {
  CASTING_V2_ONE_CHARACTER_CREDITS,
  CASTING_V2_SIGN_PRICE_CREDITS,
} from "../../../../server/castingV2/castViewPackage";
import {
  CASTING_V2_REFINE_PRICE_CREDITS,
  CASTING_V2_ROLL_PRICE_CREDITS,
  CREDIT_COSTS,
} from "../../../../server/casting/castingCreditCosts";
import { withoutComments } from "../../../../server/testing/withoutComments";
import { displayBalance, formatCredits } from "../../../../shared/creditDisplay";
import {
  charactersFor,
  charactersPhrase,
  creditsTail,
  exampleSentence,
} from "./planLadder";
import { blurbFor } from "./planBlurbs";

/**
 * CARD #1607 (P1-8) — RINOA'S FOUR LINES ON EVERY PLAN CARD, AT THE NEW SCALE.
 *
 * The card's four, in its own words: *"(1) who it is for; (2) what it covers;
 * (3) credits, one pool, second and lighter, M-style from Scale up — "15,000
 * credits a month, one pool for everything."; (4) "For example, about 6
 * finished characters.""* plus the trust line *"See the price before you make
 * anything. Credits back if a result doesn't arrive."*
 *
 * ## What these arms are FOR, because two of them could be written three ways
 *
 * The card's own rule is *"Every number through P1-1's helper; the example
 * counts are derived from the constants, not typed"* — so the arms that matter
 * here **DRIVE the derivation over the real `PLAN_TIERS` and the real prices**
 * rather than pinning the seven sentences the ladder happens to produce today.
 * A literal pin would have shipped the card's own quoted figures: its body was
 * written 2026-09-30 and quotes `Pro 16 / Studio 38 / Business 200 / Scale
 * 1,100 / Enterprise 3,600`, three of which were computed against the grant
 * ladder he **rounded** the next day (#1602). The card calls its wording
 * *"quotation, not requirement"* for exactly this reason.
 *
 * ⚠ **THE DIRECTION OF THE ROUNDING IS THE ONE THING HERE THAT IS A SAFETY
 * PROPERTY**, and it is driven as a property rather than asserted at seven
 * points: a count of what a plan COVERS may never exceed what it covers. That
 * is `creditDisplay.ts`'s asymmetry read on a different question — a balance
 * rounds down, a price rounds up — and it is why `charactersFor` floors where
 * the card's quoted `Pro 16` had rounded up from 15.7.
 *
 * ⚠ **AND ONE ARM EXISTS BECAUSE IT WOULD HAVE CAUGHT A LIVE DEFECT.** The
 * credits line was the figure plus a letterspaced `A MONTH` stamp, drawn for
 * every rung including **free** — whose `monthlyCredits` is a ONE-TIME signup
 * grant, as its own declaration in `drizzle/schema.ts` says. A free account was
 * told 2,700 credits arrive every month when they arrive once. Nothing could go
 * red, because the stamp was a literal in the JSX and no suite read the free
 * rung through it.
 */

const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const CLIENT = join(HERE, "..", "..");
const MODAL = join(CLIENT, "features", "billing", "ChangePlanModal.tsx");
const CSS = join(HERE, "settings.css");
const BILLING_ROUTER = join(HERE, "..", "..", "..", "..", "server", "routes", "billing.ts");

const read = (path: string) => readFileSync(path, "utf8");
/* Every source arm reads the code and not the prose about it — this file's own
   subject is copy, and the comments quote the copy they explain. */
const code = (source: string) => withoutComments(source);

/** The card draws the offered ladder; the hidden rung is never on it (#391). */
const offered = () => OFFERED_PLAN_ORDER.map((id) => ({ id, ...PLAN_TIERS[id] }));

describe("#1607 — the four lines, derived", () => {
  it("⚠ THE DIVISOR IS THE THREE PRICES THE STUDIO CHARGES, NOT THE LEGACY STUDIO'S", () => {
    /*
      The example's basis is the whole point of the line. It used to be
      `CREDIT_COSTS.castingImage` — declared in `castingCreditCosts.ts` as *"not
      part of the new scale"*, for a lane admin-only since #1654 — so the one
      figure telling a customer what their money buys was priced off a surface
      they cannot reach.

      Driven against the three live constants rather than against 11,450: the
      day his 2026-10-02 one-price ruling lands on `CASTING_V2_COSTS`, this arm
      follows it, where a pinned total would have had to be edited by hand.
    */
    expect(CASTING_V2_ONE_CHARACTER_CREDITS).toBe(
      CASTING_V2_ROLL_PRICE_CREDITS
        + CASTING_V2_REFINE_PRICE_CREDITS
        + CASTING_V2_SIGN_PRICE_CREDITS,
    );
    expect(
      CASTING_V2_ONE_CHARACTER_CREDITS,
      "the example is priced off the legacy studio again",
    ).not.toBe(CREDIT_COSTS.castingImage);

    const surface = code(read(MODAL));
    expect(surface, "the plan cards read the legacy per-frame price again").not.toContain(
      "castingImage",
    );
    expect(surface, "the plan cards query the legacy price list again").not.toContain(
      "credits.getCosts",
    );
    expect(surface, "the divisor is not the one the server derives").toContain(
      "plans?.oneFinishedCharacterCredits",
    );
    expect(
      code(read(BILLING_ROUTER)),
      "getPlans stopped serving the figure the cards divide by",
    ).toContain("oneFinishedCharacterCredits: CASTING_V2_ONE_CHARACTER_CREDITS");
  });

  it("⚠ THE EXAMPLE NEVER PROMISES MORE THAN THE PLAN COVERS — every offered rung", () => {
    /*
      The property, not the seven numbers. The count multiplied back by one
      character must fit inside the grant, or the card has overpromised; and it
      must stay within a tenth of the exact floor, or the readability rounding
      has quietly become a discount.
    */
    for (const rung of offered()) {
      const count = charactersFor(rung.monthlyCredits, CASTING_V2_ONE_CHARACTER_CREDITS);
      const exact = Math.floor(rung.monthlyCredits / CASTING_V2_ONE_CHARACTER_CREDITS);
      expect(count, `${rung.id}: nothing to state`).toBeGreaterThan(0);
      expect(
        count * CASTING_V2_ONE_CHARACTER_CREDITS,
        `${rung.id}: the card promises more characters than the grant covers`,
      ).toBeLessThanOrEqual(rung.monthlyCredits);
      expect(count, `${rung.id}: the count overshot the exact floor`).toBeLessThanOrEqual(exact);
      expect(
        count,
        `${rung.id}: the rounding threw away more than a tenth`,
      ).toBeGreaterThanOrEqual(Math.floor(exact * 0.9));
    }
  });

  it("⚠ THE FREE RUNG IS NOT TOLD ITS ONE-TIME GRANT ARRIVES EVERY MONTH", () => {
    /*
      THE LIVE DEFECT THIS CARD'S LINE 3 CARRIED AWAY. `A MONTH` was a literal
      in the JSX, under every rung, and `PLAN_TIERS.free.monthlyCredits` is a
      one-time signup grant.

      The arrival is derived from the PRICE, so this holds for whatever the free
      rung is next called — keying on the rung's id would be the fixed list his
      N3 principle rules out.
    */
    expect(creditsTail(PLAN_TIERS.free.price)).not.toMatch(/month/i);
    expect(creditsTail(PLAN_TIERS.free.price)).toContain("credits to start");
    for (const rung of offered().filter((entry) => entry.price > 0)) {
      expect(creditsTail(rung.price), `${rung.id}: a paid rung lost its month`).toContain(
        "credits a month",
      );
    }
    /* And one pool, on every rung — the claim the sentence exists to make while
       the per-use buckets on his approved page stay Phase 2. */
    for (const rung of offered()) {
      expect(creditsTail(rung.price)).toContain("one pool for everything.");
    }
    const surface = code(read(MODAL));
    expect(surface, "the `A MONTH` stamp is back on the credits figure").not.toContain("A MONTH");
    expect(code(read(CSS)), "the stamp's class came back without the stamp").not.toContain(
      "dp-plan__creditsunit",
    );
  });

  it("⚠ MILLIONS-STYLE FROM SCALE UP, AND THE THRESHOLD IS READ OFF THE TABLE", () => {
    /*
      The card asks for *"M-style from Scale up"*. `formatCredits` already does
      it from a million display credits up, so nothing new was written — what is
      held here is that the threshold still lands where the card says, which is
      a fact about the LADDER and moved under this rule once already (#1602
      rounded the three top grants the day after the card was written).
    */
    const displayed = (ledger: number) => formatCredits(displayBalance(ledger));
    expect(displayed(PLAN_TIERS.scale.monthlyCredits), "Scale left millions style").toMatch(/M$/);
    expect(
      displayed(PLAN_TIERS.enterprise.monthlyCredits),
      "Enterprise left millions style",
    ).toMatch(/M$/);
    expect(
      displayed(PLAN_TIERS.business.monthlyCredits),
      "Business crossed into millions style — the card says from Scale up",
    ).not.toMatch(/M$/);
  });

  it("⚠ ALL FOUR LINES ARE ON THE CARD, AND LINE 4 FOLLOWS LINE 3", () => {
    /*
      Line 1 is the blurb map (#404), line 2 the perk row (card 425 item 1),
      lines 3 and 4 the credits block.

      ⚠ **LINE 2 SITS AFTER THE ACTION AND THAT IS DELIBERATE** — card 390 item
      1 put the action in the middle so the decision does not sit behind four
      lines of detail, and `card425-guard.test.ts` holds it there. #1607 names
      an order for the PROSE; it does not ask for the button to move, and
      moving the perk row above it would mean weakening an arm whose reason is
      his own. The PR records the reading.
    */
    const surface = code(read(MODAL));
    const card = surface.slice(surface.indexOf("dp-plan__tierhead"));
    const blurb = card.indexOf("dp-plan__blurb");
    const credits = card.indexOf("dp-plan__credits");
    const makes = card.indexOf("dp-plan__makes");
    const perk = card.indexOf('className="dp-plan__perk"');
    for (const [name, at] of [
      ["line 1 (who it is for)", blurb],
      ["line 2 (what it covers)", perk],
      ["line 3 (credits, one pool)", credits],
      ["line 4 (the example)", makes],
    ] as const) {
      expect(at, `${name} left the plan card`).toBeGreaterThan(-1);
    }
    expect(credits, "line 3 is above the positioning line").toBeGreaterThan(blurb);
    expect(makes, "the example is above the credits line it is an example of").toBeGreaterThan(
      credits,
    );
    /* Line 3's two parts: the figure carries the weight, the sentence is
       lighter — the card's *"second and lighter"*. */
    expect(surface).toContain("dp-plan__creditsfigure");
    expect(code(read(CSS))).toMatch(/\.dp-plan__creditsfigure\s*\{/);
    /* And both derived sentences come from the ladder module, not from JSX. */
    expect(surface).toContain("creditsTail(plan.priceInCents)");
    expect(surface).toContain("charactersFor(plan.credits, oneCharacterCredits)");
  });

  it("⚠ EVERY OFFERED RUNG HAS ALL FOUR LINES WITH SOMETHING TO SAY", () => {
    /* The four lines are only four lines if none of them is empty on a rung the
       card draws — #404's `null` branch draws nothing, which is right for an
       unwritten blurb and wrong as a silent state for a whole rung. */
    for (const rung of offered()) {
      expect(blurbFor(rung.id), `${rung.id}: line 1 is empty`).toBeTruthy();
      expect(creditsTail(rung.price).length, `${rung.id}: line 3 is empty`).toBeGreaterThan(0);
      expect(
        exampleSentence(charactersFor(rung.monthlyCredits, CASTING_V2_ONE_CHARACTER_CREDITS)),
        `${rung.id}: line 4 is empty`,
      ).toMatch(/^For example, about [\d,]+ finished character/);
    }
    /* The singular is a real case: the free grant covers one. */
    expect(exampleSentence(1)).toBe("For example, about 1 finished character.");
    expect(exampleSentence(2)).toBe("For example, about 2 finished characters.");
    /* Nothing to state draws nothing, rather than "about 0". */
    expect(exampleSentence(0)).toBeNull();
    expect(charactersFor(100, 0), "a divisor nobody has read became a count").toBe(0);
  });

  it("⚠ THE COMPARE TABLE PRINTS THE CARD'S OWN PHRASE, NOT A SECOND COPY OF IT", () => {
    /*
      ⚠ **THIS ARM EXISTS BECAUSE THE TABLE GOT IT WRONG, AND IT WAS SEEN IN
      THE RUNNING APP RATHER THAN REASONED ABOUT.** The *"What that makes"* row
      composed its own `about ${n} characters` and read **`about 1
      characters`** on the free column — working law 4, drifted inside a single
      afternoon, on the one rung whose count is 1.

      So the arm holds the SHAPE rather than the string: one declaration, and
      the table reads it. A second composition anywhere in the surface is what
      this refuses.
    */
    expect(charactersPhrase(1)).toBe("about 1 finished character");
    expect(charactersPhrase(15)).toBe("about 15 finished characters");
    expect(charactersPhrase(1_200)).toBe("about 1,200 finished characters");
    expect(charactersPhrase(0)).toBeNull();
    /* `exampleSentence` is the phrase in a sentence, and is held to being
       exactly that — so a future edit to one of them moves both. */
    expect(exampleSentence(1)).toBe(`For example, ${charactersPhrase(1)}.`);
    expect(exampleSentence(15)).toBe(`For example, ${charactersPhrase(15)}.`);

    const surface = code(read(MODAL));
    expect(surface, "the compare table composes the phrase again").not.toMatch(
      /\$\{[^}]*\}\s*(finished\s*)?characters/,
    );
    expect(surface, "the compare table stopped reading the shared phrase").toContain(
      "charactersPhrase(charactersFor(plan.credits, oneCharacterCredits))",
    );
  });

  it("⚠ THE TRUST LINE IS STATED ONCE, IN BOTH MODES, AND NAMES NO ENGINE", () => {
    /*
      It sits outside the card/compare branch so one statement serves both
      views — the duplication card 390 removed and card 425 was careful not to
      bring back. The second half of it is narrower than it looks and the
      constant's own docblock carries the reading: under the catastrophic-only
      refund ruling a DISPUTED frame is delivered and charged, so the promise is
      about a result that does not arrive, never about one somebody dislikes.
    */
    const surface = code(read(MODAL));
    expect(
      surface.match(/dp-plan__trust/g)?.length,
      "the trust line is stated twice, or not at all",
    ).toBe(1);
    expect(surface).toContain("See the price before you make anything.");
    expect(surface).toContain("Credits back if a result doesn't arrive.");
    expect(code(read(CSS))).toMatch(/\.dp-plan__trust\s*\{/);
    /* The disappearing-technology law's clause 5: no engine name on a path
       somebody must walk. A billing surface is such a path. */
    for (const engine of ["sunburst", "nano banana", "gpt-image", "gemini", "fal."]) {
      expect(
        surface.toLowerCase(),
        `an engine name reached the plan surface: ${engine}`,
      ).not.toContain(engine);
    }
  });
});
