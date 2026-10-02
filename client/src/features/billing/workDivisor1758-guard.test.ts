/**
 * #1758 — WHAT A CUSTOMER'S CREDITS BUY IS PRICED OFF THE STUDIO THEY USE.
 *
 * Both money surfaces translate an allowance into work, and both divided by
 * `credits.getCosts`'s `castingImage` to do it. That number is **350**, and it
 * is the LEGACY studio's headshot price — `castingCreditCosts.ts` declares
 * `CREDIT_COSTS` as *"not part of the new scale"*, its lane has been admin-only
 * since #1654, and it retires with the legacy studio itself (#29). So the one
 * sentence on each surface that tells somebody what their money buys was priced
 * off a surface they cannot reach.
 *
 * **It read low, and the arithmetic is driven below rather than quoted.** Pro's
 * 180,000 ledger credits over the legacy 350 is *about 514 casting frames*; over
 * the 200 a sheet slice actually costs it is 900. (#1758's body says *"more than
 * half"* and quotes 1,200 — true while a slice cost 150, a price his one-price
 * ruling of the same day moved. The arm below holds the direction for that
 * reason.)
 *
 * #1607 took the plan cards off it by replacing the frames line with a count of
 * finished characters, derived server-side from the three prices the studio
 * charges (`CASTING_V2_ONE_CHARACTER_CREDITS` = Roll + Refine + Sign). #1758 is
 * its sibling on Add credits, and these arms hold the pair together:
 *
 * - the population is **derived** from the tree — every production surface that
 *   calls `charactersFor` — so a third surface that starts saying what credits
 *   make is held to the same divisor without anybody adding a row here;
 * - `framesFor` is **deleted**, not left beside its replacement: a helper whose
 *   only argument is a per-frame price is an invitation to fetch that price
 *   again, which is the defect both cards are about;
 * - the plural rule has **one** declaration (`charactersPhrase`), because the
 *   compare grid is what taught this file's neighbour that two copies of it
 *   drift — it printed `about 1 characters` on the free column (#1607, law 6).
 *
 * Comments are stripped before every source match, so this docblock cannot
 * satisfy an arm about the code.
 */
import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { withoutComments } from "../../../../server/testing/withoutComments";
import { readListedSource } from "../../../../server/testing/listedSource";
import { CONTENDED_TEST_TIMEOUT_MS } from "../../../../server/testing/contendedTestTimeout";
import { PLAN_TIERS } from "../../../../drizzle/schema";
import { CASTING_V2_ONE_CHARACTER_CREDITS } from "../../../../server/castingV2/castViewPackage";
import {
  CASTING_V2_COSTS,
  CREDIT_COSTS,
} from "../../../../server/casting/castingCreditCosts";
import { charactersFor, charactersPhrase } from "../settings/planLadder";

/* The population arms walk `client/src`, `server` and `shared` off the real
   tree, which is the contended-read population: fast here, red under load on
   somebody else's machine rather than in CI. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const HERE = join(process.cwd(), "client", "src", "features", "billing");
const code = (name: string) => withoutComments(readFileSync(join(HERE, name), "utf8"));

const ADD_CREDITS = "client/src/features/billing/AddCreditsModal.tsx";
const CHANGE_PLAN = "client/src/features/billing/ChangePlanModal.tsx";

/**
 * The slice of a surface between two anchors, so an arm about one sentence
 * cannot be satisfied by another sentence in the same file. A missing anchor
 * fails loudly rather than returning an empty band, which every `not.toContain`
 * below would otherwise pass.
 */
function band(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  expect(start, "the opening anchor is gone from the surface: " + from).toBeGreaterThan(-1);
  const end = source.indexOf(to, start + from.length);
  expect(end, "the closing anchor is gone from the surface: " + to).toBeGreaterThan(-1);
  return source.slice(start, end);
}

/** Every production `.ts`/`.tsx` under the three roots whose code names `token`. */
function productionFilesNaming(token: RegExp, skipFile?: string): string[] {
  const roots = ["client/src", "server", "shared"].map((relative) =>
    join(process.cwd(), relative),
  );
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        const stat = statSync(full, { throwIfNoEntry: false });
        if (!stat?.isDirectory()) continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      /* A test is not a surface, and the declaring module is not a caller. */
      if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
      if (skipFile && entry.name === skipFile) continue;
      const body = readListedSource(full);
      if (body === null) continue;
      if (token.test(withoutComments(body))) {
        hits.push(full.slice(process.cwd().length + 1).replace(/\\/g, "/"));
      }
    }
  };
  for (const root of roots) {
    const stat = statSync(root, { throwIfNoEntry: false });
    if (stat?.isDirectory()) walk(root);
  }
  return hits.sort();
}

describe("Card 1758 - the divisor, driven on the real prices", () => {
  it("the divisor is the three prices the studio charges and is NOT the legacy table", () => {
    /* Driven against the live constant rather than against 11,850: his next
       price word moves it, and a pinned total would have to be edited by hand. */
    expect(
      CASTING_V2_ONE_CHARACTER_CREDITS,
      "the work sentence is priced off the legacy studio again",
    ).not.toBe(CREDIT_COSTS.castingImage);
    expect(CASTING_V2_ONE_CHARACTER_CREDITS).toBeGreaterThan(0);
  });

  it("the legacy divisor understated the work, and the DIRECTION is what is held", () => {
    /*
      THE BEFORE ARM, and it holds a relation rather than two figures. Read at
      the real Pro grant through the real prices on 2026-10-02: the broken
      sentence said **about 514 casting frames** where the studio a customer
      actually uses answers **900**. It is a frames-over-frames comparison on
      purpose — the fix changes the NOUN as well as the divisor, so the counts
      after it are not comparable, and the only honest measure of what was wrong
      is the unit the broken sentence itself used.

      ⚠ **THE CARD'S OWN MAGNITUDE IS A PRICE OLD AND IS NOT ASSERTED HERE.**
      #1758's body says *"understates by more than half ... reads as about 514
      frames where the real answer is 1,200"*, which was true while a sheet
      slice cost 150. His one-price ruling of 2026-10-02 (#1753) put it at 200,
      so the real answer is 900 and the understatement is 43% rather than 57%.
      Pinning either number would have shipped an arm his next price word
      reddens for no reason; the relation is what the fix is about.
    */
    const pro = PLAN_TIERS.pro.monthlyCredits;
    const framesAtLegacyPrice = Math.floor(pro / CREDIT_COSTS.castingImage);
    const framesAtStudioPrice = Math.floor(pro / CASTING_V2_COSTS.rollCandidate);
    expect(
      framesAtLegacyPrice,
      "the legacy price is no longer the dearer one, so this arm has stopped measuring the defect",
    ).toBeLessThan(framesAtStudioPrice);
    /* And the divisor the surfaces actually use is a whole character rather
       than a slice of one, so it is dearer than either — a count of characters
       can never be read as a count of frames by accident. */
    expect(CASTING_V2_ONE_CHARACTER_CREDITS).toBeGreaterThan(CREDIT_COSTS.castingImage);
    expect(CASTING_V2_ONE_CHARACTER_CREDITS).toBeGreaterThan(CASTING_V2_COSTS.rollCandidate);
  });

  it("the bullet's two counts are properties of the live ladder, not figures typed here", () => {
    /*
      The sentence a Starter subscriber reads on the Pro option — *"That is
      about 15 finished characters a month, up from about 5"* as the ladder and
      the prices stand on 2026-10-02. The figures are in this comment and not in
      the arm: #1607's guard makes the same choice, and its reason is measured —
      the counts move with his price words, and a pinned pair would have shipped
      three figures that were a day stale.
    */
    const phraseAt = (credits: number) =>
      charactersPhrase(charactersFor(credits, CASTING_V2_ONE_CHARACTER_CREDITS));
    for (const rung of [PLAN_TIERS.free, PLAN_TIERS.starter, PLAN_TIERS.pro]) {
      const phrase = phraseAt(rung.monthlyCredits);
      expect(phrase, rung.name + ": no sentence at all").not.toBeNull();
      /* The whole sentence the customer reads, including the plural rule. */
      expect(phrase!).toMatch(/^about [\d,]+ finished characters?$/);
      /* And the count never promises more than the grant covers — the one
         direction a pricing surface may not get wrong. */
      const count = charactersFor(rung.monthlyCredits, CASTING_V2_ONE_CHARACTER_CREDITS);
      expect(count * CASTING_V2_ONE_CHARACTER_CREDITS).toBeLessThanOrEqual(
        rung.monthlyCredits,
      );
    }
    /* `up from` is only ever read downward: a dearer rung covers at least as
       much work as the rung the customer is leaving. */
    expect(
      charactersFor(PLAN_TIERS.pro.monthlyCredits, CASTING_V2_ONE_CHARACTER_CREDITS),
    ).toBeGreaterThan(
      charactersFor(PLAN_TIERS.starter.monthlyCredits, CASTING_V2_ONE_CHARACTER_CREDITS),
    );
  });
});

describe("Card 1758 - every surface that says what credits make, derived from the tree", () => {
  /*
    The population is read off the code rather than typed, because the defect
    was one surface fixed and its sibling missed for a day. `charactersFor` is
    the only way a surface can state this fact now, so calling it is what makes
    a file a member.
  */
  const surfaces = productionFilesNaming(/\bcharactersFor\s*\(/, "planLadder.ts");

  it("the population is both money surfaces and nothing is silently missing", () => {
    expect(surfaces).toContain(ADD_CREDITS);
    expect(surfaces).toContain(CHANGE_PLAN);
    expect(
      surfaces.length,
      "a reader that finds nothing passes every arm below it",
    ).toBeGreaterThan(1);
  });

  it("the walker can see a symbol at all - the positive control", () => {
    /* A walker reading nothing reports a clean population as readily as a
       clean one. `charactersPhrase` is declared beside the subject and used by
       both surfaces, so an empty answer here is the reader and not the tree. */
    const phraseReaders = productionFilesNaming(/\bcharactersPhrase\s*\(/, "planLadder.ts");
    expect(phraseReaders).toContain(ADD_CREDITS);
    expect(phraseReaders).toContain(CHANGE_PLAN);
  });

  it("not one of them reads the legacy price, by either road", () => {
    for (const relative of surfaces) {
      const source = withoutComments(readFileSync(join(process.cwd(), relative), "utf8"));
      expect(source, relative + " reads the legacy per-frame price again").not.toContain(
        "castingImage",
      );
      expect(source, relative + " queries the legacy price list again").not.toContain(
        "credits.getCosts",
      );
      expect(
        source,
        relative + " divides by something other than the figure the server derives",
      ).toContain("oneFinishedCharacterCredits");
    }
  });
});

describe("Card 1758 - framesFor is deleted, not left beside its replacement", () => {
  it("nothing in the product names it, and `planLadder.ts` does not declare it", () => {
    expect(productionFilesNaming(/\bframesFor\b/)).toEqual([]);
    const ladder = withoutComments(
      readFileSync(join(process.cwd(), "client/src/features/settings/planLadder.ts"), "utf8"),
    );
    expect(ladder).not.toContain("framesFor");
    /* The positive control for the two arms above: the replacement IS there, so
       an empty answer is a deletion rather than a reader that cannot see this
       module. */
    expect(ladder).toContain("export function charactersFor");
  });
});

describe("Card 1758 - the Add credits bullet", () => {
  const source = code("AddCreditsModal.tsx");
  /* Sliced between two class names that appear once each, so an arm about this
     sentence cannot be satisfied by the renewal line under it. */
  const bullets = () => band(source, "dp-topup__bullets", "dp-topup__renewal");

  it("divides by the server's figure and nothing else", () => {
    expect(source).toContain("plans?.oneFinishedCharacterCredits");
    expect(source).not.toContain("costPerFrame");
  });

  it("declines rather than guessing while the figure is unread", () => {
    /*
      The three-state discipline this surface is full of (#1703, #1725, #1747,
      #1749, #1755): an unread allowance is `null`, never a count of zero, and
      the bullet is gated on the PHRASE rather than on a number — so the one
      place that decides whether there is anything to say is the helper that
      knows what `0` means.
    */
    expect(bullets()).toContain("nextPhrase &&");
    expect(bullets()).not.toMatch(/oneCharacterCredits\s*>\s*0/);
    expect(source).toMatch(/currentCredits === null\s*\n?\s*\?\s*null/);
    /* And the helper's own answer to a divisor nobody has read. */
    expect(charactersPhrase(charactersFor(PLAN_TIERS.pro.monthlyCredits, 0))).toBeNull();
  });

  it("says the noun once, through the shared phrase", () => {
    expect(bullets()).toContain("nextPhrase");
    expect(bullets()).toContain("nowCount");
    /* A second copy of the noun or the plural rule is what drifted on the
       compare grid; neither the singular nor the pipeline's old word is spelled
       on this surface at all. */
    expect(source, "the plural rule has a second home").not.toContain("finished character");
    expect(source, "the pipeline's unit is back on a customer's sentence").not.toContain(
      "casting frames",
    );
  });
});
