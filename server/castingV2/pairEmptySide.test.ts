/**
 * A SIDE NOTHING FOUND IS NOT DRAWN (#2800, his eye round 6).
 *
 * His panel drew "Ears ▾ → Left ear · Right ear" and "Earrings ▾ → Left
 * earring · Right earring" with one side of each holding nothing: no picture,
 * no place on the photograph. A tap on one wrote "their right ear" into the ask
 * box and lit nothing. These arms drive `facePanel` with the scan his screenshot
 * reproduces at 598 wide — the cast's left ear and the cast's right hoop, and
 * nothing else of either pair — and every "dropped" arm has a "kept" sibling.
 */
import { describe, expect, it } from "vitest";

import type { CastPronouns } from "./castPronouns";
import { facePanel, type PanelRow, type PanelScan } from "./facePanel";
import type { StoredReference } from "./referenceLibrary";
import type { FeatureSlot } from "./recipeAssembler";

const THEY: CastPronouns = { subject: "they", object: "them", possessive: "their", plural: true };
const frame = { width: 598, height: 898 };

/* His screenshot's own geometry at 598 wide, read through the reader (#2800's
   road comment): the cast's left ear is the image's right. */
const HIS: Record<string, { x: number; y: number; width: number; height: number }> = {
  "ear@left": { x: 395, y: 256, width: 14, height: 21 },
  "earring@right": { x: 206, y: 288, width: 12, height: 29 },
};
const OTHER_HOOP = { "earring@left": { x: 395, y: 273, width: 14, height: 26 } };

function scanOf(slots: Record<string, { x: number; y: number; width: number; height: number }>): PanelScan {
  return {
    frameUrl: "https://bucket.example/casting/master.jpg",
    slots: new Map(Object.entries(slots).map(([slot, box]) => [slot as FeatureSlot, {
      box: { ...box, frame },
      maskUrl: `data:image/png;base64,${slot}`,
    }])),
  };
}

function rowsOf(
  slots: Record<string, { x: number; y: number; width: number; height: number }>,
  over: { rows?: StoredReference[]; scanning?: boolean } = {},
): PanelRow[] {
  return facePanel({
    rows: over.rows ?? [],
    pronouns: THEY,
    contentUrl: (key) => `https://bucket.example/${key}`,
    maskUrl: (key) => `https://bucket.example/${key}`,
    scan: scanOf(slots),
    ...(over.scanning === undefined ? {} : { scanning: over.scanning }),
  }).groups.flatMap((group) => group.rows);
}

const named = (rows: PanelRow[], name: string) => rows.find((row) => row.name === name);
const children = (row: PanelRow | undefined) => (row?.instances ?? []).map((one) => one.name);

describe("a pair draws only the sides something found", () => {
  it("his panel: Ears keeps Left ear alone, Earrings keeps Right earring alone", () => {
    const rows = rowsOf(HIS);
    expect(children(named(rows, "Ears"))).toEqual(["Left ear"]);
    expect(children(named(rows, "Earrings"))).toEqual(["Right earring"]);
  });

  it("the side kept is the one with the picture and the place on the photograph", () => {
    const [earring] = named(rowsOf(HIS), "Earrings")!.instances;
    expect(earring.slot).toBe("earring@right");
    expect(earring.box).toEqual({ ...HIS["earring@right"], frame });
    expect(earring.cutout).not.toBeNull();
  });

  it("the parent row stays, and still means the pair", () => {
    const earrings = named(rowsOf(HIS), "Earrings")!;
    expect(earrings.slots).toEqual(["earring@left", "earring@right"]);
    expect(earrings.regions.map((one) => one.slot)).toEqual(["earring@right"]);
  });

  it("CONTROL — both sides found, both are drawn, left then right", () => {
    expect(children(named(rowsOf({ ...HIS, ...OTHER_HOOP }), "Earrings"))).toEqual(["Left earring", "Right earring"]);
  });

  it("CONTROL — a side the library holds a picture of, with no place recorded, is still drawn", () => {
    /* A carry minted before geometry was recorded: a picture, no rectangle. */
    const carried: StoredReference = {
      id: 1,
      userId: 1,
      candidateId: 1,
      variantId: null,
      slot: "earring@left",
      tier: "item",
      role: "carry",
      words: ["a silver hoop"],
      storageKey: "library/earring-left.png",
      maskKey: "library/earring-left-mask.png",
      geometry: null,
      version: 1,
      retiredAt: null,
      createdAt: new Date(0),
    } as unknown as StoredReference;
    expect(children(named(rowsOf(HIS, { rows: [carried] }), "Earrings"))).toEqual(["Left earring", "Right earring"]);
  });

  it("a pair with nothing found anywhere is not drawn at all, as before", () => {
    const rows = rowsOf({ "earring@right": HIS["earring@right"] });
    expect(named(rows, "Ears")).toBeUndefined();
  });

  it("while the scan runs, a waiting pair keeps its place with nothing to open into", () => {
    const ears = named(rowsOf({}, { scanning: true }), "Ears");
    expect(ears?.state).toBe("pending");
    expect(ears?.instances).toEqual([]);
  });
});
