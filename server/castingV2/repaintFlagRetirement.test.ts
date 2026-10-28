/**
 * THE COMPOSITOR SWAP'S FLAG IS RETIRED, AND IT STAYS RETIRED — #1577 slice 4b.
 *
 * `CASTING_REPAINT_SCOPE` decided which of two picture roads a paid refine took:
 * off, the old compositor rendered full-frame, cut the asked-about region out
 * with the segmenter, pasted it onto the master and blended the join; on, the
 * repaint assembled a recipe from the cast's own library and the engine's frame
 * WAS the delivered frame. It reached `all` on production at fable-1253, so the
 * paste road served nobody, and the ghost audit found all of it still standing
 * as the flag's off arm. **His word retiring it, 2026-10-15, verbatim and
 * entire: _"yes approve the plan and switch off the six settings"_.**
 *
 * # Why this file exists rather than a sentence in a document
 *
 * A flag retirement is reversible by accident. The variable's name is still in
 * the tree on purpose — the retirement record names it, and slice 4a's four
 * fence notes explain why those children read the reference library instead —
 * so a shift grepping for it will find it and could reasonably re-add a reader.
 * These arms say what may not come back, and the framing trim's own retirement
 * guard (#11, `framingTrimRetirement.test.ts`) is the shape they follow.
 *
 * # ⚠ IT DOES NOT ASSERT THE NAME IS ABSENT FROM THE TREE, AND THAT IS DELIBERATE
 *
 * The framing trim's guard can, because nothing was left to say about it. Here
 * the opposite is true: the whole point of a retirement record is that the next
 * reader learns WHAT died and why, and that record has to name it. So these
 * arms read the RESURRECTION SHAPES instead — the three ways a flag gets a
 * reader in this repository — and the floor is stated rather than implied: a
 * fourth shape would be invisible here.
 *
 * Every arm is an ABSENCE, and an absence is green against a reader that finds
 * nothing at all. So each reader is first made to find a flag that genuinely
 * exists, in the same call, in the same shape. If the control reddens, no
 * verdict in this file means anything.
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
const RETIRED = "CASTING_REPAINT_SCOPE";
/** A flag that exists and cannot go — every control below finds this one. */
const LIVE = "CASTING_V2_SCOPE";
/*
  A SECOND LIVE FLAG, used as this file's positive control.

  ⚠ IT WAS THE RETIRED FLAG'S OWN PARENT, `CASTING_REFERENCE_LIBRARY_SCOPE`,
  UNTIL #1577 SLICE D5 RETIRED THAT ONE TOO — which is the hazard a retirement
  guard has that no other suite has: its controls are flags, and a flag can die.
  A control naming a dead flag does not fail loudly; it stops proving the reader
  works, and the whole file keeps passing. So the control moved to a flag that
  is not on the ghost audit's retirement list at all: the auto-scan's, which
  band E of that audit marks KEEP because widening it is his (a scan spends
  house money).
*/
const PARENT = "CASTING_FACE_SCAN_SCOPE";

const SOURCES = serverAndSharedSources(repoRoot);
const DECLARED = declaredEnvNames(SOURCES);
const LAW = lawText(repoRoot);
const CATALOGUE = flagCatalogue(repoRoot);
const TEXTS = SOURCES.map((file) => ({ file, text: readFileSync(file, "utf8") }));

describe("the compositor swap's flag is retired (#1577 slice 4b)", () => {
  it("⚠ CONTROL — every reader in this file finds a flag that IS there", () => {
    expect(SOURCES.length, "the file walk found a real tree").toBeGreaterThan(100);
    expect(DECLARED, "the constant scan read a real population").toContain(LIVE);
    expect(DECLARED, "and a second live flag, which band E marks KEEP")
      .toContain(PARENT);
    expect(LAW).toContain(LIVE);
    expect(Object.keys(PRODUCTION_FLAG_POSITIONS)).toContain(LIVE);
    expect(Object.keys(PRODUCTION_FLAG_POSITIONS)).toContain(PARENT);
  });

  it("no code DECLARES it — the constant, its parse, its capture and its fence are gone", () => {
    expect(DECLARED).not.toContain(RETIRED);
  });

  it("⚠ and no code READS it by any of the three shapes that give a flag a reader", () => {
    /*
      The constant pattern above is one way. These are the other two this
      repository actually uses, read on the raw bytes rather than through a
      resolver: a direct `process.env` lookup under either subscript form, and a
      predicate named for the flag. `captureCastingRepaintEnabled` was the
      point-of-use AND; `validateCastingRepaintEnvironment` was the boot fence.
    */
    const shapes = [
      `process.env.${RETIRED}`,
      `process.env["${RETIRED}"]`,
      `process.env['${RETIRED}']`,
      "captureCastingRepaintEnabled(",
      "validateCastingRepaintEnvironment(",
      "parseCastingRepaintScope(",
    ];
    const found = TEXTS.flatMap((source) => shapes
      .filter((shape) => source.text.includes(shape))
      .map((shape) => `${source.file}: ${shape}`));
    expect(found, "these are reads of a flag that does not exist").toEqual([]);
    /*
      CONTROL for this same reader, in the same call: the live parent IS read
      this way, so a scan that found nothing would be caught here rather than
      passing as coverage.
    */
    expect(
      TEXTS.some((source) => source.text.includes("captureCastingFaceScanEnabled(")),
      "the predicate shape finds a live flag's own reader",
    ).toBe(true);
    expect(
      TEXTS.some((source) => source.text.includes(`process.env[${PARENT}_ENV]`)
        || source.text.includes(`process.env.${PARENT}`)),
      "and the env-lookup shape finds a real lookup",
    ).toBe(true);
  });

  it("⚠ the production position table does not name it — the row and the variable moved together", () => {
    /*
      Both directions bite. A row standing while the service still holds the
      variable reports a healthy position for a feature that does not exist; and
      `comparePositions` reports a governed variable with NO row, so the row
      cannot simply be dropped early either. The variable is deleted from the
      service AFTER the code DEPLOYS and never in the same act as this row's
      merge (`scripts/lib/productionFlagPositions.mts` is the authority
      and says it once) — which is the framing trim's precedent, and the reason
      the retirement record says so in capitals.
    */
    expect(Object.keys(PRODUCTION_FLAG_POSITIONS)).not.toContain(RETIRED);
  });

  it("⚠ the law surfaces describe it as RETIRED rather than live, in both places", () => {
    /*
      The index and the catalogue are read SEPARATELY, because a name surviving
      in one of them is exactly the drift `claudeMdFlagEnumeration`'s agreement
      arm exists to catch. Both still carry a row — that is the segment store's
      precedent (#1160), not an oversight: a reader who meets the name in the
      code's own retirement notes must be able to look it up and be told it is
      gone. What is asserted is that neither row reads as a live capability.
    */
    expect(indexedFlags(LAW), "CLAUDE.md's index table still has its row").toContain(RETIRED);
    expect(cataloguedFlags(CATALOGUE), "and so does the catalogue").toContain(RETIRED);

    const indexRow = LAW.split("\n").find((line) => line.startsWith(`| \`${RETIRED}\``));
    expect(indexRow, "the index row was found at all").toBeTruthy();
    expect(indexRow, "and it says the flag is retired").toMatch(/RETIRED/);

    const entry = CATALOGUE.split("\n").find((line) => line.startsWith(`- \`${RETIRED}\``));
    expect(entry, "the catalogue entry was found at all").toBeTruthy();
    expect(entry, "and it opens with the retirement, not with what the flag used to do")
      .toMatch(/^- `CASTING_REPAINT_SCOPE` — ✅ \*\*RETIRED/);
    expect(entry, "naming his word").toContain("switch off the six settings");
  });

  it("⚠ the paste road itself is gone, not merely unreachable", () => {
    /*
      The flag's absence is not the whole claim: a fork left behind a deleted
      flag is dead code with a live reputation, which is what the ghost audit
      was written to find. These are the paste road's own members, read at the
      refine service's bytes.

      ⚠ COMMENTS ARE STRIPPED FIRST, and the first run of this arm is why: the
      retirement block in that file QUOTES the fork it retired
      (*"This used to be a FORK: `if (repaintEnabled) return repaintOnce()`"*),
      so a reader over the raw text finds the road in its own obituary. A guard
      that cannot tell code from a comment about code would make every
      retirement record unwritable.
    */
    const service = readFileSync(
      path.join(repoRoot, "server/castingV2/refineService.ts"),
      "utf8",
    );
    const code = service
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(new RegExp("(^|[^:])" + "\\/\\/[^\\n]*", "g"), "$1 ");
    /* CONTROL for the stripper, both ways: it keeps code and drops comments. */
    expect(code, "the stripper kept the road that survived").toContain("repaintOnce()");
    expect(code, "and it dropped the obituary that quotes the one that did not")
      .not.toContain("This used to be a FORK");

    const found = [
      "repaintEnabled",
      "harvestRefinement",
      "castingIdentityEngine",
      "kind_unserved",
      "REPAINT_ONLY_SUBJECTS",
      "regionOverrides",
    ].filter((member) => code.includes(member));
    expect(found, "these paste-road members are reachable again in the refine service")
      .toEqual([]);
  });
});
