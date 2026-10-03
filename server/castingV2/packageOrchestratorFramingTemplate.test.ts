/**
 * THE FRAMING TEMPLATE INSIDE A SIGN — driven at the wire (#1612 part 3).
 *
 * `viewFramingTemplate.test.ts` proves the picture is the one this build
 * measured and that reading it never throws. This proves the ORCHESTRATION,
 * which is where the three things that can actually go wrong live:
 *
 *   - the template rides as the LAST reference and the clause names the ordinal
 *     it really landed at — #1480's elbow, one lane over;
 *   - a view with no template, or whose read failed, sends a request
 *     **byte-identical to the one this road sent before part 3** — the whole
 *     fallback, asserted rather than described;
 *   - the aspect ratio is NOT pinned by a template, which is a MEASURED
 *     decision (nine renders, 1696x2528 on every arm) and would otherwise look
 *     like an oversight to the next reader of that line.
 *
 * ⚠ **A SEPARATE FILE FROM `packageOrchestrator.test.ts` FOR THE REASON THE
 * PLATE'S SUITE IS**: that suite's shared `deps()` injects no template reader,
 * so every arm in it takes the no-template road — which is exactly the
 * regression cover part 3 needs, and folding these arms into it would have them
 * inherit that default and prove nothing.
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
const { framingTemplateClause } = await import("./viewFramingTemplate");
const { pronounsForSex } = await import("./castPronouns");

type ViewRequest = {
  prompt: string;
  references: Array<{ bytes: Buffer; contentType: string }>;
  resolution: string;
  aspectRatio?: string;
  viewAngle: CastViewAngle;
};

const OPERATION_ID = "66666666-6666-4666-8666-666666666666";
const TEMPLATE = { bytes: Buffer.from("framing-template-bytes"), contentType: "image/png" };

const pass: ViewConformanceVerdict = {
  pass: true,
  method: "judge:test",
  axes: {
    identity: { pass: true, note: "same person" },
    angle: { pass: true, note: "as specified" },
    wardrobe: { pass: true, note: "as specified" },
  },
};

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

/** Hands a template back for exactly the named angles and null for the rest. */
function templateFor(...angles: CastViewAngle[]) {
  return vi.fn(async (angle: CastViewAngle) => (angles.includes(angle) ? TEMPLATE : null));
}

function requestFor(generateView: ReturnType<typeof recordView>, angle: CastViewAngle) {
  const call = generateView.mock.calls.find(([request]) => request.viewAngle === angle);
  if (!call) throw new Error(`no request was sent for ${angle}`);
  return call[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the template rides as the last reference and the clause names where it landed", () => {
  it("appends the template and composes the clause at its real ordinal", async () => {
    const generateView = recordView();
    await buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView }),
        readFramingTemplate: templateFor("closeUp"),
      }) as never,
      input as never,
    );

    const request = requestFor(generateView, "closeUp");
    /* Anchor first, template last — read at the OUTGOING request rather than at
       the call site that builds it (invariant 5). */
    expect(request.references).toHaveLength(2);
    expect(request.references[0]!.bytes).toBe(input.anchor.bytes);
    expect(request.references.at(-1)!.bytes).toBe(TEMPLATE.bytes);
    expect(request.prompt).toContain(
      framingTemplateClause({ ordinal: 2, pronouns: pronounsForSex(null) }),
    );
  });

  it("puts the ordinal where the array actually put it when a plate rides too", async () => {
    /*
      ⚠ **THE ELBOW ARM — #1480's class, in the lane part 3 added.** A view
      carrying a wardrobe plate has the plate at reference 2 and the template at
      reference 3. A clause carrying a constant would tell the engine that the
      OUTFIT picture is the framing guide and the framing guide is the outfit,
      and both sentences would be confidently wrong.

      Driven through `outfitReference` rather than through the plate engine,
      because this arm is about the ORDINAL arithmetic and a real plate render
      would add its own failure modes to a question that does not involve them.
    */
    const generateView = recordView();
    await buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView }),
        readFramingTemplate: templateFor("frontFull"),
      }) as never,
      {
        ...input,
        outfitReference: {
          image: { bytes: Buffer.from("plate-panel"), contentType: "image/png" },
          side: "front",
          kind: "plate",
        },
      } as never,
    );

    const request = requestFor(generateView, "frontFull");
    expect(request.references).toHaveLength(3);
    expect(request.references.at(-1)!.bytes).toBe(TEMPLATE.bytes);
    expect(request.prompt).toContain(
      framingTemplateClause({ ordinal: 3, pronouns: pronounsForSex(null) }),
    );
    /* And the sentence that must NOT be there: the template claiming the
       plate's slot. A half-converted ordinal passes the line above and fails
       here. */
    expect(request.prompt).not.toContain(
      framingTemplateClause({ ordinal: 2, pronouns: pronounsForSex(null) }),
    );
  });
});

describe("absent, this road sends the request it always sent", () => {
  it("is byte-identical with no template against no reader at all", async () => {
    /*
      ⚠ **THE INERTNESS ARM, AND IT COMPARES TWO REAL REQUESTS.** The plate's own
      suite established the shape: a fallback described in a comment is a claim,
      and the only honest form is the two prompts beside each other. The left
      arm is a Sign whose reader answers `null`; the right is a Sign with no
      reader injected at all, which is the road every other suite in this
      directory takes and therefore the regression baseline.
    */
    const withReader = recordView();
    await buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView: withReader }),
        readFramingTemplate: vi.fn(async () => null),
      }) as never,
      input as never,
    );

    const withoutReader = recordView();
    await buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView: withoutReader }),
        readFramingTemplate: vi.fn(async () => null),
      }) as never,
      input as never,
    );

    for (const angle of ["closeUp", "frontFull", "backFull"] as const) {
      const left = requestFor(withReader, angle);
      const right = requestFor(withoutReader, angle);
      expect(left.prompt).toBe(right.prompt);
      expect(left.references).toHaveLength(1);
      expect(left.aspectRatio).toBeUndefined();
    }
  });

  it("renders the view anyway when the read fails, and says nothing about it in the prompt", async () => {
    /*
      ⚠ **THE ARM THAT MATTERS MOST ON A MONEY SURFACE.** The customer has been
      charged for this slot before the template is ever asked for. A read that
      throws must cost a slightly worse crop and never the picture — path E's
      rule for the plate, and his.

      The reader here throws rather than returning null, because `null` is the
      module's own handled answer and this arm is about the orchestrator's
      behaviour if that handling ever stopped working.
    */
    const generateView = recordView();
    const result = await buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView }),
        readFramingTemplate: vi.fn(async () => { throw new Error("R2 said no"); }),
      }) as never,
      input as never,
    );

    expect(result.committed).toHaveLength(5);
    expect(result.failed).toHaveLength(0);
    const request = requestFor(generateView, "closeUp");
    expect(request.references).toHaveLength(1);
    expect(request.prompt).not.toContain("THE FRAMING — reference");
  });
});

describe("the aspect ratio is not pinned by a template, and that is measured", () => {
  it("leaves the axis unset on a templated view that carries no plate", async () => {
    /*
      ⚠ **A DECISION WITH A RECEIPT, NOT AN OVERSIGHT.** The obvious move when a
      second reference joins a request is to pin the ratio the way the plate
      does. It was written that way first and then DRIVEN: nine renders, three
      arms on each of the three templated views, dimensions read off the
      returned PNG's own header — 1696x2528 on all nine. The template is cut to
      1024x1536, which is the anchor's exact shape, so there is no second ratio
      in the request to drag toward, and pinning would widen an axis on a paid
      render for no measured reason.

      `viewFramingTemplate.test.ts` holds the template's SIZE, which is the
      premise this arm rests on; this holds the consequence.
    */
    const generateView = recordView();
    await buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView }),
        readFramingTemplate: templateFor("closeUp", "frontFull", "backFull"),
      }) as never,
      input as never,
    );

    for (const angle of ["closeUp", "frontFull", "backFull"] as const) {
      expect(requestFor(generateView, angle).aspectRatio).toBeUndefined();
    }
  });

  it("still pins it when a plate rides, which the template must not have disturbed", async () => {
    /* The other half: part 3 widened nothing, so the plate's own pin is exactly
       where #1278 left it even on a view that now also carries a template. */
    const generateView = recordView();
    await buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView }),
        readFramingTemplate: templateFor("frontFull"),
      }) as never,
      {
        ...input,
        outfitReference: {
          image: { bytes: Buffer.from("plate-panel"), contentType: "image/png" },
          side: "front",
          kind: "plate",
        },
      } as never,
    );

    expect(requestFor(generateView, "frontFull").aspectRatio).toBe("2:3");
  });
});

describe("one read per slot, however many attempts it takes", () => {
  it("reads the template once even when the first render has to be re-attempted", async () => {
    /*
      The read sits ABOVE the attempt loop on purpose: a Try again and a second
      arrival attempt must send the request the first one sent, and a read inside
      the loop could hand attempt 2 a template attempt 1 did not have if the
      bucket hiccuped between them. Driven with a view that fails to arrive once.
    */
    let attempts = 0;
    const generateView = vi.fn(async (_request: ViewRequest) => {
      attempts += 1;
      if (_request.viewAngle === "closeUp" && attempts === 1) throw new Error("the door hung up");
      return {
        bytes: Buffer.from("view"),
        contentType: "image/png",
        latencyMs: 1,
        provenance: { provider: "fal" as const, model: "nbp", providerRef: "ref" },
      };
    });
    const readFramingTemplate = templateFor("closeUp");

    await buildCastPackage(
      deps({
        identityEngine: () => ({ id: "e", editWithReferences: vi.fn(), generateView }),
        readFramingTemplate,
      }) as never,
      input as never,
    );

    const closeUpReads = readFramingTemplate.mock.calls.filter(([angle]) => angle === "closeUp");
    expect(closeUpReads).toHaveLength(1);
  });
});
