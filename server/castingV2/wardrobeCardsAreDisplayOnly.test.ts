/**
 * ⚠ THE PANEL'S DECOMPOSITION IS DISPLAY, AND NOTHING RENDERS FROM IT —
 * the structural half (§8.1, condition of the landing, fable-1459 ASK 1).
 *
 * The other half is at the WIRE and lives in `refineService.test.ts`
 * (*"what the panel takes apart, the engine is never handed in parts"*): it
 * drives a real repaint on a Wardrobe branch, removes every occurrence of the
 * whole LINE from each outgoing prompt, and requires that no piece survives in
 * the remainder. That is the strongest evidence available about ONE render.
 *
 * **This file is about every render there could ever be**, and the two are
 * genuinely different claims. A wire arm proves the road it drove; it says
 * nothing about a second caller added tomorrow. So the claim here is
 * structural: *no module on any render path reaches the decomposition at all*,
 * read off the import graph rather than off a grep.
 *
 * # Why the Atlas and not a search of the source
 *
 * A regex over `import` lines is the shape-match-where-a-declaration-exists
 * class this program has already paid for four times in one sitting, and it
 * reports a complete answer either way. The Atlas resolves modules through the
 * TypeScript compiler and counts all three reach shapes — a static import, a
 * re-export barrel and a dynamic `await import()` — which is the repair
 * `d614320f` bought after 65 modules read as having no callers while being
 * genuinely reached. Its freshness is guarded by `architectureAtlas.test.ts`,
 * so this arm cannot pass against a stale graph.
 *
 * # What is allowed to reach it
 *
 * ⚠ **NOTHING, SINCE #203 SLICE 2 (2026-09-24).** It was *the panel, because
 * that is what it is for, and nothing else*; the panel's wardrobe section is
 * retired with the paths, so the claim has grown one module stronger — **no
 * module that ships reaches the decomposition at all**, and in particular
 * nothing under the recipe, the render, the sign or the judge.
 *
 * ⚠ **AN EMPTY ANSWER AND A MISSPELLED ID LOOK IDENTICAL, which is the trap
 * this arm walked into the moment its expected list became empty.** So the
 * module's EXISTENCE is asserted against the Atlas's module inventory, which is
 * a different collection from its edges: the claim is *this module is on the
 * map and nothing imports it*, never *I could not find anything*.
 *
 * ⚠ **TESTS ARE NOT IN THIS GRAPH AT ALL, and the arm says so rather than
 * leaving it to be inferred.** The Atlas records module-to-module edges only:
 * every `from` in the whole edge list carries the `module:` prefix and not one
 * carries `test:`, so a suite importing this file contributes no edge. That
 * makes the expected list SHORTER and the claim CLEANER — it is exactly *what
 * ships reaches it* — but a reader who assumed tests were counted would read
 * this list as excluding them on purpose, which is a different and weaker
 * statement.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const ATLAS = JSON.parse(
  readFileSync(new URL("../../docs/architecture/drape-architecture.json", import.meta.url), "utf8"),
) as {
  edges: Array<{ from: string; to: string; kind: string }>;
  modules: Array<{ id: string }>;
};

const SUBJECT = "module:server/castingV2/wardrobeCards.ts";

/** Everything that reaches a module, by any of the three shapes the Atlas counts. */
function importersOf(id: string): string[] {
  return ATLAS.edges
    .filter((edge) => edge.to === id && edge.kind === "imports")
    .map((edge) => edge.from)
    .sort();
}

describe("nothing that renders can reach the wardrobe decomposition", () => {
  it("⚠ is reached by NOTHING that ships — the panel was the last one", () => {
    /*
      Written as an exact list rather than as a set of forbidden names: a
      forbidden-list arm passes for every module nobody thought of, which is
      always the one that turns up. The list was `[facePanel]` until the
      wardrobe section retired with the paths (#203 slice 2); it is now empty,
      and the arm below is what stops an empty list from meaning a map this
      reader could not read.

      ⚠ Written without quotation marks around either word on purpose: the
      capability census collects a door's pins by looking for its id QUOTED in a
      suite, so a docblock saying so casually registers this file as driving two
      interpreter refusals it has never been near. Caught at the generated map
      the first time this comment was written.
    */
    expect(importersOf(SUBJECT)).toEqual([]);
    /* The graph carries no test edges at all — asserted here rather than
       assumed, because the list above would look identical if it did and the
       two suites that import this module had simply been forgotten. */
    expect(ATLAS.edges.some((edge) => edge.from.startsWith("test:"))).toBe(false);
  });

  it("⚠ CONTROL — the module is ON the map, so the empty list is a fact and not a typo", () => {
    /*
      ⚠ THE ARM THIS FILE COULD NOT HAVE HAD BEFORE, and the reason it needs it
      now: an expected list of `[]` is satisfied by a misspelled id, by a stale
      Atlas, and by a reader that returns nothing for everything. Two readings
      separate those from the truth.

      First, the module INVENTORY — a different collection from the edges —
      must carry this exact id, and a deliberately misspelled one must be
      absent from it. Second, `wardrobeLine.ts` is the same feature's other half
      and is read by the prompt, the recipe, the sign and the sheet, so the edge
      reader must still come back with several for it.
    */
    const onTheMap = (id: string) => ATLAS.modules.some((module) => module.id === id);
    expect(onTheMap(SUBJECT), "the subject is a module the Atlas knows").toBe(true);
    expect(onTheMap("module:server/castingV2/wardrobeCardsTypo.ts")).toBe(false);

    const many = importersOf("module:server/castingV2/wardrobeLine.ts");
    expect(many.length).toBeGreaterThan(3);
    expect(many).toContain("module:server/castingV2/recipeAssembler.ts");
    /* And a misspelled id answers the same empty list the subject does, which
       is precisely why the inventory reading above is the one that matters. */
    expect(importersOf("module:server/castingV2/wardrobeCardsTypo.ts")).toEqual([]);
  });

  it("⚠ and the render path is named, so the claim is legible rather than implied", () => {
    /*
      The equality above already excludes these. They are listed by name anyway
      because the point of this file is a SENTENCE somebody can read — *the
      thing that paints cannot reach the thing that decomposes* — and a reader
      should not have to reconstruct which modules those are.
    */
    const importers = importersOf(SUBJECT);
    for (const renderer of [
      "module:server/castingV2/recipeAssembler.ts",
      "module:server/castingV2/repaintRender.ts",
      "module:server/castingV2/refineService.ts",
      "module:server/castingV2/refineDelta.ts",
      "module:server/castingV2/signService.ts",
      "module:server/castingV2/castViewPackage.ts",
      "module:server/castingV2/cohortPhotorealHuman.ts",
    ]) {
      expect(importers, renderer).not.toContain(renderer);
    }
  });
});
