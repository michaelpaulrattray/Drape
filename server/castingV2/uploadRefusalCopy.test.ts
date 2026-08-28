import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { inkDesignBytesRefusal } from "./inkUploadDoor";
import { referenceAttachBytesRefusal } from "./referenceAttachDoor";
import { BYTES_NOT_AN_IMAGE_MESSAGE } from "./uploadRefusalCopy";

/**
 * The guard for #209 item 1's law-4 half.
 *
 * Three claims, and the third is the one worth having: a constant that removes
 * five copies is worth little if a sixth may be typed tomorrow with nothing
 * going red. That is the failure that produced the defect in the first place.
 */

const repoRoot = path.resolve(__dirname, "..", "..");
const OWNER = "server/castingV2/uploadRefusalCopy.ts";

/**
 * The files allowed to contain the sentence as a literal, each for a reason.
 *
 * ⚠ **THE SECOND ROW IS NOT A CONVENIENCE — THE SWEEP FOUND IT ITSELF.** The
 * first run of this suite went red naming this very file, because the byte-pin
 * arm below cannot pin bytes without writing them. Two correct arms in conflict:
 * the pin needs the literal, the sweep forbids it. The same shape as the token
 * guard's own carve-out one tree away ("its own positive controls ... which
 * working law 2 requires it to contain"), and resolved the same way — declared,
 * with the reason, rather than by weakening either arm.
 *
 * Adding a third row is a decision, not a fix.
 */
const LITERAL_ALLOWED: Record<string, string> = {
  [OWNER]: "the one declaration — the whole point of the module",
  "server/castingV2/uploadRefusalCopy.test.ts":
    "the byte pin below, which cannot assert the bytes without containing them",
};

/** Every source file a copy could hide in. */
function sources(dir: string): string[] {
  const absolute = path.join(repoRoot, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === "dist") return [];
    const child = path.join(absolute, entry.name);
    const relative = path.relative(repoRoot, child).replaceAll("\\", "/");
    if (entry.isDirectory()) return sources(relative);
    return /\.(ts|tsx|mts)$/.test(entry.name) ? [relative] : [];
  });
}

describe("the not-an-image sentence has exactly one author", () => {
  it("still says what it said before the dedupe — byte for byte", () => {
    /*
      A BYTE PIN, unlike the token guard's message arm one file away, and the
      difference is who reads it. That sentence is read by us; this one is read
      by a customer mid-upload, and #209 is maintenance: zero customer-visible
      change. A reworded sentence is a product decision and should have to break
      a test to happen.
    */
    expect(BYTES_NOT_AN_IMAGE_MESSAGE).toBe("That file isn't an image we can read.");
  });

  it("is declared in a module that imports nothing", () => {
    /*
      The property `briefRefusalCopy.ts` states and pins for the same reason: a
      copy of a shape that drops the shape's one structural rule teaches the
      next reader the wrong lesson.
    */
    const source = fs.readFileSync(path.join(repoRoot, OWNER), "utf8");
    const imports = [...source.matchAll(/^\s*import\s/gm)].map((m) => m[0]);
    expect(imports, `${OWNER} must stay a leaf`).toEqual([]);
  });

  /**
   * ⚠ THE ARM THAT MAKES THE DEDUPE HOLD (law 7).
   *
   * #209 filed this defect as TWO route sites. The sweep found FIVE, in four
   * files — so the card's own count was a floor, and the only thing that stops
   * the count climbing again is an arm that reads the tree rather than a
   * reviewer remembering.
   *
   * It asserts the literal appears only in the files `LITERAL_ALLOWED` names,
   * with the reason for each written beside it.
   */
  it("appears as a literal in no file but the two that must hold it", () => {
    const authors = sources("server")
      .concat(sources("client"), sources("shared"), sources("scripts"))
      .filter((relative) =>
        fs.readFileSync(path.join(repoRoot, relative), "utf8").includes(BYTES_NOT_AN_IMAGE_MESSAGE),
      );

    expect(
      authors.sort(),
      "Import BYTES_NOT_AN_IMAGE_MESSAGE instead of writing the sentence out again"
        + " — it was written inline five times before #209 and any copy could have"
        + " been reworded with nothing going red",
    ).toEqual(Object.keys(LITERAL_ALLOWED).sort());
  });

  it("keeps both carve-outs honest — each must exist and still need it", () => {
    /*
      The token guard's discipline, borrowed with it: an exception that stops
      being needed is an exception that starts hiding the next copy.
    */
    for (const [relative, reason] of Object.entries(LITERAL_ALLOWED)) {
      const absolute = path.join(repoRoot, relative);
      expect(fs.existsSync(absolute), `${relative} is gone — remove the row (${reason})`).toBe(true);
      expect(
        fs.readFileSync(absolute, "utf8").includes(BYTES_NOT_AN_IMAGE_MESSAGE),
        `${relative} no longer holds the sentence — remove the row (${reason})`,
      ).toBe(true);
    }
  });

  it("is the sentence both byte doors actually hand back", () => {
    /*
      DRIVEN AT THE DOOR rather than asserted near it (working law 5). The
      constant being right proves nothing about whether the door reaches for it,
      and "the door still hands back the old string" is exactly the defect this
      swap could have introduced. `decoded: null` is the unreadable case: bytes
      sharp could not open.
      A grep for the identifier would pass on a file that imports it and uses it
      nowhere, which is the same green-while-proving-nothing shape the repo has
      met before.
    */
    expect(inkDesignBytesRefusal({ byteSize: 1024, decoded: null })).toEqual({
      code: "unreadable",
      message: BYTES_NOT_AN_IMAGE_MESSAGE,
    });
    expect(referenceAttachBytesRefusal({ byteSize: 1024, decoded: null })).toEqual({
      code: "unreadable",
      message: BYTES_NOT_AN_IMAGE_MESSAGE,
    });
  });
});
