/**
 * THE SIGN-VIEW WIRE — the tattoos a Cast really has, carried into its six
 * views as pictures of her (fable-1297 §3, countersigned fable-1303).
 *
 * `inkViewReferences.test.ts` tries the CLAUSE and `packageOrchestrator.test.ts`
 * tries the WIRE. What is left is the gathering, and it is the half where a
 * customer's tattoo can go missing: that the BRANCH decides which crops are
 * worn rather than the store, that a crop nobody wrote is skipped and named,
 * that bytes which have moved refuse rather than paint, and that a Cast with no
 * ink is untouched to the byte.
 *
 * Driven directly (working law 3): every refusal below is reachable only
 * through a whole Sign, and a backstop whose only test runs through a caller
 * that usually behaves is a backstop nothing has tested.
 */
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

/** The logger is mocked so the fields this lane writes are readable — the same
 *  shape `signFeatureWords.test.ts` uses. */
const logged: { fields: Record<string, unknown>; message: string }[] = [];
vi.mock("../logging/logger", () => {
  const record = () => (fields: unknown, message: string) => {
    logged.push({ fields: (fields ?? {}) as Record<string, unknown>, message });
  };
  return {
    createModuleLogger: () => ({
      error: record(), warn: record(), info: record(), debug: record(), fatal: record(),
    }),
  };
});

import { carriedInkCrops, type SignServiceDependencies } from "./signService";
import { pronounsForSex } from "./castPronouns";

const ARM_BYTES = Buffer.from("the arm crop's bytes");
const NECK_BYTES = Buffer.from("the neck crop's bytes");
const digestOf = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

const ARM_CROP = "11111111-1111-4111-8111-111111111111";
const NECK_CROP = "22222222-2222-4222-8222-222222222222";
const CHEST_CROP = "33333333-3333-4333-8333-333333333333";

const cropRow = (over: Record<string, unknown> = {}) => ({
  publicId: ARM_CROP,
  designPublicId: "design-1",
  slot: "ink:upperArm@left",
  storageKey: "casting-v2/candidates/7/ink-delivery/arm.png",
  digest: digestOf(ARM_BYTES),
  width: 224,
  height: 348,
  ...over,
});

const NECK_ROW = cropRow({
  publicId: NECK_CROP,
  /* The WORDS road's own delivery: real ink, no design row anywhere. It is half
     the population this lane exists for. */
  designPublicId: null,
  slot: "ink:neck",
  storageKey: "casting-v2/candidates/7/ink-delivery/neck.png",
  digest: digestOf(NECK_BYTES),
});

const bytesFor = async (key: string) => {
  if (key.endsWith("neck.png")) return { bytes: NECK_BYTES, contentType: "image/png" };
  return { bytes: ARM_BYTES, contentType: "image/png" };
};

const deps = (over: Partial<SignServiceDependencies> = {}): SignServiceDependencies => ({
  listInkDeliveryCrops: vi.fn(async () => [cropRow(), NECK_ROW] as never),
  readBytes: vi.fn(bytesFor) as never,
  ...over,
} as SignServiceDependencies);

const drive = (
  anchorDeltas: unknown,
  over: Partial<SignServiceDependencies> = {},
  sex: string | null = "male",
) => carriedInkCrops(deps(over), {
  userId: 1,
  candidatePublicId: "cand-1",
  anchorDeltas,
  pronouns: pronounsForSex(sex),
  operationId: "55555555-5555-4555-8555-555555555555",
});

const WEARING_BOTH = {
  inkDelivered: { "ink:upperArm@left": ARM_CROP, "ink:neck": NECK_CROP },
};

describe("which tattoos a signed Cast's views carry", () => {
  it("carries the crops the BRANCH names, with its own bytes and the catalogue's noun", async () => {
    const { crops, dispositions } = await drive(WEARING_BOTH);

    expect(crops.map((crop) => crop.slot)).toEqual(["ink:upperArm@left", "ink:neck"]);
    expect(crops[0]!.bytes).toEqual(ARM_BYTES);
    expect(crops[0]!.noun).toBe("left upper arm tattoo");
    expect(crops[0]!.placement).toBe("upperArm");
    expect(crops[0]!.side).toBe("left");
    /* A surface there is one of files sideless, and `centre` is the
       vocabulary's word for that — never a laterality claim nobody measured. */
    expect(crops[1]!.side).toBe("centre");
    expect(dispositions.every((one) => one.rode)).toBe(true);
  });

  it("is INERT for a Cast with no ink — and does not even ask the store", async () => {
    /*
      The control that matters most: this lane reaches every package view in the
      product. A Cast with no delivered tattoo must compose the prompt it
      composed yesterday, and a read that happens anyway is a read that can
      fail, log, and cost time on every Sign in the product.
    */
    const listInkDeliveryCrops = vi.fn(async () => [cropRow()] as never);
    expect(await drive(null, { listInkDeliveryCrops })).toEqual({ crops: [], dispositions: [] });
    expect(await drive({}, { listInkDeliveryCrops })).toEqual({ crops: [], dispositions: [] });
    /* The pristine master's own answer — no version selected, nothing worn. */
    expect(await drive({ inkDelivered: {} }, { listInkDeliveryCrops }))
      .toEqual({ crops: [], dispositions: [] });
    expect(listInkDeliveryCrops).not.toHaveBeenCalled();
  });

  it("reads the BRANCH, never the store's whole history of this Cast", async () => {
    /*
      A Cast accumulates a crop per delivering FRAME, so the store holds every
      tattoo it has ever worn. Handed the store's rows, a Cast wearing one
      tattoo would carry three — including ones a later edit took away.
    */
    const { crops } = await drive({ inkDelivered: { "ink:neck": NECK_CROP } });
    expect(crops.map((crop) => crop.slot)).toEqual(["ink:neck"]);
  });

  it("skips a crop the branch names and nobody wrote — the id points, the row decides", async () => {
    /*
      The name is minted at CLAIM and the row at DELIVERY, so a render whose ink
      never landed leaves the branch naming a row that does not exist. Skipped
      and said out loud, exactly as the panel and the refine carry do.
    */
    const { crops, dispositions } = await drive({
      inkDelivered: { "ink:upperArm@left": ARM_CROP, "ink:neck": CHEST_CROP },
    });
    expect(crops.map((crop) => crop.slot)).toEqual(["ink:upperArm@left"]);
    expect(dispositions).toContainEqual({
      slot: "ink:neck", cropPublicId: CHEST_CROP, rode: false, reason: "noRow",
    });
  });

  it("REFUSES a crop whose bytes are not the ones its row minted", async () => {
    /*
      The repaint road's third door, one lane along. Bytes that hash to anything
      else are not the tattoo this row describes, and painting them would put an
      unknown picture on a customer's body in six frames she paid for.
    */
    const { crops, dispositions } = await drive(WEARING_BOTH, {
      readBytes: (async (key: string) => (key.endsWith("arm.png")
        ? { bytes: Buffer.from("somebody else's picture"), contentType: "image/png" }
        : bytesFor(key))) as never,
    });

    expect(crops.map((crop) => crop.slot)).toEqual(["ink:neck"]);
    expect(dispositions).toContainEqual({
      slot: "ink:upperArm@left", cropPublicId: ARM_CROP, rode: false, reason: "bytesMoved",
    });
  });

  it("says bytesUnreadable when the row is there and the object is not", async () => {
    const { crops, dispositions } = await drive(WEARING_BOTH, {
      readBytes: (async (key: string) => {
        if (key.endsWith("arm.png")) throw new Error("NoSuchKey");
        return bytesFor(key);
      }) as never,
    });

    expect(crops.map((crop) => crop.slot)).toEqual(["ink:neck"]);
    expect(dispositions).toContainEqual({
      slot: "ink:upperArm@left", cropPublicId: ARM_CROP, rode: false, reason: "bytesUnreadable",
    });
  });

  it("refuses an UPPER CHEST crop its ride, and names the surface as the reason", async () => {
    /*
      One owner for *may a tattoo at this surface ride a package view* — the
      plate lane's `placementRidesPackageViews`, shared rather than copied, so
      the two lanes cannot come to disagree about the wardrobe. The chest stays
      shut until his hidden-vs-scoop word and the court that follows it
      (fable-1303 §2).
    */
    const { crops, dispositions } = await drive(
      { inkDelivered: { "ink:upperChest": CHEST_CROP } },
      {
        listInkDeliveryCrops: (async () => [cropRow({
          publicId: CHEST_CROP, slot: "ink:upperChest", storageKey: "chest.png",
        })]) as never,
      },
    );
    expect(crops).toEqual([]);
    expect(dispositions).toEqual([{
      slot: "ink:upperChest", cropPublicId: CHEST_CROP, rode: false, reason: "surfaceCovered",
    }]);
  });

  it("refuses an OPEN placement, because where it sits on a fresh view is a guess", async () => {
    /*
      Her own word for a surface nobody has measured is a legal placement on the
      EDIT road, which paints onto a frame that already shows her. A package
      view has no such anchor: there is no reader word, no ride-table entry and
      no image-half phrase, so the only thing this lane could say is a guess
      about a customer's body.
    */
    const OPEN = "44444444-4444-4444-8444-444444444444";
    const { crops, dispositions } = await drive(
      { inkDelivered: { "ink:ribcage": OPEN } },
      {
        listInkDeliveryCrops: (async () => [cropRow({
          publicId: OPEN, slot: "ink:ribcage", storageKey: "rib.png",
        })]) as never,
      },
    );
    expect(crops).toEqual([]);
    expect(dispositions).toEqual([{
      slot: "ink:ribcage", cropPublicId: OPEN, rode: false, reason: "unmeasuredPlacement",
    }]);
  });

  it("refuses a key whose SIDEDNESS the catalogue disagrees with — and that is what keeps `centre` honest", async () => {
    /*
      THE DOOR THIS LANE WOULD MISS MOST QUIETLY, and it is not a shape nobody
      can write: `upperArm` is `perSide` and `neck` is `one`, so a sideless arm
      key and a sided neck key are both nameable-looking and both refused by the
      catalogue — the placement itself is measured, so the door above this one
      lets them straight through.

      It is driven because its POSITION is load-bearing rather than tidy. A crop
      that survives to the bottom is pushed with `side: placed.side ?? "centre"`,
      and the only thing that makes that substitution safe is this refusal
      having already run: drop it, or reorder it below the wardrobe door, and a
      sideless `ink:upperArm` rides as `centre` — the prompt then says "his
      upper arm" with no side at all, on a surface there are two of. That is the
      wrong-arm defect the legacy ink road refunded 300 credits for twice
      (DECISION_LOG R7-7G), arriving through a key rather than through a reader.
    */
    for (const slot of ["ink:upperArm", "ink:neck@left"]) {
      const { crops, dispositions } = await drive(
        { inkDelivered: { [slot]: ARM_CROP } },
        {
          listInkDeliveryCrops: (async () => [cropRow({ slot })]) as never,
        },
      );
      expect(crops).toEqual([]);
      expect(dispositions).toEqual([{
        slot, cropPublicId: ARM_CROP, rode: false, reason: "unnameableSlot",
      }]);
    }
  });

  it("NEVER fails the Sign when the store will not answer", async () => {
    const { crops, dispositions } = await drive(WEARING_BOTH, {
      listInkDeliveryCrops: (async () => {
        throw new Error("the table is not there");
      }) as never,
    });
    expect({ crops, dispositions }).toEqual({ crops: [], dispositions: [] });
  });

  it("one refusal never silences a ride, and every tattoo gets a line", async () => {
    logged.length = 0;
    const { crops, dispositions } = await drive({
      inkDelivered: {
        "ink:upperArm@left": ARM_CROP,
        "ink:neck": NECK_CROP,
        "ink:upperChest": CHEST_CROP,
      },
    });

    expect(crops.map((crop) => crop.slot)).toEqual(["ink:upperArm@left", "ink:neck"]);
    expect(dispositions).toHaveLength(3);

    const line = logged.find((entry) => entry.message.includes("delivered tattoos"));
    expect(line?.fields.dispositions).toEqual(dispositions);
  });

  it("puts NO picture and NO word of hers in the log — slots and crop ids only", async () => {
    /*
      The words and the pictures are the customer's creative content, which the
      access grid keeps out of every surface that is not the engine. This line
      says WHICH tattoos rode and nothing about what they are.
    */
    logged.length = 0;
    await drive(WEARING_BOTH);
    const written = JSON.stringify(logged);
    expect(written).not.toContain("upper arm tattoo");
    expect(written).not.toContain(ARM_BYTES.toString("base64"));
    expect(written).not.toContain("ink-delivery/arm.png");
  });
});
