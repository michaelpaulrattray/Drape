/**
 * THE CARRIED-GEOMETRY RE-MINT (fable-1443 option (iii), fable-1445 §2).
 *
 * The defect is one sentence: a library crop's rectangle was measured on the
 * frame it was cut from, and on every version after that mint it is drawn over
 * different pixels. The founder's "Right horn" box floated over background.
 *
 * So the arm that matters is fable-1443's own — **version N's box is version
 * N's OWN frame's geometry, not version N-1's** — and it is driven end to end
 * through both halves here: the producer reads a frame and files a box, the
 * consumer draws it, and the assertion is that the number on the panel is the
 * number the reader saw and not the one the library stored.
 *
 * Every arm is producer-sabotageable. Make `reMintCarriedGeometry` pass the
 * library's own geometry through instead of reading, or make `facePanel` prefer
 * the library's box, and the end-to-end arm reddens on the coordinate.
 */
import { describe, expect, it, vi } from "vitest";

import {
  CARRIED_GEOMETRY_COST_NOTE_ABOVE,
  carriedSlotsForGeometry,
  reMintCarriedGeometry,
} from "./carriedGeometry";
import { facePanel } from "./facePanel";
import type { StoredReference } from "./referenceLibrary";
import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";
import type { FeatureSlot } from "./recipeAssembler";

const FRAME = { width: 100, height: 100 };

/** A mask with one solid rectangle lit, in the frame's own pixel space. */
function maskWith(box: { x: number; y: number; width: number; height: number }): Mask {
  const data = Buffer.alloc(FRAME.width * FRAME.height, 0);
  for (let y = box.y; y < box.y + box.height; y += 1) {
    for (let x = box.x; x < box.x + box.width; x += 1) data[y * FRAME.width + x] = 255;
  }
  return { data, width: FRAME.width, height: FRAME.height } as Mask;
}

let version = 0;
function row(over: Partial<StoredReference> & { slot: string }): StoredReference {
  version += 1;
  return {
    id: version,
    publicId: `row-${version}`,
    candidateId: 1,
    variantId: 7,
    role: "carry",
    tier: "anatomy",
    noun: "horns",
    words: ["curved black horns"],
    storageKey: `crops/${version}.png`,
    maskKey: `crops/${version}-mask.png`,
    digest: `d${version}`,
    geometry: { bbox: { x: 1, y: 2, width: 3, height: 4 }, frame: FRAME },
    guard: null,
    refusal: null,
    version,
    retiredAt: null,
    createdAt: new Date(),
    ...over,
  } as StoredReference;
}

function readerReturning(masks: ReadonlyMap<string, Mask>): RegionReader & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    /* The two capabilities this road never asks for. Present because the type
       is one reader, and throwing is the honest body: a call would be a defect
       rather than a case to handle. */
    async subject(): Promise<Mask> { throw new Error("carried geometry never asks for a subject matte"); },
    async landmark(): Promise<{ x: number; y: number }[]> { throw new Error("carried geometry never asks for a landmark"); },
    async region({ name }) {
      asked.push(name);
      const found = masks.get(name);
      if (!found) throw new Error(`no mask for ${name}`);
      return found;
    },
    async regionSides({ name }) {
      asked.push(`${name}#sides`);
      const left = masks.get(`${name}@left`);
      const right = masks.get(`${name}@right`);
      if (!left || !right) return null;
      return { left, right };
    },
  };
}

describe("which features this render carried rather than wrote", () => {
  it("takes a live carry row with a box that this render did not file", () => {
    const carried = carriedSlotsForGeometry({
      rows: [row({ slot: "hair" })],
      minted: new Set(),
    });
    expect(carried.map((one) => one.slot)).toEqual(["hair"]);
    expect(carried[0]!.side).toBeNull();
  });

  it("skips a slot this render's own mint just cut a fresh crop for", () => {
    /* The mint has already measured this feature on this very frame. A second
       read is a second answer to one question, and it costs money to disagree. */
    expect(carriedSlotsForGeometry({
      rows: [row({ slot: "hair" })],
      minted: new Set(["hair"]),
    })).toEqual([]);
  });

  it("skips a words-only row — there is no rectangle on screen to be wrong", () => {
    expect(carriedSlotsForGeometry({
      rows: [row({ slot: "hair", geometry: null, storageKey: null, maskKey: null })],
      minted: new Set(),
    })).toEqual([]);
  });

  it("skips a slot the catalogue gives no segmentation question — a surface", () => {
    /* `skin` is a surface: no region word names it, and D-213 forbids inventing
       one. Its row is words and has never had a box. */
    expect(carriedSlotsForGeometry({
      rows: [row({ slot: "skin", geometry: null })],
      minted: new Set(),
    })).toEqual([]);
  });

  it("skips a slot she has EMPTIED — a vacancy on top of a carry", () => {
    /* `liveReferences` keys on (slot, role), so both rows are live. The panel
       shows nothing; reading here would buy a box for the glasses she took off. */
    const carry = row({ slot: "glasses" });
    const vacancy = row({ slot: "glasses", role: "vacancy", storageKey: null, geometry: null });
    expect(carriedSlotsForGeometry({ rows: [carry, vacancy], minted: new Set() })).toEqual([]);
  });

  it("does NOT skip a slot she emptied and then filled again", () => {
    /* The same two roles, the other way round in time. The carry is newer, so
       the thing is on her face and its box is on the panel. */
    const vacancy = row({ slot: "glasses", role: "vacancy", storageKey: null, geometry: null });
    const carry = row({ slot: "glasses" });
    expect(carriedSlotsForGeometry({ rows: [vacancy, carry], minted: new Set() })
      .map((one) => one.slot)).toEqual(["glasses"]);
  });

  it("carries a per-side slot's own side, read off its key and never its words", () => {
    const carried = carriedSlotsForGeometry({
      rows: [row({ slot: "eye@left", noun: "eye", words: ["a fiery red iris"] })],
      minted: new Set(),
    });
    expect(carried).toHaveLength(1);
    expect(carried[0]!.side).toBe("left");
  });

  it("asks an OPEN kind in her own words, joined across the whole stack", () => {
    /* The mint's own measurement: the bare noun `orb` returns zero pixels and
       her stored sentence returns a tight box. If this asked `orb`, every open
       kind's box would stop healing and nothing else would go red. */
    const carried = carriedSlotsForGeometry({
      rows: [row({ slot: "open:orb", noun: "orb", words: ["glowing slightly brighter"] })],
      minted: new Set(),
      priorWords: new Map([["open:orb", ["a floating orb above her palm"]]]),
    });
    expect(carried).toHaveLength(1);
    expect(carried[0]!.question).toContain("a floating orb above her palm");
    expect(carried[0]!.question).toContain("glowing slightly brighter");
    expect(carried[0]!.question).not.toBe("orb");
  });
});

describe("re-reading the carried features on the delivered frame", () => {
  const base = {
    userId: 4,
    candidateId: 11,
    candidatePublicId: "cand-abc",
    variantId: 99,
    frameKey: "faces/v219.png",
    frame: { bytes: Buffer.from("frame") },
  };

  it("files the box the READER saw on this frame, never the library's own", async () => {
    const written: Array<Parameters<typeof import("../db/castingV2FaceScans").keepCarriedGeometry>[0]> = [];
    const result = await reMintCarriedGeometry({
      ...base,
      slots: [{ slot: "hair" as FeatureSlot, question: "hair", side: null }],
      reader: readerReturning(new Map([["hair", maskWith({ x: 40, y: 10, width: 20, height: 30 })]])),
      dependencies: {
        write: async (one) => { written.push(one); return { written: true }; },
      },
    });

    expect(result).toMatchObject({ asked: 1, filed: 1, unread: [], written: true });
    expect(written).toHaveLength(1);
    expect(written[0]!.carried[0]).toEqual({
      slot: "hair",
      box: { x: 40, y: 10, width: 20, height: 30, frame: FRAME },
    });
    /* The frame travels with the box and comes from the mask it was measured
       in — two readings of a frame's size can disagree; a mask and its own
       dimensions cannot. */
    expect(written[0]!.frameKey).toBe("faces/v219.png");
  });

  it("scopes a per-side feature through the reader, never the whole-frame answer", async () => {
    /* Asked whole-frame, a bilateral question answers with BOTH — a box spanning
       her two horns, labelled as one of them. */
    const reader = readerReturning(new Map([
      ["curved black horns@left", maskWith({ x: 10, y: 10, width: 10, height: 10 })],
      ["curved black horns@right", maskWith({ x: 70, y: 10, width: 10, height: 10 })],
    ]));
    const written: Array<{ slot: string; box: unknown }> = [];
    await reMintCarriedGeometry({
      ...base,
      slots: [{ slot: "open:horns@right" as FeatureSlot, question: "curved black horns", side: "right" }],
      reader,
      dependencies: {
        write: async (one) => { written.push(...one.carried); return { written: true }; },
      },
    });
    expect(reader.asked).toEqual(["curved black horns#sides"]);
    expect(written[0]!.box).toMatchObject({ x: 70, width: 10 });
  });

  it("counts a read that did not settle, and the other features still land", async () => {
    const written: Array<{ slot: string }> = [];
    const result = await reMintCarriedGeometry({
      ...base,
      slots: [
        { slot: "hair" as FeatureSlot, question: "hair", side: null },
        { slot: "nose" as FeatureSlot, question: "nose", side: null },
      ],
      reader: readerReturning(new Map([["hair", maskWith({ x: 5, y: 5, width: 5, height: 5 })]])),
      dependencies: {
        write: async (one) => { written.push(...one.carried); return { written: true }; },
      },
    });
    /* The countable line's own subject: a re-mint that quietly starts failing is
       stale geometry returning with a green suite. */
    expect(result.unread).toEqual(["nose"]);
    expect(result.filed).toBe(1);
    expect(written.map((one) => one.slot)).toEqual(["hair"]);
  });

  it("writes nothing when no feature could be read", async () => {
    const write = vi.fn();
    const result = await reMintCarriedGeometry({
      ...base,
      slots: [{ slot: "nose" as FeatureSlot, question: "nose", side: null }],
      reader: readerReturning(new Map()),
      dependencies: { write },
    });
    expect(write).not.toHaveBeenCalled();
    expect(result).toMatchObject({ filed: 0, written: false, unread: ["nose"] });
  });

  it("an ABSENT TABLE costs the boxes and never the picture (fable-1445 condition 3)", async () => {
    const result = await reMintCarriedGeometry({
      ...base,
      slots: [{ slot: "hair" as FeatureSlot, question: "hair", side: null }],
      reader: readerReturning(new Map([["hair", maskWith({ x: 1, y: 1, width: 2, height: 2 })]])),
      dependencies: {
        write: async () => { throw new Error("Table 'x.casting_face_scans' doesn't exist"); },
      },
    });
    /* Resolved, not thrown. The render is one statement away from landing a
       picture somebody has paid for. */
    expect(result.written).toBe(false);
    expect(result.unread).toEqual(["hair"]);
  });

  it("stands down rather than writing onto a row about different bytes", async () => {
    const result = await reMintCarriedGeometry({
      ...base,
      slots: [{ slot: "hair" as FeatureSlot, question: "hair", side: null }],
      reader: readerReturning(new Map([["hair", maskWith({ x: 1, y: 1, width: 2, height: 2 })]])),
      dependencies: { write: async () => ({ written: false, reason: "frame-moved" as const }) },
    });
    expect(result).toMatchObject({ filed: 1, written: false });
  });

  it("the cost note's threshold is a stated number, not a hidden one", () => {
    /* fable-1443 condition 4: the tripwire lives beside the constant that
       prices it. A face carrying more than this resurfaces the per-render cost
       reading — $0.005 a read, so eleven features is $0.055 a render. */
    expect(CARRIED_GEOMETRY_COST_NOTE_ABOVE).toBe(10);
  });
});

describe("⚠ version N's box is version N's OWN frame — end to end", () => {
  /**
   * The whole defect and the whole fix in one arm.
   *
   * A branch carrying horns minted on v215 at x=10. The frame delivered by v219
   * has them at x=62 — the founder's regenerate moved them. The panel is built
   * from the SAME library rows either way; the only difference is whether the
   * render's re-read reached it.
   */
  const carriedRow = row({
    slot: "open:horns",
    noun: "horns",
    words: ["curved black horns"],
    geometry: { bbox: { x: 10, y: 20, width: 12, height: 14 }, frame: FRAME },
  });

  const panelWith = (carriedGeometry?: ReadonlyMap<string, { x: number; y: number; width: number; height: number; frame: { width: number; height: number } }>) => facePanel({
    rows: [carriedRow],
    pronouns: { subject: "he", object: "him", possessive: "his", plural: false },
    contentUrl: (key) => `https://cdn/${key}`,
    maskUrl: (key) => `https://cdn/${key}`,
    ...(carriedGeometry ? { carriedGeometry } : {}),
  });

  const boxOf = (panel: ReturnType<typeof facePanel>) => panel.groups
    .flatMap((group) => group.rows)
    .find((one) => one.name === "Horns")?.regions[0]?.box ?? null;

  it("without the re-read the panel draws v215's rectangle — the defect", () => {
    expect(boxOf(panelWith())).toMatchObject({ x: 10, y: 20 });
  });

  it("with it, the panel draws where the horns are on the frame it is showing", async () => {
    const written: Array<{ slot: string; box: { x: number; y: number; width: number; height: number; frame: { width: number; height: number } } }> = [];
    const toReRead = carriedSlotsForGeometry({ rows: [carriedRow], minted: new Set() });
    await reMintCarriedGeometry({
      userId: 4,
      candidateId: 11,
      candidatePublicId: "cand-abc",
      variantId: 219,
      frameKey: "faces/v219.png",
      frame: { bytes: Buffer.from("v219") },
      slots: toReRead,
      /* The frame v219 actually delivered: the horns have moved and grown. */
      reader: readerReturning(new Map([
        [toReRead[0]!.question, maskWith({ x: 62, y: 24, width: 18, height: 21 })],
      ])),
      dependencies: {
        write: async (one) => { written.push(...one.carried as typeof written); return { written: true }; },
      },
    });

    const drawn = boxOf(panelWith(new Map(written.map((one) => [one.slot, one.box]))));
    expect(drawn).toMatchObject({ x: 62, y: 24, width: 18, height: 21 });
    /* Said as an inequality too, because that is the founder's complaint: the
       rectangle he was shown was not about the picture he was looking at. */
    expect(drawn!.x).not.toBe(carriedRow.geometry!.bbox.x);
  });
});
