import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PLAN_TIERS } from "../../../../drizzle/schema";
import { OFFERED_PLAN_ORDER } from "../../../../server/stripe/stripeProducts";
import { readBurn, readCycle } from "./planMath";
import { recommendPlan, type LadderPlan } from "./planLadder";

/**
 * CARD 425 — his four Change plan corrections, and the two of them that turned
 * out to need no code at all.
 *
 * His reply, verbatim and entire (2026-09-01 23:43:51Z, on the brief-390 eye
 * item):
 *
 * > *"The tick reading "Every model and every tool" bring it back because
 * > eventually i need to make benefits between each plan which will be a
 * > reminder for me. the button in the compare table that says ON THIS ONE
 * > looks way to oversized or something. could we also called it like current
 * > or something better than on this one. additionally what happened to the
 * > "fits your use" badge on the plan which best suits the use of the person
 * > and the one that says at this rate you run out on 27/jul card above all the
 * > plans. i know we have not built this feature yet and its not relevant on a
 * > free account but i need it there as a stub reminder to build the feature
 * > in"*
 *
 * ## ⚠ ITEMS 3 AND 4 WERE ALREADY BUILT, AND THE ARMS BELOW ARE WHY THAT IS A
 * FINDING RATHER THAN A CLAIM
 *
 * He asked for the `FITS YOUR USE` badge and the *"at this rate you run out
 * on…"* band as **stubs**, believing neither existed. Both exist, both are
 * real, and both have been in the tree since `75c3a413` (2026-09-01). What
 * hides them is not an omission — it is `readCycle()` returning `null` for an
 * account with no billing period, which is every Free account, exactly as he
 * half-guessed (*"its not relevant on a free account"*).
 *
 * **A stub of a built feature is a fake standing beside the real one**, so
 * nothing shipped for those two. That decision is only safe while the features
 * really do appear when the data exists, so the arms here **DRIVE the reading
 * functions** — `readCycle`, `readBurn`, `recommendPlan` — over a subscribed
 * fixture and a free one, and require the subscribed case to produce both facts
 * and the free case to produce neither.
 *
 * ⚠ **They drive rather than read the source on purpose.** A source arm
 * grepping for `FITS YOUR USE` would pass on a surface where the badge can
 * never render — which is precisely the trap card 390's own inline-style arm
 * fell into (*"`0 inline-styled nodes` meant the element is not on screen"*).
 * The condition is what was in question, so the condition is what is driven.
 * The frames in the PR are the other half, and they are his eye's (law 9).
 */

const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const CLIENT = join(HERE, "..", "..");
const MODAL = join(CLIENT, "features", "billing", "ChangePlanModal.tsx");

const read = (path: string) => readFileSync(path, "utf8");
/* Comments are stripped before every source arm — this file's own subject is
   quoted at length in the component's docblocks, and a rule written in prose is
   not a rule shipped. Card 390's guard has been red for exactly this. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const DAY = 24 * 60 * 60 * 1000;

/**
 * ⚠ **THE LADDER IS THE PRODUCT'S OWN, AND THIS FILE'S FIRST DRAFT PROVES WHY.**
 *
 * It began with a hand-written three-rung ladder whose Starter carried 5,000
 * credits. `PLAN_TIERS.starter` is **75,000**. The arms passed — the arithmetic
 * was right about the ladder it was given — and the DRIVER built on the same
 * figures then photographed a Free-looking surface on a subscribed account,
 * because a 6,750 projection never troubles a 75,000 plan and `recommendPlan`
 * correctly returned null. Both elements stayed hidden and it read like proof
 * that they were missing.
 *
 * A fixture that cannot produce the outcome cannot report its absence. So the
 * rungs come from `PLAN_TIERS` and the spend below is derived from Starter's
 * real allowance, which makes a future price edit surface here rather than in a
 * shift's frames.
 *
 * ⚠ **AND THE ORDER COMES FROM `OFFERED_PLAN_ORDER`, NOT FROM OBJECT KEYS**
 * (PR #488 review, finding 1; re-pointed by PR #583 round 2, finding 1).
 * `recommendPlan` walks the ladder by INDEX — *the first rung above the
 * current one that covers the burn* — so its answer is a function of the
 * order, and the surface gets its order from `plans.planOrder`
 * (`ChangePlanModal.tsx`), which since the #391 fold is `OFFERED_PLAN_ORDER`:
 * the offered seven, WITHOUT the hidden rung. Building the fixture from
 * `PLAN_ORDER` agreed with the wire until the fold split the two — after it,
 * a top-of-ladder arm here would pass against `ultimate` while production
 * answers `enterprise`, which is exactly this docblock's own warning about
 * driving a ladder no customer ever sees. Working law 4, one layer under the
 * one this file already documents.
 */
const LADDER = OFFERED_PLAN_ORDER.map((id) => ({
  id,
  name: PLAN_TIERS[id].name,
  priceInCents: PLAN_TIERS[id].price,
  credits: PLAN_TIERS[id].monthlyCredits,
  rolloverPercent: PLAN_TIERS[id].rolloverPercent,
})) as unknown as LadderPlan[];

const STARTER = PLAN_TIERS.starter.monthlyCredits;

describe("card 425 items 1 and 2 — his two corrections, at the surface", () => {
  it("⚠ THE TICK IS BACK ON EVERY CARD, AND THE PANE NO LONGER SAYS IT TWICE", () => {
    /*
      Item 1. His reason is not that it differentiates today — it is that the
      row is where differentiation will go: *"eventually i need to make benefits
      between each plan which will be a reminder for me."*

      What must NOT come back with it is the duplication: card mode's footnote
      existed only because the tick had left, so the pane would otherwise state
      one fact thirteen times.
    */
    const surface = code(read(MODAL));
    const css = code(read(join(HERE, "settings.css")));
    /*
      ⚠ **`toContain("dp-plan__perk")` PASSED WITH THE TICK DELETED**, because
      the WRAPPER is `dp-plan__perks` and that string is a prefix of it. The
      sabotage driver found it: renaming the tick element reddened nothing at
      all, so this arm was held up by its own wrapper. The class is matched with
      its closing quote now, and the label it must carry is asserted INSIDE it,
      so an empty wrapper can no longer satisfy it.
    */
    expect(surface, "the tick did not come back").toMatch(
      /className="dp-plan__perk">[\s\S]{0,200}\{EVERY_PLAN_PERK\}/,
    );
    expect(css, "the perk row has no styling").toMatch(/\.dp-plan__perk\s*\{/);
    expect(surface, "the tick lost its check mark").toMatch(/<Check size=\{12\}/);
    expect(
      surface.match(/dp-plan__footnote/g)?.length,
      "card mode's footnote is back beside the ticks — one fact, thirteen statements",
    ).toBe(1);
  });

  it("⚠ THE TICK SITS AFTER THE CREDITS BLOCK — §6c'S ORDER, NOT THE PRE-390 ONE", () => {
    /*
      ⚠ **THIS IS NOT A STRAIGHT REVERT AND THE ARM EXISTS TO SAY SO.** The list
      card 390 removed ran ABOVE the action. §6c's order is name + unit → price
      → blurb → action → credits block → **perks**, and card 390 item 1 moved
      the action into the middle for a reason that still holds: the decision
      must not sit behind four lines of detail. Restoring the row at its old
      position would push the only button on the card back down.
    */
    const surface = code(read(MODAL));
    const card = surface.slice(surface.indexOf("dp-plan__tierhead"));
    const action = card.indexOf("dp-plan__here");
    const block = card.indexOf("dp-plan__block");
    const perks = card.indexOf("dp-plan__perks");
    expect(action, "the action slot left the card").toBeGreaterThan(-1);
    expect(perks, "the perk row left the card").toBeGreaterThan(-1);
    expect(block, "the perk row is back above the credits block").toBeLessThan(perks);
    expect(action, "the perk row is back above the action").toBeLessThan(perks);
  });

  it("⚠ THE CURRENT MARKER IS A WORD, NOT A BUTTON — BOTH INSTANCES", () => {
    /*
      Item 2: *"the button in the compare table that says ON THIS ONE looks way
      to oversized or something. could we also called it like current."*

      He named ONE instance; `.dp-plan__here` has two, and law 7 sweeps the
      class rather than the instance. The card's was the worse of the two and
      invisible to him: `.dp-plan__tier` is a stretch flex column, so an
      `inline-flex` chip with a border and a wash filled the whole card width.

      ⚠ **The vertical padding is asserted PRESENT, not absent.** Dropping it
      would lift the current card's credits block out of line with its two
      neighbours — the tidy-looking version of this fix is the one that breaks
      the row.
    */
    const surface = code(read(MODAL));
    /* Both sheets: the marker is in `settings.css` and the button metrics it
       must match are in the foundation's. Reading one and asserting about the
       other is how the 34-against-36 defect got past the first draft. */
    const css =
      code(read(join(HERE, "settings.css"))) +
      code(read(join(CLIENT, "foundation", "foundation.css")));
    expect(surface, "the old wording survives somewhere").not.toContain("ON THIS ONE");
    expect(
      surface.match(/<span className="dp-plan__here">Current<\/span>/g)?.length,
      "both instances did not move together",
    ).toBe(2);

    const rule = css.slice(css.indexOf(".dp-plan__here {"));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body, "the marker still draws a border").not.toMatch(/\bborder:/);
    expect(body, "the marker still fills itself like a button").not.toMatch(/background:/);
    expect(body, "the marker still has a button's radius").not.toMatch(/border-radius:/);

    /*
      ⚠ **AND IT KEEPS A BUTTON'S METRICS, WHICH IS NOT COSMETIC.** This arm
      exists because the first draft did not have it: `var(--s-4)` and 11.5px
      produced a 34px marker against a 36px primary and pushed the current
      card's credits block 2px further out of line with its neighbours —
      measured in the running app, invisible to every other check in this file.
      The padding and font size are READ OUT of `.dp-btn--primary` rather than
      typed, so the two cannot drift apart silently.
    */
    const primary = css.slice(css.indexOf(".dp-btn--primary {"));
    const primaryBody = primary.slice(0, primary.indexOf("}"));
    const padOf = /padding:\s*([^;]+);/.exec(primaryBody)?.[1]?.trim();
    const sizeOf = /font-size:\s*([^;]+);/.exec(primaryBody)?.[1]?.trim();
    expect(padOf, "the primary button's padding could not be read").toBeTruthy();
    expect(sizeOf, "the primary button's font size could not be read").toBeTruthy();
    expect(body, "the marker no longer stands at a button's height").toContain(
      `padding: ${padOf};`,
    );
    expect(body, "the marker no longer sets a button's font size").toContain(
      `font-size: ${sizeOf};`,
    );
  });
});

describe("card 425 items 3 and 4 — the two he thought were unbuilt", () => {
  /*
    The fixture, derived from Starter's REAL allowance rather than a typed one:
    a paying account 20 days into a 30-day cycle that has spent 90% of it, with
    9% of the allowance left. The daily rate over 30 days projects to 1.35× the
    plan, so Starter cannot cover it and a higher rung must be recommended; and
    two-thirds of a day's spend against ten days to renewal, so the band has a
    real shortfall to name. Both facts must exist.
  */
  const now = new Date("2026-07-21T00:00:00Z");
  const SUBSCRIBED = {
    creditsUsed: Math.round(STARTER * 0.9),
    balance: Math.round(STARTER * 0.09),
    currentPeriodStart: new Date(now.getTime() - 20 * DAY),
    currentPeriodEnd: new Date(now.getTime() + 10 * DAY),
  };
  /* A Free account: no subscription, therefore no period. This is the state he
     was looking at when he asked what had happened to them. */
  const FREE = {
    creditsUsed: 120,
    balance: 380,
    currentPeriodStart: null,
    currentPeriodEnd: null,
  };

  it("⚠ THE RUN-OUT BAND IS BUILT: a subscribed cycle produces a real date, not a stub", () => {
    const cycle = readCycle(SUBSCRIBED, now);
    expect(cycle, "readCycle refused a complete cycle").not.toBeNull();
    const burn = readBurn(cycle!, now);
    expect(burn.emptyOn, "no empty date — the band cannot render").not.toBeNull();
    expect(burn.perDay, `a burn of zero from ${SUBSCRIBED.creditsUsed} spent credits`).toBeGreaterThan(0);
    /* The band's sharper half: it only dramatises when the balance runs out
       BEFORE renewal, which is the whole reason to act. */
    expect(burn.dryDays, "the band would claim a shortfall that is not there").toBeGreaterThan(0);
    expect(burn.emptyOn!.getTime(), "the empty date is not before renewal").toBeLessThan(
      cycle!.renewsAt.getTime(),
    );
  });

  it("⚠ THE `FITS YOUR USE` BADGE IS BUILT: a burn above the plan names a real rung", () => {
    const cycle = readCycle(SUBSCRIBED, now)!;
    const burn = readBurn(cycle, now);
    const projected = Math.round(burn.perDay * cycle.cycleLength);
    expect(
      projected,
      `the projection (${projected}) does not exceed Starter's ${STARTER}`,
    ).toBeGreaterThan(STARTER);
    const fit = recommendPlan(LADDER, "starter" as never, projected);
    expect(fit, "nothing was recommended, so the badge cannot draw").not.toBeNull();
    /* Not a typed rung name: the recommendation must be the FIRST rung above
       Starter that actually covers the projection, whatever the ladder says
       today. A price edit moves this answer and the arm follows it. */
    const expected = LADDER.find(
      (plan, i) => i > LADDER.findIndex((p) => p.id === "starter") && plan.credits >= projected,
    );
    expect(fit!.id, "the recommendation is not the first rung that covers the burn").toBe(
      expected!.id,
    );
  });

  it("⚠ AND A FREE ACCOUNT PRODUCES NEITHER — which is why he could not see them", () => {
    /*
      ⚠ **THE NEGATIVE CONTROL, AND IT IS THE ARM THAT ANSWERS HIS QUESTION.**
      Without it the two arms above prove only that the maths works; they cannot
      distinguish *"built and correctly hidden"* from *"built and broken"*.

      `readCycle` returns `null` on a missing period, so `cycle && burn &&
      burn.emptyOn && recommended` is false and `isRecommended` is false. Both
      elements are absent BY CONSTRUCTION on a Free account, and no stub is owed
      — a placeholder here would label a shipped feature "not built yet".
    */
    expect(readCycle(FREE, now), "a Free account produced a billing cycle").toBeNull();
    /* No cycle → no burn → the projection the recommendation reads is 0, and
       zero can never exceed a plan's credits, so no rung is ever recommended. */
    expect(recommendPlan(LADDER, "free" as never, 0), "a free plan was told to upgrade").toBeNull();
  });

  it("⚠ AND THE SURFACE STILL HOLDS BOTH — the conditions are unchanged by this card", () => {
    /*
      This card shipped no code for items 3 and 4. This arm is what makes that
      safe to say next month: if either element is ever deleted, this goes red
      and the "already built" verdict on card 425 stops being true silently.
    */
    const surface = code(read(MODAL));
    expect(surface, "the run-out band left the surface").toContain("At this rate you run out on");
    expect(surface, "the fits-your-use badge left the surface").toContain("FITS YOUR USE");
    expect(surface, "the band no longer waits for a real cycle").toMatch(
      /cycle && burn && burn\.emptyOn && recommended/,
    );
  });
});
