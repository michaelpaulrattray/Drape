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
import { MANNEQUIN_DEFERRED_NOTE } from "../../shared/inkMannequinDeferral";

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
        /* ECHOED FROM THE INPUT, never defaulted here: the whole point of the
           column is that the recorded disposition is the one the service
           decided, and a double that answered `null` regardless would make the
           arm asserting it vacuous. */
        cutRoute: one.cutRoute,
        /* ECHOED for the same reason, one column along: this door files `null`
           because she uploaded the design rather than taking it out of a
           picture, and a double that invented one would make the arm vacuous. */
        sourceDigest: one.sourceDigest,
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
          promptDigest: "p".repeat(64),
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
    /*
      THE OFF ROAD BY DEFAULT, so every arm written before build 3a.2 keeps
      testing exactly what it tested — which is the proof that the flag is
      additive and inert rather than a claim about it.

      And `cut` THROWS rather than returning something plausible: an arm that
      reaches the cutter without meaning to should be loud, not quietly served
      by a double that agrees with whatever it was expecting.
    */
    cutEnabled: vi.fn(() => false),
    cut: vi.fn(async () => { throw new Error("the cutter was called on the OFF road"); }),
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
    /* Driven un-deferred: the subject is the ORDER of the whole road, and the
       mannequin half of it is parked rather than gone. */
    const { dependencies, order, manifests, stored, recorded } = harness({ mannequinDeferred: false });

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

/**
 * THE PARKED ROAD'S OWN TESTS, kept alive on purpose.
 *
 * The mannequin road is deferred (fable-1053 §2) and every arm below drives it
 * with `mannequinDeferred: false`. Deleting them would leave the day it resumes
 * with nothing proving how it behaves — a suite that cannot fail when its
 * subject returns is the same defect as one that cannot fail when its subject is
 * deleted, and this program has paid for that shape already (the credit-velocity
 * caps). The deferral's own arms are at the bottom of this file.
 */
describe("the plate, drawn at upload (fable-936 §2, wired fable-968 §2)", () => {
  it("mints from the design that was just filed, and says what came back", async () => {
    /* The mint is handed the design's OWN public id and this account's id —
       never the candidate, never anything from the caller's request — because
       the mint re-proves ownership in its own statement from exactly those two.
       Asserted at the wire rather than at a constant beside it (invariant 5). */
    const { dependencies, minted, recorded } = harness({ mannequinDeferred: false });

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
      mannequinDeferred: false,
      mint: async (one) => ({
        ok: true,
        reused: true,
        plate: {
          publicId: "plate-public-id",
          designPublicId: one.designPublicId,
          engine: "fal:fal-ai/nano-banana-pro",
          templateKind: "arm",
          templateDigest: "t".repeat(64),
          promptDigest: "p".repeat(64),
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
      mannequinDeferred: false,
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

/**
 * THE MANNEQUIN ROAD IS PARKED, so the upload STORES and does not DRAW
 * (founder fable-1053 §2, gated fable-1060 §1).
 *
 * The mint-on-intent ruling predates the deferral and the deferral supersedes
 * the spend: every upload was buying a fal call and ~37 seconds to draw a design
 * onto a mannequin for a road nobody is building. What it must NOT do is stop
 * keeping her design — storing is not spending, and the design is the seed the
 * road uses whenever it resumes.
 */
describe("the plate is NOT drawn while the mannequin road is deferred", () => {
  it("stores the design, files the row, and mints nothing", async () => {
    const { dependencies, order, minted } = harness();
    const outcome = await uploadInkDesign({ ...ask, bytes: await pngOf(1024, 1024) }, dependencies);

    expect(outcome.ok).toBe(true);
    /* The keeping half, unchanged — this is the assertion that stops a
       "deferral" quietly becoming a refusal. */
    expect(order).toEqual(["manifest", "store", "record"]);
    expect(minted).toEqual([]);
  });

  it("says so, rather than reporting a mint that silently did not happen", async () => {
    /* `minted: false` with no note is indistinguishable from a mint that broke,
       and the customer would be left guessing which. */
    const { dependencies } = harness();
    const outcome = await uploadInkDesign({ ...ask, bytes: await pngOf(1024, 1024) }, dependencies);
    if (!outcome.ok) throw new Error("the upload should have succeeded");
    expect(outcome.plate).toEqual({ minted: false, note: MANNEQUIN_DEFERRED_NOTE });
    expect(MANNEQUIN_DEFERRED_NOTE).toContain("Nothing was charged");
  });
});

describe("THE CUT, at the wire — build 3a.2's upload wire", () => {
  /**
   * A cutter double that hands back a design DIFFERENT from what it was given.
   *
   * Different bytes, and deliberately different DIMENSIONS, so an arm cannot
   * pass by accident on a buffer that merely happens to compare equal. The
   * point of every arm below is which of the two objects reached the store and
   * the row — asserted at the wire, on what the dependencies were actually
   * handed, never on a constant near the call.
   */
  async function cutterReturning(route: "cut" | "rideWhole", given?: Buffer) {
    const design = await sharp({
      create: { width: 300, height: 280, channels: 4, background: { r: 9, g: 9, b: 9, alpha: 1 } },
    }).png().toBuffer();
    return {
      design,
      cut: vi.fn(async (input: { userId: number; candidatePublicId: string; bytes: Buffer }) => (route === "cut"
        ? {
          ok: true as const,
          cut: {
            route: "cut" as const,
            bytes: design,
            width: 300,
            height: 280,
            inkPixels: 84000,
            personPixels: 160000,
            box: { left: 50, top: 60, width: 300, height: 280 },
            focus: null,
          },
        }
        : {
          ok: true as const,
          cut: {
            route: "rideWhole" as const,
            bytes: given ?? input.bytes,
            width: 600,
            height: 800,
            inkPixels: 0,
            personPixels: 0,
            box: null,
            focus: null,
          },
        })),
    };
  }

  it("⚠ STORES THE CUT AND NOT THE PHOTOGRAPH, and every column describes the object written", async () => {
    const bytes = await pngOf(600, 800);
    const { design, cut } = await cutterReturning("cut");
    const { dependencies, stored, recorded } = harness({ cutEnabled: () => true, cut });

    const outcome = await uploadInkDesign({ ...ask, bytes }, dependencies);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(cut).toHaveBeenCalledTimes(1);
    /* The cutter was handed HER picture — the one thing upstream of all of this. */
    expect(cut.mock.calls[0]![0]!.bytes.equals(bytes)).toBe(true);

    /* AT THE WIRE. What reached storage is the cut, and it is not her frame. */
    expect(stored).toHaveLength(1);
    expect(stored[0]!.bytes.equals(design)).toBe(true);
    expect(stored[0]!.bytes.equals(bytes)).toBe(false);

    /*
      AND THE ROW DESCRIBES THAT OBJECT. A digest of the photograph over bytes
      that are the cut is not merely dishonest — the plate mint compares the two
      and refuses on the mismatch, so this arm is load-bearing rather than tidy.
    */
    expect(recorded[0]).toMatchObject({
      byteSize: design.byteLength,
      width: 300,
      height: 280,
      digest: createHash("sha256").update(design).digest("hex"),
    });
    expect(recorded[0]!.digest).not.toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(outcome.cut).toEqual({ route: "cut" });
    expect(outcome.design.width).toBe(300);
    expect(outcome.design.height).toBe(280);
  });

  it("stores a cut as a PNG even when she uploaded a JPEG — a JPEG has no alpha to keep", async () => {
    const bytes = await sharp({
      create: { width: 600, height: 800, channels: 3, background: { r: 30, g: 30, b: 30 } },
    }).jpeg().toBuffer();
    const { cut } = await cutterReturning("cut");
    const { dependencies, stored, recorded } = harness({ cutEnabled: () => true, cut });

    const outcome = await uploadInkDesign({ ...ask, bytes }, dependencies);

    expect(outcome.ok).toBe(true);
    expect(stored[0]!.contentType).toBe("image/png");
    expect(stored[0]!.key.endsWith(".png")).toBe(true);
    expect(recorded[0]).toMatchObject({ mime: "image/png" });
  });

  it("keeps her bytes and her format UNTOUCHED when the frame rides whole", async () => {
    /*
      The `rideWhole` road must be byte-identical to the off road, or the digest
      stops meaning byte identity for exactly the population — flash sheets —
      that makes up most of what a tattoo customer uploads.
    */
    const bytes = await sharp({
      create: { width: 600, height: 800, channels: 3, background: { r: 30, g: 30, b: 30 } },
    }).jpeg().toBuffer();
    const { cut } = await cutterReturning("rideWhole");
    const { dependencies, stored, recorded } = harness({ cutEnabled: () => true, cut });

    const outcome = await uploadInkDesign({ ...ask, bytes }, dependencies);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(stored[0]!.bytes.equals(bytes)).toBe(true);
    expect(stored[0]!.contentType).toBe("image/jpeg");
    expect(recorded[0]).toMatchObject({
      mime: "image/jpeg",
      byteSize: bytes.byteLength,
      width: 600,
      height: 800,
      digest: createHash("sha256").update(bytes).digest("hex"),
    });
    expect(outcome.cut).toEqual({ route: "rideWhole" });
  });

  it("⚠ `null` and `rideWhole` are NOT the same answer — nobody looked is not a licence", async () => {
    const bytes = await pngOf(600, 800);
    const { dependencies } = harness();

    const outcome = await uploadInkDesign({ ...ask, bytes }, dependencies);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    /*
      Off, the cutter is not called at all and the answer is `null`. A surface
      that read `null` as "we checked and there was nobody in it" would be
      reading an unflipped flag as a positive licence.
    */
    expect(outcome.cut).toBeNull();
    expect(dependencies.cut).not.toHaveBeenCalled();
  });

  /**
   * THE ANSWER IS KEPT, NOT JUST RETURNED (migration 0047).
   *
   * All three dispositions used to live in a local and leave with the HTTP
   * response, so at read time a cutout, a frame that rode whole and a
   * photograph nobody looked at were indistinguishable — and fable-1137 §4's
   * containment condition, which refuses to let an unexamined design ride to a
   * render, had no fact to read.
   *
   * Asserted on the ROW THE WRITER WAS HANDED rather than on the outcome the
   * caller sees, because those are two different promises and it was the second
   * one that already existed.
   */
  it("records the disposition on the row — all three of them, each as itself", async () => {
    const bytes = await pngOf(600, 800);

    const off = harness();
    await uploadInkDesign({ ...ask, bytes }, off.dependencies);
    expect(off.recorded[0]!.cutRoute, "nobody looked").toBeNull();

    const { cut: cutter } = await cutterReturning("cut");
    const cut = harness({ cutEnabled: () => true, cut: cutter });
    await uploadInkDesign({ ...ask, bytes }, cut.dependencies);
    expect(cut.recorded[0]!.cutRoute).toBe("cut");

    const { cut: whole } = await cutterReturning("rideWhole");
    const rode = harness({ cutEnabled: () => true, cut: whole });
    await uploadInkDesign({ ...ask, bytes }, rode.dependencies);
    expect(rode.recorded[0]!.cutRoute).toBe("rideWhole");
  });

  it("REFUSES the upload on the cutter's refusal, in her words, having written NOTHING", async () => {
    const bytes = await pngOf(600, 800);
    const refusal = {
      code: "personWithoutDesign" as const,
      message: "That looks like a design on a model's arm — I can't safely take it from there.",
    };
    const { dependencies, manifests, stored, recorded } = harness({
      cutEnabled: () => true,
      cut: vi.fn(async () => ({ ok: false as const, refusal })),
    });

    const outcome = await uploadInkDesign({ ...ask, bytes }, dependencies);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    /* HER SENTENCE, unchanged — a re-worded refusal is how two surfaces come to
       say different things about one wall. */
    expect(outcome.refusal).toEqual(refusal);
    /* FREE, and free means nothing was written either — no manifest, so no
       receipt for a worker to collect and no litter to collect. */
    expect(manifests).toHaveLength(0);
    expect(stored).toHaveLength(0);
    expect(recorded).toHaveLength(0);
  });

  it("⚠ never reads her picture when a FREE DOOR would have refused it anyway", async () => {
    /*
      The cut is the first step that spends. A customer whose declared intent
      this product cannot serve should hear that rather than have her picture
      read at house expense — and the ordering is what makes that true, so it
      is asserted rather than described.
    */
    const bytes = await pngOf(600, 800);
    const { cut } = await cutterReturning("cut");
    const { dependencies } = harness({ cutEnabled: () => true, cut });

    const outcome = await uploadInkDesign(
      { ...ask, bytes, side: "centre" as const },
      dependencies,
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    /* And refused for the reason the arm is about, so it cannot pass on some
       other door quietly closing first. */
    expect(outcome.refusal.code).toBe("sideNotOnPlacement");
    expect(cut).not.toHaveBeenCalled();
  });
});
