/**
 * #1606 SLICE 2 — THE ADD-CREDITS SURFACE: WHAT A PACK BUYS, AND THE ONE
 * NUMBER EVERY FIGURE ON IT IS READ FROM.
 *
 * Slice 1 built the money road (the ladder, the catalogue resolver, the
 * checkout, the webhook grant) and is pinned by `server/creditTopupLadder.test.ts`
 * and its siblings. This is the SCREEN: his design of 2026-10-02 (terminal),
 * verbatim — *"for our add credits we should be inspired by how higgsfield does
 * it but obviously in ur own design language … they have a slider also"* — and
 * the relay's translation of it on the card: three packs biggest first, a
 * 5,000-step slider, what each amount buys in the customer's words at the live
 * prices, the credits-per-dollar chip, one *Best value* badge, the honest plan
 * nudge.
 *
 * ## What these arms hold, and what they deliberately do not
 *
 * - **Every count is DRIVEN over the live price constants, never quoted.** His
 *   own design example is already stale and that is the whole argument for
 *   deriving it: he wrote *"about 104 Rolls, or 14 Signs for 25,000 (25,000 ÷
 *   240, ÷ 1,700)"* hours before his one-price ruling the same day (#1753) took
 *   a Roll from 240 to 320 display. An arm that pinned 104 would have gone red
 *   on a correct surface; an arm that pinned 78 goes red the next time he moves
 *   a price. **So the arms hold the ARITHMETIC and its direction**, and the one
 *   figure quoted from his design is quoted as a NEGATIVE control.
 * - **The floor is a safety property, not a rounding taste.** A count of what
 *   an amount COVERS may never exceed what it covers — `creditDisplay.ts`'s own
 *   asymmetry read on a different question (a balance rounds down, a price
 *   rounds up), and it is driven as a property at every sellable size rather
 *   than asserted at three.
 * - **The no-badge branch is driven on an injected flat ladder.** The live
 *   ladder's three rates differ, so an arm over the real constants can only see
 *   one of the two answers and the branch that exists to stop a lie would be
 *   the untested one (working law 2).
 * - **The nudge's truth is NOT re-proven here.** `server/creditTopupLadder.test.ts`
 *   already holds every band's rate below the cheapest paid plan's, which
 *   covers every slider position because a position pays a band's rate. A
 *   second copy of that comparison would be the mirror working law 4 bans; what
 *   is held here is that the surface draws the row and that it leads somewhere.
 *
 * Comments are stripped before every source match, so this docblock and the
 * surface's own ⚠ paragraphs — which quote his design at length — cannot
 * satisfy an arm about the code.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { withoutComments } from "../../../../server/testing/withoutComments";
import { sourceBand } from "../../../../server/testing/sourceBand";
import { CASTING_V2_ROLL_PRICE_CREDITS } from "../../../../server/casting/castingCreditCosts";
/*
  ⚠ **THE SIGN PRICE MOVED MODULE WITH #1968.** It was derived in
  `castViewPackage.ts` from a promotion base plus a per-view slice; his word of
  2026-10-08 makes it one flat number he set, so it is declared beside every
  other price in `castingCreditCosts.ts` and imported from there.
*/
import { CASTING_V2_SIGN_PRICE_CREDITS } from "../../../../server/casting/castingCreditCosts";
import { displayBalance, formatCredits } from "../../../../shared/creditDisplay";
import {
  TOPUP_BRACKETS,
  TOPUP_MAX_UNITS,
  TOPUP_PACKS,
  TOPUP_UNIT_DISPLAY_CREDITS,
  bestValueTopupUnits,
  topupLedgerCredits,
  topupPriceInCents,
} from "../../../../shared/creditTopups";

const SURFACE = "client/src/features/billing/AddCreditsModal.tsx";
const CSS = "client/src/features/settings/settings.css";
const PLAN_SURFACE = "client/src/features/billing/ChangePlanModal.tsx";

const read = (relative: string) =>
  withoutComments(readFileSync(join(process.cwd(), relative), "utf8"));
/** The stylesheet, read whole — there are no comments to strip from a claim
 *  about a selector, and stripping them would eat the CSS block comments. */
const readRaw = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

/** Every unit count this product sells — the population for a property. */
const sellable = () =>
  Array.from({ length: TOPUP_MAX_UNITS }, (_unused, index) => index + 1);

/** What the surface's `buys` helper answers, computed the same way. */
const buys = (units: number) => ({
  rolls: Math.floor(topupLedgerCredits(units) / CASTING_V2_ROLL_PRICE_CREDITS),
  signs: Math.floor(topupLedgerCredits(units) / CASTING_V2_SIGN_PRICE_CREDITS),
});

describe("the three packs are the bands' own first orders, biggest first", () => {
  it("is the ladder read backwards, with nothing declared beside it", () => {
    expect(TOPUP_PACKS.map((pack) => pack.units)).toEqual(
      [...TOPUP_BRACKETS].reverse().map((bracket) => bracket.fromUnits),
    );
    /* His design's word is *biggest first*, and it is a property of the array
       rather than a sort the surface performs. */
    for (let index = 1; index < TOPUP_PACKS.length; index += 1) {
      expect(
        TOPUP_PACKS[index].units,
        "the packs are no longer ordered biggest first, so the surface draws his design upside down",
      ).toBeLessThan(TOPUP_PACKS[index - 1].units);
    }
  });

  it("each pack's price is its own band's rate, so a pack and the slider agree at one size", () => {
    for (const pack of TOPUP_PACKS) {
      expect(pack.cents).toBe(topupPriceInCents(pack.units));
    }
    /* His three dollar figures, which is the one thing a customer reads off
       these rows. Quoted because they are HIS ruling rather than a derivation:
       5,000 = $12 · 10,000 = $22 · 25,000 = $50. */
    expect(TOPUP_PACKS.map((pack) => pack.cents)).toEqual([5000, 2200, 1200]);
  });

  it("⚠ A PACK CARRIES NO CREDIT FIGURE OF ITS OWN — the screen derives it", () => {
    /*
      A `displayCredits` field was written and taken out in the same commit: a
      credit number a customer sees has to come through `displayBalance` to be
      printable at all (`DisplayCredits` is a branded type), so the field was a
      second copy of the same number one conversion away.
    */
    for (const pack of TOPUP_PACKS) {
      expect(
        Object.keys(pack).sort(),
        "a pack carries a figure the screen does not read, which is the mirror working law 4 bans",
      ).toEqual(["cents", "units"]);
    }
    /* And the figure the screen does derive is the one he named the Stripe key
       for, so the row, the key and the grant say one number. */
    expect(
      TOPUP_PACKS.map((pack) => displayBalance(topupLedgerCredits(pack.units)) as number),
    ).toEqual([25_000, 10_000, 5_000]);
  });
});

describe("what an amount buys — derived from the live prices, and floored", () => {
  it("⚠ BOTH OF HIS DESIGN'S COUNTS ARE STALE NOW, WHICH IS WHY NOTHING IS TYPED", () => {
    /*
      The negative control, and the argument for this whole file. His design
      says *about 104 Rolls* and *about 14 Signs* for 25,000 credits.

      The Roll figure was computed at 240 display a Roll, hours before #1753
      took a Roll to 320. ⚠ **AND THE SIGNS FIGURE WENT STALE WITH #1968** — it
      was right at 1,700 display a Sign, and his word of 2026-10-08 made a Sign
      a flat 650, so 25,000 credits now buys nearly three times as many. This
      arm asserted `signs === 14` under the note *"the half of his example that
      survived the price move"*, and that sentence has expired.

      **Nothing on the surface is wrong**: it derives both counts from the live
      prices, which is the whole reason the design's own arithmetic is allowed
      to rot. What is stale is the DESIGN DOCUMENT, and this arm is the record
      of it rather than a reason to type a number.
    */
    const ledger = topupLedgerCredits(TOPUP_PACKS[0].units);
    const biggest = buys(TOPUP_PACKS[0].units);
    expect(
      biggest.rolls,
      "the surface is quoting his design's arithmetic rather than the product's prices",
    ).not.toBe(104);
    expect(
      biggest.signs,
      "the surface is quoting his design's Signs figure rather than the live Sign price",
    ).not.toBe(14);
    /* Both derived from the live prices, which is the only claim that can stay
       true across his next price word. */
    expect(biggest.rolls).toBe(Math.floor(ledger / CASTING_V2_ROLL_PRICE_CREDITS));
    expect(biggest.signs).toBe(Math.floor(ledger / CASTING_V2_SIGN_PRICE_CREDITS));
  });

  it("⚠ THE COUNT NEVER EXCEEDS WHAT THE AMOUNT COVERS, AT EVERY SELLABLE SIZE", () => {
    /* The safety property, driven as one. A count that rounded up would tell a
       customer their money covers work it does not. */
    for (const units of sellable()) {
      const ledger = topupLedgerCredits(units);
      const answer = buys(units);
      expect(answer.rolls * CASTING_V2_ROLL_PRICE_CREDITS).toBeLessThanOrEqual(ledger);
      expect(answer.signs * CASTING_V2_SIGN_PRICE_CREDITS).toBeLessThanOrEqual(ledger);
      /* And it is the LARGEST count that fits, so the floor is not a shrug. */
      expect((answer.rolls + 1) * CASTING_V2_ROLL_PRICE_CREDITS).toBeGreaterThan(ledger);
      expect((answer.signs + 1) * CASTING_V2_SIGN_PRICE_CREDITS).toBeGreaterThan(ledger);
    }

    /*
      ⚠ **THE ARITHMETIC ABOVE IS THIS FILE'S OWN, SO THE SURFACE'S COPY OF IT
      IS PINNED SEPARATELY — otherwise the property is proven about the arm.**
      Those loops establish that FLOORING has the safety property; this
      establishes that the pane floors. An arm that only did the first would go
      green over a `Math.ceil` on the screen.
    */
    const helper = sourceBand(
      read(SURFACE),
      "const buys = (unitCount: number)",
      "const topup =",
      "the pane's buys helper",
    );
    expect(helper).toContain("const ledger = topupLedgerCredits(unitCount);");
    expect(helper, "the pane's Roll count no longer floors").toContain(
      "rolls: Math.floor(ledger / rollCredits),",
    );
    expect(helper, "the pane's Sign count no longer floors").toContain(
      "signs: Math.floor(ledger / signCredits),",
    );
    expect(helper, "a count rounds up, so it claims work the money does not cover").not.toContain(
      "Math.ceil",
    );
    expect(helper, "a count rounds to nearest, which can round up").not.toContain("Math.round");
  });

  it("the counts rise with the amount and a Sign always costs more than a Roll", () => {
    for (let index = 1; index < TOPUP_PACKS.length; index += 1) {
      /* Biggest first, so each later pack buys no more than the one above it. */
      expect(buys(TOPUP_PACKS[index].units).rolls).toBeLessThan(
        buys(TOPUP_PACKS[index - 1].units).rolls,
      );
    }
    /* The reason the row names both: they are the two ends of the road, and the
       pair is only informative while they differ. */
    expect(CASTING_V2_SIGN_PRICE_CREDITS).toBeGreaterThan(CASTING_V2_ROLL_PRICE_CREDITS);
    for (const units of sellable()) {
      expect(buys(units).signs).toBeLessThanOrEqual(buys(units).rolls);
    }
  });

  it("the two divisors are SERVED, so the surface carries no price literal", () => {
    const surface = read(SURFACE);
    expect(surface, "the pack rows stopped reading the served Roll price").toContain(
      "plans?.rollCredits",
    );
    expect(surface, "the pack rows stopped reading the served Sign price").toContain(
      "plans?.signCredits",
    );
    /* D-15: the client is served the number and never carries a literal. */
    for (const literal of [
      String(CASTING_V2_ROLL_PRICE_CREDITS),
      String(CASTING_V2_SIGN_PRICE_CREDITS),
    ]) {
      expect(
        sourceBand(
          surface,
          "function CreditPacksPane",
          "export function AddCreditsModal",
          "the credit packs pane",
        ),
        `a price literal (${literal}) is typed into the credit-packs pane`,
      ).not.toContain(literal);
    }
    /* An unread price declines rather than printing `about 0`. */
    expect(surface).toContain("if (rollCredits <= 0 || signCredits <= 0) return null;");
  });
});

describe("one Best value badge, and none at all when the rates are equal", () => {
  it("is the cheapest band's own first order", () => {
    const cheapest = Math.min(...TOPUP_BRACKETS.map((bracket) => bracket.centsPerUnit));
    const expected = TOPUP_BRACKETS.find((bracket) => bracket.centsPerUnit === cheapest);
    expect(bestValueTopupUnits()).toBe(expected?.fromUnits);
    /* On his ladder that is the biggest pack, which is where a volume discount
       puts it — stated so a ladder that stopped being one is visible. */
    expect(bestValueTopupUnits()).toBe(TOPUP_PACKS[0].units);
  });

  it("⚠ A BADGE ON EQUAL RATES IS A LIE, AND THE FLAT LADDER IS DRIVEN", () => {
    /*
      His design's own condition: *"today all three are $12 per 5,000, so no
      badge until they differ (a badge on equal rates is a lie)"*. That was the
      FLAT ladder his volume ruling the same day replaced — so this branch is
      unreachable on the live constants and is driven on an injected ladder
      instead, which is `castingSliceCredits`'s own reason for taking its table
      as a parameter.
    */
    const flat = [
      { fromUnits: 1, centsPerUnit: 1200 },
      { fromUnits: 2, centsPerUnit: 1200 },
      { fromUnits: 5, centsPerUnit: 1200 },
    ];
    expect(bestValueTopupUnits(flat)).toBeNull();
    /* The positive control for the same reader: one rate moved, and it answers. */
    expect(bestValueTopupUnits([...flat.slice(0, 2), { fromUnits: 5, centsPerUnit: 1100 }])).toBe(5);
    /* And an empty ladder has no best rather than throwing on `Math.min`. */
    expect(bestValueTopupUnits([])).toBeNull();
  });

  it("exactly one row can wear it, and the surface asks the ladder rather than the list", () => {
    const best = bestValueTopupUnits();
    expect(TOPUP_PACKS.filter((pack) => pack.units === best).length).toBe(1);

    const packs = sourceBand(
      read(SURFACE),
      'className="dp-topup__packs"',
      'className="dp-topup__slider"',
      "the pack rows",
    );
    expect(packs, "the badge is drawn from something other than the ladder's own answer").toContain(
      "pack.units === bestUnits",
    );
    expect(
      (packs.match(/dp-plan__badge/g) ?? []).length,
      "more than one badge is drawn on the pack rows",
    ).toBe(1);
  });
});

describe("the slider is the ladder's own bound, and the packs are positions on it", () => {
  it("its step is the unit and its end is his 100,000", () => {
    /*
      His design: *"steps of 5,000 from 5,000 up to 100,000"*. The surface's
      slider counts UNITS, so the two facts to hold are that a unit is 5,000
      credits and that the bound times the unit is his ceiling — decided
      independently (the bound is a judgement on #1606, the ceiling is his
      design), so their agreeing is a real claim rather than one definition.
    */
    expect(TOPUP_UNIT_DISPLAY_CREDITS).toBe(5_000);
    expect(TOPUP_MAX_UNITS * TOPUP_UNIT_DISPLAY_CREDITS).toBe(100_000);
  });

  it("the control's min, max and step are read from the ladder and not typed", () => {
    const slider = sourceBand(
      read(SURFACE),
      'className="dp-topup__slider"',
      "dp-topup__bullets",
      "the slider block",
    );
    expect(slider, "the slider's end is a literal, so it can price an order the server refuses")
      .toContain("max={TOPUP_MAX_UNITS}");
    expect(slider).toContain("min={1}");
    /* The thumb moves in whole units, which is what makes the step 5,000
       credits without the number appearing here at all. */
    expect(slider).toContain("step={1}");
    expect(slider).toContain('type="range"');
    /* The figure beside it is `units` itself, so no second state can disagree. */
    expect(slider).toContain("value={units}");
  });

  it("⚠ ONE STATE, SO A PACK AND THE SLIDER CANNOT COST DIFFERENT THINGS", () => {
    const pane = sourceBand(
      read(SURFACE),
      "function CreditPacksPane",
      "export function AddCreditsModal",
      "the credit packs pane",
    );
    /* The packs set the same number the slider does — his design's *"the three
       packs are presets that snap the slider"*. */
    expect(pane).toContain("onClick={() => setUnits(pack.units)}");
    expect(
      (pane.match(/useState/g) ?? []).length,
      "the pane holds more state than the amount and the in-flight flag, so two numbers can disagree",
    ).toBe(2);
    /* And the arithmetic is one call each, from that one number. */
    expect(pane).toContain("const cents = topupPriceInCents(units);");
    expect(pane).toContain("const displayCredits = displayBalance(topupLedgerCredits(units));");
  });

  it("the amount's own price is on the button before the press", () => {
    const foot = sourceBand(
      read(SURFACE),
      "function CreditPacksPane",
      "export function AddCreditsModal",
      "the credit packs pane",
    );
    expect(foot).toContain("`Add credits · ${formatDollars(cents)}`");
    /* It is never an em dash: the figure is composed from the ladder and the
       chosen amount, so nothing about this price waits on a server. */
    expect(
      sourceBand(foot, "variant=\"primary\"", "</Button>", "the money button"),
      "the money button can draw a held glyph where a price belongs",
    ).not.toContain('"—"');
  });
});

describe("the surface sends the top-up checkout and bounds what it sends", () => {
  it("fires `createTopupCheckout` with the unit count and nothing else", () => {
    const pane = sourceBand(
      read(SURFACE),
      "function CreditPacksPane",
      "export function AddCreditsModal",
      "the credit packs pane",
    );
    expect(pane).toContain("trpc.billing.createTopupCheckout.useMutation");
    expect(pane).toContain("topup.mutate({ units });");
    /* No amount, no price, no lookup key on the wire — the server composes all
       three from the unit count (slice 1's own contract). */
    for (const word of ["cents", "priceId", "lookup"]) {
      expect(
        sourceBand(pane, "const submit = ", "const chosenBuys", "the submit handler"),
        `the surface sends \`${word}\` to the checkout, which the server must own`,
      ).not.toContain(word);
    }
  });

  it("⚠ THE BOUND IS ASKED AT THE SURFACE TOO, NOT ONLY IN THE INPUT SCHEMA", () => {
    const pane = sourceBand(
      read(SURFACE),
      "const submit = ",
      "const chosenBuys",
      "the submit handler",
    );
    expect(
      pane,
      "the surface can open a checkout for an amount the ladder refuses to price",
    ).toContain("!isSellableTopupUnits(units)");
  });
});

describe("the plan nudge, and the road it leads to", () => {
  it("the row is drawn under the packs with the move-up action", () => {
    const pane = sourceBand(
      read(SURFACE),
      "function CreditPacksPane",
      "export function AddCreditsModal",
      "the credit packs pane",
    );
    const nudge = sourceBand(pane, 'className="dp-plan__cross"', "</div>", "the plan nudge");
    /* #1940 B28 — his recommendation 2 was to drop "cost less each". */
    expect(nudge).toContain("Need credits every month?");
    expect(nudge).toContain("A plan adds credits each month.");
    expect(nudge, "a price claim is back on the nudge row").not.toMatch(/cost less|cheaper|more for the money/);
    expect(nudge, "the nudge has nowhere to go").toContain("onClick={onChangePlan}");
    /* His design: *no fake discount*. There is no former price to strike and a
       top-up discount would contradict the ladder's own design. */
    for (const word of ["%", "discount", "Save", "dp-topup__struck"]) {
      expect(nudge, `a discount claim is back on the nudge row: ${word}`).not.toContain(word);
    }
  });

  it("⚠ THE ROAD IS REQUIRED, SO NO MOUNT CAN SHIP THE ROW WITH NOTHING BEHIND IT", () => {
    /*
      `AccountSurfaces`'s own docblock records what an optional one cost before:
      *"the out-of-credits mounts open the top-up with no way to reach Change
      plan from it"*. A required prop makes the compiler ask every mount, which
      is why this arm holds the DECLARATION rather than counting call sites.
    */
    const shell = sourceBand(
      read(SURFACE),
      "export function AddCreditsModal",
      "const { data: status }",
      "the modal shell",
    );
    expect(shell, "the plan road is optional again").toContain("onChangePlan: () => void;");
    expect(shell, "the plan road is optional again").not.toContain("onChangePlan?:");
  });

  it("the sibling row on Change plan no longer describes a mechanism it stopped using", () => {
    /*
      §6f's note read *"Pick an amount and the plan moves with it — same thing,
      fewer decisions."* — true while Add credits could only answer *I need more
      credits* by moving the plan, and false from the commit that gave it a
      checkout.
    */
    const plan = read(PLAN_SURFACE);
    expect(
      plan,
      "the cross-row still tells a customer that buying credits moves their plan",
    ).not.toContain("the plan moves with it");
    expect(
      sourceBand(plan, 'className="dp-plan__cross"', "</div>", "the cross-row on Change plan"),
    ).toContain(
      "your plan stays exactly as it is",
    );
  });
});

describe("the shell reads the rung, and neither pane is drawn until it is known", () => {
  it("three answers, and the unread one claims nothing", () => {
    const shell = sourceBand(
      read(SURFACE),
      "export function AddCreditsModal",
      "ModalScrim",
      "the modal shell",
    );
    expect(shell).toContain("topupEligibility(status?.planTier)");
    expect(shell).toContain('eligibility === "may-buy"');
    expect(shell).toContain('eligibility === "needs-a-plan"');
    /* A boolean would make an unanswered `getStatus` read as *you have no
       plan*, which is the eight-defect class on this surface. */
    expect(
      shell,
      "the rung is collapsed to a boolean, so a Pro subscriber is shown the upgrade offer",
    ).not.toMatch(/planTier\s*===\s*"free"/);
  });

  it("the upgrade offer is what a free account gets, and it is not deleted", () => {
    const surface = read(SURFACE);
    /* The card's own sentence: *"Free accounts are offered an upgrade, not a
       pack."* The pane that does it is the whole of what this surface was
       before slice 2, kept rather than replaced. */
    expect(surface).toContain("function PlanStepUpPane({ onClose }");
    expect(surface).toContain("createSubscriptionCheckout.useMutation");
  });
});

describe("the disappearing-technology law, on the one surface it is easiest to break", () => {
  it("⚠ NO ENGINE NAME, NO LOOKUP KEY AND NO LEDGER WORD REACHES THIS PANE", () => {
    const pane = sourceBand(
      read(SURFACE),
      "function CreditPacksPane",
      "export function AddCreditsModal",
      "the credit packs pane",
    );
    /*
      Higgsfield's own rows name their models in exactly this slot (*"up to N
      Nano Banana images"*), which is what his design says to take the shape of
      and not the words of. The engine list is the one this product ships
      today; a new engine name is a new entry here, and that is cheaper than a
      customer reading one.
    */
    for (const word of [
      "Nano Banana",
      "Sunburst",
      "GPT Image",
      "Seedance",
      "gpt-image",
      "fal-ai",
      "klieg_topup",
      "lookup_key",
    ]) {
      expect(pane, `an engine or a Stripe name reached the customer: ${word}`).not.toContain(word);
    }
  });

  it("⚠ EVERY CREDIT FIGURE A CUSTOMER READS COMES THROUGH THE DISPLAY HELPER", () => {
    const pane = sourceBand(
      read(SURFACE),
      "function CreditPacksPane",
      "export function AddCreditsModal",
      "the credit packs pane",
    );
    /* `formatCredits` takes a branded `DisplayCredits`, so this is the
       compiler's rule as much as the arm's — what the arm adds is that the
       scale is never re-applied by hand on the way in. */
    expect(
      pane,
      "the display scale is multiplied out by hand on a money surface",
    ).not.toContain("LEDGER_PER_DISPLAY_CREDIT");
    for (const match of pane.matchAll(/formatCredits\(([^)]*)\)/g)) {
      expect(
        match[1],
        `a credit figure is printed from \`${match[1]}\` rather than through the display helper`,
      ).toMatch(/^(displayBalance\(|displayCredits$|displaySpent\()/);
    }
    /* And the helper actually produces the figure his design names, through the
       real functions rather than through this arm's arithmetic. */
    expect(formatCredits(displayBalance(topupLedgerCredits(5)))).toBe("25,000");
  });

  it("the pack rows need no stylesheet token this system did not already have", () => {
    const css = readRaw(CSS);
    /* The promotion pass's own test of a new section: if it had to invent a
       token, the section is not in the system's language. */
    const block = sourceBand(
      css,
      ".dp-topup__packs {",
      "The two global rules",
      "the pack rows stylesheet block",
    );
    for (const token of block.matchAll(/var\((--[a-zA-Z0-9-]+)\)/g)) {
      expect(
        css.includes(token[1]) || readRaw("client/src/foundation/tokens.css").includes(token[1]),
        `the pack rows use a token nothing declares: ${token[1]}`,
      ).toBe(true);
    }
    /* No colour literal, and no green anywhere in this system. */
    expect(block, "a colour literal is hard-coded where a token belongs").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
