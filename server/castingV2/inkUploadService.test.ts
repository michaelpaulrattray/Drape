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
import { uploadInkDesign, type InkUploadDependencies } from "./inkUploadService";

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
        storageKey: one.storageKey,
        createdAt: new Date("2026-08-18T00:00:00Z"),
      };
    }),
    ...overrides,
  };
  return { dependencies, order, manifests, stored, recorded };
}

const ask = {
  userId: 1,
  candidatePublicId: "11111111-1111-4111-8111-111111111111",
  placement: "upperArm" as const,
  side: "left" as const,
  provenance: "consented" as const,
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

    expect(order).toEqual(["manifest", "store", "record"]);
    expect(manifests[0]!.storageKeys).toEqual([stored[0]!.key]);
    expect(manifests[0]!.userId).toBe(1);
    /* And the row is filed against THAT manifest, so committing the row is what
       releases the hold. A row filed against a different batch would leave the
       design scheduled for deletion. */
    expect(recorded[0]!.cleanupBatchId).toBe(manifests[0]!.id);
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
