/**
 * A TEXT-ONLY ROW KEEPS ITS WORDS AND ITS BOX AND LOSES ITS TILE (#1341).
 *
 * Founder, 2026-09-26, verbatim: *"currently we have a build thumbnail, really
 * build should carry as text only and outfit does need its own card but this is
 * also n3 right?"* — the outfit half is N3's; this drives the half he ruled on.
 *
 * # WHAT EACH ARM IS FOR, because three of them look like one
 *
 * The tile going is the easy assertion and it is the least of it. The two that
 * actually protect the ruling are the ones that pin what must NOT change:
 *
 *   - the BOX survives, because fable-414 requires every panel row to have a
 *     bounding box and a row without one leaves the panel entirely. A fix that
 *     dropped the box would read as "build is text only" in a diff and delete
 *     the row on the customer's screen.
 *   - the WORDS survive, because "text only" is the whole content of the row.
 *   - the rule is read from the CATALOGUE rather than from a slot name here, so
 *     this suite cannot pass while the panel special-cases the string "build".
 *
 * The negative control is `skin`: the nearest-shaped row, deliberately NOT given
 * the field, so an implementation that dropped every composed-region tile fails
 * here rather than shipping a ruling he did not make.
 */
import { describe, expect, it } from "vitest";
import { facePanel, type PanelRow } from "./facePanel";
import { catalogueSlots, slotDefinition } from "./referenceSlotCatalogue";
import type { StoredReference } from "./referenceLibrary";
import type { FeatureSlot } from "./recipeAssembler";
import type { CastPronouns } from "./castPronouns";

const FRAME = { width: 1024, height: 1536 };
const SHE: CastPronouns = { subject: "she", object: "her", possessive: "her", plural: false };

let nextId = 1;

/** A library-held row WITH a minted crop — the edited-cast state, where a tile
 *  reaches the row from the library rather than from the scan. */
function libraryRow(slot: string): StoredReference {
  const id = nextId++;
  return {
    id,
    publicId: `pub-${id}`,
    candidateId: 7,
    variantId: 11,
    role: "carry",
    slot: slot as FeatureSlot,
    tier: "anatomy",
    noun: slot,
    words: ["athletic, broad-shouldered"],
    storageKey: `casting-v2/${slot}/minted.png`,
    maskKey: `casting-v2/${slot}/minted-mask.png`,
    digest: null,
    geometry: { bbox: { x: 10, y: 20, width: 30, height: 40 }, frame: { width: 1000, height: 1500 } },
    guard: null,
    refusal: null,
    version: 1,
    retiredAt: null,
    createdAt: new Date(2026, 8, 26, 12, 0, id),
  };
}

/** A panel built from a scan alone — the state every unedited cast is in, and
 *  the one that mints a scan-born tile for anything with geometry. */
function rowsFromScan(
  boxes: Record<string, { x: number; y: number; width: number; height: number }>,
  words: Record<string, readonly string[]> = {},
): PanelRow[] {
  return facePanel({
    rows: [],
    pronouns: SHE,
    contentUrl: (key) => `https://bucket.example/${key}`,
    maskUrl: (key) => key,
    scan: {
      frameUrl: "https://bucket.example/casting/master.jpg",
      slots: new Map(Object.entries(boxes).map(([slot, box]) => [slot as FeatureSlot, {
        box: { ...box, frame: FRAME },
        maskUrl: `data:image/png;base64,${slot}`,
      }])),
      words: new Map(Object.entries(words).map(([slot, said]) => [slot as FeatureSlot, said])),
    },
  }).groups.flatMap((group) => group.rows);
}

const TORSO = { x: 180, y: 700, width: 660, height: 800 };
const FACE = { x: 380, y: 240, width: 280, height: 340 };

describe("a text-only panel row (#1341)", () => {
  it("draws build with no tile", () => {
    const build = rowsFromScan({ build: TORSO }, { build: ["athletic, broad-shouldered"] })
      .find((row) => row.name === "Build");

    expect(build, "the Build row left the panel — his ruling keeps it and drops its picture").toBeDefined();
    expect(build!.cutouts).toEqual([]);
  });

  it("keeps build's words, which are now the whole of the row", () => {
    const build = rowsFromScan({ build: TORSO }, { build: ["athletic, broad-shouldered"] })
      .find((row) => row.name === "Build")!;

    expect(build.words).toEqual(["athletic, broad-shouldered"]);
  });

  it("keeps build's bounding box, so the row stays legal under fable-414", () => {
    const build = rowsFromScan({ build: TORSO }, { build: ["athletic"] })
      .find((row) => row.name === "Build")!;

    // A row with no box leaves the panel. Dropping it would look like this
    // change and delete the row instead of its tile.
    expect(build.regions.map((region) => region.box)).toEqual([{ ...TORSO, frame: FRAME }]);
  });

  it("leaves every other row's tile alone — skin is the negative control", () => {
    // `skin` is the nearest shape to build (a region it may never be cut from)
    // and he ruled on build alone. An implementation that dropped tiles for all
    // composed regions reddens here.
    const skin = rowsFromScan({ skin: FACE }, { skin: ["fair, warm undertone"] })
      .find((row) => row.name === "Skin");

    expect(skin, "the Skin row is expected on the panel for this control to mean anything").toBeDefined();
    expect(skin!.cutouts).toHaveLength(1);
    expect(skin!.cutouts[0]!.crop).toEqual({ ...FACE, frame: FRAME });
  });

  it("reads the rule off the catalogue, not off a slot name in the panel", () => {
    // If the panel special-cased "build", this arm would still pass while the
    // rule it claims to implement did not exist. So assert the declaration is
    // what carries it, and that exactly the declared slots are tile-less.
    const declared = catalogueSlots()
      .filter((definition) => definition.noThumbnail !== undefined)
      .map((definition) => definition.slot);

    expect(declared).toEqual(["build"]);
    expect(slotDefinition("build")?.noThumbnail?.why).toMatch(/text only/i);
    expect(slotDefinition("skin")?.noThumbnail).toBeUndefined();
  });

  it("drops a CARRIED crop too, not only the scan-born one", () => {
    // "Text only" has to mean both sources. A library row for build would
    // otherwise keep its minted tile and the ruling would hold on an unedited
    // cast and quietly fail on an edited one — the worst shape, because the
    // panel looks right on every fixture and wrong on his own Cast.
    const rows = [libraryRow("build"), libraryRow("skin")];
    const drawn = facePanel({
      rows,
      pronouns: SHE,
      contentUrl: (key) => `https://bucket.example/${key}`,
      maskUrl: (key) => key,
    }).groups.flatMap((group) => group.rows);

    const build = drawn.find((row) => row.name === "Build");
    const skin = drawn.find((row) => row.name === "Skin");

    // Asserted DEFINED first: an `if (build)` here would pass by the row being
    // absent, which is the one outcome this change must not produce.
    expect(build, "the Build row left the panel on a library-held build").toBeDefined();
    expect(build!.cutouts).toEqual([]);
    expect(build!.words).toEqual(["athletic, broad-shouldered"]);

    // The same library shape on the control row still carries its crop, so the
    // empty array above is this rule and not a broken fixture.
    expect(skin, "the Skin control row is missing, so the arm above proves nothing").toBeDefined();
    expect(skin!.cutouts).toHaveLength(1);
  });
});
