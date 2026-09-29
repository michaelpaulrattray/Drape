/**
 * THE WARDROBE PLATE INSIDE A SIGN — driven at the wire (#1278 path E).
 *
 * `outfitPlate.test.ts` proves the plate cuts correctly and never throws. This
 * proves the ORCHESTRATION, which is where his design actually lives:
 *
 *   - the three views that do not wear the plate **do not wait for it** (his
 *     first line, and the only part of path E a customer can feel);
 *   - the two that do get **their own half**, as the LAST reference, with a
 *     clause naming the ordinal it really landed at;
 *   - a plate that fails leaves a request **byte-identical to the one this
 *     road sent before path E existed** — which is the whole fallback, and it
 *     is asserted rather than described;
 *   - a plate that REJECTS still leaves all five views attempted. That arm is
 *     the important one: the audit rows and the charge exist before the plate
 *     is asked for, so a view that is never attempted is the single failure
 *     mode on this road with no refund path out of it.
 *
 * ⚠ **IT IS A SEPARATE FILE FROM `packageOrchestrator.test.ts` ON PURPOSE.**
 * That suite's shared `deps()` injects no plate engine, so every arm in it
 * takes the no-plate road — which is exactly the regression cover path E
 * needs, and collapsing these arms into it would have them silently inherit
 * that default and prove nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CastViewAngle } from "../../shared/boardTypes";
import type { ViewConformanceVerdict } from "./viewConformance";

vi.mock("../logging/logger", () => {
  const shape = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  return { logger: shape, createModuleLogger: () => shape };
});
vi.mock("../db/castingV2Sign", () => ({
  commitPackageSlotAsset: vi.fn(async () => 1),
  recordPackageSlotFailure: vi.fn(async () => true),
  activateSignedCast: vi.fn(async () => ({
    type: "activated" as const,
    modelId: 901,
    packageSnapshotId: "pkg",
    slots: [],
  })),
  listCastAssets: vi.fn(async () => []),
  listOperationViewSteps: vi.fn(async () => []),
}));
vi.mock("../db/generations", () => ({
  createGeneration: vi.fn(async () => 1),
  updateGeneration: vi.fn(async () => undefined),
}));
vi.mock("./viewThumbnailMint", () => ({ mintViewThumbnail: vi.fn(async () => undefined) }));

const { buildCastPackage } = await import("./packageOrchestrator");
const { CAST_PACKAGE_VIEWS } = await import("./castViewPackage");
const { PLATE_ANGLES, PLATE_VIEW_ASPECT_RATIO, outfitPlateClause } = await import("./outfitPlate");
const { pronounsForSex } = await import("./castPronouns");
type OutfitPlateEngine = import("./outfitPlate").OutfitPlateEngine;

type ViewRequest = {
  prompt: string;
  references: Array<{ bytes: Buffer; contentType: string }>;
  resolution: string;
  aspectRatio?: string;
  viewAngle: CastViewAngle;
};

const OPERATION_ID = "77777777-7777-4777-8777-777777777777";
const pass: ViewConformanceVerdict = {
  pass: true,
  method: "judge:test",
  axes: {
    identity: { pass: true, note: "same person" },
    angle: { pass: true, note: "as specified" },
    wardrobe: { pass: true, note: "as specified" },
  },
};

/**
 * A real two-panel PNG, so the split under test is the real one.
 *
 * Deliberately not a stub: the panel bytes are what the arms then look for in
 * the outgoing request, and a fake plate would let a wiring bug that hands a
 * view the WHOLE plate pass as if it had handed it a half.
 */
async function realPlateBytes(): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const left = await sharp({
    create: { width: 200, height: 300, channels: 3, background: { r: 220, g: 20, b: 20 } },
  }).png().toBuffer();
  const right = await sharp({
    create: { width: 200, height: 300, channels: 3, background: { r: 20, g: 20, b: 220 } },
  }).png().toBuffer();
  return sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([{ input: left, left: 0, top: 0 }, { input: right, left: 200, top: 0 }])
    .png()
    .toBuffer();
}

function recordView() {
  return vi.fn(async (_request: ViewRequest) => ({
    bytes: Buffer.from("view"),
    contentType: "image/png",
    latencyMs: 1,
    provenance: { provider: "fal" as const, model: "nbp", providerRef: "ref" },
  }));
}

function deps(overrides: Record<string, unknown> = {}) {
  return {
    judge: () => vi.fn(async () => pass),
    storeImage: vi.fn(async () => ({ key: "k.png", url: "https://cdn.example/k.png" })),
    refund: vi.fn(async (_u: number, amount: number, _l: string, reference: string) => ({
      recorded: true, amount, reference, duplicate: false,
    })),
    deleteObject: vi.fn(async () => ({ success: true as const })),
    wait: vi.fn(async () => undefined),
    ...overrides,
  };
}

const input = {
  userId: 1,
  operationId: OPERATION_ID,
  modelId: 901,
  identityRevisionId: "rev-1",
  identityText: "identity",
  anchor: { bytes: Buffer.from("anchor"), contentType: "image/png" },
  description: "a street-level futurist, stylish and a little worn",
};

let plateBytes: Buffer;

beforeEach(async () => {
  plateBytes = await realPlateBytes();
  vi.clearAllMocks();
});

function plateEngine(bytes: Buffer): OutfitPlateEngine {
  return { editWithReferences: async () => ({ bytes, contentType: "image/png" }) };
}

function requestFor(generateView: ReturnType<typeof recordView>, angle: CastViewAngle) {
  const call = generateView.mock.calls.find(([request]) => request.viewAngle === angle);
  if (!call) throw new Error(`no request was sent for ${angle}`);
  return call[0];
}

describe("the two full-length views wear the plate, and nothing else does", () => {
  it("hands frontFull the LEFT half and backFull the RIGHT half, as the last reference", async () => {
    const generateView = recordView();
    await buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView }),
        outfitPlateEngine: () => plateEngine(plateBytes),
      }),
      input,
    );

    const front = requestFor(generateView, "frontFull");
    const back = requestFor(generateView, "backFull");

    /* Two references: the anchor, then this view's own panel. */
    expect(front.references).toHaveLength(2);
    expect(front.references[0].bytes).toEqual(input.anchor.bytes);
    expect(back.references).toHaveLength(2);

    /* The halves are DIFFERENT pictures — the arm that fails if both views are
       handed one panel, or the whole plate. */
    expect(front.references[1].bytes.equals(back.references[1].bytes)).toBe(false);

    const sharp = (await import("sharp")).default;
    const frontMeta = await sharp(front.references[1].bytes).metadata();
    expect(frontMeta.width).toBe(200);
    expect(frontMeta.height).toBe(300);
  });

  it("tells each of them which half it is, at the ordinal the picture really landed at", async () => {
    const generateView = recordView();
    await buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView }),
        outfitPlateEngine: () => plateEngine(plateBytes),
      }),
      input,
    );

    /*
      ⚠ **DERIVED FROM `outfitPlateClause`, NOT RETYPED** (working law 4;
      changed in #1471 after a retyped copy of the sentence reddened this arm on
      a wording change it had no opinion about). What this arm is actually FOR
      is the ordinal and the side — that frontFull was handed the front panel at
      the position the picture really landed at, and backFull the back one — and
      the wording itself is pinned in `outfitPlate.test.ts`, where it belongs.
      Asserting the composed clause keeps the ordinal and the side real while
      making the sentence a detail of one module again.
    */
    const clauseFor = (side: "front" | "back") =>
      outfitPlateClause({
        ordinal: 2,
        side,
        /* The fallback the orchestrator applies, read from the same function
           rather than assumed. This fixture declares no `pronouns` at all — the
           field is optional on the input — so the null form is the one the
           views in this arm were really composed with. */
        pronouns: pronounsForSex(null),
      });

    expect(requestFor(generateView, "frontFull").prompt).toContain(clauseFor("front"));
    expect(requestFor(generateView, "backFull").prompt).toContain(clauseFor("back"));
    /* And the two are genuinely different sentences, so a side mix-up cannot
       pass by both arms reading the same string. */
    expect(clauseFor("front")).not.toBe(clauseFor("back"));
  });

  it("leaves the other three views exactly as they were — one reference, no plate sentence", async () => {
    const generateView = recordView();
    await buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView }),
        outfitPlateEngine: () => plateEngine(plateBytes),
      }),
      input,
    );

    const others = CAST_PACKAGE_VIEWS.filter(
      (angle) => !(PLATE_ANGLES as readonly CastViewAngle[]).includes(angle),
    );
    expect(others).toEqual(["closeUp", "threeQuarter", "sideClose"]);
    for (const angle of others) {
      const request = requestFor(generateView, angle);
      expect(request.references).toHaveLength(1);
      expect(request.prompt).not.toContain("wardrobe plate");
    }
  });

  it("⚠ pins the delivered shape, so a plate cannot reshape a paid view", async () => {
    /*
      Measured on the real door before this was written: the same view came
      back 1696x2528 master-only and 1792x2400 with a plate beside it, because
      Nano Banana Pro reads its output shape off its references. Two views a
      different shape from the other three is a defect a customer sees and no
      test would have caught — this is that test.
    */
    const generateView = recordView();
    await buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView }),
        outfitPlateEngine: () => plateEngine(plateBytes),
      }),
      input,
    );

    for (const angle of PLATE_ANGLES) {
      expect(requestFor(generateView, angle).aspectRatio).toBe(PLATE_VIEW_ASPECT_RATIO);
    }
    /* And the three that do not wear one declare nothing, exactly as before. */
    for (const angle of ["closeUp", "threeQuarter", "sideClose"] as const) {
      expect(requestFor(generateView, angle).aspectRatio).toBeUndefined();
    }
  });

  it("asks for ONE plate per package, not one per view", async () => {
    const editWithReferences = vi.fn(async () => ({ bytes: plateBytes, contentType: "image/png" }));
    await buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView: recordView() }),
        outfitPlateEngine: () => ({ editWithReferences }),
      }),
      input,
    );

    expect(editWithReferences).toHaveBeenCalledTimes(1);
  });
});

describe("⚠ a cast with tattoos AND a plate — the ordinals are the defect", () => {
  /*
    FOUND BY A SABOTAGE CASE SURVIVING, not by review. Moving the plate from
    the END of the reference list to just after the anchor left every arm here
    green, because no arm sent a Cast that had BOTH.

    What that costs a real customer: her delivered ink crops are named by
    POSITION — *"reference 2 is her left upper arm tattoo, draw it there and
    nowhere else"* — so a plate inserted in front of them renames every one of
    those sentences onto the wrong picture. The view is then told the wardrobe
    plate is a tattoo on her arm and told to paint it there. Nothing downstream
    can tell: a plausible picture comes back, the judge reads the spec rather
    than the prompt, and the customer pays 50 credits for it.
  */
  const crop = (over: Record<string, unknown> = {}) => ({
    cropPublicId: "11111111-1111-4111-8111-111111111111",
    slot: "ink:upperArm@left",
    placement: "upperArm" as const,
    side: "left" as const,
    noun: "left upper arm tattoo",
    bytes: Buffer.from("arm-crop"),
    contentType: "image/png",
    ...over,
  });

  it("puts the plate LAST and names it at the ordinal it really landed at", async () => {
    const crops = [
      crop(),
      crop({
        cropPublicId: "22222222-2222-4222-8222-222222222222",
        slot: "ink:neck",
        placement: "neck" as const,
        side: null,
        noun: "neck tattoo",
        bytes: Buffer.from("neck-crop"),
      }),
    ];
    const generateView = recordView();
    await buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView }),
        outfitPlateEngine: () => plateEngine(plateBytes),
      }),
      { ...input, inkCrops: crops, pronouns: pronounsForSex("female") },
    );

    const front = requestFor(generateView, "frontFull");

    /* anchor, arm crop, calf crop, plate — in that order, read at the bytes. */
    expect(front.references).toHaveLength(4);
    expect(front.references[1].bytes).toEqual(crops[0].bytes);
    expect(front.references[2].bytes).toEqual(crops[1].bytes);

    /* Her tattoos keep the ordinals their own sentences quote... */
    expect(front.prompt).toContain("Reference 2 is the exact left upper arm tattoo");
    expect(front.prompt).toContain("Reference 3 is the exact neck tattoo");
    /* ...and the plate takes the next one, rather than stealing theirs. */
    expect(front.prompt).toContain("reference 4 is a wardrobe plate");
    expect(front.prompt).not.toContain("reference 2 is a wardrobe plate");
  });

  it("keeps her tattoos at the same ordinals with a plate and without one", async () => {
    /* The inertness half: adding a plate must not move a single sentence that
       was already pointing at a picture of her. */
    const crops = [crop()];
    async function promptFor(withPlate: boolean) {
      const generateView = recordView();
      await buildCastPackage(
        deps({
          identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView }),
          ...(withPlate ? { outfitPlateEngine: () => plateEngine(plateBytes) } : {}),
        }),
        { ...input, inkCrops: crops, pronouns: pronounsForSex("female") },
      );
      return requestFor(generateView, "frontFull").prompt;
    }

    const withPlate = await promptFor(true);
    const withoutPlate = await promptFor(false);
    const inkSentence = "left upper arm tattoo";
    expect(withoutPlate).toContain(inkSentence);
    /* Everything the plate clause is APPENDED to is identical, byte for byte —
       the plate adds a paragraph and moves nothing. */
    const upToPlate = withPlate.slice(0, withPlate.indexOf("THE OUTFIT —")).trimEnd();
    expect(upToPlate).toBe(withoutPlate.trimEnd());
  });
});

describe("⚠ the three views that do not wear the plate never wait for it", () => {
  it("dispatches them BEFORE the plate has landed — his first line, and the only part a customer feels", async () => {
    /*
      A plate held open until something releases it. If the orchestrator awaited
      the plate before fanning out, these three would not have been sent yet and
      the assertion below would read zero.
    */
    let releasePlate: (() => void) | null = null;
    const plateInFlight = new Promise<void>((resolve) => { releasePlate = resolve; });
    const dispatched: CastViewAngle[] = [];
    const generateView = vi.fn(async (request: ViewRequest) => {
      dispatched.push(request.viewAngle);
      return {
        bytes: Buffer.from("view"),
        contentType: "image/png",
        latencyMs: 1,
        provenance: { provider: "fal" as const, model: "nbp", providerRef: "ref" },
      };
    });

    const build = buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView }),
        outfitPlateEngine: () => ({
          editWithReferences: async () => {
            await plateInFlight;
            return { bytes: plateBytes, contentType: "image/png" };
          },
        }),
      }),
      input,
    );

    /* Let the microtask queue drain while the plate is still held open. */
    for (let tick = 0; tick < 25; tick += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(dispatched.slice().sort()).toEqual(["closeUp", "sideClose", "threeQuarter"]);
    expect(dispatched).not.toContain("frontFull");
    expect(dispatched).not.toContain("backFull");

    releasePlate!();
    await build;

    expect(dispatched.slice().sort()).toEqual([
      "backFull", "closeUp", "frontFull", "sideClose", "threeQuarter",
    ]);
  });
});

describe("a plate that does not land never costs the Sign anything", () => {
  /**
   * The control every arm below is measured against: what this road sends with
   * no plate at all, which is what it sent before path E existed.
   */
  async function promptsWithout(plateOverride: Record<string, unknown>) {
    const generateView = recordView();
    const result = await buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView }),
        ...plateOverride,
      }),
      input,
    );
    return { generateView, result };
  }

  it("delivers all five, master-only, when the engine refuses", async () => {
    const { generateView, result } = await promptsWithout({
      outfitPlateEngine: () => ({
        editWithReferences: async () => { throw new Error("content policy"); },
      }),
    });

    expect(result.committed.slice().sort()).toEqual([...CAST_PACKAGE_VIEWS].sort());
    expect(result.failed).toEqual([]);
    expect(result.refundedCredits).toBe(0);
    for (const angle of CAST_PACKAGE_VIEWS) {
      expect(requestFor(generateView, angle).references).toHaveLength(1);
    }
  });

  it("⚠ delivers all five when the plate ENGINE ITSELF throws — the credential road", async () => {
    /*
      THE ARM THIS BLOCK EXISTS FOR, and it caught a real defect while being
      written. The plate engine's constructor throws on a missing `FAL_KEY`,
      which is the correct refusal for that door. Built in the argument list
      that throw is SYNCHRONOUS inside `buildCastPackage` — before any view is
      dispatched, and after the five audit rows and the 450-credit charge
      already exist. Five paid views would have been lost to a missing
      environment variable, with nothing refusing and nothing refunding.

      It is also not hypothetical in this repository: `vitest.setup.ts` strips
      `FAL_KEY` from every suite, so this is the road EVERY other orchestrator
      arm takes.
    */
    const { generateView, result } = await promptsWithout({
      outfitPlateEngine: () => { throw new Error("FAL_KEY is required to render a Sign's wardrobe plate"); },
    });

    expect(result.committed.slice().sort()).toEqual([...CAST_PACKAGE_VIEWS].sort());
    expect(result.failed).toEqual([]);
    expect(result.refundedCredits).toBe(0);
    for (const angle of CAST_PACKAGE_VIEWS) {
      expect(requestFor(generateView, angle).references).toHaveLength(1);
    }
  });

  it("sends the identical prompt with no plate and with a broken plate", async () => {
    /*
      The inertness assertion, and it is the reason the fallback can be trusted:
      not "it still works", but "it sends the same bytes".
    */
    const broken = await promptsWithout({
      outfitPlateEngine: () => ({
        editWithReferences: async () => { throw new Error("content policy"); },
      }),
    });
    const absent = await promptsWithout({});

    for (const angle of CAST_PACKAGE_VIEWS) {
      expect(requestFor(broken.generateView, angle).prompt)
        .toBe(requestFor(absent.generateView, angle).prompt);
    }
  });
});
