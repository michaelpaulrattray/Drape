import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { CANONICAL_VIEW_ANGLES, CAST_VIEW_ANGLES } from "../../shared/boardTypes";
import { CAST_PACKAGE_VIEWS } from "./castViewPackage";

/**
 * THE VOCABULARY BOUNDARY, enforced rather than remembered.
 *
 * Two lists legitimately exist. `CANONICAL_VIEW_ANGLES` is the legacy comp
 * card — exactly six, and six other modules are right to assert that, because
 * the PDF has six cells and the export has six filenames. `CAST_VIEW_ANGLES` is
 * what a Cast can actually own, which since package v3 includes a close-up.
 *
 * The trouble is that a filter or a loop typechecks identically against either
 * list. The first paid v3 Sign proved what that costs: five read sites narrowed
 * through the comp-card six, so the close-up was planned, generated, charged,
 * judged and refunded — and then dropped between the database and the screen.
 * Every individual record was correct. Fixing those five sites does nothing to
 * stop a sixth being written the same way next week.
 *
 * So this file is the device, and it is deliberately a lint rather than a unit
 * test: inside the V2 surface the comp-card six is simply not the vocabulary,
 * and reaching for it fails CI even where it compiles.
 */

const V2_DIR = new URL(".", import.meta.url);

/** Files allowed to name the comp-card six, each for a stated reason. */
const PINNED_EXCEPTIONS = new Map<string, string>([
  ["castViewPackage.test.ts", "asserts the comp-card list is still exactly six"],
  ["viewVocabulary.test.ts", "this file — it compares the two vocabularies"],
]);

describe("the Casting V2 view vocabulary", () => {
  it("is the only vocabulary the V2 surface reaches for", async () => {
    const entries = await readdir(V2_DIR);
    const offenders: string[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".ts")) continue;
      if (PINNED_EXCEPTIONS.has(entry)) continue;
      const source = await readFile(new URL(entry, V2_DIR), "utf8");
      if (/\bCANONICAL_VIEW_ANGLES\b|\bCanonicalViewAngle\b/.test(source)) {
        offenders.push(entry);
      }
    }
    expect(
      offenders,
      `These Casting V2 modules narrow to the legacy comp-card six. A V2 surface `
      + `reads CAST_VIEW_ANGLES / CastViewAngle — the comp card is a legacy artifact `
      + `list that merely overlaps. If one of these genuinely builds a comp-card `
      + `artifact, add it to PINNED_EXCEPTIONS with the reason.\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("contains every view the package actually sells", () => {
    /*
      The direct statement of the defect: a profile may only promise views the
      room can draw. Selling a view outside the rendering vocabulary is how a
      customer pays for something no screen can show.
    */
    for (const angle of CAST_PACKAGE_VIEWS) {
      expect(CAST_VIEW_ANGLES).toContain(angle);
    }
  });

  it("keeps the comp-card six intact inside it, in order", () => {
    // The V2 list is a superset, so legacy ordering assumptions still hold.
    expect(CAST_VIEW_ANGLES.filter((angle) => (CANONICAL_VIEW_ANGLES as readonly string[])
      .includes(angle))).toEqual([...CANONICAL_VIEW_ANGLES]);
    expect(CAST_VIEW_ANGLES.length).toBe(CANONICAL_VIEW_ANGLES.length + 1);
  });

  it("is what the legacy authorities read when they meet a signed Cast", async () => {
    /*
      The three sites the advisor caught downstream of the original fix, each of
      which would have broken a Cast whose package SUCCEEDED:

        effectiveCastState  — refused the sealed snapshot outright
        snapshotTransitions — dropped the close-up from the next snapshot
        wholeCastRestore    — left a deleted v3 Cast with no restore point

      A legacy authority meeting a V2 snapshot widens, or refuses by name. It
      never filters silently (D-102).
    */
    const authorities = [
      "../casting/effectiveCastState.ts",
      "../casting/snapshotTransitions.ts",
      "../casting/wholeCastRestore.ts",
    ];
    for (const path of authorities) {
      const source = await readFile(new URL(path, V2_DIR), "utf8");
      expect(source, `${path} must read the ledger's vocabulary`).toContain("CAST_VIEW_ANGLES");
    }
  });
});
