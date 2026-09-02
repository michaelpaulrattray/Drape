/**
 * ⚠ THE FRAMING TRIM LEFT NO REACHABLE TRACE — the retirement, proven at the
 * artifacts rather than remembered.
 *
 * # What was retired, and on whose word
 *
 * The trim rendered every roll at 1536x2304, bought two fal REGION READS per
 * frame, cut each one to a common head size and downscaled to the 1024x1536 it
 * delivers — keeping the uncut original at `sourceKey` so a later framing change
 * could be a re-trim rather than a re-render.
 *
 * The founder judged the framing on his own flagged sheets, 2026-09-02, and his
 * word was the whole of it: **"11 heads look fine."** Rule 15 of
 * `PROMPT_AUTHOR_RULING_2026-08-26.md` had been written against exactly that
 * question — *if a stated framing sentence holds head size inside the trim's own
 * bar, the trim retires* — so the author's framing sentence does the work now,
 * in words, before the render, instead of a paid crop after it.
 *
 * # Why a DELETION gets an arm at all
 *
 * Because this repository's own record says a retired road is where controls go
 * to die quietly: *a control that stops being reachable leaves no failing test
 * and no error — only a green suite and a document that still describes it.*
 * Deleting a flag is the cheapest possible way for the flag INDEX, the flag
 * CATALOGUE and the production POSITION TABLE to disagree with the code, and
 * none of those disagreements is visible from a passing suite. So the
 * enumeration is asserted rather than assumed.
 *
 * # ⚠ THE POSITIVE CONTROL IS THE POINT OF THIS FILE
 *
 * Every arm below is an ABSENCE, and an absence assertion is green against a
 * reader that finds nothing at all — a mistyped path, a walker returning `[]`, a
 * document that failed to load. So each reader is FIRST made to find a flag that
 * genuinely exists (`CASTING_V2_SCOPE`, the parent of every casting flag and
 * the last one that could ever go), in the same call, in the same shape. If the
 * control ever goes red, no verdict in this file means anything.
 *
 * # What it does NOT cover — a clean run is a floor
 *
 * The readers are `claudeMdFlagEnumeration.test.ts`'s own, so they inherit its
 * stated floor exactly: the `*_ENV` constant pattern and nothing else. A trim
 * resurrected through a bare `process.env["CASTING_FRAMING_TRIM_SCOPE"]` would
 * be invisible here — which is why the source sweep below reads the RAW TEXT of
 * the server tree as a second reader that does not share that resolver.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { declaredEnvNames, serverAndSharedSources } from "../../scripts/lib/declaredEnvNames.mts";
import { cataloguedFlags, flagCatalogue, indexedFlags, lawText } from "../../scripts/lib/lawText.mts";
import { PRODUCTION_FLAG_POSITIONS } from "../../scripts/lib/productionFlagPositions.mts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The retired flag. */
const RETIRED = "CASTING_FRAMING_TRIM_SCOPE";
/** A flag that exists and cannot go — every control below finds this one. */
const LIVE = "CASTING_V2_SCOPE";

const DECLARED = declaredEnvNames(serverAndSharedSources(repoRoot));
const LAW = lawText(repoRoot);
const CATALOGUE = flagCatalogue(repoRoot);

describe("the framing trim's retirement (#11)", () => {
  it("⚠ CONTROL — every reader in this file finds a flag that IS there", () => {
    /* Without this arm, all four below pass on readers that found nothing. */
    expect(DECLARED, "the constant scan read a real population").toContain(LIVE);
    expect(LAW).toContain(LIVE);
    expect(indexedFlags(LAW)).toContain(LIVE);
    expect(cataloguedFlags(CATALOGUE)).toContain(LIVE);
    expect(Object.keys(PRODUCTION_FLAG_POSITIONS)).toContain(LIVE);
  });

  it("no code declares it — the scope, its parse and its capture are gone", () => {
    expect(DECLARED).not.toContain(RETIRED);
  });

  it("no law surface still describes it — the index and the catalogue moved together", () => {
    /* The index and the catalogue are read SEPARATELY on purpose. They are two
       documents, and a name surviving in one of them is exactly the drift that
       `claudeMdFlagEnumeration`'s agreement arm exists to catch — a claim
       satisfied on one page must never pass for the other. */
    expect(indexedFlags(LAW), "CLAUDE.md's index table").not.toContain(RETIRED);
    expect(cataloguedFlags(CATALOGUE), "the flag catalogue").not.toContain(RETIRED);
    expect(LAW, "the prose of either law surface").not.toContain(RETIRED);
  });

  it("⚠ the production position table does not name it — a row nothing declares can never disagree with anything", () => {
    /* And the other direction is what actually bites: while a row stands here
       and the service still holds the variable, the deploy rite compares them
       and passes — reporting a healthy position for a feature that no longer
       exists. The variable is deleted from the service in the same act. */
    expect(Object.keys(PRODUCTION_FLAG_POSITIONS)).not.toContain(RETIRED);
  });

  it("⚠ SECOND READER — the server tree's raw text does not mention it either", () => {
    /* A different resolver from `declaredEnvNames`, which only sees the `*_ENV`
       constant shape: this reads the bytes, so a bare `process.env[...]` lookup
       or a lingering import is caught here and nowhere else. */
    const sources = serverAndSharedSources(repoRoot);
    expect(sources.length, "the file walk found a real tree").toBeGreaterThan(100);
    const texts = sources.map((file) => ({ file, text: readFileSync(file, "utf8") }));
    expect(
      texts.filter((source) => source.text.includes(RETIRED)).map((source) => source.file),
      "these files still name a flag that does not exist",
    ).toEqual([]);
    /* CONTROL for the same reader, in the same call. */
    expect(texts.filter((source) => source.text.includes(LIVE)).length).toBeGreaterThan(0);
  });
});
