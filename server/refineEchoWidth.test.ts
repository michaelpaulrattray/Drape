/**
 * THE ANSWER SHE GETS BACK FITS THE FIELD, AND THE RENDER STILL GETS ALL OF IT
 * (#1126).
 *
 * # The defect, and its two halves
 *
 * A re-ask resolves into a sentence that does two jobs: it is pushed onto the
 * recipe the picture is rendered from, and it is stored in
 * `castingCandidateVariants.requestText` as the label the version rail shows
 * her. The column was `varchar(220)` while the router accepts an `answering` of
 * 309, so an answered refine resolved into 341 characters against a field that
 * held 220, and a bare `slice(0, 220)` decided what fell off the end — which was
 * our own clarifying clause, the only thing that tells two versions of one ask
 * apart on the rail.
 *
 * PR #1186 fixed the LOSS: her sentence is cut at a word boundary and our clause
 * survives (`storedEchoOf`). Migration 0066 (his "a" on the Desk card,
 * 2026-09-25; `scripts/ceremony-request-text-width.mts`, applied on both
 * worlds and read back at the column) removed the loss: the column is 400, and
 * nothing she is allowed to type is thrown away. Both halves are guarded here —
 * the second as the promise, the first as the belt beside the brace, driven at
 * the width it was built for so the widening cannot have made it inert.
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
 * overflowed the old column with no clause of ours in them at all — *"Yes —
 * pink"* resolves to her whole corrected sentence, *"Go ahead anyway"* and the
 * two design chips resolve to her sentence unchanged. {@link storedEchoOf} is
 * the single reader that answers for all of them, and the sweep below drives it
 * rather than a list of sites.
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
 * The width the column had when the loss was real. The trimming arms are
 * driven at THIS number, not at the live one: at 400 nothing overflows, and an
 * arm that finds nothing to trim passes by having nothing to check.
 */
const OLD_WIDTH = 220;

/**
 * A sentence at the longest an ANSWER may be — the case the old column could
 * not hold, and the reason every number here is measured at 309 rather than at
 * the 200 the typing box allows.
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

/** Options that cannot fit a column of `width` as they stand. */
function overflowing(reask: Reask, width: number): ReaskOption[] {
  return reask.options.filter((option) => option.resolves.length > width);
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

  it("the column holds every answer the product can compose — nothing she types is thrown away", () => {
    /* THE PROMISE migration 0066 bought, measured rather than assumed: the
       longest thing any question can resolve to, at the longest answer the
       router accepts, fits the column whole. A new question that composes a
       longer clause, or a router that accepts more, reddens here on its day. */
    const longest = Math.max(
      ...QUESTIONS.flatMap((row) => row.reask.options.map((option) => option.resolves.length)),
    );
    expect(REFINE_REQUEST_TEXT_MAX_LENGTH).toBeGreaterThan(REFINE_ANSWERING_MAX_LENGTH);
    expect(longest, "an option resolves to more than the column can hold").toBeLessThanOrEqual(
      REFINE_REQUEST_TEXT_MAX_LENGTH,
    );
    expect(QUESTIONS.flatMap((row) => overflowing(row.reask, REFINE_REQUEST_TEXT_MAX_LENGTH)))
      .toEqual([]);
  });

  it("the trimming below is looking at something — the OLD width really did overflow", () => {
    /* A control on the belt-and-brace arms: they are driven at the old width,
       and if the builders ever stopped producing an option that overflows it,
       every arm under them would pass by finding nothing. */
    const found = QUESTIONS.flatMap((row) => overflowing(row.reask, OLD_WIDTH));
    expect(found.length).toBeGreaterThanOrEqual(QUESTIONS.length);
  });
});

/**
 * ⚠ THE FIRST VERSION OF THIS ARM WAS BLIND TO THE EXACT THING IT GUARDS, and
 * a sabotage run is the only reason that is known.
 *
 * It read the clause as `resolves.slice(head.length)` and skipped any option
 * whose `resolves` did not START WITH her whole sentence — so under the card's
 * own road, where `resolves` becomes a CUT of her sentence, the filter matched
 * nothing and the arm passed by having nothing to check. **A guard whose
 * population is derived from the value under test cannot see that value go
 * wrong.**
 *
 * What it asserts instead is a property the defect destroys and nothing else
 * touches: the END of what she said is still in the instruction. A fixed answer
 * of ours — *"leave them as they are"*, *"remove her glasses"* — is not built
 * from her sentence at all and is exempt by length, which is stated here rather
 * than inferred.
 */
describe("#1126 — the resolved instruction is never cut", () => {
  /** Longer than any answer of ours that is not built from her sentence. */
  const OURS_ALONE_MAX = 60;

  for (const { kind, head, reask } of QUESTIONS) {
    it(`${kind}: every chip renders the END of what she said`, () => {
      const herEnding = head.slice(-30);
      for (const option of reask.options) {
        if (option.resolves.length <= OURS_ALONE_MAX) continue;
        expect(
          option.resolves.includes(herEnding),
          `${kind} cut the instruction at ${JSON.stringify(option.label)} — `
            + `the last words she typed are not in what would be rendered`,
        ).toBe(true);
        /* (No length floor here on purpose: "Yes — pink" resolves to her
           CORRECTED sentence, one character shorter than what she typed.) */

        /* And where a clause was composed on, it is composed onto ALL of her
           sentence rather than onto a shortened one. */
        const tail = tailOf(head, option);
        if (tail !== "") expect(option.resolves).toBe(`${head}${tail}`);
      }
    });
  }
});

describe("#1126 — what is stored fits, and never cuts a word", () => {
  for (const { kind, reask } of QUESTIONS) {
    it(`${kind}: at the live width every chip stores exactly what it resolves to`, () => {
      /* The customer-facing promise after 0066: the rail label IS the
         instruction, whole — there is no trimming left to notice. */
      for (const option of reask.options) {
        expect(storedEchoOf(option), `${kind} · ${option.label} was trimmed`).toBe(option.resolves);
      }
    });
  }

  for (const { kind, head, reask } of QUESTIONS) {
    it(`${kind}: at the OLD width the echo fits, keeps our clause and never cuts a word`, () => {
      /* The belt beside the brace, driven at the width that overflows so it is
         proved to do work: {@link capForEchoWithTail} is what `storedEchoOf`
         uses, called here at OLD_WIDTH rather than the live constant. */
      for (const option of reask.options) {
        const tail = tailOf(head, option);
        const stored = tail !== ""
          ? capForEchoWithTail(head, tail, OLD_WIDTH)
          : capForEcho(option.resolves, OLD_WIDTH);
        expect(stored.length, `${kind} · ${option.label} overflows the old column`)
          .toBeLessThanOrEqual(OLD_WIDTH);

        if (tail !== "" && option.resolves.length > OLD_WIDTH) {
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

  it("NEGATIVE CONTROL — the live reader really does cut, and really does keep a clause", () => {
    /* Past 400, so the live width is the one being exercised: the fallback
       behind the promise is doing work, not sitting behind a column that is
       always wide enough. */
    const composed: ReaskOption = {
      label: "Her left",
      resolves: `${"word ".repeat(100)}(her left)`,
      echo: capForEchoWithTail("word ".repeat(100), "(her left)", REFINE_REQUEST_TEXT_MAX_LENGTH),
    };
    expect(composed.resolves.length).toBeGreaterThan(REFINE_REQUEST_TEXT_MAX_LENGTH);
    expect(storedEchoOf(composed).length).toBeLessThanOrEqual(REFINE_REQUEST_TEXT_MAX_LENGTH);
    expect(storedEchoOf(composed).endsWith("(her left)")).toBe(true);

    /* And with no echo it still fits — the fallback is doing work, not sitting
       behind an echo that is always present. */
    const bare: ReaskOption = { label: "Go ahead anyway", resolves: "word ".repeat(100).trim() };
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
