import { createHash } from "node:crypto";

import sharp from "sharp";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { INK_TEMPLATES } from "./inkTemplates";
import {
  InkPlateDesignNotFound,
  mintInkPlate,
  type InkPlateMintDependencies,
} from "./inkPlateMint";
import type { InkPlateEngine } from "./inkPlateEngines";
import type { StoredInkDesign } from "../db/castingV2InkDesigns";
import type { RecordedInkPlate } from "../db/castingV2InkPlates";
import type { ImageResult } from "../providers/types";

/**
 * THE MINT'S ORDER, DRIVEN DIRECTLY.
 *
 * The doors are proved in `inkPlateDoor.test.ts` and the two engines in
 * `inkPlateEngines.test.ts`. What is proved here is the SEQUENCE, because the
 * sequence is the part that goes wrong invisibly and the part that costs money:
 *
 *   - every refusal happens BEFORE the engine is called, so a mint that cannot
 *     succeed has not already spent;
 *   - the bytes are registered for cleanup BEFORE they are written, so a crash
 *     between the two collects itself rather than littering a permanently public
 *     URL;
 *   - the row is filed LAST, and it records what was measured rather than what
 *     was claimed.
 *
 * Every dependency is injected, so none of this needs a database, a bucket or a
 * provider — which is the same reason the doors are a module.
 */
const DESIGN_BYTES = Buffer.from("a customer's photograph of a tattoo");
const DESIGN_DIGEST = createHash("sha256").update(DESIGN_BYTES).digest("hex");

const DESIGN: StoredInkDesign = {
  publicId: "design-1",
  candidateId: 7,
  placement: "upperArm",
  side: "left",
  /* NOBODY LOOKED (0047). The mint predates the cutter and is indifferent to
     the disposition — it reads bytes and a digest — so the fixture states the
     honest value rather than a convenient one. */
  cutRoute: null,
  provenance: "consented",
  intents: ["tattoo"],
  storageKey: "casting-v2/ink/design-1.png",
  digest: DESIGN_DIGEST,
  mime: "image/png",
  byteSize: DESIGN_BYTES.byteLength,
  width: 900,
  height: 900,
  createdAt: new Date("2026-08-18T00:00:00Z"),
};

/**
 * A Cast's compiled instruction, in the shape `readResolvedIdentity` accepts.
 *
 * The mint needs exactly one field out of it — the build, which picks the torso
 * blank — but it is parsed by the one owner of that parse rather than faked at
 * a shape that owner would reject, so a change to the required fields reddens
 * this file instead of leaving the mint silently reading `null`.
 */
function identityOf(sex: string): { internalPrompt: unknown } {
  return {
    internalPrompt: {
      resolved: { sex, ageBand: "twenties", energy: "calm", heritage: ["northern european"] },
    },
  };
}

/** A real 32x48 PNG, so "what the plate actually is" can be measured. */
async function drawnPlate(): Promise<ImageResult> {
  const bytes = await sharp({
    create: { width: 32, height: 48, channels: 3, background: "#ffffff" },
  }).png().toBuffer();
  return {
    bytes,
    contentType: "image/png",
    /* DELIBERATELY WRONG. `ImageResult.width` is a provider's claim; the row is
       supposed to carry what the bytes decode to. */
    width: 4096,
    height: 4096,
    latencyMs: 12,
    provenance: { provider: "fal", model: "test", providerRef: "r" },
  };
}

function recordedFrom(input: Parameters<InkPlateMintDependencies["record"]>[0]): RecordedInkPlate {
  return { ...input, publicId: "plate-1", createdAt: new Date("2026-08-18T00:01:00Z") };
}

let mint: Mock<InkPlateEngine["mint"]>;
let plateBytes: Buffer;
let engine: InkPlateEngine;
let dependencies: InkPlateMintDependencies;
let calls: string[];

beforeEach(async () => {
  const drawn = await drawnPlate();
  plateBytes = drawn.bytes;
  calls = [];
  mint = vi.fn<InkPlateEngine["mint"]>(async () => {
    calls.push("engine");
    return drawn;
  });
  engine = { id: "fal:openai/gpt-image-2/edit", mint };
  dependencies = {
    readDesign: vi.fn(async () => DESIGN),
    readCastIdentity: vi.fn(async () => identityOf("female")),
    countMissingForm: vi.fn(async () => true),
    existingPlates: vi.fn(async () => []),
    loadTemplate: vi.fn(async (template) => ({
      template,
      bytes: Buffer.from("the blank form"),
      digest: template.digest,
    })),
    fetchDesignBytes: vi.fn(async () => ({ bytes: DESIGN_BYTES, contentType: "image/png" })),
    manifest: vi.fn(async () => { calls.push("manifest"); }),
    store: vi.fn(async ({ key }) => { calls.push("store"); return { key, url: `https://x/${key}` }; }),
    record: vi.fn(async (input) => { calls.push("record"); return recordedFrom(input); }),
  };
});

function mintOne(overrides: Partial<Parameters<typeof mintInkPlate>[0]> = {}) {
  return mintInkPlate({ userId: 1, designPublicId: "design-1", engine, ...overrides }, dependencies);
}

describe("the refusals, and that each costs nothing", () => {
  it("refuses with no transport before it reads anything at all", async () => {
    const outcome = await mintOne({ engine: null });

    expect(outcome).toMatchObject({ ok: false, refusal: { code: "noTransport" } });
    /* Not merely "did not spend" — did not even look. Every read below this
       door is work bought for a call that cannot happen. */
    expect(dependencies.readDesign).not.toHaveBeenCalled();
    expect(mint).not.toHaveBeenCalled();
  });

  it("refuses a torso design with no form for the build, and spends nothing", async () => {
    /*
      DRIVEN DIRECTLY, because the only alternative is trusting that a build
      with no blank never reaches here — and a guard whose only test runs
      through the happy path is a guard nobody has tested (working law 3).

      Both halves matter: the customer gets a sentence about the MATERIAL, and
      the door fires before the template is loaded, before the design's bytes
      are fetched and before any engine call, so it costs nothing.
    */
    dependencies.readDesign = vi.fn(async () => ({ ...DESIGN, placement: "neck" as const, side: "centre" as const }));
    dependencies.readCastIdentity = vi.fn(async () => identityOf("nonbinary"));

    const outcome = await mintOne();

    expect(outcome).toMatchObject({ ok: false, refusal: { code: "noFormForBuild" } });
    expect(dependencies.loadTemplate).not.toHaveBeenCalled();
    expect(dependencies.fetchDesignBytes).not.toHaveBeenCalled();
    expect(mint).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
    /* COUNTED, at the seam it escapes from. A refusal nobody counts is a demand
       signal thrown away, and the count is the whole reason the third form ever
       gets commissioned. */
    expect(dependencies.countMissingForm).toHaveBeenCalledWith({
      kind: "torsoNonbinary", placement: "neck", outcome: "refused",
    });
  });

  it("refuses the same way when the Cast never stated a build at all — but counts it DIFFERENTLY", async () => {
    /*
      Two causes, one refusal, two demand rows — and the absent one is the
      dangerous one twice over. It must not fall through to the female blank
      (the room calling every Cast "she", with a picture attached), and it must
      not be counted as *draw a third form* when what it actually means is
      *this record is missing a field*. Collapsing them would put a data gap
      into the number that decides whether to commission artwork.
    */
    dependencies.readDesign = vi.fn(async () => ({ ...DESIGN, placement: "upperChest" as const, side: "centre" as const }));
    dependencies.readCastIdentity = vi.fn(async () => null);

    expect(await mintOne()).toMatchObject({ ok: false, refusal: { code: "noFormForBuild" } });
    expect(mint).not.toHaveBeenCalled();
    expect(dependencies.countMissingForm).toHaveBeenCalledWith({
      kind: "torsoUnstated", placement: "upperChest", outcome: "refused",
    });
  });

  it("does NOT refuse an ARM design for the same Cast — the limb serves everyone", async () => {
    /* The control on the two above. A refusal that had widened to every
       placement would pass both of them and take the whole feature away from a
       customer it was never about — and would file demand rows for a form that
       is not missing at all. */
    dependencies.readCastIdentity = vi.fn(async () => identityOf("nonbinary"));

    const outcome = await mintOne();

    expect(outcome).toMatchObject({ ok: true });
    expect(mint).toHaveBeenCalledTimes(1);
    expect(dependencies.countMissingForm).not.toHaveBeenCalled();
  });

  it("still refuses when the demand row cannot be written — telemetry never blocks the answer", async () => {
    /*
      The count rides a customer's request, and this table lands in production
      by a founder ceremony: until that ceremony runs, EVERY call to it fails.
      So the failing case is the live case for a while, and it is driven rather
      than assumed. The customer's sentence must be exactly the same one.
    */
    dependencies.readDesign = vi.fn(async () => ({ ...DESIGN, placement: "neck" as const, side: "centre" as const }));
    dependencies.readCastIdentity = vi.fn(async () => identityOf("nonbinary"));
    dependencies.countMissingForm = vi.fn(async () => { throw new Error("no such table"); });

    expect(await mintOne()).toMatchObject({ ok: false, refusal: { code: "noFormForBuild" } });
    expect(dependencies.countMissingForm).toHaveBeenCalledTimes(1);
    expect(mint).not.toHaveBeenCalled();
  });

  it("throws rather than refusing when the design is not this account's", async () => {
    /* A sentence a customer reads is the wrong shape for "that isn't yours" —
       it is answered the way a missing thing is answered, one layer up. */
    dependencies.readDesign = vi.fn(async () => null);

    await expect(mintOne()).rejects.toBeInstanceOf(InkPlateDesignNotFound);
    expect(mint).not.toHaveBeenCalled();
  });

  it("refuses a template that is not there, and one that is not HIS", async () => {
    dependencies.loadTemplate = vi.fn(async () => null);
    expect(await mintOne()).toMatchObject({ ok: false, refusal: { code: "templateMissing" } });

    dependencies.loadTemplate = vi.fn(async (template) => ({
      template,
      bytes: Buffer.from("somebody edited the form"),
      digest: "f".repeat(64),
    }));
    expect(await mintOne()).toMatchObject({ ok: false, refusal: { code: "templateMoved" } });

    /* The whole point of both: a plate drawn on artwork nobody approved is a
       different tattoo, and nothing downstream could tell. */
    expect(mint).not.toHaveBeenCalled();
  });

  it("refuses a design whose bytes are gone, apart from one whose bytes changed", async () => {
    dependencies.fetchDesignBytes = vi.fn(async () => null);
    expect(await mintOne()).toMatchObject({ ok: false, refusal: { code: "designMissing" } });

    dependencies.fetchDesignBytes = vi.fn(async () => ({
      bytes: Buffer.from("a different picture entirely"),
      contentType: "image/png",
    }));
    expect(await mintOne()).toMatchObject({ ok: false, refusal: { code: "designMoved" } });

    expect(mint).not.toHaveBeenCalled();
  });

  it("writes nothing on any refusal — no manifest, no bytes, no row", async () => {
    dependencies.loadTemplate = vi.fn(async () => null);
    await mintOne();
    expect(dependencies.manifest).not.toHaveBeenCalled();
    expect(dependencies.store).not.toHaveBeenCalled();
    expect(dependencies.record).not.toHaveBeenCalled();
  });
});

describe("a design is plated ONCE PER ENGINE", () => {
  it("hands back the plate that exists rather than buying another", async () => {
    const existing = recordedFrom({
      userId: 1,
      designPublicId: "design-1",
      engine: "fal:openai/gpt-image-2/edit",
      templateKind: "arm",
      templateDigest: INK_TEMPLATES.armLeft.digest,
      promptDigest: "p".repeat(64),
      storageKey: "casting-v2/ink/plates/old.png",
      digest: "c".repeat(64),
      mime: "image/png",
      byteSize: 10,
      width: 32,
      height: 48,
    });
    dependencies.existingPlates = vi.fn(async () => [existing]);

    const outcome = await mintOne();

    /*
      THE COST ARGUMENT OF MINTING AT UPLOAD, in one assertion: the plate is made
      once per design and reused by every later render. A second ask that bought
      a second picture would quietly turn a one-off into a per-render cost, and
      nothing downstream would say so.
    */
    expect(outcome).toMatchObject({ ok: true, reused: true });
    expect(outcome.ok && outcome.plate.storageKey).toBe("casting-v2/ink/plates/old.png");
    expect(mint).not.toHaveBeenCalled();
  });

  it("does NOT count a plate from the other engine — that is the court", async () => {
    /* One design on both engines is two legal rows. If the other engine's plate
       counted, the comparison the founder's eye is meant to settle could never
       be built. */
    dependencies.existingPlates = vi.fn(async () => [recordedFrom({
      userId: 1,
      designPublicId: "design-1",
      engine: "fal:fal-ai/nano-banana-pro",
      templateKind: "arm",
      templateDigest: INK_TEMPLATES.armLeft.digest,
      promptDigest: "p".repeat(64),
      storageKey: "casting-v2/ink/plates/nbp.png",
      digest: "d".repeat(64),
      mime: "image/png",
      byteSize: 10,
      width: 32,
      height: 48,
    })]);

    const outcome = await mintOne();

    expect(outcome).toMatchObject({ ok: true, reused: false });
    expect(mint).toHaveBeenCalledTimes(1);
  });
});

describe("the mint itself", () => {
  it("registers the bytes for cleanup BEFORE writing them, and files the row last", async () => {
    await mintOne();

    /*
      Manifest → bytes → row, the library's own discipline. Bytes at a
      permanently public URL with no row referencing them are litter nobody will
      go looking for; if the store dies the hold lapses and the worker collects,
      and only a committed row releases the receipt.
    */
    expect(calls).toEqual(["engine", "manifest", "store", "record"]);
  });

  it("names ONE key, and the same one, in all three steps", async () => {
    await mintOne();

    const manifested = vi.mocked(dependencies.manifest).mock.calls[0]![0];
    const stored = vi.mocked(dependencies.store).mock.calls[0]![0];
    const recorded = vi.mocked(dependencies.record).mock.calls[0]![0];
    expect(manifested.storageKeys).toEqual([stored.key]);
    expect(recorded.storageKey).toBe(stored.key);
    /* Under the ink tree, one level in, so an operator can tell what a customer
       GAVE us from what we DREW. */
    expect(stored.key).toMatch(/^casting-v2\/ink\/plates\/[0-9a-f-]{36}\.png$/);
  });

  it("tells the engine which placement, in the vocabulary's own word", async () => {
    /* ASSERT AT THE WIRE (invariant 5): the contract is about what is SENT, and
       with a full-limb template nothing but these words keeps an upper-arm
       design off the forearm (fable-955 §3). */
    await mintOne();

    const sent = mint.mock.calls[0]![0];
    expect(sent.prompt).toContain("the left upper arm");
    expect(sent.template.bytes.toString()).toBe("the blank form");
    expect(sent.design.bytes).toBe(DESIGN_BYTES);
    /* The arm form's real pixels, so the canvas is derived from the artwork
       rather than from a number the caller chose. */
    expect(sent.templateWidth).toBe(INK_TEMPLATES.armLeft.width);
    expect(sent.templateHeight).toBe(INK_TEMPLATES.armLeft.height);
  });

  it("records what it MEASURED, never what it was told", async () => {
    await mintOne();

    const recorded = vi.mocked(dependencies.record).mock.calls[0]![0];
    /* The provider claimed 4096 square; the bytes are 32x48. Working law 1 at
       the width of one column: the row a court verdict is read off carries the
       artifact's own size. */
    expect({ width: recorded.width, height: recorded.height }).toEqual({ width: 32, height: 48 });
    expect(recorded.digest).toBe(createHash("sha256").update(plateBytes).digest("hex"));
    expect(recorded.byteSize).toBe(plateBytes.byteLength);
    expect(recorded.engine).toBe("fal:openai/gpt-image-2/edit");
    /* Derived from the design's placement, never passed in. */
    expect(recorded.templateKind).toBe("arm");
    expect(recorded.templateDigest).toBe(INK_TEMPLATES.armLeft.digest);
  });

  it("records a digest of the WORDS THAT WENT OUT, not of a second copy of them", async () => {
    /*
      `templateDigest` pins the sheet a plate stands on; this pins the other
      half, and the other half moved on 2026-08-18 — the one-view sentence
      against a turnaround template — leaving two plates indistinguishable in
      the table across a change that produced wildly different pictures.

      Asserted against the string THE ENGINE WAS HANDED rather than against a
      second call to `inkPlatePrompt` (working law 5). A test that built its own
      copy of the prompt would pass while the row recorded a digest of something
      nobody sent, which is the exact failure this column exists to make
      impossible.
    */
    await mintOne();

    const sent = mint.mock.calls[0]![0]!.prompt;
    const recorded = (dependencies.record as Mock).mock.calls[0]![0]!.promptDigest;
    expect(recorded).toBe(createHash("sha256").update(sent).digest("hex"));
    /* And it is a sha256 hex digest rather than the prompt itself: the words are
       derived from data already on the row, so storing them would be a copy
       that drifts. */
    expect(recorded).toMatch(/^[0-9a-f]{64}$/);
    expect(recorded).not.toContain(" ");
  });

  it("files no row when the engine returns bytes that will not decode", async () => {
    /*
      Ours, not hers. No row is filed and the manifest is never discharged, so
      the worker collects whatever was stored — which is why this is a fault
      rather than a refusal a customer reads.
    */
    mint.mockResolvedValue({
      bytes: Buffer.from("not an image"),
      contentType: "image/png",
      latencyMs: 1,
      provenance: { provider: "fal", model: "test", providerRef: "r" },
    });

    await expect(mintOne()).rejects.toThrow(/will not decode/);
    expect(dependencies.record).not.toHaveBeenCalled();
    expect(dependencies.manifest).not.toHaveBeenCalled();
  });
});
