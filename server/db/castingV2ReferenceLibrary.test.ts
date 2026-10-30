/**
 * The library's door — the row shapes it refuses, driven directly.
 *
 * MySQL cannot be asked to enforce "a surface never holds a crop", so the write
 * helper is where those rules live, and this file drives each one at a row it
 * should reject. Working law 3: a backstop proved only by a path that usually
 * behaves is not proved at all — and every one of these refusals would sit
 * green and unreachable if it were only ever handed legal rows.
 *
 * So each rule gets both arms: the row it must refuse, and the closest legal
 * row to it, which must pass.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  GUARD_REFUSAL_REASONS,
  REFUSALS_THAT_KEEP_THEIR_CROP,
  refusalKeepsItsCrop,
} from "../castingV2/referenceCompleteness";
import {
  assertReferenceRowShape,
  ReferenceLibraryShapeError,
  type ReferenceRowToRecord,
} from "./castingV2ReferenceLibrary";

const geometry = {
  bbox: { x: 10, y: 20, width: 120, height: 80 },
  frame: { width: 1024, height: 1536 },
};
const guard = { kind: "hair", coverage: 9460, spill: 120, threshold: 9460 };

function crop(overrides: Partial<ReferenceRowToRecord> = {}): ReferenceRowToRecord {
  return {
    role: "carry",
    slot: "hair",
    tier: "anatomy",
    noun: "hair",
    words: ["a blunt shoulder-length bob"],
    image: {
      storageKey: "casting-v2/library/abc.png",
      maskKey: "casting-v2/library/abc-mask.png",
      digest: "a".repeat(64),
      geometry,
      guard,
    },
    ...overrides,
  };
}

function reasonOf(row: ReferenceRowToRecord): string {
  try {
    assertReferenceRowShape(row);
  } catch (error) {
    if (error instanceof ReferenceLibraryShapeError) return error.reason;
    return `unexpected: ${String(error)}`;
  }
  return "accepted";
}

describe("the keys the library will hold", () => {
  /*
    THE WHOLE DIFFERENCE BETWEEN THIS TABLE AND THE UNDO LEDGER is that the
    ledger's key does not parse here. `makeup@face skin` is a real production
    key from the other store; letting one in would make the library a second
    copy of the ledger under a cleaner name.
  */
  it("refuses a ledger key", () => {
    expect(reasonOf(crop({ slot: "makeup@face skin" }))).toBe("slotNotAFeatureSlot");
  });

  it("takes a panel slot, plain or per instance", () => {
    expect(reasonOf(crop({ slot: "hair" }))).toBe("accepted");
    expect(reasonOf(crop({ slot: "eye@left" }))).toBe("accepted");
  });

  /*
    AND BOUND (c) — AN OPEN KIND'S CROP IS AN ORDINARY LIBRARY ROW
    (`OPEN_LANE_CARRY_DESIGN.md` §6, executing fable-760 §2c).

    The whole reason the ruling synthesized a key rather than inventing a second
    carrier is that an open crop then rides this door like everything else:
    minted at delivery, digested, frozen, purged with its candidate. So this
    door has to take one.

    **The multi-word key is why the normalizer kebabs (fable-775 §3).**
    `readKind` accepts up to three space-separated words, and this gate is
    `parseSlot`, which refuses any key containing a space. Minted as
    `open:cat ears` the crop is refused HERE, at the database, after the render
    has been paid for — and a kind whose crop never mints re-rolls on every
    later render, which is fable-566's defect arriving through the one bound
    written to prevent it. It was found on `cat ears` because every specimen
    this lane was reasoned on was one word.

    So the key is a single token and this door needs no space-tolerance at all.
    The control below is the half that must keep FAILING: a spaced key is still
    refused, so the grammar was left untouched rather than loosened.
  */
  it("takes an open kind's key in the single-token form the normalizer mints", () => {
    expect(reasonOf(crop({ slot: "open:horns" }))).toBe("accepted");
    expect(reasonOf(crop({ slot: "open:cat-ears" }))).toBe("accepted");
    expect(reasonOf(crop({ slot: "open:third-eye" }))).toBe("accepted");
    expect(reasonOf(crop({ slot: "open:elf-ears" }))).toBe("accepted");
  });

  it("and still refuses a spaced key — the grammar was not loosened", () => {
    /* The negative control kept after the positive passes. If this ever reads
       `accepted`, `parseSlot` has been widened and the ledger key two tests up
       is one edit away from being admitted too. */
    expect(reasonOf(crop({ slot: "open:cat ears" }))).toBe("slotNotAFeatureSlot");
  });

  /*
    INK NEVER ENTERS THIS TABLE — fable-1137 §3 as a DOOR rather than a ruling.

    The arm above is the reason this one has to exist. `open:horns` is
    `accepted` because `parseSlot` reads it as a feature with no space and no
    `@` — and `ink:neck` has exactly the same shape, so the rule that catches a
    ledger key is silent on precisely the key the ruling forbids. Without its
    own line the answer would be `accepted`, arrived at by nobody.

    The design's bytes have a durable home of their own with a digest and a
    purge path; a copy here is the second list that drifts from a source of
    truth, and what would drift is a customer's design.
  */
  it("refuses an ink design — the library never holds one", () => {
    expect(reasonOf(crop({ slot: "ink:neck" }))).toBe("slotNeverEntersTheLibrary");
    expect(reasonOf(crop({ slot: "ink:upperArm@left" }))).toBe("slotNeverEntersTheLibrary");
    expect(reasonOf(crop({ slot: "ink:upperChest" }))).toBe("slotNeverEntersTheLibrary");
    /* Her own word for a surface nobody measured is refused by the SAME rule,
       not by falling through to the grammar one — the reason is the namespace,
       never the vocabulary. */
    expect(reasonOf(crop({ slot: "ink:sleeve" }))).toBe("slotNeverEntersTheLibrary");
  });

  it("says WHY, in a sentence naming the design's own home", () => {
    /* The positive control on the arm above: a refusal whose detail said
       nothing would be indistinguishable from the grammar refusing it by
       accident, which is the outcome this door exists to replace. */
    try {
      assertReferenceRowShape(crop({ slot: "ink:neck" }));
      expect.unreachable("an ink key must not pass the library door");
    } catch (error) {
      expect(error).toBeInstanceOf(ReferenceLibraryShapeError);
      expect((error as Error).message).toContain("the library never holds one");
      expect((error as Error).message).toContain("purge path");
    }
  });
});

describe("what a row of each role may hold", () => {
  it("refuses an anchor with no image — a frozen reference is a picture", () => {
    expect(reasonOf(crop({ role: "anchor", tier: "item", image: undefined })))
      .toBe("anchorWithoutImage");
  });

  it("refuses an anchor carrying a bbox or a mask — it was never cut", () => {
    expect(reasonOf(crop({
      role: "anchor",
      tier: "item",
      image: { storageKey: "flash-sheet.png", digest: "b".repeat(64), geometry },
    }))).toBe("anchorIsNotACut");
    expect(reasonOf(crop({
      role: "anchor",
      tier: "item",
      image: { storageKey: "flash-sheet.png", maskKey: "cut.png", digest: "b".repeat(64) },
    }))).toBe("anchorIsNotACut");
  });

  it("takes an uploaded anchor: an image, no geometry, no guard reading", () => {
    expect(reasonOf(crop({
      role: "anchor",
      tier: "item",
      image: { storageKey: "flash-sheet.png", digest: "b".repeat(64) },
    }))).toBe("accepted");
  });

  /*
    §3.0a: a surface is carried by words, always. fable-195's carve-out is the
    OTHER role — an uploaded makeup reference is a legal anchor — so both arms
    are asserted here rather than one, because a refusal that swallowed the
    carve-out would make an uploaded look impossible to store.
  */
  it("refuses a minted crop for a surface, and allows an uploaded anchor for one", () => {
    expect(reasonOf(crop({ slot: "skin", tier: "surface", noun: "skin" })))
      .toBe("surfaceCarriesCrop");
    expect(reasonOf(crop({
      slot: "skin",
      tier: "surface",
      noun: "skin",
      role: "anchor",
      image: { storageKey: "the-look.png", digest: "c".repeat(64) },
    }))).toBe("accepted");
  });

  it("takes a words-only row for a surface", () => {
    expect(reasonOf(crop({
      slot: "skin",
      tier: "surface",
      noun: "skin",
      words: ["a warm even tan"],
      image: undefined,
    }))).toBe("accepted");
  });

  it("takes a words-only row for anatomy nothing has delivered yet", () => {
    expect(reasonOf(crop({ image: undefined }))).toBe("accepted");
  });
});

describe("what a stored crop must be able to say about itself", () => {
  it("refuses a crop with no completeness reading", () => {
    expect(reasonOf(crop({
      image: { storageKey: "crop.png", maskKey: "mask.png", digest: "d".repeat(64), geometry },
    }))).toBe("cropWithoutGuard");
  });

  it("refuses a crop with no frame", () => {
    expect(reasonOf(crop({
      image: { storageKey: "crop.png", maskKey: "mask.png", digest: "d".repeat(64), guard },
    }))).toBe("cropWithoutGeometry");
  });

  /* The panel shows a CUTOUT and the recipe sends the RECTANGLE (§5.1). A crop
     stored without its mask can be sent and never shown, and its coverage
     reading could never be re-measured against anything. */
  it("refuses a crop with no mask", () => {
    expect(reasonOf(crop({
      image: { storageKey: "crop.png", digest: "d".repeat(64), geometry, guard },
    }))).toBe("cropWithoutMask");
  });

  it("refuses an image with no digest — the byte-identity refusal reads it", () => {
    expect(reasonOf(crop({
      image: { storageKey: "crop.png", maskKey: "mask.png", digest: "  ", geometry, guard },
    }))).toBe("imageWithoutDigest");
  });

  /* The mislabelled-frame class: a box that leaves its own frame was measured
     against a different picture, and every later reader inherits the mistake. */
  it("refuses a bbox that falls outside its own frame", () => {
    expect(() => assertReferenceRowShape(crop({
      image: {
        storageKey: "crop.png",
        maskKey: "mask.png",
        digest: "e".repeat(64),
        geometry: {
          bbox: { x: 900, y: 20, width: 300, height: 80 },
          frame: { width: 1024, height: 1536 },
        },
        guard,
      },
    }))).toThrow(/outside its own frame/);
  });
});

/*
  THE REFUSED CROP'S OWN DOOR (migration 0029).

  These columns exist so a picture nobody has certified can be opened by a human
  and can never be handed to the painter. Each rule below is one way that stops
  being true — and the closest legal row to each one has to pass, or the rule is
  just an outage nobody has hit yet.
*/
describe("what a refused crop may say about itself", () => {
  const refused = (overrides: Partial<ReferenceRowToRecord> = {}): ReferenceRowToRecord => crop({
    image: undefined,
    refusal: { reason: "noSpecimen", kind: "earring", coverage: 9560 },
    slot: "earring@left",
    noun: "left earring",
    ...overrides,
  });

  const keptCrop = {
    contentKey: "casting-v2/library/x-refused.png",
    maskKey: "casting-v2/library/x-refused-mask.png",
    geometry,
  };

  it("takes a refusal that keeps its pixels, both keys and its box", () => {
    expect(reasonOf(refused({
      refusal: { reason: "noSpecimen", kind: "earring", coverage: 9560, crop: keptCrop },
    }))).toBe("accepted");
  });

  /* The mislabelled-frame class again, on the refused side of the door. The
     stored mask is written at the box's own size, so a box measured against a
     different picture puts her hoop somewhere she never wore one. */
  it("refuses a kept crop whose box leaves its own frame", () => {
    expect(() => assertReferenceRowShape(refused({
      refusal: {
        reason: "noSpecimen",
        kind: "earring",
        coverage: 9560,
        crop: {
          ...keptCrop,
          geometry: {
            bbox: { x: 900, y: 20, width: 300, height: 80 },
            frame: { width: 1024, height: 1536 },
          },
        },
      },
    }))).toThrow(/outside its own frame/);
  });

  it("takes a refusal that recorded no reading at all", () => {
    /* `readDidNotSettle` is the one refusal with no number. A zero here would be
       a measurement nobody made. */
    expect(reasonOf(refused({ refusal: { reason: "readDidNotSettle", kind: "earring" } }))).toBe("accepted");
  });

  it("refuses a reason the guard cannot produce", () => {
    expect(reasonOf(refused({
      refusal: { reason: "tooSmall" as never, kind: "earring" },
    }))).toBe("refusalNotAReason");
  });

  it("refuses a refusal that names no specimen family", () => {
    /* The number would be adopted as a KIND's positive specimen, and a slot is
       not a kind: `earring@left` is one hoop, `earring` is what complete looks
       like for hoops. */
    expect(reasonOf(refused({ refusal: { reason: "noSpecimen", kind: "  " } }))).toBe("refusalNotAReason");
  });

  it("refuses a row that is both delivered and refused", () => {
    expect(reasonOf(crop({
      refusal: { reason: "underCaptured", kind: "hair", coverage: 1250 },
    }))).toBe("refusedAndDelivered");
  });

  it("takes a DISPUTED delivery's crop, which is the other refusal a human settles", () => {
    /* fable-220 §3. The reader said the ask did not land and the crop is the only
       thing that can say whether it was the reader or the painter that was wrong
       — so these pixels go in the same column group, under their own reason. */
    expect(reasonOf(refused({
      slot: "lips",
      noun: "lips",
      refusal: { reason: "disputedDelivery", kind: "lips", coverage: 8870, crop: keptCrop },
    }))).toBe("accepted");
  });

  it("takes a crop of a shape the instrument cannot score (fable-224)", () => {
    /* Two-thirds of a hoop is its own outline, so no coverage number divides
       anything on it. The pixels are kept because an EYE can still say whether
       the crop is the whole of the visible metal. */
    expect(reasonOf(refused({
      refusal: { reason: "notScorableByArea", kind: "earring", coverage: 6520, crop: keptCrop },
    }))).toBe("accepted");
  });

  /* Only the refusals a HUMAN settles keep pixels — `noSpecimen`, which produces
     the specimen, `disputedDelivery`, which settles reader against painter, and
     `notScorableByArea`, where only an eye can judge the shape at all. Keeping a
     `subjectAbsent` crop would store a picture of where the thing would have
     been and put it in front of the one person able to adopt it. Every other
     reason is enumerated here so a new one cannot arrive quietly carrying
     pixels. */
  it("refuses keeping the pixels of any other refusal", () => {
    const notKept = GUARD_REFUSAL_REASONS
      .filter((reason) => !refusalKeepsItsCrop(reason));
    expect(notKept).toEqual([
      "subjectAbsent", "readDidNotSettle", "underCaptured", "duplicateOfSlot",
      /* `mouthOpen` keeps nothing DELIBERATELY, and it is the one whose pixels
         are tempting: `lips` has no specimen, so a kept smiling crop would
         become the candidate the lips bar is derived from (fable-493). */
      "mouthOpen",
      /* THE OPEN LANE'S TWO, and they keep nothing for the same reason
         `subjectAbsent` does not (OPEN_LANE_DESIGN_NOTE §4, step 3). Both are
         refusals of a crop nobody can say contains its subject: one because the
         reader answered on a frame WITHOUT the thing, one because the control
         could not be run at all. A kept crop is one a human may adopt as a
         specimen, and a gallery of maybe-nothing is exactly what that door
         exists to prevent. `noSpecimen` keeps its pixels because the crop can
         TEACH the bar; here there is no bar being taught. */
      "absenceUnproven", "absenceUnread",
    ]);
    for (const reason of notKept) {
      expect(reasonOf(refused({
        refusal: {
          reason,
          kind: "hair",
          coverage: 1250,
          crop: { contentKey: "a.png", maskKey: "a-mask.png", geometry },
        },
      })), reason).toBe("refusedCropIsNotAdoptable");
    }
  });

  it("refuses half a kept crop", () => {
    expect(reasonOf(refused({
      refusal: {
        reason: "noSpecimen",
        kind: "earring",
        coverage: 9560,
        crop: { contentKey: "a.png", maskKey: "   ", geometry },
      },
    }))).toBe("refusedCropWithoutMask");
  });

  it("refuses a refusal on an anchor — an upload never passes the guard", () => {
    expect(reasonOf(refused({
      role: "anchor",
      image: {
        storageKey: "casting-v2/library/anchor.png",
        digest: "b".repeat(64),
      },
      refusal: { reason: "noSpecimen", kind: "earring" },
    }))).toBe("anchorIsNotGuarded");
  });

  it("refuses a refusal on a surface — a surface is never cut at all", () => {
    expect(reasonOf(refused({
      slot: "skin",
      tier: "surface",
      noun: "skin",
      refusal: { reason: "noSpecimen", kind: "face skin" },
    }))).toBe("surfaceWasNeverCut");
  });
});

describe("the schema's own paragraph about the kept pixels", () => {
  /*
    WHY A DOCBLOCK ARM, AND WHY HERE.

    `drizzle/schema.ts` said the write helper keeps those two keys on
    `noSpecimen` ALONE. It never has: the rule below is `refusalKeepsItsCrop`,
    and four reasons answer yes to it. The sentence was true when `noSpecimen`
    was the only one and did not move when `disputedDelivery` and
    `brokenOutline` joined.

    It is not a harmless stale line, which is why it is held rather than just
    fixed. Production holds exactly ONE row in that column group and its reason
    is `disputedDelivery` — so the schema told anyone reading it that the live
    row breaches the write helper's own shape rule. #2565 §3 sends the builder
    of kept items to that very paragraph to learn the store's shape.

    The arm lives beside the enforcement it describes rather than beside the
    schema, because `assertReferenceRowShape` is what the sentence is ABOUT and
    this suite already imports the table it must agree with. Same
    derive-never-mirror exception the catalogue's header arm takes: the fact
    under test IS that a particular sentence agrees with a particular table.
  */
  const ANCHOR = "AND IT IS NOT `noSpecimen` ALONE";

  const schemaProse = (): string => readFileSync(
    new URL("../../drizzle/schema.ts", import.meta.url),
    "utf8",
  )
    .replace(/^\s*\*\s?/gm, "")
    .replace(/\s+/g, " ");

  /* The paragraph, sliced out by its own heading. A whole-file `toContain`
     would pass on any other docblock in a 5,000-line schema that happened to
     name the same reason, so the anchor is asserted UNIQUE before it is used
     to cut. */
  const paragraph = (): string => {
    const prose = schemaProse();
    const at = prose.indexOf(ANCHOR);
    expect(at, "the paragraph's anchor is missing from drizzle/schema.ts").toBeGreaterThan(-1);
    expect(prose.indexOf(ANCHOR, at + 1), "the anchor is not unique, so the slice is ambiguous").toBe(-1);
    return prose.slice(at, prose.indexOf("The write helper enforces the shape MySQL cannot", at));
  };

  it("names every refusal that keeps its crop, and names no other", () => {
    const named = [...paragraph().matchAll(/`([A-Za-z]+)`/g)]
      .map((match) => match[1]!)
      .filter((word) => (GUARD_REFUSAL_REASONS as readonly string[]).includes(word));
    expect(new Set(named)).toEqual(new Set(REFUSALS_THAT_KEEP_THEIR_CROP));
    /* The negative half, so this is a bar rather than a tautology: a reason
       that does NOT keep its crop must not be sitting in the list. */
    for (const name of named) expect(refusalKeepsItsCrop(name as never)).toBe(true);
  });

  it("holds both of the paragraph's numbers equal to the table", () => {
    /* Written as words, which is how the paragraph reads; the map is derived
       from the counts rather than the counts from the map. */
    const WORDS = [
      "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
      "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
    ];
    const keeping = WORDS[REFUSALS_THAT_KEEP_THEIR_CROP.length];
    const all = WORDS[GUARD_REFUSAL_REASONS.length];
    expect(keeping, "more refusal reasons than this arm can spell").toBeDefined();
    expect(all, "more refusal reasons than this arm can spell").toBeDefined();
    expect(paragraph().toLowerCase()).toContain(`**${keeping}** of its **${all}** reasons`);
  });

  it("is still describing a rule the write helper actually applies", () => {
    /*
      The RULE SENTENCE, sliced — not the whole file, and that distinction is
      the arm's own first bug: the paragraph QUOTES the stale sentence in order
      to correct it, so a file-wide `not.toContain` fails on the correction
      itself. Quoting is never declaring (the shift orders' own rule about the
      quiet-night marker, in a second place).
    */
    const prose = schemaProse();
    const at = prose.indexOf("The write helper enforces the shape MySQL cannot");
    expect(at, "the rule sentence is missing").toBeGreaterThan(-1);
    expect(prose.indexOf("The write helper enforces the shape MySQL cannot", at + 1)).toBe(-1);
    const rule = prose.slice(at, at + 220);
    expect(rule).not.toContain("keys only on `noSpecimen`");
    expect(rule).toContain("keys only on a reason in `REFUSALS_THAT_KEEP_THEIR_CROP`");
    /* And if somebody ever re-narrows the helper to one reason, this says so
       rather than letting the prose go wrong in the other direction. */
    expect(REFUSALS_THAT_KEEP_THEIR_CROP.length).toBeGreaterThan(1);
  });

  it("holds the refusedReason column's own count too", () => {
    const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven",
      "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen"];
    const prose = schemaProse();
    const at = prose.indexOf("One of `referenceCompleteness.ts`'s");
    expect(at, "the refusedReason column's sentence is missing").toBeGreaterThan(-1);
    expect(prose.slice(at, at + 90))
      .toContain(`'s ${WORDS[GUARD_REFUSAL_REASONS.length]} reasons`);
  });
});
