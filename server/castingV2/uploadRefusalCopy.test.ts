import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { readListedSource } from "../testing/listedSource";
import { inkDesignBytesRefusal } from "./inkUploadDoor";
import { REFERENCE_PICTURES_PER_CANDIDATE_REFUSAL, referenceAttachBytesRefusal } from "./referenceAttachDoor";
import {
  BYTES_NOT_AN_IMAGE_MESSAGE,
  REFERENCE_ATTACH_REFUSAL_COPY,
  UPLOAD_REFUSAL_COPY,
} from "./uploadRefusalCopy";
import { INK_DESIGN_MAX_BYTES, INK_DESIGN_MIN_EDGE } from "./uploadLimits";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";

/* Its arms do real work in process — a tree sweep, a sheet compile, a sharp
   encode — and under the parallel run that cost multiplies by fifteen or twenty
   against vitest's 5,000 ms default. The measurement, and the two roads that
   were rejected, are in `contendedTestTimeout.ts` (#741). File level, never
   per arm: a number typed onto one `it(…)` is not inherited by its neighbour. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

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

  it("is declared in a module that imports exactly one leaf, and the leaf is still a leaf", () => {
    /*
      The property `briefRefusalCopy.ts` states and pins for the same reason: a
      copy of a shape that drops the shape's one structural rule teaches the
      next reader the wrong lesson.

      ⚠ IT READ `toEqual([])` UNTIL #209 ITEM 1, AND THE WEAKENING IS DELIBERATE
      AND BOUNDED. The copy table must state the two sentences that QUOTE
      `INK_DESIGN_MAX_BYTES` and `INK_DESIGN_MIN_EDGE`, and writing `8MB` out
      beside the constant that produces it is a second author of one number —
      working law 4, in the module whose whole subject is one sentence having
      one author. So it takes ONE import and that import must be a LEAF, which
      is `briefRefusalCopy.ts`'s own arrangement with `@shared/briefLength`.
      Both halves are asserted: a second import here fails, and a leaf that
      grows an import of its own fails too — that is the road by which this
      module would quietly start dragging app code into the atlas.
    */
    const source = fs.readFileSync(path.join(repoRoot, OWNER), "utf8");
    const imports = [...source.matchAll(/^import .*$/gm)].map((m) => m[0]);
    expect(imports, `${OWNER} may import its one leaf and nothing else`).toEqual([
      'import { INK_DESIGN_MAX_BYTES, INK_DESIGN_MIN_EDGE, INK_DESIGNS_PER_CANDIDATE } from "./uploadLimits";',
    ]);

    const leaf = fs.readFileSync(path.join(repoRoot, "server/castingV2/uploadLimits.ts"), "utf8");
    expect(
      [...leaf.matchAll(/^import .*$/gm)].map((m) => m[0]),
      "server/castingV2/uploadLimits.ts must stay a leaf — the copy module's one import rests on it",
    ).toEqual([]);
  });

  /**
   * ⚠ THE ARM THE ID HALF OF #209 EXISTS FOR — the tables' KEYS, quoted.
   *
   * A sentence with no id is a door the capability map cannot hold, and these
   * five were invisible BY CONSTRUCTION: unlike every other gap #206 closed,
   * there was no id anywhere for a wider reader to find. The keys below are now
   * the map's door ids (`upload.*`, `reference.pictureCap`).
   *
   * ⚠ **AND THIS SUITE ASSERTS THE KEYS RATHER THAN CALLING THE ATLAS'S OWN
   * READERS, WHICH IS NOT A STYLE CHOICE.** `pinCandidates` drops any test file
   * that imports `lib/capabilityAtlas.mts` — structurally, so the census cannot
   * publish its own positive control into the corpus it searches. A suite that
   * imported those readers to check the ids would therefore stop being a PIN,
   * and `reference.pictureCap` has no other: the census's own arm then refuses
   * the door for having lost its last one. Found by doing exactly that.
   *
   * So the split is deliberate and each half is where it can do its job: the
   * declarations are checked in `server/capabilityAtlas.test.ts`, and the bare
   * member names are quoted HERE, which is what a pin is.
   */
  it("names every door id the capability map carries for this entrance", () => {
    expect(Object.keys(UPLOAD_REFUSAL_COPY))
      .toEqual(["unreadable", "unsupportedFormat", "tooLarge", "tooSmall"]);
    expect(Object.keys(REFERENCE_ATTACH_REFUSAL_COPY)).toEqual(["pictureCap"]);
  });

  it("is the one author of the two sentences that quote a number", () => {
    /*
      Driven at the value rather than asserted near it: the point of moving the
      limits into a leaf was that these sentences cannot drift from the numbers
      the doors actually enforce. A hand-typed "8MB" passes a grep and fails
      this.
    */
    expect(UPLOAD_REFUSAL_COPY.tooLarge).toContain(String(Math.round(INK_DESIGN_MAX_BYTES / (1024 * 1024))));
    expect(UPLOAD_REFUSAL_COPY.tooSmall).toContain(String(INK_DESIGN_MIN_EDGE));
  });

  it("hands the attach door's cap sentence back unchanged", () => {
    /*
      `referenceAttachDoor.ts` re-exports it, so its callers and
      `inkReferenceMint.test.ts`'s two arms did not move. A re-export that
      stopped pointing here would leave two sentences again, silently.
    */
    expect(REFERENCE_PICTURES_PER_CANDIDATE_REFUSAL).toBe(REFERENCE_ATTACH_REFUSAL_COPY.pictureCap);
    expect(REFERENCE_PICTURES_PER_CANDIDATE_REFUSAL).toMatch(/new Cast/i);
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
    const scanned = sources("server").concat(sources("client"), sources("shared"), sources("scripts"));

    /*
      THE FLOOR THIS ARM DID NOT HAVE, and it is the one suite in the class that
      needed it (#223). The assertion below is an EQUALITY against a two-name
      list, so a reader that found nothing at all would agree with it perfectly
      — blindness reads exactly like a clean sweep. Five of the seven scripts/
      walkers already carry a population arm; this one did not.
    */
    expect(scanned.length, "the scan found no sources — a checker that cannot look cannot fail")
      .toBeGreaterThan(500);

    const authors = scanned.filter((relative) => {
      /* A file `sources()` listed can be gone by the time it is read — a
         parallel suite plants and unlinks in `scripts/`, and this is the arm
         that met the ENOENT and refused the deploy rite on a clean tree. */
      const source = readListedSource(path.join(repoRoot, relative));
      return source !== null && source.includes(BYTES_NOT_AN_IMAGE_MESSAGE);
    });

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
