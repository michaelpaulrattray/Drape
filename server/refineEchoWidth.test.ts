/**
 * THE ANSWER SHE GETS BACK FITS THE FIELD, AND THE RENDER STILL GETS ALL OF IT
 * (#1126).
 *
 * # The defect
 *
 * A re-ask resolves into a sentence that does two jobs: it is pushed onto the
 * recipe the picture is rendered from, and it is stored in
 * `castingCandidateVariants.requestText` as the label the version rail shows
 * her. The column is `varchar(220)`; the router accepts an `answering` of 309.
 * So an answered refine can resolve into 341 characters against a field that
 * holds 220, and a bare `slice(0, 220)` decided what fell off the end — which
 * was our own clarifying clause, the only thing that tells two versions of one
 * ask apart on the rail.
 *
 * # ⚠ THE ARM THAT MATTERS MOST IS THE ONE THAT LOOKS REDUNDANT
 *
 * The card's recommended fix was to cap her sentence at the places the
 * composition happens. **That would have shortened a paid render**: the same
 * string is the instruction. `the resolved instruction is never cut` stands in
 * front of that road, and it is not redundant with the echo arms — it is the
 * one that goes red if somebody takes the cheaper road later.
 *
 * # ⚠ AND THE POPULATION IS WALKED, WHICH IS HOW THE FIFTH SITE WAS FOUND
 *
 * The card named four composing sites. Driving every question the product can
 * ask, at the longest answer the router accepts, turned up options that
 * overflow with no clause of ours in them at all — *"Yes — pink"* resolves to
 * her whole corrected sentence, *"Go ahead anyway"* and the two design chips
 * resolve to her sentence unchanged. They were cut mid-word by the same slice
 * and looked nothing like the defect. {@link storedEchoOf} is the single reader
 * that answers for all of them, and the sweep below drives it rather than a
 * list of sites.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { capForEcho, capForEchoWithTail } from "../server/castingV2/capAtWordBoundary";
import {
  REASK_KINDS,
  alreadyUpsweptReask,
  didYouMeanReask,
  glassesHideEyesReask,
  nearMiss,
  replaceDesignReask,
  sameAgainReask,
  storedEchoOf,
  thisDesignReask,
  whichFacetReask,
  whichSideReask,
  type Reask,
  type ReaskOption,
} from "../server/castingV2/refineReask";
import {
  REFINE_ANSWERING_MAX_LENGTH,
  REFINE_REQUEST_TEXT_MAX_LENGTH,
} from "../server/castingV2/refineLimits";
import type { CastPronouns } from "../server/castingV2/castPronouns";

const HER: CastPronouns = {
  subject: "she",
  object: "her",
  possessive: "her",
  reflexive: "herself",
  plural: false,
};

/**
 * A sentence at the longest an ANSWER may be — the case the column cannot
 * hold, and the reason every number here is measured at 309 rather than at the
 * 200 the typing box allows.
 */
function askedAtFullLength(seed: string): string {
  const filler = " and keep the lighting soft and even across the whole frame";
  let asked = seed;
  while (asked.length < REFINE_ANSWERING_MAX_LENGTH) asked += filler;
  /* No trailing punctuation and no trailing space: the builders strip both,
     and a head the builder rewrote would make the tail derivation a lie. */
  return asked.slice(0, REFINE_ANSWERING_MAX_LENGTH).replace(/[\s.!?]+$/, "");
}

/** Every question the product can ask, built at the longest answer it can carry. */
const QUESTIONS: Array<{ kind: string; head: string; reask: Reask }> = (() => {
  const colour = askedAtFullLength("pinker");
  const upswept = askedAtFullLength("fox eyes");
  const glasses = askedAtFullLength("give her a cat eye");
  const side = askedAtFullLength("use this tattoo design on her arm");
  const typo = askedAtFullLength("piink hair");
  const design = askedAtFullLength("use this tattoo design on her left upper arm");
  const again = askedAtFullLength("gold hoops please");
  return [
    { kind: "which-facet", head: colour, reask: whichFacetReask(colour) },
    { kind: "already-upswept", head: upswept, reask: alreadyUpsweptReask(upswept, HER) },
    { kind: "glasses-hide-eyes", head: glasses, reask: glassesHideEyesReask(glasses, HER) },
    { kind: "which-side", head: side, reask: whichSideReask(side, HER) },
    { kind: "did-you-mean", head: typo, reask: didYouMeanReask(typo, nearMiss(typo)!) },
    {
      kind: "this-design",
      head: design,
      reask: thisDesignReask({ designPublicId: "d-minted", asked: design }),
    },
    {
      kind: "replace-design",
      head: design,
      reask: replaceDesignReask({
        pronouns: HER,
        newDesignPublicId: "d-minted",
        residentDesignPublicId: "d-resident",
        placement: "upperArm",
        side: "left",
        asked: design,
      }),
    },
    {
      kind: "same-again",
      head: again,
      reask: sameAgainReask({ asked: again, priceCredits: 25, pronouns: HER }),
    },
  ];
})();

/** The clause this option composed onto her sentence, or "" if it composed none. */
function tailOf(head: string, option: ReaskOption): string {
  return option.resolves.startsWith(head) && option.resolves.length > head.length
    ? option.resolves.slice(head.length)
    : "";
}

/** Options that cannot fit the column as they stand — the ones the echo is for. */
function overflowing(reask: Reask): ReaskOption[] {
  return reask.options.filter((option) =>
    option.resolves.length > REFINE_REQUEST_TEXT_MAX_LENGTH);
}

describe("#1126 — the field, the router and the column", () => {
  it("covers every question the product can ask — none joins without a row", () => {
    expect([...REASK_KINDS].sort()).toEqual(QUESTIONS.map((row) => row.kind).sort());
  });

  it("the width this module caps to is the width the schema declares", () => {
    const schema = readFileSync(path.join(process.cwd(), "drizzle/schema.ts"), "utf8");
    const declared = schema.match(/requestText: varchar\("requestText", \{ length: (\d+) \}\)/);
    expect(declared, "requestText is not declared as a varchar in drizzle/schema.ts any more")
      .not.toBeNull();
    expect(Number(declared![1])).toBe(REFINE_REQUEST_TEXT_MAX_LENGTH);
  });

  it("the field an ANSWER travels in is wider than the column that stores it — the defect, stated", () => {
    /* Not a rule: the mismatch IS #1126. The arm is here so that widening the
       column — a founder-run `MODIFY COLUMN`, which the rite's classifier fails
       closed on — arrives with a red pointing at every belief built on 220. */
    expect(REFINE_ANSWERING_MAX_LENGTH).toBeGreaterThan(REFINE_REQUEST_TEXT_MAX_LENGTH);
  });

  it("the sweep below is looking at something — overflow really happens", () => {
    /* A control on the sweep itself: if the builders ever stopped producing an
       overflowing option, every arm under it would pass by finding nothing. */
    const found = QUESTIONS.flatMap((row) => overflowing(row.reask));
    expect(found.length).toBeGreaterThanOrEqual(QUESTIONS.length);
  });
});

describe("#1126 — the resolved instruction is never cut", () => {
  for (const { kind, head, reask } of QUESTIONS) {
    it(`${kind}: every chip renders her whole sentence and our whole clause`, () => {
      for (const option of reask.options) {
        const tail = tailOf(head, option);
        if (tail === "") continue;
        expect(option.resolves, `${kind} cut the instruction at ${JSON.stringify(option.label)}`)
          .toBe(`${head}${tail}`);
        expect(option.resolves.length).toBeGreaterThan(REFINE_REQUEST_TEXT_MAX_LENGTH);
      }
    });
  }
});

describe("#1126 — what is stored fits, and never cuts a word", () => {
  for (const { kind, head, reask } of QUESTIONS) {
    it(`${kind}: every chip stores a sentence the column can hold`, () => {
      for (const option of reask.options) {
        const stored = storedEchoOf(option);
        expect(stored.length, `${kind} · ${option.label} overflows the column`)
          .toBeLessThanOrEqual(REFINE_REQUEST_TEXT_MAX_LENGTH);

        const tail = tailOf(head, option);
        if (tail !== "" && option.resolves.length > REFINE_REQUEST_TEXT_MAX_LENGTH) {
          expect(stored.endsWith(tail), `${kind} dropped our clause ${JSON.stringify(tail)}`)
            .toBe(true);
        }

        /* Whatever it kept of the sentence is a whole number of words, taken
           from the front of what would have been rendered. */
        const kept = stored.slice(0, stored.length - tail.length);
        expect(option.resolves.startsWith(kept), `${kind} stored words nobody said`).toBe(true);
        const next = option.resolves.slice(kept.length, kept.length + 1);
        expect(
          next === "" || /[\s,;:.!?—–-]/.test(next),
          `${kind} cut ${JSON.stringify(option.resolves.slice(kept.length, kept.length + 14))} mid-word`,
        ).toBe(true);
      }
    });
  }

  it("a short answer is stored as itself — nothing cut where nothing overflows", () => {
    const short = whichSideReask("put it on her arm", HER);
    for (const option of short.options) {
      expect(option.resolves.length).toBeLessThanOrEqual(REFINE_REQUEST_TEXT_MAX_LENGTH);
      expect(storedEchoOf(option)).toBe(option.resolves);
    }
  });

  it("NEGATIVE CONTROL — the reader really does cut, and really does keep a clause", () => {
    const composed: ReaskOption = {
      label: "Her left",
      resolves: `${"word ".repeat(60)}(her left)`,
      echo: capForEchoWithTail("word ".repeat(60), "(her left)", REFINE_REQUEST_TEXT_MAX_LENGTH),
    };
    expect(composed.resolves.length).toBeGreaterThan(REFINE_REQUEST_TEXT_MAX_LENGTH);
    expect(storedEchoOf(composed).length).toBeLessThanOrEqual(REFINE_REQUEST_TEXT_MAX_LENGTH);
    expect(storedEchoOf(composed).endsWith("(her left)")).toBe(true);

    /* And with no echo it still fits — the fallback is doing work, not sitting
       behind an echo that is always present. */
    const bare: ReaskOption = { label: "Go ahead anyway", resolves: "word ".repeat(60).trim() };
    expect(bare.resolves.length).toBeGreaterThan(REFINE_REQUEST_TEXT_MAX_LENGTH);
    expect(storedEchoOf(bare).length).toBeLessThanOrEqual(REFINE_REQUEST_TEXT_MAX_LENGTH);
    expect(storedEchoOf(bare).endsWith("word")).toBe(true);
  });
});

describe("#1126 — capForEchoWithTail", () => {
  it("leaves a composition that already fits completely alone", () => {
    expect(capForEchoWithTail("make her hair pinker", " — the hair", 220))
      .toBe("make her hair pinker — the hair");
  });

  it("takes the room out of the head and never out of the tail", () => {
    const head = "a".repeat(40);
    const out = capForEchoWithTail(`${head} ${"b".repeat(40)}`, " (her left)", 55);
    expect(out.length).toBeLessThanOrEqual(55);
    expect(out).toBe(`${head} (her left)`);
  });

  it("drops the dangling separator with the half word", () => {
    expect(capForEchoWithTail("soft light, wide-set eyes, cropped", " — the hair", 30))
      .toBe("soft light — the hair");
  });

  it("falls back to the plain cut when the tail alone cannot fit", () => {
    const tail = " (an unreasonably long clause of our own)";
    const out = capForEchoWithTail("her hair pinker please", tail, 10);
    expect(out.length).toBeLessThanOrEqual(10);
    expect(out).toBe(capForEcho(`her hair pinker please${tail}`, 10));
  });
});
