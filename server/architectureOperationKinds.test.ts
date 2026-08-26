/**
 * THE ATLAS HELD 16 OF THE PRODUCT'S 29 OPERATION KINDS, AND 3 THINGS THAT ARE
 * NOT OPERATION KINDS AT ALL.
 *
 * `collectOperationKinds` scraped every dotted string literal out of
 * `server/casting/operationContract.ts` and called the result the operation
 * kinds. `GENERATION_OPERATION_KINDS` is an exported array two lines above where
 * the regex was looking — a shape-guess standing in for a definition, which is
 * working law 4 inverted, and the naming convention it guessed at was never a
 * rule anybody had agreed to.
 *
 * Measured 2026-08-23, against the committed Atlas:
 *
 *   `[a-zA-Z]+` after the dot   dropped `casting.add_views`, `casting.restore_state`
 *   `[a-zA-Z]+` before the dot  dropped ALL THREE `castingV2.*` kinds — roll,
 *                               sign, refine. The entire Casting V2 program,
 *                               invisible to the map that program is planned
 *                               from, because `castingV2` contains a digit.
 *   a required dot              dropped all eleven `evidence_*` kinds, among
 *                               them `evidence_fork_copy`, which the canvas
 *                               charges credits for.
 *   any dotted string counted   INVENTED `progress.completed`, `progress.failed`
 *                               and `progress.total` — field names off a
 *                               different object in the same file.
 *
 * Sixteen absent, three imaginary, and the list read as complete either way.
 *
 * # TWO INSTRUMENTS, ONE POPULATION (working law 4)
 *
 *   the generator   parses the `[…] as const` array at the AST and FAILS if the
 *                   declaration is not there — a partial enumeration reads
 *                   exactly like a complete one, so a missing anchor must be
 *                   loud
 *   this arm        IMPORTS `GENERATION_OPERATION_KINDS` and compares the value
 *                   TypeScript actually evaluates against the artifact on disk
 *
 * Those are genuinely different readings — one parses text, one runs the module
 * — so a parse that silently loses a member disagrees here instead of passing.
 *
 * ⚠ LIKE ITS SIBLING IN `architectureProcedureShapes.test.ts`, THIS ARM READS
 * THE COMMITTED ATLAS. A generator edit alone cannot redden it; that is
 * `architectureAtlas.test.ts`'s job, which regenerates and diffs. Change the
 * collector and the freshness arm fails; change it and regenerate, and this one
 * fails.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { GENERATION_OPERATION_KINDS } from "./casting/operationContract";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const atlas = JSON.parse(
  readFileSync(path.join(repoRoot, "docs/architecture/drape-architecture.json"), "utf8"),
) as { operationKinds: { id: string; kind: string }[] };

describe("the Atlas's operation kinds", () => {
  it("is the contract's own list, whole, and nothing besides", () => {
    const declared = [...GENERATION_OPERATION_KINDS].sort();
    const inAtlas = atlas.operationKinds.map((entry) => entry.kind).sort();

    /* Population first — two empty reads agree with each other, and that reads
       exactly like coverage (`absence-only-expect-passes-on-nothing`). */
    expect(declared.length).toBeGreaterThan(20);

    expect(
      inAtlas,
      "the Atlas's operation kinds and GENERATION_OPERATION_KINDS describe different populations — the collector is guessing at a shape again",
    ).toEqual(declared);
  });

  it("holds the four castingV2 kinds — the ones a digit in the namespace hid", () => {
    /* Named specimens rather than left to the equality above, because these are
       the kinds the whole Casting V2 program is made of and their absence was
       invisible for the life of the collector. */
    const inAtlas = new Set(atlas.operationKinds.map((entry) => entry.kind));
    for (const kind of ["castingV2.roll", "castingV2.sign", "castingV2.refine", "castingV2.retry"]) {
      expect(inAtlas.has(kind), kind).toBe(true);
    }
  });

  it("holds the underscore-only kinds, which had no dot to be found by", () => {
    const inAtlas = new Set(atlas.operationKinds.map((entry) => entry.kind));
    expect(inAtlas.has("evidence_fork_copy")).toBe(true);
    expect(inAtlas.has("casting.add_views")).toBe(true);
  });

  it("holds nothing the contract does not declare", () => {
    /* The other direction, stated on its own: `progress.completed`,
       `progress.failed` and `progress.total` were in the artifact and are not
       operation kinds. An equality assertion covers this, but a phantom entry
       and a missing one are different defects and deserve different sentences. */
    const declared = new Set<string>(GENERATION_OPERATION_KINDS);
    const phantom = atlas.operationKinds
      .map((entry) => entry.kind)
      .filter((kind) => !declared.has(kind));

    expect(phantom).toEqual([]);
  });
});
