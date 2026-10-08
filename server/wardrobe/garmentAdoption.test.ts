/**
 * #1961 — A GARMENT OWNS THE PICTURES ON ITS ROW (the relay's finding on PR
 * #1979).
 *
 * The finding, verbatim: *"`import` writes the swept URLs into a garment …
 * about 5 minutes after detect, the garment's images point at nothing. A
 * customer who imports after 5 minutes feeds a deleted URL into the paid
 * digitize."*
 *
 * ⚠ **THE CLAIM UNDER TEST IS NOT "A COPY HAPPENED" — IT IS THAT THE ROW
 * CARRIES THE GARMENT'S OWN KEY AND NEVER THE SCRATCH ONE.** A suite that
 * asserted a copy was made would pass on the bug that matters most: copy the
 * bytes, then write the scratch URL onto the row anyway. Every arm below reads
 * what the row would be given.
 *
 * ⚠ **AND THE ORDER IS A CLAIM OF ITS OWN**, as it is for
 * {@link putWardrobeScratchUpload}: the destination is registered BEFORE the
 * bytes are copied, so a crash between the two leaves a manifest naming an
 * object that may not exist — which the worker handles — and never bytes that
 * nothing names. The recorder writes one sequence and the arms read it.
 */
import { describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";
import { storageCleanupBatchIsHeld } from "../db/storageCleanup";
import {
  GARMENT_PICTURE_NOT_YOURS,
  GarmentPictureNotYoursError,
  adoptGarmentPicture,
  adoptGarmentPictures,
  garmentOwnedKey,
  garmentRowPictures,
  importPictureChoice,
  wardrobeAdoptableKey,
  type GarmentAdoptionDeps,
} from "./garmentAdoption";
import { WARDROBE_SCRATCH_HOLD_MS, wardrobeScratchHeldUntil } from "./scratchUpload";

/* #741 — the suite shares one disk with 275 others. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const PUBLIC_URL = "https://pub-abc.r2.dev";

function recorder(options: { registerThrows?: boolean; copyThrows?: boolean } = {}) {
  const order: string[] = [];
  const registered: Array<{ id: string; userId: number; storageKey: string; operationId: string }> = [];
  const copied: Array<{ sourceKey: string; destinationKey: string }> = [];

  const deps: GarmentAdoptionDeps = {
    registerManifest: async (input) => {
      order.push(`register:${input.storageKey}`);
      if (options.registerThrows) throw new Error("Data truncated for column 'kind'");
      registered.push(input);
    },
    copy: async (input) => {
      order.push(`copy:${input.sourceKey}->${input.destinationKey}`);
      if (options.copyThrows) throw new Error("Storage copy verification failed");
      copied.push(input);
      return { key: input.destinationKey, url: `${PUBLIC_URL}/${input.destinationKey}` };
    },
  };

  return { deps, order, registered, copied };
}

describe("a garment's pictures are its own (#1961)", () => {
  it("registers the destination BEFORE it copies — the order, not two calls", async () => {
    const { deps, order, registered, copied } = recorder();
    const adopted = await adoptGarmentPicture({
      userId: 7,
      url: `${PUBLIC_URL}/7-wardrobe/decomposed/top-abc.png`,
      currentPublicUrl: PUBLIC_URL,
    }, deps);

    expect(order).toEqual([
      `register:${adopted.key}`,
      `copy:7-wardrobe/decomposed/top-abc.png->${adopted.key}`,
    ]);
    expect(registered).toHaveLength(1);
    expect(copied).toHaveLength(1);
    /* The manifest names the DESTINATION. Registering the source would promise
       the worker an object the row is about to depend on. */
    expect(registered[0].storageKey).toBe(adopted.key);
    expect(registered[0].id).toBe(adopted.cleanupBatchId);
    expect(registered[0].userId).toBe(7);
  });

  it("⚠ hands the row the GARMENT's key, never the scratch key it was cut from", async () => {
    const { deps } = recorder();
    const scratchKey = "7-wardrobe/decomposed/top-abc.png";
    const adopted = await adoptGarmentPicture({
      userId: 7,
      url: `${PUBLIC_URL}/${scratchKey}`,
      currentPublicUrl: PUBLIC_URL,
    }, deps);

    expect(adopted.key).not.toBe(scratchKey);
    expect(adopted.key).not.toContain("decomposed");
    expect(adopted.key.startsWith("7-wardrobe/garment/")).toBe(true);
    expect(adopted.url).toBe(`${PUBLIC_URL}/${adopted.key}`);
    expect(adopted.url).not.toContain(scratchKey);
  });

  it("a registration that fails REFUSES the copy — invariant 7's second clause", async () => {
    const { deps, order, copied } = recorder({ registerThrows: true });
    await expect(adoptGarmentPicture({
      userId: 7,
      url: `${PUBLIC_URL}/7-wardrobe/scan-1.png`,
      currentPublicUrl: PUBLIC_URL,
    }, deps)).rejects.toThrow("Data truncated");

    expect(copied).toEqual([]);
    expect(order.filter((step) => step.startsWith("copy:"))).toEqual([]);
  });

  it("a copy that fails yields no picture, and the manifest it left collects itself", async () => {
    const { deps, registered } = recorder({ copyThrows: true });
    await expect(adoptGarmentPicture({
      userId: 7,
      url: `${PUBLIC_URL}/7-wardrobe/scan-1.png`,
      currentPublicUrl: PUBLIC_URL,
    }, deps)).rejects.toThrow("Storage copy");

    /* The manifest IS left behind, on purpose: it names a destination that may
       or may not exist, nothing references it, and the worker takes it when the
       hold lapses. The alternative — delete the manifest on failure — is how
       half-written bytes become permanent. */
    expect(registered).toHaveLength(1);
  });

  describe("⚠ what may be adopted at all", () => {
    const refused: Array<[string, string]> = [
      ["another account's object", `${PUBLIC_URL}/8-wardrobe/decomposed/top.png`],
      ["an account whose id is a prefix of this one", `${PUBLIC_URL}/71-wardrobe/scan-1.png`],
      ["a MODEL photo, which is not a garment picture", `${PUBLIC_URL}/7-models/upload-1.png`],
      ["an account's casting object", `${PUBLIC_URL}/7-casting/candidate.png`],
      ["an external host", "https://evil.example.com/7-wardrobe/scan-1.png"],
      ["a legacy host still on the CSP allowlist", "https://files.manuscdn.com/7-wardrobe/scan-1.png"],
      ["an encoded dot-segment", `${PUBLIC_URL}/7-wardrobe/%2e%2e/8-wardrobe/scan-1.png`],
      ["not a URL at all", "7-wardrobe/scan-1.png"],
    ];

    it.each(refused)("refuses %s", async (_label, url) => {
      const { deps, order } = recorder();
      await expect(adoptGarmentPicture({
        userId: 7,
        url,
        currentPublicUrl: PUBLIC_URL,
      }, deps)).rejects.toThrow(GarmentPictureNotYoursError);
      /* ⚠ Nothing registered and nothing copied: the refusal is before the
         first side effect, so a crafted import cannot even mint a manifest. */
      expect(order).toEqual([]);
    });

    it("and the refusal says what to do, in her words", () => {
      expect(GARMENT_PICTURE_NOT_YOURS).toContain("Scan or decompose a photo again");
      expect(GARMENT_PICTURE_NOT_YOURS).not.toMatch(/manifest|storage|key|R2|bucket/i);
    });

    it("CAN FAIL — the reader driven on what it must ACCEPT, both decomposition shapes", () => {
      /*
         A refusal test whose reader refuses everything passes every arm above
         while breaking the feature. These are the three keys the product's own
         routes mint.
      */
      expect(wardrobeAdoptableKey({
        userId: 7, currentPublicUrl: PUBLIC_URL,
        url: `${PUBLIC_URL}/7-wardrobe/scan-1759900000-abc.png`,
      })).toBe("7-wardrobe/scan-1759900000-abc.png");
      expect(wardrobeAdoptableKey({
        userId: 7, currentPublicUrl: PUBLIC_URL,
        url: `${PUBLIC_URL}/7-wardrobe/decompose-1759900000-abc.png`,
      })).toBe("7-wardrobe/decompose-1759900000-abc.png");
      expect(wardrobeAdoptableKey({
        userId: 7, currentPublicUrl: PUBLIC_URL,
        url: `${PUBLIC_URL}/7-wardrobe/decomposed/item_1-abc.png`,
      })).toBe("7-wardrobe/decomposed/item_1-abc.png");
    });
  });

  it("carries the source's extension rather than spelling one", () => {
    expect(garmentOwnedKey({ userId: 7, sourceKey: "7-wardrobe/scan-1.png" })).toMatch(/\.png$/);
    expect(garmentOwnedKey({ userId: 7, sourceKey: "7-wardrobe/scan-1.webp" })).toMatch(/\.webp$/);
    /* No extension on the source, none invented on the destination. */
    expect(garmentOwnedKey({ userId: 7, sourceKey: "7-wardrobe/scan-1" })).toMatch(/[0-9a-f-]{36}$/);
  });

  it("two different pictures are two copies and two receipts", async () => {
    const { deps, copied } = recorder();
    const adopted = await adoptGarmentPictures({
      userId: 7,
      imageUrl: `${PUBLIC_URL}/7-wardrobe/decomposed/top-abc.png`,
      sourceUrl: `${PUBLIC_URL}/7-wardrobe/decompose-1.png`,
      currentPublicUrl: PUBLIC_URL,
    }, deps);

    expect(copied).toHaveLength(2);
    expect(adopted.source).not.toBeNull();
    expect(adopted.image.key).not.toBe(adopted.source?.key);
    expect(adopted.receipts).toEqual([
      adopted.image.cleanupBatchId,
      adopted.source?.cleanupBatchId,
    ]);
  });

  it("⚠ the SAME picture twice is copied ONCE — the drawer's whole-photograph road", async () => {
    /*
      `DecompositionDrawer.tsx`'s *import the whole photograph* press sends
      `cropUrl` equal to `sourceImageUrl`. Adopting per column would put two
      keys on one row for one picture: two objects for the account sweep to
      carry, two receipts, and no second picture.
    */
    const { deps, copied, registered } = recorder();
    const url = `${PUBLIC_URL}/7-wardrobe/scan-1.png`;
    const adopted = await adoptGarmentPictures({
      userId: 7, imageUrl: url, sourceUrl: url, currentPublicUrl: PUBLIC_URL,
    }, deps);

    expect(copied).toHaveLength(1);
    expect(registered).toHaveLength(1);
    expect(adopted.source).toBe(adopted.image);
    expect(adopted.receipts).toEqual([adopted.image.cleanupBatchId]);
  });

  it("one picture with no source is one receipt and no source key", async () => {
    const { deps, copied } = recorder();
    const adopted = await adoptGarmentPictures({
      userId: 7,
      imageUrl: `${PUBLIC_URL}/7-wardrobe/scan-1.png`,
      sourceUrl: undefined,
      currentPublicUrl: PUBLIC_URL,
    }, deps);

    expect(copied).toHaveLength(1);
    expect(adopted.source).toBeNull();
    expect(adopted.receipts).toEqual([adopted.image.cleanupBatchId]);
  });

  it("⚠ every manifest it registers gets a receipt, and no receipt names anything else", async () => {
    /*
      THE JOIN THE WHOLE REPAIR RESTS ON. `createGarment` discharges exactly
      what it is handed and throws on a receipt that releases nothing — so a
      registered manifest missing from `receipts` is an object the worker takes
      out from under a live row, and a receipt naming an unregistered batch is
      an import that cannot complete. Asserted as SET EQUALITY over the real
      calls rather than by counting.
    */
    const { deps, registered } = recorder();
    const adopted = await adoptGarmentPictures({
      userId: 7,
      imageUrl: `${PUBLIC_URL}/7-wardrobe/decomposed/top-abc.png`,
      sourceUrl: `${PUBLIC_URL}/7-wardrobe/decompose-1.png`,
      currentPublicUrl: PUBLIC_URL,
    }, deps);

    expect([...adopted.receipts].sort()).toEqual(registered.map((one) => one.id).sort());
  });
});

describe("⚠ what the ROW is actually given — where the defect lived", () => {
  /*
    The relay's finding, verbatim: *"`wardrobe.import` … sets `originalImageUrl:
    input.cropUrl || input.sourceImageUrl` and `sourceImageUrl` on
    `createGarment`. Those are the `decompose`/`scan` URLs and crops now
    registered as scratch."*

    So this is the arm that matters most, and it is driven on the mapping the
    route now uses rather than on a grep for the old expression.
  */
  async function adopt(choice: { imageUrl: string; sourceUrl: string | undefined }) {
    const { deps } = recorder();
    return adoptGarmentPictures({
      userId: 7, ...choice, currentPublicUrl: PUBLIC_URL,
    }, deps);
  }

  it("the crop is the garment and the photograph is its source", () => {
    expect(importPictureChoice({
      sourceImageUrl: "https://p/photo.png",
      cropUrl: "https://p/crop.png",
    })).toEqual({ imageUrl: "https://p/crop.png", sourceUrl: "https://p/photo.png" });
  });

  it("with no crop, the photograph is the garment and there is no source", () => {
    expect(importPictureChoice({ sourceImageUrl: "https://p/photo.png" })).toEqual({
      imageUrl: "https://p/photo.png",
      sourceUrl: undefined,
    });
    expect(importPictureChoice({ sourceImageUrl: "https://p/photo.png", cropUrl: undefined })).toEqual({
      imageUrl: "https://p/photo.png",
      sourceUrl: undefined,
    });
  });

  it("⚠ NO INPUT URL REACHES THE ROW — the four fields, read", async () => {
    const cropUrl = `${PUBLIC_URL}/7-wardrobe/decomposed/top-abc.png`;
    const sourceImageUrl = `${PUBLIC_URL}/7-wardrobe/decompose-1.png`;
    const adopted = await adopt(importPictureChoice({ sourceImageUrl, cropUrl }));
    const row = garmentRowPictures(adopted);

    expect(row.originalImageUrl).not.toBe(cropUrl);
    expect(row.sourceImageUrl).not.toBe(sourceImageUrl);
    /* Not merely different — the scratch keys appear NOWHERE in the row. */
    for (const value of Object.values(row)) {
      expect(String(value)).not.toContain("decomposed");
      expect(String(value)).not.toContain("decompose-1");
    }
    /* And it is the adoption, field for field. */
    expect(row).toEqual({
      originalImageUrl: adopted.image.url,
      originalImageKey: adopted.image.key,
      sourceImageUrl: adopted.source?.url,
      sourceImageKey: adopted.source?.key,
    });
  });

  it("⚠ every picture field on the row has its KEY beside it — accountDeletion reads keys", async () => {
    /*
      `accountDeletion.ts:596` takes a garment's objects from `originalImageKey`,
      `isolatedImageKey` and `sourceImageKey` — never from the URL columns. A row
      with a URL and no key is swept by nothing, which is this card's own defect
      through the other door, and is why a release alone would not have closed it.
    */
    const withSource = garmentRowPictures(await adopt({
      imageUrl: `${PUBLIC_URL}/7-wardrobe/decomposed/top-abc.png`,
      sourceUrl: `${PUBLIC_URL}/7-wardrobe/decompose-1.png`,
    }));
    expect(withSource.originalImageKey).toBeTruthy();
    expect(withSource.sourceImageKey).toBeTruthy();

    const withoutSource = garmentRowPictures(await adopt({
      imageUrl: `${PUBLIC_URL}/7-wardrobe/scan-1.png`,
      sourceUrl: undefined,
    }));
    expect(withoutSource.originalImageKey).toBeTruthy();
    /* No source picture, so no source URL either — never a URL with no key. */
    expect(withoutSource.sourceImageUrl).toBeUndefined();
    expect(withoutSource.sourceImageKey).toBeUndefined();
  });
});

describe("⚠ the hold is the customer's working window (#1961, the relay's second road)", () => {
  /*
    The relay: *"The hold is `STORAGE_CLEANUP_MANIFEST_HOLD_MS` = … 5 min … A
    5-minute sweep kills it mid-session."* These arms drive the WORKER'S OWN
    predicate against the hold this module writes, because what must be true is
    not "the constant is bigger" but "the worker cannot claim it while she is
    working".
  */
  const batch = (leaseExpiresAt: Date) => ({
    status: "processing",
    leaseToken: null,
    attemptedAt: null,
    leaseExpiresAt,
  });

  it("is a day, and a day is longer than the five minutes that was there", () => {
    expect(WARDROBE_SCRATCH_HOLD_MS).toBe(24 * 60 * 60 * 1000);
    expect(WARDROBE_SCRATCH_HOLD_MS).toBeGreaterThan(5 * 60 * 1000);
  });

  it("the worker cannot take it mid-session — the five-minute mark, driven", () => {
    const now = new Date("2026-10-08T12:00:00.000Z");
    const held = batch(wardrobeScratchHeldUntil(now));
    const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);
    expect(storageCleanupBatchIsHeld(held, fiveMinutesLater)).toBe(true);
    /* An hour in, still hers. */
    expect(storageCleanupBatchIsHeld(held, new Date(now.getTime() + 60 * 60 * 1000))).toBe(true);
  });

  it("CAN FAIL — it IS claimable once the window closes, at the boundary", () => {
    /*
      The arm above with no closing boundary would pass on a hold of a century,
      which is an orphan with extra steps — the card's own defect. The sweep
      must still come.
    */
    const now = new Date("2026-10-08T12:00:00.000Z");
    const held = batch(wardrobeScratchHeldUntil(now));
    const atTheInstant = new Date(now.getTime() + WARDROBE_SCRATCH_HOLD_MS);
    expect(storageCleanupBatchIsHeld(held, atTheInstant)).toBe(false);
    expect(storageCleanupBatchIsHeld(held, new Date(atTheInstant.getTime() + 1))).toBe(false);
    /* And one millisecond before it, still held — so the arm is reading the
       boundary and not a constant far from it. */
    expect(storageCleanupBatchIsHeld(held, new Date(atTheInstant.getTime() - 1))).toBe(true);
  });
});
