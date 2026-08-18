/**
 * The upload, driven end to end with fakes — everything except MySQL and R2.
 *
 * The doors are proved next door (`inkUploadDoor.test.ts`) and the statements
 * against a real database (`server/castingV2-ink-design-db.test.ts`). What is
 * proved HERE is the ORDER, which is the part that cannot be read off any one
 * function: a refusal must cost nothing, the manifest must exist before the
 * bytes it names, and the row must carry what the BYTES were rather than what
 * the caller said about them.
 */
import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { INK_DESIGN_MIN_EDGE } from "./inkUploadDoor";
import { resetInkPlateEngineForTests } from "./inkPlateEngine";
import { defaultMintPlate, uploadInkDesign, type InkUploadDependencies } from "./inkUploadService";

async function pngOf(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 20, g: 20, b: 20 } },
  }).png().toBuffer();
}

function harness(overrides: Partial<InkUploadDependencies> = {}) {
  const order: string[] = [];
  const manifests: Array<{ id: string; userId: number; storageKeys: readonly string[] }> = [];
  const stored: Array<{ key: string; bytes: Buffer; contentType: string }> = [];
  const recorded: Array<Record<string, unknown>> = [];
  const minted: Array<{ userId: number; designPublicId: string }> = [];
  const dependencies: InkUploadDependencies = {
    manifest: vi.fn(async (one) => { order.push("manifest"); manifests.push(one); }),
    store: vi.fn(async (one) => { order.push("store"); stored.push(one); return { key: one.key, url: `https://cdn.test/${one.key}` }; }),
    record: vi.fn(async (one) => {
      order.push("record");
      recorded.push(one as unknown as Record<string, unknown>);
      return {
        publicId: "design-public-id",
        candidateId: 42,
        placement: one.placement,
        side: one.side,
        provenance: one.provenance,
        intents: one.intents,
        storageKey: one.storageKey,
        createdAt: new Date("2026-08-18T00:00:00Z"),
      };
    }),
    mint: vi.fn(async (one) => {
      order.push("mint");
      minted.push(one);
      return {
        ok: true as const,
        reused: false,
        plate: {
          publicId: "plate-public-id",
          designPublicId: one.designPublicId,
          engine: "fal:fal-ai/nano-banana-pro",
          templateKind: "arm" as const,
          templateDigest: "t".repeat(64),
          storageKey: "casting/ink/plates/plate.png",
          digest: "d".repeat(64),
          mime: "image/png",
          byteSize: 1234,
          width: 1152,
          height: 1024,
          createdAt: new Date("2026-08-18T00:00:00Z"),
        },
      };
    }),
    ...overrides,
  };
  return { dependencies, order, manifests, stored, recorded, minted };
}

const ask = {
  userId: 1,
  candidatePublicId: "11111111-1111-4111-8111-111111111111",
  placement: "upperArm" as const,
  side: "left" as const,
  provenance: "consented" as const,
  intents: ["tattoo"] as const,
};

describe("attaching a design to a Cast", () => {
  it("stores the bytes, files the row, and hands back what was attached", async () => {
    const bytes = await pngOf(600, 800);
    const { dependencies, recorded, stored } = harness();

    const outcome = await uploadInkDesign({ ...ask, bytes }, dependencies);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.design.placement).toBe("upperArm");
    expect(outcome.design.side).toBe("left");
    expect(stored).toHaveLength(1);
    expect(stored[0]!.contentType).toBe("image/png");
    /* THE BYTES WE KEEP ARE THE BYTES WE WERE GIVEN — a copy, never a pointer,
       and never a re-encode nobody asked for. */
    expect(stored[0]!.bytes.equals(bytes)).toBe(true);
    expect(recorded[0]).toMatchObject({
      userId: 1,
      /* What she said she was taking, on the row — never inferred from the fact
         that this door files tattoos. */
      intents: ["tattoo"],
      candidatePublicId: ask.candidatePublicId,
      storageKey: stored[0]!.key,
      mime: "image/png",
      byteSize: bytes.byteLength,
      width: 600,
      height: 800,
      digest: createHash("sha256").update(bytes).digest("hex"),
    });
  });

  it("registers the manifest BEFORE the bytes, naming the exact key it stores", async () => {
    /*
      The failure this ordering prevents really fired on the library road: bytes
      at a permanently public key with no row referencing them, after a crash
      between the two writes. The manifest is the receipt that collects them.

      Asserted at the wire — the key in the manifest is compared to the key
      actually stored and the key actually filed, rather than to a constant
      near them (invariant 5).
    */
    const { dependencies, order, manifests, stored, recorded } = harness();

    await uploadInkDesign({ ...ask, bytes: await pngOf(512, 512) }, dependencies);

    /* And the MINT is last, after the row is committed — the only step that
       spends, and it has nothing to read until the design exists. */
    expect(order).toEqual(["manifest", "store", "record", "mint"]);
    expect(manifests[0]!.storageKeys).toEqual([stored[0]!.key]);
    expect(manifests[0]!.userId).toBe(1);
    /* And the row is filed against THAT manifest, so committing the row is what
       releases the hold. A row filed against a different batch would leave the
       design scheduled for deletion. */
    expect(recorded[0]!.cleanupBatchId).toBe(manifests[0]!.id);
  });

  it("asks what she is taking BEFORE it looks at her picture", async () => {
    /*
      The founder's catch (fable-937): a reference uploaded for the HAIR, of a
      person who happens to have tattoos. Nothing is reserved, nothing stored,
      nothing written — and the sentence names the feature rather than the
      photograph.

      Since the mint landed in this order, the empty list also carries his
      actual worry in his own words — *"we just wasted money on generating the
      tattoo onto a manequinn"* — because `mint` is one of the steps that would
      appear in it, and it is the one that spends.
    */
    const { dependencies, order } = harness();

    const outcome = await uploadInkDesign(
      { ...ask, intents: ["hair"], bytes: await pngOf(512, 512) },
      dependencies,
    );

    expect(outcome).toMatchObject({ ok: false, refusal: { code: "intentNotOpen" } });
    if (outcome.ok) return;
    expect(outcome.refusal.message).toContain("her hair");
    expect(order).toEqual([]);
  });

  it("refuses an undeclared upload before anything else can go wrong", async () => {
    /* Empty is the amendment's own line: no extraction without intent. It is
       answered ahead of a picture that is ALSO unacceptable, so the customer
       hears the thing she can act on. */
    const { dependencies, order } = harness();

    const outcome = await uploadInkDesign(
      { ...ask, intents: [], bytes: Buffer.from("not an image either") },
      dependencies,
    );

    expect(outcome).toMatchObject({ ok: false, refusal: { code: "intentMissing" } });
    expect(order).toEqual([]);
  });

  it("costs nothing at all when the door refuses", async () => {
    /* `upperArm` is a pair, so it is never `centre`. Nothing is reserved,
       nothing is stored, nothing is written — the refusal happens before the
       first byte moves. */
    const { dependencies, order } = harness();

    const outcome = await uploadInkDesign(
      { ...ask, side: "centre", bytes: await pngOf(512, 512) },
      dependencies,
    );

    expect(outcome).toMatchObject({ ok: false, refusal: { code: "sideNotOnPlacement" } });
    expect(order).toEqual([]);
  });

  it("refuses bytes that are not a picture, before reserving anything", async () => {
    const { dependencies, order } = harness();

    const outcome = await uploadInkDesign(
      { ...ask, bytes: Buffer.from("this is a text file pretending to be a tattoo") },
      dependencies,
    );

    expect(outcome).toMatchObject({ ok: false, refusal: { code: "unreadable" } });
    expect(order).toEqual([]);
  });

  it("judges the picture by its own pixels, not by a claim", async () => {
    /* One pixel under the floor on one edge. The caller says nothing about
       size; the decoder does. */
    const { dependencies, order } = harness();

    const outcome = await uploadInkDesign(
      { ...ask, bytes: await pngOf(INK_DESIGN_MIN_EDGE, INK_DESIGN_MIN_EDGE - 1) },
      dependencies,
    );

    expect(outcome).toMatchObject({ ok: false, refusal: { code: "tooSmall" } });
    expect(order).toEqual([]);
  });

  it("writes no row when the bytes never landed", async () => {
    /*
      A store that fails leaves the manifest behind, and that is the design: the
      worker collects a key that may or may not exist, and no row ever claims
      bytes that are not there. The alternative — filing the row anyway — is a
      design whose picture is a 404 at render time.
    */
    const { dependencies, order } = harness({
      store: vi.fn(async () => { throw new Error("R2 said no"); }),
    });

    await expect(uploadInkDesign({ ...ask, bytes: await pngOf(512, 512) }, dependencies))
      .rejects.toThrow(/R2 said no/);
    expect(order).toEqual(["manifest"]);
  });

  it("gives every design its own unguessable name", async () => {
    const { dependencies, stored } = harness();
    const bytes = await pngOf(512, 512);

    await uploadInkDesign({ ...ask, bytes }, dependencies);
    await uploadInkDesign({ ...ask, bytes }, dependencies);

    expect(stored[0]!.key).not.toBe(stored[1]!.key);
    /* The same picture twice is the same digest twice — byte identity, which is
       what a later reader compares a reference against. */
    expect(stored[0]!.bytes.equals(stored[1]!.bytes)).toBe(true);
  });

  it("keeps a JPEG as a JPEG", async () => {
    /* The content type follows the DECODED format, so a design is served as
       what it is. A stored-as-png lie would be a picture browsers guess at. */
    const jpeg = await sharp({
      create: { width: 512, height: 512, channels: 3, background: { r: 200, g: 30, b: 30 } },
    }).jpeg().toBuffer();
    const { dependencies, stored, recorded } = harness();

    await uploadInkDesign({ ...ask, bytes: jpeg }, dependencies);

    expect(stored[0]!.contentType).toBe("image/jpeg");
    expect(stored[0]!.key).toMatch(/\.jpg$/);
    expect(recorded[0]!.mime).toBe("image/jpeg");
  });
});

describe("the plate, drawn at upload (fable-936 §2, wired fable-968 §2)", () => {
  it("mints from the design that was just filed, and says what came back", async () => {
    /* The mint is handed the design's OWN public id and this account's id —
       never the candidate, never anything from the caller's request — because
       the mint re-proves ownership in its own statement from exactly those two.
       Asserted at the wire rather than at a constant beside it (invariant 5). */
    const { dependencies, minted, recorded } = harness();

    const outcome = await uploadInkDesign({ ...ask, bytes: await pngOf(600, 800) }, dependencies);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(minted).toEqual([{ userId: 1, designPublicId: "design-public-id" }]);
    expect(recorded).toHaveLength(1);
    expect(outcome.plate).toEqual({
      minted: true,
      plateId: "plate-public-id",
      reused: false,
      engine: "fal:fal-ai/nano-banana-pro",
      width: 1152,
      height: 1024,
    });
  });

  it("carries REUSED rather than reporting a second mint as a first", async () => {
    /* The mint is idempotent per (design, engine). A caller that could not tell
       drawn-now from already-there would read a re-drive as a second $0.15. */
    const { dependencies } = harness({
      mint: async (one) => ({
        ok: true,
        reused: true,
        plate: {
          publicId: "plate-public-id",
          designPublicId: one.designPublicId,
          engine: "fal:fal-ai/nano-banana-pro",
          templateKind: "arm",
          templateDigest: "t".repeat(64),
          storageKey: "casting/ink/plates/plate.png",
          digest: "d".repeat(64),
          mime: "image/png",
          byteSize: 1234,
          width: 1152,
          height: 1024,
          createdAt: new Date("2026-08-18T00:00:00Z"),
        },
      }),
    });

    const outcome = await uploadInkDesign({ ...ask, bytes: await pngOf(600, 800) }, dependencies);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.plate).toMatchObject({ minted: true, reused: true });
  });

  it("does NOT fail the upload when the plate refuses — her design is still hers", async () => {
    /*
      The two facts travel separately on purpose. She attached a design and it
      is stored; whether a plate was drawn from it is a second thing, and an
      upload that threw here would delete a picture she gave us over a transport
      that was down for ninety seconds.
    */
    const { dependencies, stored, recorded } = harness({
      mint: async () => ({
        ok: false,
        refusal: { code: "noTransport", message: "We can't draw designs right now." },
      }),
    });

    const outcome = await uploadInkDesign({ ...ask, bytes: await pngOf(600, 800) }, dependencies);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(stored).toHaveLength(1);
    expect(recorded).toHaveLength(1);
    /* The mint's own sentence, unchanged — not a second wording of one wall. */
    expect(outcome.plate).toEqual({ minted: false, note: "We can't draw designs right now." });
  });

  it("the REAL dependency goes through the real mint, not a double that agrees with it", async () => {
    /*
      THE WIRE, in the caller's own suite. Both benches once passed while the
      thing under them was inert, because every arm was handed its argument by
      the harness. This drives the function the upload ACTUALLY calls.

      With no `FAL_KEY` there is no transport, and the mint answers that with
      its own sentence before a database is touched — so this proves the wiring
      end to end without a network, a key or a row.
    */
    const key = process.env.FAL_KEY;
    delete process.env.FAL_KEY;
    /* The engine is memoized process-wide, and `.env` is loaded for the suite —
       so without this the arm could read an engine some earlier test built and
       pass for the wrong reason. */
    resetInkPlateEngineForTests();
    try {
      const outcome = await defaultMintPlate({ userId: 1, designPublicId: "design-public-id" });
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.refusal.code).toBe("noTransport");
    } finally {
      if (key === undefined) delete process.env.FAL_KEY;
      else process.env.FAL_KEY = key;
      resetInkPlateEngineForTests();
    }
  });
});
