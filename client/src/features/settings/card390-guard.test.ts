import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PLAN_TIERS } from "../../../../drizzle/schema";
import {
  annualPrice,
  creditsPerDollar,
  formatCreditsPerDollar,
  monthlyEquivalent,
} from "./planMath";

/**
 * CARD 390 — the six form corrections, held where each one can actually fail.
 *
 * His design agent read the Change plan modal and made six points; the
 * reconciliation found a seventh thing neither it nor the brief could know,
 * and it is the one that decides whether this card did damage:
 *
 * ⚠ **THE PROTOTYPE DRAWS A PRICING LADDER THE PRODUCT DOES NOT HAVE.** Five
 * rungs — Starter · Pro · Studio · **Agency** · **Network** — at `$149 / $349 /
 * $749` with `6,000` credits on Studio. The product has **twelve**, `Agency`
 * and `Network` are not among them, and the credit figures are ~83× apart. His
 * own rule settles it, verbatim: *"the credits and things like that in the
 * mockup are obviously not the same as the live server that is the source of
 * truth a mockup isnt."*
 *
 * So the first arm below is the important one and the other six are hygiene: a
 * build that copies a mockup's price into a billing surface has invented a
 * pricing ladder, and nothing else in this suite would notice.
 *
 * ## Why the arithmetic arms DRIVE and the layout arms READ
 *
 * `monthlyEquivalent` and `formatCreditsPerDollar` are functions, so they are
 * called against `PLAN_TIERS` itself — the real table, never a fixture, so a
 * price edit that breaks the value argument goes red here rather than on a
 * customer's screen. Element ORDER inside one JSX return is not observable from
 * a function, so those arms read the source; they are pinned to class names
 * that only this surface uses, and the frames in the PR are what actually show
 * the layout.
 *
 * ⚠ **COMMENTS ARE STRIPPED BEFORE EVERY SOURCE ARM.** The component's own
 * docblock quotes `Agency`, `Network` and `2.79¢` in the course of banning
 * them, and section 03's guard has already been red once for exactly this — a
 * rule written in prose is not a rule shipped, and it must not be mistaken for
 * one in either direction.
 */

const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const CLIENT = join(HERE, "..", "..");
const MODAL = join(CLIENT, "features", "billing", "ChangePlanModal.tsx");

const read = (path: string) => readFileSync(path, "utf8");
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** The paid rungs, in ladder order, straight off the product's own table. */
const PAID = Object.values(PLAN_TIERS).filter((tier) => tier.price > 0);

describe("card 390 — the ladder on screen is the product's, never the mockup's", () => {
  it("⚠ NO PROTOTYPE PLAN NAME, PRICE OR CREDIT FIGURE IS TYPED INTO THE SURFACE", () => {
    /*
      The bar, verbatim: *"No plan name, price, credit figure or perk is copied
      from the prototype. Every one comes from `PLAN_TIERS`. Asserted, because
      this is the single way this card can do real damage."*
    */
    const surface = code(read(MODAL)) + code(read(join(HERE, "planLadder.ts")));
    for (const invented of [
      "Agency",
      "Network",
      "$149",
      "$349",
      "$749",
      "2.79¢",
      "2.63¢",
      "2.48¢",
      "2.33¢",
      "1.87¢",
    ]) {
      expect(surface, `the mockup's \`${invented}\` was typed into the surface`).not.toContain(
        invented,
      );
    }

    /* The control for an absence arm: the names it DOES use are the real ones,
       and they arrive through the ladder rather than as literals. */
    expect(Object.values(PLAN_TIERS).map((tier) => tier.name)).not.toContain("Agency");
    expect(code(read(MODAL))).toContain("{plan.name}");
  });

  it("⚠ AND NO PLAN NAME IS A LITERAL AT ALL — the whole ladder comes off the wire", () => {
    /*
      The sharper form of the arm above, and the one that survives a rename: the
      component may not contain ANY rung's name, ours included. Every one of the
      twelve reaches the screen through `billing.getPlans` → `planLadder`.
    */
    const surface = code(read(MODAL));
    for (const tier of Object.values(PLAN_TIERS)) {
      expect(surface, `\`${tier.name}\` is hard-coded in the modal`).not.toContain(
        `"${tier.name}"`,
      );
    }
    expect(surface, "the modal stopped reading the server's plan list").toContain(
      "trpc.billing.getPlans.useQuery()",
    );
  });
});

describe("card 390 item 4 — the unit price is inverted, and it still argues for itself", () => {
  it("⚠ CREDITS PER DOLLAR IMPROVES AT EVERY ONE OF THE PAID RUNGS", () => {
    /*
      His bar: *"keep the monotonic check: the figure must improve at every
      rung. If the real ladder breaks that, the ladder is the bug."* Inverted,
      "improve" means ASCEND — you get more credits for your dollar as you
      climb. Read against `PLAN_TIERS` itself, not a fixture.
    */
    expect(PAID.length, "no paid rungs found — the reader is broken").toBe(11);
    for (let index = 1; index < PAID.length; index += 1) {
      const before = creditsPerDollar(PAID[index - 1].price, PAID[index - 1].monthlyCredits);
      const after = creditsPerDollar(PAID[index].price, PAID[index].monthlyCredits);
      expect(
        after,
        `${PAID[index].name} buys fewer credits per dollar than ${PAID[index - 1].name}`,
      ).toBeGreaterThan(before);
    }
  });

  it("⚠ AND THE CHECKER CAN FAIL — a rung made worse is caught", () => {
    /*
      Working law 2: verify the instrument before believing its finding. The arm
      above is green on today's table; this drives the same comparison over a
      ladder with one rung deliberately worsened and proves it goes red, so a
      green above means the ladder is monotonic rather than that the check is
      inert.
    */
    const sabotaged = PAID.map((tier, index) =>
      index === 4 ? { ...tier, monthlyCredits: Math.round(tier.monthlyCredits / 3) } : tier,
    );
    const ascends = sabotaged.every((tier, index) => {
      if (index === 0) return true;
      return (
        creditsPerDollar(tier.price, tier.monthlyCredits) >
        creditsPerDollar(sabotaged[index - 1].price, sabotaged[index - 1].monthlyCredits)
      );
    });
    expect(ascends, "the monotonic check passed a ladder that argues against itself").toBe(false);
  });

  it("⚠ EVERY PRINTED FIGURE SEPARATES ITS RUNG — the whole reason for inverting", () => {
    /*
      Item 4: *"`0.036¢ a credit` is not a value argument. At sub-penny
      precision the rungs differ in the third decimal."* Whole credits per
      dollar run 2,778 → 6,250 and every adjacent pair differs by hundreds.
    */
    const printed = PAID.map((tier) => formatCreditsPerDollar(tier.price, tier.monthlyCredits));
    expect(new Set(printed).size, `two rungs print the same figure: ${printed.join(" ")}`).toBe(
      printed.length,
    );
    /* Whole numbers with separators, never a decimal — a fraction of a credit
       buys nothing and reintroduces the precision problem being fixed. */
    for (const figure of printed) {
      expect(figure, `\`${figure}\` is not a whole number of credits`).toMatch(/^[\d,]+$/);
    }
    /* The free rung has no dollar to divide by and must not print `Infinity`. */
    expect(formatCreditsPerDollar(0, PLAN_TIERS.free.monthlyCredits)).toBe("free");
  });

  it("the surface prints the inverted figure and not the old one", () => {
    const surface = code(read(MODAL));
    expect(surface).toContain("formatCreditsPerDollar");
    expect(surface, "the cents-per-credit figure is still on the cards").not.toContain(
      "formatCentsPerCredit",
    );
    expect(surface, "the compare row still asks for cost per credit").not.toContain(
      "Cost per credit",
    );
    expect(surface).toContain('label: "Credits per dollar"');
  });
});

describe("card 390 item 2 — annual is a rate, not a bigger number", () => {
  it("⚠ THE MONTHLY EQUIVALENT IS THE YEAR WE CHARGE, DIVIDED BY TWELVE", () => {
    /*
      *"A customer toggling from $149 / month to $1,490 / year reads a tenfold
      price rise"* — and it makes `2 MONTHS FREE` unverifiable, because the
      badge claims a saving the number does not show. Derived from
      `annualPrice`, so the figure a customer divides in their head is the
      figure we charge.
    */
    for (const tier of PAID) {
      const equivalent = monthlyEquivalent(tier.price);
      expect(equivalent, `${tier.name}'s annual rate is not cheaper`).toBeLessThan(tier.price);
      expect(
        Math.abs(equivalent * 12 - annualPrice(tier.price)),
        `${tier.name}: the monthly equivalent does not multiply back to the year charged`,
      ).toBeLessThanOrEqual(12);
    }
    /* The badge is verifiable now: two months of the equivalent is what the
       year saves against twelve months at the monthly rate, give or take the
       rounding on a single cent per month. */
    const studio = PLAN_TIERS.studio.price;
    expect(studio * 12 - annualPrice(studio)).toBeGreaterThan(monthlyEquivalent(studio));
  });

  it("⚠ NO PRICE ON THIS SURFACE IS A YEAR'S TOTAL, AND THE COMPARE LABEL DOES NOT MOVE", () => {
    /*
      Item 2's second half: *"Compare-mode's row label stays Price a month. The
      full annual figure belongs in the confirm step, where it is what actually
      gets charged."* §6d's row 6 says `Price a month` flatly.
    */
    const surface = code(read(MODAL));
    expect(surface, "a year's total is still rendered on this surface").not.toContain(
      "annualPrice",
    );
    expect(surface, "the compare row label still moves with the toggle").not.toContain(
      "Price a year",
    );
    expect(surface).toContain('label: "Price a month"');
    expect(surface, "the card price still names the year").not.toMatch(
      /"annual" \? "year" : "month"/,
    );
    /* And the interval is carried by a word instead of by the number. */
    expect(surface).toContain("billed yearly");
    /* The badge is untouched — §6b's one framing everywhere. */
    expect(surface).toContain("{monthsFree()} MONTHS FREE");
  });
});

describe("card 390 items 1, 3, 5 and 6 — the form of a card", () => {
  it("⚠ THE ACTION SITS IN THE MIDDLE, BEFORE THE CREDITS BLOCK", () => {
    /*
      Item 1: §6c's order is name + unit → price → blurb → **action** → credits
      block → perks. It ran last, so *"the decision is gated behind four lines
      of detail"* — and on the recommended card, which carries the only ink
      button in the view, it sat furthest from the price.
    */
    const surface = code(read(MODAL));
    const card = surface.slice(surface.indexOf("dp-plan__tierhead"));
    const price = card.indexOf("dp-plan__price");
    const action = card.indexOf("dp-plan__here");
    const block = card.indexOf("dp-plan__block");
    expect(price, "the price left the card").toBeGreaterThan(-1);
    expect(action, "the action slot left the card").toBeGreaterThan(-1);
    expect(block, "the credits block left the card").toBeGreaterThan(-1);
    expect(action, "the action moved back above the price").toBeGreaterThan(price);
    expect(block, "the action fell back below the credits block").toBeGreaterThan(action);
  });

  it("⚠ ITEM 3'S HALF THAT SURVIVES — THE SENTENCE IS DECLARED ONCE AND EACH VIEW SAYS IT ONCE", () => {
    /*
      ⚠ **THIS ARM WAS `THE PERK THAT DOES NOT DIFFER IS NOT ON THE CARDS`, AND
      THE FOUNDER REVERSED THAT IN HIS OWN WORDS — IT IS SAID HERE RATHER THAN
      EDITED QUIETLY.** Card 425 item 1, verbatim: *"The tick reading 'Every
      model and every tool' bring it back because eventually i need to make
      benefits between each plan which will be a reminder for me."*

      Item 3 was two claims wearing one title. The first — *the identical perk
      does not belong on a card* — was a styling judgement of ours (§6d's test
      applied to a card), and his product reason outranks it: he is buying the
      SLOT for the day a benefit differs. **That half is dead and its
      replacement is `card425-guard.test.ts`, which pins the row's presence.**

      The second half is untouched and is what item 3 was actually protecting:
      **one declaration, and each view states the fact exactly once.** That is
      working law 4, it survives the reversal intact, and it is now stronger —
      the footnote is INTERPOLATED from the tick's constant, so the two cannot
      drift when he edits one.

      An arm whose subject a founder ruling removes is not weakened, it is
      re-aimed at what still holds; an arm quietly deleted is how a reversal
      loses the part of itself that was right.
    */
    const surface = code(read(MODAL));
    /* One declaration, two readers — the card's tick and compare mode's
       footnote, which is built FROM it rather than repeating it. Three
       mentions: the `const`, the interpolation, the JSX. A fourth means
       somebody typed the sentence somewhere instead of reading it. */
    expect(surface.match(/EVERY_PLAN_PERK/g)?.length, "the perk label is not shared").toBe(3);
    expect(
      surface,
      "the footnote hand-types the fact again instead of deriving it",
    ).toMatch(/const ONE_FOR_EVERY_PLAN = `\$\{EVERY_PLAN_PERK\}/);
    /* And the sentence is not stated twice in ONE view: exactly one footnote
       element survives, under the compare table. */
    expect(
      surface.match(/dp-plan__footnote/g)?.length,
      "a view is stating the every-plan sentence twice again",
    ).toBe(1);
    expect(surface).toContain("the only differences are the ones shown above");
  });

  it("⚠ §6c'S BLURB SLOT IS EMPTY AND THE FRAMES LINE IS IN THE CREDITS BLOCK", () => {
    /*
      Item 5: *"The blurb slot was quietly filled by the frames line."* There is
      no server field for a positioning statement, so the slot ships empty and
      says so; `About N casting frames` is what the CREDITS make and §6c puts it
      inside the credits block.
    */
    const surface = code(read(MODAL));
    const css = code(read(join(HERE, "settings.css")));
    expect(surface, "the frames line is back in the blurb slot").not.toContain("dp-plan__blurb");
    expect(css, "the blurb class outlived its only consumer").not.toContain("dp-plan__blurb");
    expect(surface).toContain("dp-plan__makes");
    expect(css).toContain(".dp-plan__makes");
    /* And it is inside the block rather than beside it. */
    const block = surface.indexOf("dp-plan__block");
    const makes = surface.indexOf("dp-plan__makes");
    expect(makes).toBeGreaterThan(block);
  });

  it("⚠ NO INLINE STYLE WHERE A MODIFIER BELONGS", () => {
    /*
      Item 6: `style={{ position: "static", display: "inline-block" }}` meant
      `.dp-plan__tab` was only correct in one of its two contexts. *"Inline
      styles beating a class is how the CSS drifts."*

      ⚠ **THE SECOND CONTEXT IS GONE (#487) AND SO IS THE MODIFIER.** This arm
      used to require `.dp-plan__tab--inline` in both the surface and the CSS,
      which was correct while the tag sat in the compare head. He ruled the tag
      off that table, so the modifier had no consumer — and a class kept alive
      by a test that demands it is worse than the inline style this item was
      about. The half that survives his ruling is the half that was really the
      rule: no inline style overriding a class.
    */
    const surface = code(read(MODAL));
    const css = code(read(join(HERE, "settings.css")));
    expect(surface, "an inline style is overriding a class again").not.toMatch(/style=\{\{/);
    /* POSITIVE CONTROL — the reader can see this file's classes at all, so the
       absence arms below are readings rather than an empty string passing. */
    expect(surface).toContain("dp-plan__tab");
    expect(css).toContain(".dp-plan__tab");
  });

  /*
    ⚠ HIS RULING ON #487, and it supersedes §6d's ordering rule for this cell.
    Reply #115, verbatim and entire: *"dont show the fits your use tag on the
    compare table it doesnt look right. everything else looks good"*.

    Written as an arm rather than trusted to the comment beside it, because the
    thing that would quietly undo it is somebody re-reading §6d — which still
    says the tag outranks `YOU ARE HERE` — and putting it back.
  */
  /* The card number lives in the comment above, not the title: `#487` is a
     valid hex literal and `token-guard.test.ts` reads titles as code. */
  it("⚠ FITS YOUR USE IS NOT IN THE COMPARE TABLE — his ruling", () => {
    const surface = code(read(MODAL));
    const compareHead = surface.slice(surface.indexOf("dp-plan__comparegrid"));
    expect(compareHead.length, "the compare grid was not found — this arm is reading nothing")
      .toBeGreaterThan(200);
    expect(compareHead, "the tag is back in the compare table").not.toContain("FITS YOUR USE");
    /* The dead modifier goes with it — a class whose only consumer was that tag. */
    expect(surface).not.toContain("dp-plan__tab--inline");
    expect(code(read(join(HERE, "settings.css")))).not.toContain(".dp-plan__tab--inline");
    /* ⚠ POSITIVE CONTROLS, and they carry the whole arm. `not.toContain` is
       green over an empty string, and it is green if the tag simply moved.
       Both markers it lives beside are asserted PRESENT: the tag on the plan
       CARDS, which he did not object to and which must not be swept with it,
       and `YOU ARE HERE`, which is what the compare head still says. */
    expect(surface, "the tag was removed from the plan cards too — he ruled on the table only")
      .toContain("FITS YOUR USE");
    expect(compareHead, "`YOU ARE HERE` went with it").toContain("YOU ARE HERE");
  });
});
