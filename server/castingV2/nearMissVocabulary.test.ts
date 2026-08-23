/**
 * THE NEIGHBOURHOOD, WALKED MECHANICALLY — so the typo gate cannot fall behind
 * the vocabulary again.
 *
 * # The instance
 *
 * `"shave her head"` was answered with **"Did you mean shape?"**. The founder's
 * own phrasing for a bald edit never reached the interpreter: `shave` is one
 * slip from `shape`, the curated never-a-typo list did not have it, and the
 * work stopped at a question about shaping her head.
 *
 * # Why this is a test and not three more words in a list
 *
 * `refineReask.ts` states the discipline honestly: the list *"was built by
 * walking the one-slip neighbourhood of every known word and writing down the
 * real words found there. When a new colour or subject joins the vocabulary,
 * walk its neighbourhood too."* That is a human promise about a list that grows
 * whenever the product learns a new word — the exact shape of promise this
 * program has watched decay four times.
 *
 * So the walk is mechanical, and its corpus is DERIVED rather than invented:
 * **every word the product itself writes** — the roll prompt, the refine prose,
 * the refusal sentences, the catalogue's own notes. A word this product uses to
 * describe a face is a real word in this domain by construction, so its own
 * typo gate flagging one is a false positive with a user's name on it.
 *
 * The first run over 70,867 tokens found 53. `shave` was one; `color` and
 * `gray` (a US customer's own spelling), `crown`, `pair`, `frown`, `while` and
 * `write` were others, and `freckle` was offered `freckles` — its own plural —
 * as a correction.
 *
 * Reads source text only: no transport, no database, no credits.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { nearMiss } from "./refineReask";

/** The product's own voice: what it says to the engine, and to her. */
const SOURCES = [
  "server/castingV2/cohortPhotorealHuman.ts",
  "server/castingV2/refineService.ts",
  "server/castingV2/refineInterpreter.ts",
  "server/castingV2/refineSubjects.ts",
  "server/castingV2/refineReask.ts",
  "server/castingV2/referenceSlotCatalogue.ts",
  "server/castingV2/castingFrame.ts",
  "server/castingV2/faceDescribe.ts",
  "server/castingV2/axisRegistry.ts",
  "server/castingV2/briefCompiler.ts",
];

/**
 * The three words in that corpus that ARE typos, because they are written as
 * examples of typos. Enumerated rather than filtered by a pattern: an exception
 * list somebody has to justify is the point.
 */
const DELIBERATE_TYPO_FIXTURES = new Set([
  "hiar",   // refineReask's own example of a transposition
  "piink",  // refineService's example of a slip inside a re-ask
  "shair",  // a genuine typo in axisRegistry's prose, found by this sweep
  /* Census row `guard.typo`'s own two specimens, written into refineReask's
     docblock by the commit that closed C3. They are the sentences that used to
     RENDER, so they must go on firing — and the arm below asserts exactly that,
     which is what stops this exception from quietly retiring the row. */
  "rign", "riing",
]);

function spokenWords(source: string): string[] {
  const said: string[] = [];
  for (const literal of source.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g) ?? []) {
    said.push(literal.slice(1, -1));
  }
  /* The prose comments too — the catalogue's reasons and the prompt's notes are
     written in the same vocabulary, and that is where the rarer words live. */
  for (const comment of source.match(/\/\*[\s\S]*?\*\//g) ?? []) said.push(comment);
  return said;
}

describe("the typo gate against the product's own vocabulary", () => {
  const flagged: { word: string; meant: string; where: string }[] = [];
  let distinct = 0;

  for (const path of SOURCES) {
    const source = readFileSync(path, "utf8");
    const seen = new Set<string>();
    for (const said of spokenWords(source)) {
      for (const token of said.toLowerCase().split(/[^a-z]+/)) {
        if (token.length <= 3 || seen.has(token)) continue;
        seen.add(token);
        distinct += 1;
        if (DELIBERATE_TYPO_FIXTURES.has(token)) continue;
        const miss = nearMiss(token);
        if (miss) flagged.push({ word: token, meant: miss.meant, where: path.split("/").pop()! });
      }
    }
  }

  it("never calls a word the product itself writes a typo", () => {
    expect(
      flagged,
      `these are words this product uses about a face, and its own typo gate would ask `
      + `whether the customer meant something else:\n`
      + flagged.map((hit) => `  ${hit.word} → "${hit.meant}"  [${hit.where}]`).join("\n")
      + `\n\nAdd them to VALID_IN_CONTEXT (or ALTERNATE_SPELLINGS, if that is what they are). `
      + `The founder's rule is absolute: the question never fires on a word that is valid in context.`,
    ).toEqual([]);
  });

  it("read a corpus big enough for that to mean something", () => {
    /* A guard that swept an empty corpus would pass forever. */
    expect(distinct).toBeGreaterThan(2_000);
  });

  it("and the gate still catches a real slip — it was not bought by switching off", () => {
    /* The negative control, kept AFTER the positive one passes: a list this
       long is exactly how a gate ends up inert without anybody noticing. */
    expect(nearMiss("hiar")).toEqual({ typed: "hiar", meant: "hair" });
    expect(nearMiss("make her hair coppr")).toEqual({ typed: "coppr", meant: "copper" });
    expect(nearMiss("add freckels")).toEqual({ typed: "freckels", meant: "freckles" });
  });
});

describe("the phrasings that started this", () => {
  it.each([
    "shave her head",
    "shave her hair off",
    "buzz her hair",
    "make her bald",
    "remove her hair",
    "give her a shaved head",
  ])("does not stop %s with a question", (sentence) => {
    expect(nearMiss(sentence)).toBeNull();
  });

  it("does not quiz a customer on which side of the Atlantic they learned to spell", () => {
    for (const sentence of [
      "make her hair color warmer",
      "give her gray hair",
      "give her blond hair",
      "make her hair colour warmer",
      "give her grey hair",
      "give her blonde hair",
    ]) expect(nearMiss(sentence), sentence).toBeNull();
  });
});

/**
 * THE WORN THINGS — census row `guard.typo`, closed 2026-08-24 (C3).
 *
 * `ring` lived on the do-not-accuse list and on no target list, so *"give her a
 * nose rign"* rendered and charged instead of asking. The fix adds the accessory
 * nouns as TARGETS, and the recipe is the law of that commit: **a noun joins
 * `KNOWN_WORDS` only with its exposed neighbourhood joining `VALID_IN_CONTEXT`
 * in the same commit.**
 *
 * These arms are both directions of that recipe, because only one of them is
 * about the customer who typed a typo. The other is about the far larger number
 * of customers who typed a real word one slip away from a piece of jewellery.
 */
describe("the worn things, and the neighbourhood they expose", () => {
  it("offers the correction the census row was filed for", () => {
    expect(nearMiss("give her a nose rign")).toEqual({ typed: "rign", meant: "ring" });
    /* The pure insertion — `piink` → `pink`'s own shape — which also rendered.
       Both are in the guard corpus's DELIBERATE_TYPO_FIXTURES above, and they
       are here because that set only says "do not count this as a false
       positive"; nothing there says the gate must still FIRE on them. */
    expect(nearMiss("give her a nose riing")).toEqual({ typed: "riing", meant: "ring" });
    expect(nearMiss("gold hoop earings")).not.toBeNull();
  });

  it.each([
    /* ⚠ THE TWO WORST CASES, and they are the reason the recipe exists.
       `ring` is one slip from `wing` — and "give her wings" is winged eyeliner,
       the open lane's own worked example. `band` is one slip from `bangs`,
       which is a hairstyle: asking a customer taking her bangs shorter whether
       she meant *bands* is the shave→shape incident with new nouns. */
    "give her wings",
    "give her winged eyeliner",
    "make her bangs shorter",
    "cut her a blunt fringe with bangs",
    /* The rest of the walked neighbourhood, in sentences rather than as tokens:
       a word list can be satisfied by a list and this cannot. */
    "give her hooded lids",
    "make the tips of her hair lighter",
    "a thin bracelet on her wrist",
    "give her a punk look",
    "flame red hair",
    "stone grey eyes",
    "soften the bend in her nose",
    "take the hook out of her nose",
    "loop her braid around",
    "a gold hoop in each ear",
    "wire frame glasses",
    "a fine chain at her throat",
    "a small stud below each ear",
    "give her a nose ring",
  ])("does not stop %s with a question", (sentence) => {
    expect(nearMiss(sentence), sentence).toBeNull();
  });

  /**
   * THE POPULATION IS DERIVED, not typed out here — every canonical sentence
   * the capability census puts to the real refine entrance.
   *
   * A hand-written list of "sentences customers say" is a second list shadowing
   * a source of truth, and it drifts (working law 4). The corpus is that source:
   * it is the one place the census's asks live, and it grows whenever a road
   * gains a door. So the gate is walked against it, and the day somebody adds a
   * row whose sentence this gate would accuse, this arm goes red in their own
   * commit rather than in a customer's session.
   */
  it("never accuses a sentence the census itself drives", async () => {
    const { CORPUS } = await import("../../scripts/capability-atlas-corpus.mts");
    /* A guard that walked an empty corpus would pass forever. */
    expect(CORPUS.length).toBeGreaterThan(40);
    const accused = CORPUS
      /* `guard.typo` is the one row whose sentence is SUPPOSED to be caught —
         it is the row this card closed. Named, not filtered by a pattern. */
      .filter((row) => row.id !== "guard.typo")
      .map((row) => ({ row, miss: nearMiss(row.ask) }))
      .filter((entry) => entry.miss !== null);
    expect(
      accused.map((entry) => `${entry.row.id}: "${entry.row.ask}" → did you mean "${entry.miss!.meant}"?`),
      "the typo gate would stop one of the census's own canonical customer sentences with a question about a word "
      + "that is spelled correctly. Add the word to VALID_IN_CONTEXT — the founder's rule on this gate is absolute.",
    ).toEqual([]);
    /* And the row that IS supposed to fire still does, in the same arm, so a
       fix that silenced the gate could not pass this one by emptying it. */
    expect(nearMiss(CORPUS.find((row) => row.id === "guard.typo")!.ask)).toEqual({ typed: "rign", meant: "ring" });
  });
});
