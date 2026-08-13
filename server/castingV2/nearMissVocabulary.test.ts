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
