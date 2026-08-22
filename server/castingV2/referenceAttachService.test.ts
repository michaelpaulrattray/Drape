/**
 * THE ATTACH, DRIVEN DIRECTLY — the doors, and the ORDER.
 *
 * The order is the half that goes wrong invisibly, and it is the half a
 * green suite has hidden before: manifest, then bytes, then row. If the bytes
 * land before the receipt exists, a crash between the two leaves **a photograph
 * of a person at a permanently public URL that nothing will ever go looking
 * for.** So the sequence is asserted as a sequence — recorded calls in order —
 * rather than by checking that each one happened.
 *
 * Working law 3: every arm here is driven with the service's own inputs and a
 * fake storage seam. Nothing is proven through a model, a bucket or a database.
 */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import sharp from "sharp";

import {
  REFERENCE_PICTURES_PER_CANDIDATE,
  REFERENCE_ATTACHMENT_KEY_PREFIX,
  referenceAttachBytesRefusal,
  referenceAttachmentKey,
} from "./referenceAttachDoor";
import { INK_DESIGNS_PER_CANDIDATE, INK_DESIGN_MIN_EDGE } from "./inkUploadDoor";
import {
  attachReference,
  type ReferenceAttachDependencies,
} from "./referenceAttachService";
import type { ReferenceAttachmentToRecord } from "../db/castingV2ReferenceAttachments";

/** A real PNG, because the door decodes rather than believing a claim. */
async function png(size = 512): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 20, g: 20, b: 20 } },
  }).png().toBuffer();
}

type Recorder = {
  calls: string[];
  stored: Array<{ key: string; bytes: Buffer; contentType: string }>;
  recorded: ReferenceAttachmentToRecord[];
  manifested: string[][];
  manifestIds: string[];
  dependencies: ReferenceAttachDependencies;
};

function recorder(overrides: Partial<ReferenceAttachDependencies> = {}): Recorder {
  const calls: string[] = [];
  const stored: Recorder["stored"] = [];
  const recorded: ReferenceAttachmentToRecord[] = [];
  const manifested: string[][] = [];
  const manifestIds: string[] = [];
  const dependencies: ReferenceAttachDependencies = {
    manifest: async (input) => {
      calls.push("manifest");
      manifested.push([...input.storageKeys]);
      /* The RECEIPT's own id, kept so the arm below can compare it against the
         one the row write is handed — see that arm for what it cost not to. */
      manifestIds.push(input.id);
    },
    store: async (input) => {
      calls.push("store");
      stored.push(input);
      return { key: input.key, url: `https://example.invalid/${input.key}` };
    },
    record: async (input) => {
      calls.push("record");
      recorded.push(input);
      return {
        publicId: "attachment-public-id",
        provenance: input.provenance,
        width: input.width,
        height: input.height,
      };
    },
    ...overrides,
  };
  return { calls, stored, recorded, manifested, manifestIds, dependencies };
}

const REQUEST = {
  userId: 7,
  candidatePublicId: "cast-public-id",
  provenance: "consented" as const,
};

describe("attachReference — the order", () => {
  it("registers the purge receipt BEFORE the bytes, and the row last", async () => {
    /*
      THE ARM THIS FILE EXISTS FOR. Asserted as a SEQUENCE: `toEqual` on the
      whole call list fails if two steps swap, where three separate
      "was it called" checks would pass on any ordering at all.
    */
    const seam = recorder();
    const outcome = await attachReference({ ...REQUEST, bytes: await png() }, seam.dependencies);
    expect(outcome.ok).toBe(true);
    expect(seam.calls).toEqual(["manifest", "store", "record"]);
  });

  it("names the exact key it is about to write in the manifest — not a prefix, not a guess", async () => {
    /* A receipt naming a different key is a receipt for nothing: the worker
       would collect an object that was never written and leave the one that
       was. */
    const seam = recorder();
    await attachReference({ ...REQUEST, bytes: await png() }, seam.dependencies);
    expect(seam.manifested).toHaveLength(1);
    expect(seam.manifested[0]).toEqual([seam.stored[0]?.key]);
    expect(seam.stored[0]?.key).toMatch(new RegExp(`^${REFERENCE_ATTACHMENT_KEY_PREFIX}/`));
  });

  it("stores the bytes GIVEN — no re-encode, and the digest is of those same bytes", async () => {
    /*
      Copy, never pointer, and never a re-encode: the digest means byte
      identity later, which is what lets a reference whose bytes have moved be
      refused rather than painted.
    */
    const bytes = await png();
    const seam = recorder();
    await attachReference({ ...REQUEST, bytes }, seam.dependencies);
    expect(seam.stored[0]?.bytes).toBe(bytes);
    expect(seam.recorded[0]?.digest).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(seam.recorded[0]?.byteSize).toBe(bytes.byteLength);
  });

  it("carries the SHARED cap into the statement that enforces it", async () => {
    /* The cap spans two stores, so it cannot be counted here — what this
       proves is that the number reaching the transaction is the shared one and
       not a second constant. */
    const seam = recorder();
    await attachReference({ ...REQUEST, bytes: await png() }, seam.dependencies);
    expect(seam.recorded[0]?.cap).toBe(REFERENCE_PICTURES_PER_CANDIDATE);
    expect(REFERENCE_PICTURES_PER_CANDIDATE).toBe(INK_DESIGNS_PER_CANDIDATE);
  });

  it("⚠ HANDS THE ROW THE RECEIPT — the same batch id the manifest was given", async () => {
    /*
      THE DEFECT THIS ARM EXISTS FOR, and it shipped: the id was minted, given
      to the manifest, and **never passed to the row**. Nothing discharged, the
      cleanup worker collected every picture a customer had attached exactly as
      designed, and the ROW SURVIVED POINTING AT NOTHING. Found 2026-08-22 by
      building the route that shows her the picture and getting `NoSuchKey` from
      a live row's own storage key.

      The file's own docblock had always specified it — *"4. the ROW, which
      discharges the manifest in its own transaction"* — and the sweep that
      polices this class asked only whether the file MENTIONED the id, which it
      did, twice, while handing it nowhere.

      Asserted as an EQUALITY between the two seams rather than as "a batch id
      is present": a row handed some other id would discharge a manifest that
      holds nothing and leave this one to collect the picture, which is the same
      defect wearing a passing test.
    */
    const seam = recorder();
    await attachReference({ ...REQUEST, bytes: await png() }, seam.dependencies);
    expect(seam.manifestIds).toHaveLength(1);
    expect(seam.recorded[0]?.cleanupBatchId).toBe(seam.manifestIds[0]);
    /* And it is a real id rather than an empty string satisfying an equality. */
    expect(seam.manifestIds[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("takes the owner from the request and never writes an intent", async () => {
    /* invariant 3 at this seam, and the absence that the migration argues for:
       nothing is extracted at attach time, so nothing here may claim an ask. */
    const seam = recorder();
    await attachReference({ ...REQUEST, bytes: await png() }, seam.dependencies);
    expect(seam.recorded[0]?.userId).toBe(REQUEST.userId);
    expect(seam.recorded[0]?.candidatePublicId).toBe(REQUEST.candidatePublicId);
    expect(Object.keys(seam.recorded[0] ?? {})).not.toContain("intents");
  });
});

describe("attachReference — a refusal costs nothing", () => {
  it("writes no manifest, no bytes and no row when the picture is unreadable", async () => {
    /*
      THE NEGATIVE CONTROL FOR THE ORDER. A door that refuses after the receipt
      is written leaves an undischarged hold on a key nothing will ever fill —
      harmless, but it means the refusal reached storage, which is the property
      being claimed.
    */
    const seam = recorder();
    const outcome = await attachReference(
      { ...REQUEST, bytes: Buffer.from("this is not a picture") },
      seam.dependencies,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.code).toBe("unreadable");
    expect(seam.calls).toEqual([]);
  });

  it("refuses a picture too small to become a crop, before any byte moves", async () => {
    const seam = recorder();
    const outcome = await attachReference(
      { ...REQUEST, bytes: await png(INK_DESIGN_MIN_EDGE - 1) },
      seam.dependencies,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.code).toBe("tooSmall");
    expect(seam.calls).toEqual([]);
  });
});

describe("the attach door's own decisions", () => {
  it("judges the format by what the BYTES are — there is no field for a claim", async () => {
    /* A PDF named .png is a PDF at this door: the refusal function takes a
       decoding, never a declared mime and never a filename. */
    expect(referenceAttachBytesRefusal({ byteSize: 10, decoded: { format: "pdf", width: 900, height: 900 } }))
      .toEqual({ code: "unsupportedFormat", message: expect.any(String) });
    expect(referenceAttachBytesRefusal({ byteSize: 10, decoded: null })?.code)
      .toBe("unreadable");
  });

  it("admits an ordinary photograph — the carve-out, kept beside the refusals", async () => {
    /* Working law 2: a door proven only in the direction it was written for is
       how a guard ends up refusing everybody. */
    expect(referenceAttachBytesRefusal({
      byteSize: 2_000_000,
      decoded: { format: "jpeg", width: 3000, height: 4000 },
    })).toBeNull();
  });

  it("names every object under one prefix, with a random name and never Math.random", async () => {
    /*
      The object sits at a permanently public URL and the NAME is the only thing
      between it and a stranger — and on this road the stranger would be looking
      at a photograph of a person. Two keys minted in a row must differ.
    */
    const first = referenceAttachmentKey("png");
    const second = referenceAttachmentKey("png");
    expect(first).not.toBe(second);
    expect(first).toMatch(new RegExp(`^${REFERENCE_ATTACHMENT_KEY_PREFIX}/[0-9a-f-]{36}\\.png$`));
    /* jpeg gets the conventional extension rather than the decoder's word. */
    expect(referenceAttachmentKey("jpeg")).toMatch(/\.jpg$/);
  });
});
