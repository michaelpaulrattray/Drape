import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { PLAN_TIERS } from "../../../../drizzle/schema";
import {
  ARRANGED_DIRECTLY_PLAN_TIERS,
  OFFERED_PLAN_ORDER,
  PURCHASABLE_PLANS,
  SELF_SERVE_PLAN_ORDER,
} from "../../../../server/stripe/stripeProducts";
import { CAST_PACKAGE_VIEWS } from "../../../../server/castingV2/castViewPackage";
import { topupEligibility } from "../../../../shared/creditTopups";
import { readListedSource } from "../../../../server/testing/listedSource";
import { CONTENDED_TEST_TIMEOUT_MS } from "../../../../server/testing/contendedTestTimeout";

/**
 * CARDS #1832, #1833 AND #1834 — THE PLAN SURFACE REBUILT TO HIS PHASE 2 BRIEF.
 *
 * His word opening the rung, 2026-10-03 (terminal, verbatim): *"phase 2 gets
 * built next not n2b"*, and on the brief itself the same morning: *"frames right
 * numbers right"*. The brief is #1774 and the design is
 * `docs/specs/PRICING_PHASE2_PLANS_DESIGN.md`; what ships here is three of its
 * four build cards — the three-card ladder (#1832, minus the Studio slider),
 * the Enterprise band (#1833) and the grouped compare table (#1834).
 *
 * # What this suite is for, and what it deliberately is not
 *
 * Every figure on a money surface must be DERIVED. That is not a new rule here —
 * `card390-guard.test.ts` holds no plan name may be a literal, and it CAUGHT the
 * Enterprise band's first draft typing `Enterprise` — so what this adds is the
 * properties those guards cannot see, each tied to a sentence in his brief:
 *
 * 1. **The surface draws three cards and the server decides which three.** A
 *    client-side `["starter","pro","studio"]` would be a second copy of the
 *    ladder (working law 4), and the day he moves a rung the surface and the
 *    catalogue disagree with a price on screen.
 * 2. **The rungs that left the ladder did NOT leave the money enums.** This is
 *    the arm most worth having: narrowing a SURFACE is a design change, and
 *    narrowing `PURCHASABLE_PLANS` would be a refusal nobody asked for — an
 *    account he hand-sells Business could not change its own billing cycle.
 * 3. **A row exists in the compare table only where the plans differ at the
 *    code.** The design's §2 found four such facts and refuses to invent a
 *    fifth; a table organised by what a customer makes *invites* rows headed
 *    *views per cast* or *refines a month*, and each would be machinery dressed
 *    as a benefit.
 * 4. **The copy's capability claims are held to the constants they describe** —
 *    #1607's rule, *"re-derive every string against present capability before
 *    shipping"*, pointed at the three `[new]` sentences that make a claim.
 *
 * ⚠ **IT IS A SOURCE READER AND THAT IS ITS FLOOR, SAID OUT LOUD.** It cannot
 * see a layout, a colour or a truncation — the frames in both themes at both
 * widths are the relay's eye (working law 6, law 9), and the PR carries them.
 * What a source read CAN do is refuse a typed number, and that is what every
 * arm below does.
 */

/* Several arms read five source files off the real tree through
   `readListedSource`, which is the contended-read population: fast here, red
   under load on somebody else's machine rather than in CI (#741). */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const HERE = __dirname;
const MODAL = join(HERE, "ChangePlanModal.tsx");
const LADDER = join(HERE, "..", "settings", "planLadder.ts");
const CSS = join(HERE, "..", "settings", "settings.css");
const BILLING = join(HERE, "..", "..", "..", "..", "server", "routes", "billing.ts");

/**
 * Source with comments stripped — a guard must never read the prose about the
 * rule it is checking.
 *
 * ⚠ It goes through `readListedSource` so a path that stops existing is a RED
 * rather than an empty string every `toContain` below would then fail on for the
 * wrong reason (the repo's tree-walking-suite discipline).
 */
function code(path: string): string {
  const raw = readListedSource(path);
  expect(raw, `${path} could not be read — every arm below would be reading nothing`)
    .not.toBeNull();
  const text = (raw ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
  expect(text.length, `${path} read empty`).toBeGreaterThan(500);
  return text;
}

/** Raw bytes, for an arm that must read a comment's own word. */
function raw(path: string): string {
  return readFileSync(path, "utf8");
}

/** The slice between two anchors, with both proven unique and present. */
function slice(text: string, from: string, to: string, what: string): string {
  expect(text.split(from).length - 1, `${what}: the opening anchor is not unique`).toBe(1);
  const start = text.indexOf(from);
  expect(start, `${what}: the opening anchor is absent`).toBeGreaterThan(-1);
  const end = text.indexOf(to, start);
  expect(end, `${what}: the closing anchor is absent`).toBeGreaterThan(start);
  const cut = text.slice(start, end);
  expect(cut.length, `${what}: the slice is empty`).toBeGreaterThan(80);
  return cut;
}

describe("card 1832 — the self-serve ladder is three rungs and the SERVER decides which", () => {
  it("the narrowing is derived from the offered ladder, never typed", () => {
    /*
      `free` plus the three individual plans, and each half of that sentence is
      read rather than asserted as a literal list: the population is
      `OFFERED_PLAN_ORDER` minus `ARRANGED_DIRECTLY_PLAN_TIERS`, and the order is
      the catalogue's own.
    */
    expect(SELF_SERVE_PLAN_ORDER).toEqual(
      OFFERED_PLAN_ORDER.filter(
        (tier) => !(ARRANGED_DIRECTLY_PLAN_TIERS as readonly string[]).includes(tier),
      ),
    );
    /* The shape his brief asks for: Free, and exactly three priced rungs. */
    const priced = SELF_SERVE_PLAN_ORDER.filter((tier) => PLAN_TIERS[tier].price > 0);
    expect(priced, "the self-serve ladder is no longer three individual plans").toHaveLength(3);
    expect(
      SELF_SERVE_PLAN_ORDER.filter((tier) => PLAN_TIERS[tier].price === 0),
      "Free left the ladder — it keeps its compare column, which is the whole point of it",
    ).toHaveLength(1);
    /* And the three are the CHEAPEST three, so the band genuinely covers the
       top and the ladder has no hole in the middle. */
    const dropped = OFFERED_PLAN_ORDER.filter((tier) => !SELF_SERVE_PLAN_ORDER.includes(tier));
    for (const kept of priced) {
      for (const gone of dropped) {
        expect(
          PLAN_TIERS[kept].price,
          `${gone} is cheaper than ${kept} and left the ladder — the ladder has a hole in it`,
        ).toBeLessThan(PLAN_TIERS[gone].price);
      }
    }
  });

  it("⚠ AND THE RUNGS THAT LEFT THE SURFACE DID NOT LEAVE THE MONEY ENUMS", () => {
    /*
      The arm this suite exists for. Narrowing a surface is a design change;
      narrowing `PURCHASABLE_PLANS` is a REFUSAL, and nobody asked for one — an
      account he hand-sells Business would be unable to change its own billing
      cycle, and the hand-sold checkout link the band's conversation ends in
      would be rejected by the server that is supposed to honour it.

      #391's own precedent is the answer to the invariant-5 worry: `ultimate` has
      been a real rung with no card for a month, reached by a link he sends.
    */
    for (const tier of ARRANGED_DIRECTLY_PLAN_TIERS) {
      expect(
        PLAN_TIERS[tier],
        `${tier} left PLAN_TIERS — an account on it would be captioned Free (PR 583 finding 1)`,
      ).toBeTruthy();
      expect(
        PURCHASABLE_PLANS as readonly string[],
        `${tier} left the purchasable enum — a hand-sold account can no longer be billed`,
      ).toContain(tier);
      expect(
        OFFERED_PLAN_ORDER as readonly string[],
        `${tier} left the offered ladder — getPlans is what ownPlanFacts' fallback reads`,
      ).toContain(tier);
    }
  });

  it("the surface reads the server's narrowed order and the cards derive from the price", () => {
    const modal = code(MODAL);
    expect(
      modal,
      "the surface stopped reading the server's self-serve order — a typed list of three" +
        " rungs is a second copy of the ladder, and the day he moves one they disagree" +
        " with a price on screen",
    ).toContain("for (const id of plans.selfServeOrder)");
    expect(
      modal,
      "Free is a card again, or the card population stopped being derived from the price." +
        " It is the state you are in, not a plan you buy (the design's section 3).",
    ).toContain("ladder.filter((plan) => plan.priceInCents > 0)");
    /* The server serves it. Without this the field above is undefined and every
       card silently disappears. */
    expect(
      code(BILLING),
      "getPlans stopped serving selfServeOrder, so the surface draws no cards at all",
    ).toContain("selfServeOrder: SELF_SERVE_PLAN_ORDER");
  });

  it("the windowing mechanism is GONE, not left pointing at itself", () => {
    /*
      `cardTrio` and `compareWindow` existed for one reason — seven rungs do not
      fit in an 880px modal. Three rungs are the whole individual ladder, so
      there is nothing left to window, and a mechanism whose reason has gone is
      removed rather than kept as a no-op that the next reader has to reason
      about (the design's section 3, decision 1).
    */
    const ladder = code(LADDER);
    expect(ladder, "cardTrio is back").not.toContain("export function cardTrio(");
    expect(ladder, "compareWindow is back").not.toContain("export function compareWindow(");
    expect(ladder, "the five-column constant is back").not.toContain("COMPARE_COLUMNS");
    /* POSITIVE CONTROL — the reader can see this file's declarations at all, so
       the three absences above are readings rather than an unread file. */
    expect(ladder).toContain("export function recommendPlan(");
  });

  it("⚠ AND NO LABEL STILL DESCRIBES IT — the control names where it goes (#1850)", () => {
    /*
      THE ARM ABOVE WAS NOT ENOUGH, AND THIS IS THE CARD THAT PROVED IT. The
      window's CODE went in #1832 and its COPY did not: the compare control's
      return label read *"Back to the nearest three"* for a day after there
      stopped being anything to be nearest to, and it was found by the relay
      reading PR #1849 rather than by anything here. A population that derives
      survives a ruling (the surface drew three cards with no code change when
      the ladder shortened by four rungs); a STRING that described the mechanism
      does not, because nothing derives a label.

      So the sweep's finding is pinned rather than remembered. Comments are
      stripped before every match below, so the paragraph you are reading — and
      the surface's own ⚠ note quoting the dead label — cannot satisfy it.
    */
    const modal = code(MODAL);
    const control = slice(
      modal,
      'className="dp-plan__modeswitch"',
      "</button>",
      "the compare control",
    );
    expect(
      control,
      "the compare control's labels moved — one of them may be describing a mechanism again",
    ).toContain('{compare ? "Back to plans" : "Compare plans"}');

    /* And no customer string anywhere on the surface names the window or a rung
       count. `window` itself is NOT on this list: the stripped source carries
       the browser global, so an arm over that word would be red on correct
       code — which is the shape that gets a guard deleted rather than fixed. */
    for (const word of ["nearest", "Compare all", "all 5", "all five", "windowed"]) {
      expect(
        modal,
        `the plan surface names the deleted sliding window again: ${word}`,
      ).not.toContain(word);
    }
  });

  it("⚠ the direction of a move is read from the PRICE, and the prices make that faithful", () => {
    /*
      An account on an arranged-directly rung is not on the drawn ladder, so a
      position-based direction answers -1 and labels every card `Upgrade` —
      including the ones that are a drop in both allowance and price. The price
      answers it for every rung, because `getStatus` serves the account's own
      price through `ownPlanFacts` precisely so an off-ladder account is not
      captioned from a list it is absent from.

      ⚠ **THAT ONLY HOLDS WHILE PRICE AND LADDER POSITION AGREE**, so the
      equivalence is asserted over the real table rather than assumed: a future
      rung priced out of order would make *costs more* and *further up* two
      different facts, and a button would quietly mislabel itself.
    */
    const ordered = OFFERED_PLAN_ORDER.map((tier) => PLAN_TIERS[tier].price);
    for (let index = 1; index < ordered.length; index += 1) {
      expect(
        ordered[index],
        `${OFFERED_PLAN_ORDER[index]} is not dearer than ${OFFERED_PLAN_ORDER[index - 1]},` +
          " so a price comparison no longer gives the ladder's own direction",
      ).toBeGreaterThan(ordered[index - 1]);
    }
    const modal = code(MODAL);
    expect(
      modal,
      "the direction is a ladder position again — see this arm's own reasoning",
    ).toContain("plan.priceInCents > ownPriceInCents");
    expect(
      modal,
      "the account's own price is no longer read off its own row, so an off-ladder account" +
        " has no direction at all",
    ).toContain("status?.planPriceInCents");
  });
});

describe("card 1833 — the Enterprise band", () => {
  it("replaces the support-mailto line rather than sitting beside it", () => {
    const modal = code(MODAL);
    expect(modal, "the band is gone").toContain("dp-plan__ent");
    expect(
      modal,
      "the old quiet support line is back beside the band, so the surface now has two doors",
    ).not.toContain("Need a higher limit?");
    expect(
      code(CSS),
      "the support line's class is back",
    ).not.toContain(".dp-plan__request {");
    expect(code(CSS), "the band has no style of its own").toContain(".dp-plan__ent {");
  });

  it("its action is a mail and collects nothing", () => {
    const modal = code(MODAL);
    expect(modal, "the action stopped being a mail — #391 asked for an email link").toContain(
      "mailto:${SALES_EMAIL}",
    );
    /* His own condition on the card: never a form that collects card details.
       Nothing leaves the app until the customer sends the mail, so the band may
       not hold an input, a form or a mutation. */
    /* The anchor is the full `className` attribute: `dp-plan__ent` alone also
       matches `dp-plan__entbody` and `dp-plan__entnote`, and a slice taken from
       whichever sorted first is the guard-arm-satisfied-by-a-sibling shape this
       repository has paid for. `slice` proves uniqueness, which is how this was
       caught. */
    const band = slice(modal, 'className="dp-plan__ent"', "dp-plan__trust", "the band");
    expect(band, "the band grew a form").not.toMatch(/<form|<input|<textarea|useMutation/);
    /* The subject is composed from account data, so both halves are encoded —
       one `&` would truncate the subject and invent a mailto parameter. */
    expect(
      modal,
      "the mailto subject is no longer encoded, and it is composed from the account's own" +
        " plan name and balance",
    ).toContain("encodeURIComponent(subject)");
  });

  it("⚠ its heading comes off the wire, because a plan name may not be a literal", () => {
    /*
      Card 390's rule, and it caught this band's first draft: the modal may not
      contain any rung's name. The band wears the top arranged-directly rung's
      name and audience line off ONE key, so a rename in `PLAN_TIERS` renames the
      band with it.
    */
    const modal = code(MODAL);
    expect(modal, "the band's heading is a literal again").toContain(
      "plans?.tiers[BAND_TIER as keyof typeof plans.tiers]?.name",
    );
    expect(
      modal,
      "the band's audience line is no longer the rung's own",
    ).toContain("blurbFor(BAND_TIER)");
    /* And the key it reads is a rung the server actually serves — otherwise the
       band silently never draws. */
    const key = /const BAND_TIER = "([a-z_]+)";/.exec(raw(MODAL));
    expect(key, "BAND_TIER is no longer declared as a plain key").not.toBeNull();
    expect(
      ARRANGED_DIRECTLY_PLAN_TIERS as readonly string[],
      "the band wears the name of a rung it does not stand for",
    ).toContain(key![1]);
    expect(
      OFFERED_PLAN_ORDER as readonly string[],
      "the band's own key is not in getPlans' tiers projection, so the band never draws",
    ).toContain(key![1]);

    /*
      ⚠ **AND THE NAME IS CHECKED AS JSX TEXT, NOT ONLY AS A STRING LITERAL —
      THIS ARM WAS WRITTEN BY A SABOTAGE THAT SURVIVED EVERYTHING ELSE.**

      Replacing `{bandName}` with a bare `Enterprise` between the tags passed
      BOTH guards: `card390-guard.test.ts` reads `"Enterprise"` WITH its quotes,
      and the arm above only asks that `bandName` is still DECLARED. So the one
      edit this pair exists to catch was the one edit that got through, and the
      finding is about the readers rather than about the tree.

      ⚠ **IT IS SCOPED TO THE BAND AND THE WIDENING IS NOT A ONE-LINER, WHICH IS
      WHY THE FLOOR IS STATED HERE RATHER THAN QUIETLY FIXED IN card 390's ARM.**
      A tree-wide "no rung name as JSX text" read reddens on a shipped, correct
      string: the footer's `<Button …>Drop to Free</Button>`, which is a plan
      name in copy a customer reads and which he has approved. Deciding what to
      do about that is a copy judgement, not a guard edit, so it is Retro
      material and is named in this commit's report. The band is where no name
      belongs at all, because its heading is derived by construction.
    */
    const bandText = slice(modal, 'className="dp-plan__ent"', "dp-plan__trust", "the band");
    const asText = [...bandText.matchAll(/>([^<>{}]+)</g)].map((match) => match[1]);
    for (const tier of Object.values(PLAN_TIERS)) {
      expect(
        asText.join(" | "),
        `\`${tier.name}\` is typed into the band as JSX text — the heading comes off the wire`,
      ).not.toContain(tier.name);
    }
    /* WORKING LAW 2 — the reader can see one. The same scan over the same slice
       with the sabotage's own edit applied finds it. */
    const sabotaged = [
      ...bandText
        .replace("{bandName}", PLAN_TIERS.enterprise.name)
        .matchAll(/>([^<>{}]+)</g),
    ].map((match) => match[1]);
    expect(
      sabotaged.join(" | "),
      "the JSX-text reader cannot see a hard-coded name even when one is put there",
    ).toContain(PLAN_TIERS.enterprise.name);
  });
});

describe("card 1834 — the compare table is grouped, and a row means a real difference", () => {
  /** Every `label: "…"` in the compare table's own groups. */
  function rowLabels(): string[] {
    const modal = code(MODAL);
    const groups = slice(
      modal,
      "const groups: CompareGroup[]",
      "const phoneOrder",
      "the compare groups",
    );
    return [...groups.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]);
  }

  it("⚠ FOUR FACTS DIFFER AND THERE ARE FOUR ROWS, PLUS THE PRICE", () => {
    /*
      The design's section 2, held as a property rather than quoted. The four:
      the allowance (`monthlyCredits`), what it makes (derived from it), what
      happens to unspent credits (`rolloverPercent`), and whether packs may be
      bought (`topupEligibility`) — plus the price itself. A fifth row would be
      inventing a difference, which is the trap a table organised by what a
      customer makes invites.

      ⚠ **THE COUNT ALONE WOULD PASS A SWAP**, so each row is named; and the
      count is asserted too, so a row cannot be quietly added beside them.
    */
    const labels = rowLabels();
    expect(labels, "the compare table's row set changed").toEqual([
      "Finished characters a month",
      "Credits",
      "Unspent credits",
      "Buy extra credits",
      "Price a month",
    ]);
    /* The four differing facts are each genuinely read, at the real table — so
       the row set above is a reading of the product rather than a list. */
    const credits = new Set(OFFERED_PLAN_ORDER.map((tier) => PLAN_TIERS[tier].monthlyCredits));
    const rollovers = new Set(OFFERED_PLAN_ORDER.map((tier) => PLAN_TIERS[tier].rolloverPercent));
    const eligibility = new Set(OFFERED_PLAN_ORDER.map((tier) => topupEligibility(tier)));
    const prices = new Set(OFFERED_PLAN_ORDER.map((tier) => PLAN_TIERS[tier].price));
    expect(credits.size, "every plan now has the same allowance — the Credits row is dead")
      .toBeGreaterThan(1);
    expect(rollovers.size, "rollover no longer differs — the Unspent credits row is dead")
      .toBeGreaterThan(1);
    expect(eligibility.size, "pack eligibility no longer differs — that row is dead")
      .toBe(2);
    expect(prices.size, "the prices no longer differ").toBeGreaterThan(1);
  });

  it("no row claims a per-plan capability, because no plan rung gates one", () => {
    /*
      His avoid-list on #1607 from the other side. These are the rows a grouped
      table *wants* and the product cannot honestly draw: nothing in it consults
      `planTier` for a capability.
    */
    const modal = code(MODAL);
    for (const invented of [
      "views per cast",
      "Views per cast",
      "refines a month",
      "Refines a month",
      "rolls at once",
      "Rolls at once",
      "Priority",
      "Unlimited",
      "seats",
    ]) {
      expect(modal, `the table invented a per-plan difference: ${invented}`).not.toContain(
        `label: "${invented}`,
      );
    }
    /* POSITIVE CONTROL — the reader does see this file's labels. */
    expect(rowLabels().length).toBeGreaterThan(3);
  });

  it("the rate is still absent from the whole surface — his word, and it stayed absent", () => {
    /*
      2026-10-02, verbatim: *"on the free card remove the free CREDITS PER $1
      line thats stupid"*, then *"yes i like this"* on the reading that the rate
      belongs on Add credits and nowhere else. A redesign of this surface is
      exactly where it would come back.
    */
    const modal = code(MODAL);
    expect(modal, "the rate is back on the plan surface").not.toContain("formatCreditsPerDollar");
    expect(modal, "the rate row is back in the table").not.toContain("Credits per dollar");
    expect(modal, "the old cost-per-credit row is back").not.toContain("Cost per credit");
  });

  it("the column count is derived, so a stylesheet cannot hold a stale ladder width", () => {
    const modal = code(MODAL);
    const css = code(CSS);
    expect(
      modal,
      "the grid's column count stopped being read from the population it drew",
    ).toContain('["--dp-plan-cols" as string]: String(plans.length)');
    expect(
      css,
      "the compare grid has a typed column count again — the ladder's length is the" +
        " server's to change (SELF_SERVE_PLAN_ORDER)",
    ).toContain("repeat(var(--dp-plan-cols, 1), minmax(0, 1fr))");
    expect(css, "a literal five-column grid is back").not.toContain("repeat(5, 1fr)");
  });

  it("⚠ the phone shape and the wide shape read ONE declaration", () => {
    /*
      A transposition cannot be a media query — the cells leave their rows — so
      the phone layout is a second DOM. The one thing a second layout must never
      do is hold a different population or a different reading, which is working
      law 4 in the place it would be least visible: nobody opens a modal at
      390px and 880px in the same breath.
    */
    const modal = code(MODAL);
    const phone = slice(
      modal,
      "dp-plan__comparephone",
      "dp-plan__footnote",
      "the phone table",
    );
    expect(
      phone,
      "the phone table stopped reading the same groups, so its rows can now differ from" +
        " the wide table's",
    ).toMatch(/groups\.flatMap/);
    expect(
      phone,
      "the phone table declares its own row labels",
    ).not.toMatch(/label: "/);
    expect(
      phone,
      "the phone order is no longer derived from the drawn population",
    ).toContain("phoneOrder.map");
    /* And exactly one of the two is visible at a time, by `display: none` — so
       a screen reader meets one table rather than two. */
    const css = code(CSS);
    expect(css, "the phone table is visible beside the wide one").toContain(
      ".dp-plan__comparephone { display: none; }",
    );
    expect(css, "the wide table is not hidden on a phone").toContain(
      ".dp-plan__comparewide { display: none; }",
    );
  });
});

describe("the brief's new copy claims only what the tree holds (#1607's rule)", () => {
  it("⚠ `the same five views` is CAST_PACKAGE_VIEWS' own length", () => {
    /*
      A spelled number in prose cannot be derived, so it is pinned instead: a
      sixth view reddens this arm rather than quietly making a sentence on a
      money surface false. The word is read out of the shipped string, not out of
      a copy of it in this file.
    */
    const WORDS: Record<number, string> = {
      3: "three",
      4: "four",
      5: "five",
      6: "six",
      7: "seven",
      8: "eight",
    };
    const word = WORDS[CAST_PACKAGE_VIEWS.length];
    expect(word, `no word for ${CAST_PACKAGE_VIEWS.length} views — extend this map`).toBeTruthy();
    expect(
      code(MODAL),
      `a signed cast now comes with ${CAST_PACKAGE_VIEWS.length} views and the compare` +
        " table still says five",
    ).toContain(`the same ${word} views, on every plan`);
  });

  it("the `on every plan` list names only routes that exist, and the COMING line names no engine", () => {
    const modal = code(MODAL);
    /*
      Each item is a road a signed-in customer can open today, read at
      `App.tsx` rather than assumed. The guard holds the ROUTES, because that is
      the half that can go false without anybody touching this file.
    */
    const app = code(join(HERE, "..", "..", "App.tsx"));
    for (const route of ["/app/casting", "/app/canvas", "/app/garments"]) {
      expect(app, `${route} is gone, so the ON EVERY PLAN line names a door that is shut`)
        .toContain(route);
    }
    /*
      ⚠ THE DISAPPEARING-TECHNOLOGY LAW, clause 5's narrow half: no engine name
      on a path someone must walk to reach their picture. The COMING line names
      a studio and two generators — things a customer wants — and must never
      name a model.
    */
    /*
      ⚠ **WORD-BOUNDED WHERE THE NAME IS A SUBSTRING OF ORDINARY CODE** — `fal`
      is inside `false` and `filter`, so an unbounded read reddens on plain
      TypeScript and teaches a shift to delete the arm. Measured: it did, on
      `false`, the first time it ran.

      ⚠ **AND THE FIRST SPELLING OF THESE PATTERNS WAS INERT, WHICH IS WHY EVERY
      ONE OF THEM NOW CARRIES ITS OWN POSITIVE CONTROL.** The boundaries were
      written through a tool that turned the escape into a BACKSPACE byte (0x08),
      so five of the seven patterns could never match anything and this arm passed
      by asserting nothing about them. **Nothing downstream disagreed** — a
      pre-commit hook caught the byte, not the test, and the 13-case sabotage run
      did not cover engine names. One control on one pattern would not have found
      it either: the pattern that happened to be controlled was `Nano Banana`,
      which has no boundary in it at all.
    */
    const ENGINES: Array<[RegExp, string]> = [
      [/Nano Banana/i, "Nano Banana Pro"],
      [/\bSunburst\b/i, "GPT Image 2.5 Sunburst"],
      [/GPT Image/i, "GPT Image 2.5"],
      [/\bGemini\b/i, "Gemini 3 Pro"],
      [/\bfal\b/i, "rendered on fal"],
      [/\bOpenRouter\b/i, "through OpenRouter"],
      [/\bSAM ?3\b/, "SAM 3 presence"],
    ];
    for (const [engine, specimen] of ENGINES) {
      expect(modal, `an engine name reached the plan surface: ${engine}`).not.toMatch(engine);
      /* WORKING LAW 2, PER PATTERN: the reader can see this one when it IS there.
         An inert regex passes the line above for free, which is exactly what the
         first spelling of this list did. */
      expect(specimen, `the pattern ${engine} matches nothing at all — it is inert`).toMatch(
        engine,
      );
    }
    /* And the COMING mark exists at all — the brief's own ask for forward copy. */
    expect(modal, "the COMING mark is gone, so unshipped capability reads as live").toContain(
      "dp-plan__coming",
    );
  });

  it("⚠ the slider's clause IS in the footnote now, and its figure is derived", () => {
    /*
      ⚠ **THIS ARM USED TO HOLD THE OPPOSITE AND ITS OWN MESSAGE SAID WHAT TO
      DO WHEN THE DAY CAME: *"or the slider shipped and this arm is the thing
      that is now stale: delete it with the clause, do not weaken it."*** The
      day is this commit. The dial ships, so the sentence it declared owed is
      owed, and the arm is re-aimed rather than deleted — the figure it names is
      the one thing about that sentence that can silently go wrong.

      What it held before, kept because it is the reason the clause was late:
      the slider needed a recurring Stripe price at his $9 a step, creating a
      Stripe object is his hand or the relay's, and quoting a control a
      customer cannot find is the stale-figure class with his approval attached
      to it (#1607's rule). He created both prices himself on 2026-10-07
      (*"Set up both. I'll run the command"*), and this seat re-read the
      catalogue before building rather than inheriting that comment.

      **The claim now: the clause exists, and no credits figure in it is
      typed.** A hard-coded `466,000` would be exactly the stale figure the
      absence was protecting against — it is `displayBalance` over the served
      spec, so a price move or a rung added above the dial moves the sentence.
    */
    const modal = code(MODAL);
    const footnote = modal.slice(modal.indexOf("dp-plan__footnote"));
    expect(
      footnote,
      "the footnote lost the slider's clause — the dial is on the cards and the table says nothing about it",
    ).toMatch(/goes up to\{" "\}/);
    /* The figure is DERIVED: the clause reads the ceiling through the display
       helper, and `sliderCeilingCredits` is composed from the served spec. */
    expect(
      footnote,
      "the slider's ceiling is printed without the display helper",
    ).toMatch(/formatCredits\(displayBalance\(sliderCeilingCredits\)\)/);
    /* And the ceiling itself is not a literal anywhere on the surface. The
       top of today's dial is 466,000 display / 2,330,000 ledger; either one
       typed here is the defect this arm exists for. */
    for (const literal of ["466,000", "466000", "2,330,000", "2330000"]) {
      expect(modal, `the slider's ceiling is typed as ${literal} instead of derived`).not.toContain(
        literal,
      );
    }
    /* The half of that sentence that was always true still points at the band. */
    expect(modal, "the footnote stopped pointing at the rungs with no column").toContain(
      "Enterprise is arranged with us directly",
    );
  });
});

describe("card 1939 — no note in this table may claim credits do not expire", () => {
  /**
   * ⚠ **THE DEFECT THIS ARM EXISTS FOR WAS A SENTENCE THAT WAS TRUE WHERE IT
   * WAS WRITTEN AND FALSE WHERE IT WAS COPIED.**
   *
   * The Credits group's note read *"One pool. Every tool spends the same
   * credits, and credits you have paid for never expire."* The second clause was
   * quoted from Add credits, where it is true and derived from real behaviour:
   * #1660 made `refreshMonthlyCredits` add `purchasedCreditsRemaining(row)` back
   * whole at every renewal. **In the plan compare table it is false**, because a
   * customer paying for a plan has paid for their plan credits too, and
   * `rolloverPercent` is 50 on Starter and 75 on Pro — two of the three rungs
   * this table draws. **The same table said so two rows up**, through
   * `rolloverSentence`.
   *
   * ⚠ **SO THE ARM IS NOT A STRING PIN, AND THAT CHOICE IS THE WHOLE VALUE
   * HERE.** Pinning the new sentence would redden on a reword and say nothing
   * about the next sentence somebody copies in from a surface where it is true.
   * What is asserted is the PROPERTY: while any rung drawn in this table
   * forfeits part of its allowance, no note in it may claim otherwise. The
   * population is read from `PLAN_TIERS` through the same two order constants
   * the surface itself is narrowed by, so the day every offered rung reaches
   * 100% rollover this arm stands down on its own rather than holding a true
   * sentence out.
   */

  /** Every group `note:` string in the compare table, read at the real source. */
  function groupNotes(): string[] {
    const modal = code(MODAL);
    const groups = slice(
      modal,
      "const groups: CompareGroup[]",
      "const phoneOrder",
      "the compare groups",
    );
    const notes = [...groups.matchAll(/note:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
    expect(notes.length, "no group notes were read — the shape moved and this arm is blind")
      .toBeGreaterThan(0);
    return notes;
  }

  it("⚠ while a drawn rung forfeits unspent credits, no note says credits never expire", () => {
    /* The rungs the table actually draws: the self-serve ladder, plus the
       arranged-directly band the footnote covers — both read from the catalogue
       rather than listed, so a rung moving between them cannot slip the check. */
    const drawn = [...SELF_SERVE_PLAN_ORDER, ...ARRANGED_DIRECTLY_PLAN_TIERS];
    const forfeiting = drawn.filter((tier) => PLAN_TIERS[tier].rolloverPercent < 100);

    /* The precondition, stated so a future reader knows why the arm is silent
       if it ever stops holding — and so a catalogue change that makes the
       sentence TRUE does not read as this guard being deleted. */
    expect(
      forfeiting.length,
      "every drawn rung now keeps 100% of unspent credits — this arm no longer has a" +
        " subject, and an expiry claim in the table would be true; delete it with its card",
    ).toBeGreaterThan(0);

    const worst = forfeiting
      .map((tier) => `${PLAN_TIERS[tier].name} keeps ${PLAN_TIERS[tier].rolloverPercent}%`)
      .join(", ");

    for (const note of groupNotes()) {
      expect(
        /\bnever expire\b|\bdo(?:es)? not expire\b|\bdon't expire\b|\bnothing\b[^.]*\bexpires?\b/i.test(
          note,
        ),
        `a compare-table note claims credits do not expire — but ${worst}, and the` +
          ` Unspent credits row in this same table says so: "${note}"`,
      ).toBe(false);
    }
  });

  it("the per-rung expiry fact is still drawn, in the row where it belongs", () => {
    /*
      The other half of the repair, and the reason nothing honest was lost by
      cutting the clause: what expires is a PER-RUNG fact, so it is stated in a
      per-rung CELL and never in a note that spans every column. If the row ever
      stops reading `rolloverSentence`, the table would carry no expiry fact at
      all — which the arm above cannot see, because it only forbids a claim.
    */
    const modal = code(MODAL);
    const groups = slice(
      modal,
      "const groups: CompareGroup[]",
      "const phoneOrder",
      "the compare groups",
    );
    expect(
      groups,
      "the Unspent credits row stopped reading rolloverSentence — the table now states" +
        " no expiry fact anywhere, per rung or otherwise",
    ).toContain("rolloverSentence(plan.rolloverPercent).text");
  });
});
