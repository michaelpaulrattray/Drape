/**
 * WHAT A SIGNED FACE'S OWN SENTENCES NO LONGER ASK FOR — #2669's derivation.
 *
 * `takenBackForSelectedVariant` is the one answer both post-Sign readers take:
 * the drafted persona and voice lines (`castPersona.ts`) and the six
 * alternative reads (`castReads.ts`). It is driven here over ROWS shaped like
 * the ones `listCandidateVariants` returns, because what it has to survive is
 * a database column — `instructions` and `stepDeltas` are `json`, so their type
 * is `unknown` and every refusal below is a row a real table can hold.
 *
 * ⚠ **THE PRUNE IS PERFORMED, NEVER HAND-BUILT.** The "after" row's chain comes
 * from `matchSteps` + `chainAfterRemoval`, the real removal, so a change to
 * what a prune keeps is a change these arms see. A hand-written "after" delta
 * would pass forever while the product's own prune drifted away from it.
 *
 * ⚠ **AND THE CONTROLS ARE THE POINT.** This function returns an empty list for
 * almost every Cast in the product, so a suite of "it finds the fangs" arms
 * would pass just as well against a function that found fangs everywhere. Each
 * control below is a row shape that must stay silent.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  chainAfterRemoval,
  composeChain,
  matchSteps,
  type ChainStep,
} from "./refineRemoval";
import { takenBackForSelectedVariant } from "./refineService";

type VariantRow = {
  id: number;
  parentVariantId: number | null;
  instructions: unknown;
  stepDeltas: unknown;
  deltas: unknown;
};

const SENTENCE = "add fangs and red lipstick";

const before: ChainStep[] = [{
  instruction: SENTENCE,
  delta: { open: { fangs: { noun: "fangs", words: "long white fangs" } }, free: { lips: "red lipstick" } },
  provenance: null,
}];

/* The real removal, not a hand-built result — see the header. */
const after = chainAfterRemoval(before, matchSteps(before, { subject: "teeth", match: "fangs" }), null);

function rowOf(id: number, parentVariantId: number | null, chain: ChainStep[]): VariantRow {
  return {
    id,
    parentVariantId,
    instructions: chain.map((step) => step.instruction),
    stepDeltas: chain.map((step) => step.delta),
    deltas: composeChain(chain),
  };
}

const ancestor = rowOf(1, null, before);
const pruned = rowOf(2, 1, after);

describe("the derivation the two post-Sign readers take (#2669)", () => {
  it("names what a prune took out of a sentence the record still carries", () => {
    expect(takenBackForSelectedVariant([ancestor, pruned], 2)).toEqual(["fangs"]);
  });

  it("CONTROL — the ancestor itself, which was never pruned, takes nothing back", () => {
    expect(takenBackForSelectedVariant([ancestor, pruned], 1)).toEqual([]);
  });

  it("CONTROL — a Cast signed from an unrefined candidate has no version at all", () => {
    expect(takenBackForSelectedVariant([ancestor, pruned], null)).toEqual([]);
    expect(takenBackForSelectedVariant([ancestor, pruned], undefined)).toEqual([]);
  });

  it("CONTROL — a selected id that is not in the rows answers nothing, never throws", () => {
    expect(takenBackForSelectedVariant([ancestor], 2)).toEqual([]);
  });

  it("CONTROL — a feature asked for AGAIN by a later step is on the cast and is not named", () => {
    /*
      The whole reason `now` is the row's own composed recipe. Naming a feature
      the photograph plainly shows would tell the reader to leave out something
      it can see, which is the defect this card fixed, pointing the other way.
    */
    const reAsked: ChainStep[] = [...after, {
      instruction: "give the fangs back",
      delta: { open: { fangs: { noun: "fangs", words: "long white fangs" } } },
      provenance: null,
    }];
    expect(takenBackForSelectedVariant([ancestor, rowOf(2, 1, reAsked)], 2)).toEqual([]);
  });

  it("CONTROL — a pre-`stepDeltas` row refuses rather than reconstructing a chain", () => {
    /*
      `readChain` returns null when the two denormalized lists disagree, and
      every row written before that column existed has no list at all. An
      honest "not on this one" beats a reconstruction that is right most of the
      time and silently drops an edit the rest.
    */
    const old: VariantRow = { ...pruned, stepDeltas: null };
    expect(takenBackForSelectedVariant([ancestor, old], 2)).toEqual([]);
  });

  it("CONTROL — a json column holding something that is not a list of sentences", () => {
    const nonsense: VariantRow = { ...pruned, instructions: { not: "an array" } };
    expect(takenBackForSelectedVariant([ancestor, nonsense], 2)).toEqual([]);
  });

  it("CONTROL — a lineage whose pre-prune version is gone is a MISS, never a false entry", () => {
    /*
      Stated on `takenFromKeptSentences` itself and held here because it is the
      one limit a reader of this function most needs to know: with the ancestor
      unreadable the answer is the answer this road gave before the card, and
      never a word that was not taken back.
    */
    expect(takenBackForSelectedVariant([pruned], 2)).toEqual([]);
  });
});

/**
 * AND BOTH ENTRANCES STILL CALL IT — the orphan arm (invariant 7).
 *
 * A derivation nothing invokes does not exist, and this one is reached from two
 * places that are nowhere near it: the Sign's detached package build and the
 * reads door's procedure. Neither has a unit arm it would redden — the reads
 * door needs a database — so a later change that quietly dropped one of the two
 * would leave every arm above green while half the product went back to being
 * told the cast has fangs it no longer has.
 *
 * That is this repository's path-three death class exactly: written, wired,
 * live, then orphaned by a change aimed at something else. The guard keys on
 * the CALL and not on the import, because an import is not a call site.
 */
describe("the derivation is still invoked at both entrances (#2669)", () => {
  const repoRoot = join(import.meta.dirname, "..", "..");
  const entrances = [
    ["server/castingV2/signService.ts", "the Sign's drafted persona and voice lines"],
    ["server/routes/castingV2.ts", "the six alternative reads"],
  ] as const;

  for (const [file, what] of entrances) {
    it(`${file} derives it for ${what}`, () => {
      const source = readFileSync(join(repoRoot, file), "utf8");

      expect(source).toContain("takenBackForSelectedVariant(variants,");
      /* And hands the answer on, rather than deriving it and dropping it. */
      expect(source).toMatch(/takenBack/);
    });
  }
});
