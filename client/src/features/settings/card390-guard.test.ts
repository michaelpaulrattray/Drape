import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PLAN_TIERS } from "../../../../drizzle/schema";
import {
  annualPrice,
  creditsPerDollar,
  formatCreditsPerDollar,
  monthlyEquivalent,
  priceAMonth,
} from "./planMath";

import { sourceBand } from "../../../../server/testing/sourceBand";
import { withoutComments } from "../../../../server/testing/withoutComments";

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
/** The other billing surface that argues value — #403's half of item 4. */
const TOPUP = join(CLIENT, "features", "billing", "AddCreditsModal.tsx");
const MATH = join(CLIENT, "features", "settings", "planMath.ts");

const read = (path: string) => readFileSync(path, "utf8");
const code = (text: string) => withoutComments(text);

/**
 * ⚠ **`AddCreditsModal.tsx` IS THREE SURFACES, AND HIS RATE RULE APPLIES TO
 * EXACTLY ONE OF THEM — #1845.** `PlanStepUpPane` is what a FREE account opens:
 * eyebrow `PLANS`, heading *Choose a plan*, a button reading *Upgrade to …*, so
 * it is a plan surface and his #1773 word forbids a rate on it.
 * `CreditPacksPane` is a plan holder's Add credits, which is where he put the
 * rate's one home. **A file-level read cannot tell them apart and therefore
 * cannot state the rule** — which is not a theory: this suite WAS that reader,
 * and it passed a credits-per-$1 line standing on the plan pane for the day it
 * was live.
 *
 * The anchors are the function declarations, in source order, so a pane
 * renamed or removed REFUSES rather than answering an empty string (the band
 * reader's own negative control).
 */
const freePane = () => sourceBand(read(TOPUP), "function PlanStepUpPane", "function CreditPacksPane", "the free plan pane");
const packsPane = () => sourceBand(read(TOPUP), "function CreditPacksPane", "export function AddCreditsModal", "the credit packs pane");

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
    /* 7 paid rungs since the #391 fold — six offered plus the hidden top. */
    expect(PAID.length, "no paid rungs found — the reader is broken").toBe(7);
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

  it("⚠ AND THE LADDER THAT WAS REPLACED IS DRIVEN, NOT INFERRED — it falls at studio, scale and enterprise", () => {
    /*
      THE NEGATIVE CONTROL THE SCHEMA'S OWN COMMENT HAS BEEN ASSERTING IN PROSE.

      `drizzle/schema.ts` says, above `PLAN_TIERS`, that the approved proposal
      (rev 21.6) *"lowered Pro and up while leaving every monthly price where it
      was, and at those prices credits per dollar FELL at three rungs — Studio
      below Pro, Scale below Business, Enterprise below Scale"*. That sentence
      is the whole reason the founder was handed the LADDER as the bug rather
      than the guard, and it is why his volume-discount ladder exists at all.

      ⚠ **IT WAS INFERRED, AND THE PR #1704 REVIEW SAID SO** — *"no arm pins the
      OLD proposal's figures as a negative control … inferred, one arm would
      drive it"*. Law 7b: never guess, test or confirm. A comment cannot fail a
      test, so the one claim that justifies replacing a ladder was carried by
      the kind of sentence this repository has already been bitten by.

      ⚠ **THE PRICES COME OFF THE REAL TABLE AND ARE NOT TYPED HERE.** The
      proposal moved GRANTS only; reading its prices from a fixture would prove
      something about a ladder nobody ever proposed. So the comparison is the
      shipped prices against the superseded grants, which is the ladder that was
      actually on the table when he ruled.

      ⚠ **AND THE READER GETS A POSITIVE CONTROL IN THE SAME ARM** (working law
      2): the identical `fellAt` reader is run over the SHIPPED table and must
      come back empty. Without it, a reader that reports every rung as falling —
      or one that cannot see a fall at all — would pass this arm by accident.
    */
    /** The superseded proposal's ledger grants, by rung name (#1602's body). */
    const PROPOSED_LEDGER_GRANTS: Record<string, number> = {
      Starter: 75_000,
      Pro: 190_000,
      Studio: 440_000,
      Business: 2_350_000,
      Scale: 13_350_000,
      Enterprise: 41_500_000,
      Ultimate: 133_500_000,
    };

    /** Every rung where the figure does not IMPROVE on the rung below it. */
    const fellAt = (ladder: { name: string; price: number; monthlyCredits: number }[]) =>
      ladder
        .filter(
          (tier, index) =>
            index > 0 &&
            creditsPerDollar(tier.price, tier.monthlyCredits) <=
              creditsPerDollar(ladder[index - 1].price, ladder[index - 1].monthlyCredits),
        )
        .map((tier) => tier.name);

    /* A rung renamed or added must redden here rather than read as `undefined`. */
    const missing = PAID.filter((tier) => PROPOSED_LEDGER_GRANTS[tier.name] === undefined);
    expect(
      missing.map((tier) => tier.name),
      "a paid rung has no figure in the superseded proposal — this arm no longer covers the table",
    ).toEqual([]);

    const proposed = PAID.map((tier) => ({
      name: tier.name,
      price: tier.price,
      monthlyCredits: PROPOSED_LEDGER_GRANTS[tier.name],
    }));

    expect(
      fellAt(proposed),
      "the superseded proposal's ladder no longer falls where the schema's comment says it does",
    ).toEqual(["Studio", "Scale", "Enterprise"]);

    expect(
      fellAt([...PAID]),
      "the same reader reports a fall on the SHIPPED ladder — the finding above is the reader, not the proposal",
    ).toEqual([]);
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

  it("⚠ THE RATE LIVES ON ADD CREDITS AND NOWHERE ELSE (his word, card 1773 — card 403 INVERTED)", () => {
    /*
      ⚠ **THIS ARM ASSERTED THE OPPOSITE UNTIL 2026-10-02, AND THAT IS SAID
      HERE RATHER THAN EDITED QUIETLY.** It read `BOTH BILLING SURFACES ARGUE
      VALUE IN THE SAME UNIT (card 403)` and looped both files demanding that
      each print credits per dollar. **Card 403's finding was real and is not
      being overturned** — Add credits said the same fact in cents per credit
      for a fortnight, so a customer opening both surfaces in one session met
      one fact in two units. What is overturned is the REMEDY it chose, which
      was symmetry.

      His word settles it the other way (#1773, 2026-10-02): *"on the free card
      remove the free CREDITS PER $1 line thats stupid"*, then, on the reading
      that the rate belongs on Add credits and not on a plan card at all, *"yes
      i like this"*. **One home, rather than one unit in two places** — and
      card 403's defect is closed harder by this than it was by symmetry, since
      there is now only one surface that can state the unit at all.

      ⚠ **AND "ONE SURFACE" WAS ONE FILE, WHICH IS NOT THE SAME THING — #1845,
      and this arm is the reader that passed the defect.** `AddCreditsModal.tsx`
      draws a free account a PLAN pane (*Choose a plan*, *Upgrade to …*) and a
      plan holder a PACKS pane, and the rule is about the SURFACE. Read at the
      file, the rate it was holding Add credits to printing was partly the one
      standing on the plan pane — so the arm's positive half was being satisfied
      by the very line his word forbids. It reads per pane now.
    */
    const surface = code(read(MODAL));
    const topup = code(read(TOPUP));
    const free = code(freePane());
    const packs = code(packsPane());

    /*
      ⚠ **THE POSITIVE HALF IS FIRST BECAUSE THE NEGATIVE HALF IS WORTHLESS
      WITHOUT IT.** An absence arm whose subject has left the product entirely
      passes for the wrong reason — deleting `formatCreditsPerDollar` outright
      would satisfy every `not.toContain` below. So the pane that KEEPS the rate
      is held to printing it before any pane is held to not.
    */
    expect(
      packs,
      "the credit packs pane stopped printing credits per dollar — his word puts the rate HERE",
    ).toContain("formatCreditsPerDollar(");

    /*
      ⚠ **AND THE FREE ACCOUNT'S PANE IS A PLAN SURFACE, SO IT CARRIES NO RATE
      (#1845).** Measured at the real ladder before it went: a free account
      looking at Starter read `519 credits per $1` under the heading *Choose a
      plan* (`624` on annual), with no *up from* clause — the free rung has no
      price for the comparison to beat. Both the call and the printed
      words are refused: the words because that is what he read on screen, the
      call because a rate computed and formatted some other way is the same
      defect wearing different code.
    */
    expect(free, "a credits-per-dollar rate is back on the plan pane a free account opens")
      .not.toContain("formatCreditsPerDollar");
    expect(free, "the rate's printed words are back on the plan pane").not.toContain("credits per $1");
    expect(free, "`priceAMonth` is back on the plan pane, which only the retired rate read")
      .not.toContain("priceAMonth(");

    /* Change plan carries no rate, in either shape it had: the card chip and
       the compare row. */
    expect(surface, "a credits-per-dollar rate is back on the plan surface").not.toContain(
      "formatCreditsPerDollar",
    );
    expect(surface, "the compare table's rate row is back").not.toContain(
      'label: "Credits per dollar"',
    );
    expect(surface, "the chip's own class is back on the plan card").not.toContain("dp-plan__unit");
    /* And the chip's printed words, which is what he actually read on screen. */
    expect(surface, "the chip's text is back on the plan card").not.toContain("CREDITS PER $1");

    /*
      Card 403's own negative survives on BOTH files, and neither his word nor
      this change licenses it: nothing drifts back to the second unit.
    */
    for (const [path, text] of [
      [MODAL, surface],
      [TOPUP, topup],
    ] as const) {
      expect(text, `${path} is back on cents per credit`).not.toContain("formatCentsPerCredit");
    }
    expect(topup, "a cents-per-credit figure is back on the top-up surface").not.toContain("¢");
    /* And the formatter itself is gone, so there is nothing to drift back to. */
    expect(code(read(MATH)), "the second unit's formatter is back in planMath").not.toContain(
      "export function formatCentsPerCredit",
    );

    /*
      ⚠ `toContain` IS WEAKER THAN THE CLAIM ON THE SURVIVING SURFACE, AND IT
      WAS MEASURED BEFORE THIS LINE WAS FIRST WRITTEN. A sabotage that put
      `formatDollars` on ONE of two printed figures stayed green, because the
      import and the other call kept the token in the file. So the surviving
      rate is pinned by its SHAPE rather than by a word appearing somewhere.

      ⚠ **WHAT THE SHAPE IS HAS CHANGED WITH THE SUBJECT — #1845.** It used to
      be the plan pane's two-figure sentence (*the chosen rung, and the one
      being left*), and that sentence is gone with his rule. The packs pane's
      rate has the same two-site property for the same reason: the pack ROWS
      print it and the SLIDER prints it, off one `rateFor` declaration, so a
      sabotage that reverts one of the two readers leaves every token in the
      file. Both call sites are read.
    */
    expect(
      packs.match(/rateFor\(/g)?.length ?? 0,
      "a pack-rate reader stopped going through `rateFor` — the pack rows and the slider are both readers",
    ).toBeGreaterThanOrEqual(2);
    expect(
      packs.match(/formatCreditsPerDollar\(/g)?.length ?? 0,
      "the packs pane stopped computing its rate through the shared unit",
    ).toBeGreaterThanOrEqual(1);
  });

  it("⚠ THE TABLE LOST A ROW, NOT ITS NEIGHBOURS (card 1773)", () => {
    /*
      This arm read *"the surface prints the inverted figure and not the old
      one"* and held the rate PRESENT on the cards and in the table. Its
      negative half is untouched and still here — neither unit comes back. What
      replaces its positive half is the question his ruling actually raises:
      **a row was cut out of a literal array, and the risk of that is the
      neighbour that leaves with it.** He asked for the rate gone, not for a
      thinner comparison.

      The four surviving labels are listed by name rather than counted, because
      a count would pass a swap and the point is WHICH rows a customer still
      has to compare plans with.
    */
    const surface = code(read(MODAL));
    for (const label of [
      "Credits",
      "What that makes",
      "Unspent credits",
      "Price a month",
    ]) {
      expect(surface, `the compare table lost its \`${label}\` row with the rate`).toContain(
        `label: "${label}"`,
      );
    }
    /* And neither unit is anywhere on the surface — the old one by its row
       label, the new one by its own. */
    expect(surface, "the compare row still asks for cost per credit").not.toContain(
      "Cost per credit",
    );
    expect(surface, "the rate row is back in the table").not.toContain(
      'label: "Credits per dollar"',
    );
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

  it("⚠ THE FRAMES LINE IS IN THE CREDITS BLOCK, AND THE BLURB SLOT IS NOT IT", () => {
    /*
      Item 5: *"The blurb slot was quietly filled by the frames line."*

      ⚠ **THIS ARM IS RE-AIMED, NOT WEAKENED (#404).** It used to prove item 5
      by asserting the string `dp-plan__blurb` appeared NOWHERE — a fair proxy
      while the slot was empty, and the wrong rule the moment the founder
      ordered it filled. Read at what item 5 actually FOUND: the complaint was
      never that a blurb existed, it was that `About N casting frames` — what
      the credits MAKE — was standing in a slot §6c reserves for a positioning
      statement. **That half is untouched by his order and is what this arm
      holds now**: the frames line lives inside the credits block, and the
      blurb slot draws the blurb and nothing derived from credits.

      This repository has the precedent both ways round, one screen up in this
      same file: *"an arm whose subject a founder ruling removes is not
      weakened, it is re-aimed at what still holds; an arm quietly deleted is
      how a reversal loses the part of itself that was right."*

      ⚠ **A class-name absence was standing in for a behaviour**, which is the
      shape #594 fixed in the publish guard eight days ago — membership decided
      by a WORD rather than by what the code does.
    */
    const surface = code(read(MODAL));
    const css = code(read(join(HERE, "settings.css")));

    /* The slot is filled, and it is filled from the blurb map — not from
       anything the credits produce. */
    expect(surface, "the blurb slot lost its sentence").toContain("dp-plan__blurb");
    expect(css, "the blurb slot has no type of its own").toContain(".dp-plan__blurb");
    expect(
      surface,
      "the blurb is being computed from something other than the blurb map",
    ).toContain("const blurb = blurbFor(plan.id)");

    /* THE ORIGINAL FINDING, still held: the frames line is not what fills it.
       Whatever sits between `dp-plan__blurb` and the end of its element must
       not be the frames sentence or the call that builds it. */
    const slotAt = surface.indexOf("dp-plan__blurb");
    const slotEnd = surface.indexOf(String.fromCharCode(10), slotAt);
    const slotLine = surface.slice(slotAt, slotEnd < 0 ? surface.length : slotEnd);
    expect(slotLine, "the frames line is back in the blurb slot").not.toMatch(
      /frames|casting frames/i,
    );

    /* And the frames line is where §6c puts it — inside the credits block. */
    expect(surface).toContain("dp-plan__makes");
    expect(css).toContain(".dp-plan__makes");
    const block = surface.indexOf("dp-plan__block");
    const makes = surface.indexOf("dp-plan__makes");
    expect(makes).toBeGreaterThan(block);

    /* §6c's order: price → blurb → action. The slot is not merely present,
       it is in the position the brief asks for. */
    const price = surface.indexOf("dp-plan__price");
    const action = surface.indexOf("dp-plan__here");
    expect(slotAt, "the blurb is above the price").toBeGreaterThan(price);
    expect(slotAt, "the blurb fell below the action").toBeLessThan(action);
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

describe("card 661 — the rate is computed from the price standing beside it", () => {
  /**
   * ⚠ **THE DEFECT A CUSTOMER COULD CHECK AND FIND WRONG.** With Annual on, a
   * Change plan card printed `2,778 CREDITS PER $1` directly above
   * `$132 / month`: the price went through `monthlyEquivalent`, the rate went
   * on dividing by `$159`. The compare table said the same two things four
   * rows apart. Add credits — the surface #661 was actually filed about —
   * quoted the monthly rate under a year's charge, understating what was
   * being bought.
   *
   * These arms are here rather than in `planMath.test.ts` because the claim is
   * about the SURFACES: the arithmetic was never wrong, the pairing was.
   */

  it("⚠ THE ANNUAL RATE REPRODUCES FROM THE MONEY WE ACTUALLY CHARGE FOR A YEAR", () => {
    /*
      This is the arm that would have caught it. Credits per dollar is
      scale-invariant — a year's credits over a year's dollars is the same
      number as a month's over a month's — so the annual figure MUST equal the
      year's credits divided by `annualPrice`. A rate taken from the monthly
      price fails this by exactly the discount.
    */
    for (const tier of PAID) {
      const shown = creditsPerDollar(priceAMonth(tier.price, true), tier.monthlyCredits);
      const overAWholeYear = (tier.monthlyCredits * 12) / (annualPrice(tier.price) / 100);
      expect(
        Math.abs(shown - overAWholeYear) / overAWholeYear,
        `${tier.name}: the annual rate does not reproduce from the year we charge`,
      ).toBeLessThan(0.001);
      /* And the monthly reading is untouched — this changed no monthly figure. */
      expect(priceAMonth(tier.price, false)).toBe(tier.price);
    }
  });

  it("⚠ TURNING ANNUAL ON IMPROVES THE FIGURE, ON EVERY RUNG", () => {
    /*
      The toggle's whole claim is a saving. Before #661 the one line that
      argues value did not move when it was pressed, so the control that
      claims a discount left the value argument flat — §6b's complaint about
      the badge, in the sentence beside it.
    */
    for (const tier of PAID) {
      const monthly = creditsPerDollar(priceAMonth(tier.price, false), tier.monthlyCredits);
      const annual = creditsPerDollar(priceAMonth(tier.price, true), tier.monthlyCredits);
      expect(annual, `${tier.name}: annual buys no more per dollar than monthly`).toBeGreaterThan(
        monthly,
      );
    }
    /* And the ladder still ascends at the annual interval — item 4's monotonic
       claim is a claim about BOTH intervals, not just the one it was written
       for. */
    for (let index = 1; index < PAID.length; index += 1) {
      const before = creditsPerDollar(priceAMonth(PAID[index - 1].price, true), PAID[index - 1].monthlyCredits);
      const after = creditsPerDollar(priceAMonth(PAID[index].price, true), PAID[index].monthlyCredits);
      expect(after, `${PAID[index].name} is worse value than ${PAID[index - 1].name} on annual`).toBeGreaterThan(before);
    }
  });

  it("⚠ EVERY PRINTED RATE ON BOTH SURFACES READS AN INTERVAL-AWARE PRICE", () => {
    /*
      ⚠ **A `toContain` ARM WOULD PASS A HALF-REVERTED SURFACE, MEASURED LAST
      NIGHT ON THIS VERY SUITE.** The top-up sentence has two calls and the
      compare grid has one beside the card's one; a sabotage restoring the raw
      price on ONE of them leaves every token in the file. So each CALL is read
      and its first argument checked, and the population is derived from the
      calls found rather than from a number typed here.
    */
    /*
      ⚠ **`MODAL` IS 0 SINCE #1773 AND THE ROW STAYS IN THE POPULATION.** His
      word took the rate off every plan card and out of the compare table, so
      Change plan prints no rate to be interval-aware ABOUT — and the honest
      spelling of that is a count of zero, held, rather than a file quietly
      dropped from the loop. Two things keep the arm's teeth on it: zero is
      asserted (a rate reappearing on a plan surface reds here as well as in the
      card-403 arm above), and the `priceOf` hop checked at the foot of this arm
      still runs for `MODAL`, where the PRICE is still read through it.

      ⚠ **A ONE-OFF CREDIT PACK HAS NO BILLING INTERVAL, SO ITS RATE IS
      EXCLUDED BY NAME AND COUNTED SEPARATELY — #1606 slice 2.**

      This arm's subject is a rate printed beside a PLAN price: turning Annual
      on changes the charge, so a rate that did not move with it understated
      what was being bought (PR #662's finding). Add credits now also prints a
      rate for a credit PACK, computed from `topupPriceInCents` — a one-time
      purchase with no interval at all, where `priceAMonth` would be a
      category error rather than a safeguard.

      **It is enumerated rather than tolerated.** The plan-rate population
      stays pinned at exactly two per surface, so a plan rate that stopped
      reading the toggle still reddens; the pack rate is held to its own two
      facts below (no interval, and the LEDGER credit figure, because
      `formatCreditsPerDollar` divides by five inside itself — handing it the
      display figure would quote a fifth of the real rate and make every pack
      look twelve times worse than the plan beside it). A count that had simply
      been raised to three would have let a plan rate move into the exception.
    */
    /*
      ⚠ **BOTH SURFACES ARE 0 SINCE #1845, AND BOTH ROWS STAY IN THE
      POPULATION.** The last PLAN rate anywhere in the product was the free
      pane's, standing under *Choose a plan* against his #1773 rule, and it is
      gone. So there is no plan rate left to be interval-aware ABOUT — and the
      honest spelling of that is a held count of zero on each surface rather
      than a loop with no subjects: a plan rate reappearing on EITHER file reds
      here as well as in the card-403 arm above. The `priceOf` hop below still
      runs for `MODAL`, where the PRICE is still read through it, which is why
      this arm keeps its teeth with a zero on both sides.
    */
    const TOPUP_RATE_CALLEE = "topupPriceInCents";
    const wanted: Record<string, number> = { [MODAL]: 0, [TOPUP]: 0 };
    /* Exactly one pack-rate expression is expected, and it is `rateFor`'s —
       the pack rows and the slider both call it, so one declaration serves
       both and a second would be the mirror working law 4 bans. */
    const wantedTopupRates: Record<string, number> = { [MODAL]: 0, [TOPUP]: 1 };
    for (const path of [MODAL, TOPUP]) {
      const surface = code(read(path));
      const everyCall = [
        ...surface.matchAll(/formatCreditsPerDollar\(\s*([A-Za-z0-9_.]+)\(([^)]*)\)/g),
      ];
      const packRates = everyCall.filter(([, callee]) => callee === TOPUP_RATE_CALLEE);
      const calls = everyCall.filter(([, callee]) => callee !== TOPUP_RATE_CALLEE);
      expect(
        packRates.length,
        `${path}: expected ${wantedTopupRates[path]} credit-pack rates, found ${packRates.length}`,
      ).toBe(wantedTopupRates[path]);
      for (const match of packRates) {
        const [, , args] = match;
        /* The `[^)]*` above stops at the first bracket, so the second argument
           is read from a window of the SOURCE rather than from the match. */
        const whole = surface.slice(match.index ?? 0, (match.index ?? 0) + 160);
        /* The pack rate's own two facts. The second argument is what makes it
           land on the customer's scale; the first is already the pack's price
           in cents by its callee's name. */
        expect(
          args.replace(/\s+/g, " "),
          `${path}: the pack rate's price is not the ladder's own unit count`,
        ).toMatch(/^unitCount$/);
        expect(
          whole.replace(/\s+/g, " "),
          `${path}: the pack rate is quoted against a display figure, so it reads a fifth`
          + " of the real rate",
        ).toContain("topupLedgerCredits(");
      }
      expect(
        calls.length,
        `${path}: expected ${wanted[path]} printed rates through a helper, found ${calls.length}`,
      ).toBe(wanted[path]);
      for (const [, callee, args] of calls) {
        expect(
          callee,
          `${path}: a rate is computed from \`${callee}\`, which does not follow the billing interval`,
        ).toMatch(/^(priceAMonth|priceOf)$/);
        /*
          ⚠ **AND THE SECOND ARGUMENT IS READ, NOT ONLY THE CALLEE — the PR
          #662 reviewer's own finding, taken rather than noted.** The arm above
          this line proved the rate goes THROUGH the shared expression and
          stopped there, so `priceAMonth(selected.price, false)` — the interval
          hard-wired off — would have passed it while printing the monthly rate
          under an annual charge, which is the defect verbatim. `priceOf` needs
          no second argument because it closes over the interval, and its own
          definition is held below.
        */
        if (callee === "priceAMonth") {
          const second = args.split(",")[1]?.trim();
          /*
            ⚠ **RE-AIMED BY #1755, NOT WEAKENED.** This read `.toBe("annual")`,
            which was the live toggle when it was written and is now a
            `boolean | null`: the unread beat reads neither annual nor monthly,
            and `priceAMonth` takes a `boolean`, so every call site narrows with
            `annual === true`. **The subject is unchanged and is the PR #662
            reviewer's own finding** — the interval must be the live value and
            never hard-wired — so what is held is that the toggle's own
            identifier is what the rate follows, and that a literal is still
            refused by name. `annual === false` would pass the first assertion
            and is caught by the second: it is a hard-wiring wearing the
            identifier.
          */
          expect(
            second,
            `${path}: \`priceAMonth\` is called with \`${second}\` instead of the live toggle`,
          ).toMatch(/^annual( === true)?$/);
          expect(
            second,
            `${path}: the rate's interval is hard-wired rather than read from the toggle`,
          ).not.toMatch(/^(true|false)$/);
        }
      }
      /*
        `priceOf` is a HOP, and an unchecked hop is a hole in the arm above: a
        `priceOf` that stopped reading the interval would leave every call site
        above looking correct. Every declaration of it must pass the interval
        through.
      */
      for (const decl of surface.matchAll(/const priceOf = \([^)]*\) =>\s*([^;]+);/g)) {
        expect(
          decl[1].replace(/\s+/g, " "),
          `${path}: a \`priceOf\` stopped passing the interval to the shared expression`,
        ).toMatch(/priceAMonth\([^,]+, interval === "annual"\)/);
      }
      expect(
        [...surface.matchAll(/const priceOf = /g)].length,
        `${path}: no \`priceOf\` declaration found, so the hop above is unchecked`,
      ).toBeGreaterThanOrEqual(path === MODAL ? 2 : 0);
    }
    /*
      And the interval expression exists ONCE, in `planMath` — working law 4.
      Both modals used to carry their own `interval === "annual" ? ... : ...`,
      which is how the price and the rate came to disagree in the first place.
    */
    for (const path of [MODAL, TOPUP]) {
      expect(
        code(read(path)),
        `${path} computes the annual price itself instead of reading the shared expression`,
      ).not.toContain("monthlyEquivalent(");
    }
    expect(code(read(MATH))).toContain("export function priceAMonth");
  });
});
