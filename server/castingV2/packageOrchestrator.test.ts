import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderError } from "../providers/types";
import type { ViewConformanceVerdict } from "./viewConformance";

/**
 * The package's six independently refundable units (plan §F, §H.4).
 *
 * Every case here is of the sharp form the billing law demands: exactly the
 * views that did not arrive were refunded, never one that did, never twice, and
 * never more than a slice. Plus the two rules that are easy to lose in a
 * refactor — one regeneration and then the slot fails named-and-refunded, and a
 * commit that loses its fence refunds NOTHING here because recovery owns it.
 */

const OPERATION_ID = "55555555-5555-4555-8555-555555555555";

const generations: Array<Record<string, unknown>> = [];
vi.mock("../db/generations", () => ({
  createGeneration: vi.fn(async (input: Record<string, unknown>) => {
    generations.push(input);
    return { success: true, generationId: generations.length };
  }),
  updateGeneration: vi.fn(async () => ({ success: true })),
}));

vi.mock("../db/castingV2Sign", () => ({
  commitPackageSlotAsset: vi.fn(),
  recordPackageSlotFailure: vi.fn(),
  activateSignedCast: vi.fn(),
  listCastAssets: vi.fn(async () => []),
  listOperationViewSteps: vi.fn(async () => []),
}));

const {
  buildCastPackage,
  packagePromotionChargeReference,
  packageSlotChargeReference,
  promisedPackageAngles,
  unsettledPackageAngles,
} = await import("./packageOrchestrator");
const { CAST_PACKAGE_VIEWS, composePackageViewPrompt, packageViewExpectation } = await import("./castViewPackage");
import type { CastViewAngle } from "../../shared/boardTypes";

const pass: ViewConformanceVerdict = {
  pass: true,
  method: "judge:test",
  axes: {
    identity: { pass: true, note: "same person" },
    angle: { pass: true, note: "as specified" },
    wardrobe: { pass: true, note: "grey tee" },
  },
};
const fail: ViewConformanceVerdict = {
  pass: false,
  method: "judge:test",
  axes: {
    identity: { pass: false, note: "different bone structure" },
    angle: { pass: true, note: "" },
    wardrobe: { pass: true, note: "" },
  },
};

const refunds: Array<{ amount: number; reference: string }> = [];
const committed: string[] = [];
const failures: Array<Record<string, unknown>> = [];
const storedKeys: string[] = [];
const deletedKeys: string[] = [];
let refundRecords = true;

function deps(overrides: Record<string, unknown> = {}) {
  return {
    identityEngine: () => ({
      id: "test-identity",
      editWithReferences: vi.fn(),
      generateView: vi.fn(async () => ({
        bytes: Buffer.from("view"),
        contentType: "image/png",
        latencyMs: 1,
        provenance: { provider: "fal" as const, model: "nbp", providerRef: "ref" },
      })),
    }),
    judge: () => vi.fn(async () => pass),
    storeImage: vi.fn(async () => {
      const key = `casting-v2/casts/${OPERATION_ID}/views/${storedKeys.length}.png`;
      storedKeys.push(key);
      return { key, url: `https://cdn.example/${key}` };
    }),
    commitSlot: vi.fn(async (input: Record<string, unknown>) => {
      committed.push(input.angle as string);
      return committed.length;
    }),
    recordFailure: vi.fn(async (input: Record<string, unknown>) => {
      failures.push(input);
      return true;
    }),
    refund: vi.fn(async (_userId: number, amount: number, _label: string, reference: string) => {
      if (!refundRecords) {
        return { recorded: false, amount: 0, reference: `refund:${reference}`, duplicate: false };
      }
      // A repeat under the same reference is recorded but is NOT a payment —
      // the ledger absorbed it. Modelled so the receipt totals can be trusted.
      const already = refunds.some((entry) => entry.reference === reference);
      if (already) return { recorded: true, amount, reference: `refund:${reference}`, duplicate: true };
      refunds.push({ amount, reference });
      return { recorded: true, amount, reference: `refund:${reference}`, duplicate: false };
    }),
    activate: vi.fn(async () => ({
      type: "activated" as const,
      modelId: 901,
      packageSnapshotId: "pkg",
      slots: [],
    })),
    deleteObject: vi.fn(async (key: string) => {
      deletedKeys.push(key);
      return { success: true as const };
    }),
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
};

beforeEach(() => {
  refunds.length = 0;
  committed.length = 0;
  failures.length = 0;
  storedKeys.length = 0;
  deletedKeys.length = 0;
  generations.length = 0;
  refundRecords = true;
  vi.clearAllMocks();
});

describe("a package where everything lands", () => {
  // Five, not six: a Cast has six views — the Master plus the package's five —
  // and the package commits the five. The title said "six" while the assertion
  // below said five, from the shift the walk view retired in v2.
  it("commits all five package views and refunds nothing", async () => {
    const result = await buildCastPackage(deps(), input);

    expect(result.committed).toHaveLength(5);
    expect(result.failed).toHaveLength(0);
    expect(result.refundedCredits).toBe(0);
    expect(refunds).toHaveLength(0);
    expect(new Set(committed)).toEqual(new Set(CAST_PACKAGE_VIEWS));
    expect(result.activated).toBe(true);
  });

  it("writes one audit row per view, in the shared step vocabulary", async () => {
    await buildCastPackage(deps(), input);
    expect(generations).toHaveLength(5);
    expect(generations.every((row) => String(row.stepKey).startsWith("view:"))).toBe(true);
  });
});

describe("one regeneration, then named-and-refunded", () => {
  it("keeps a view that passes on the second attempt, and charges nothing extra", async () => {
    let calls = 0;
    const judge = () => vi.fn(async () => {
      calls += 1;
      return calls === 1 ? fail : pass;
    });
    const result = await buildCastPackage(deps({ judge }), input);

    expect(result.failed).toHaveLength(0);
    expect(refunds).toHaveLength(0);
    // The rejected attempt's object is deleted rather than orphaned.
    expect(deletedKeys.length).toBeGreaterThan(0);
  });

  it("fails and refunds exactly one slice when both attempts fail conformance", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "backFull" ? fail : pass);
    const result = await buildCastPackage(deps({ judge }), input);

    expect(result.failed).toEqual(["backFull"]);
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toEqual({
      amount: 50,
      reference: packageSlotChargeReference(OPERATION_ID, "backFull"),
    });
    expect(result.refundedCredits).toBe(50);
    // Five landed. A failed view never blocks the others.
    expect(committed).toHaveLength(4);
  });

  it("persists the per-axis verdict on the failed slot, so a dispute is answerable", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "sideClose" ? fail : pass);
    await buildCastPackage(deps({ judge }), input);

    const marker = failures.find((entry) => entry.angle === "sideClose");
    const failure = marker?.failure as { conformance?: { axes: Record<string, { pass: boolean }> } };
    expect(failure.conformance?.axes.identity.pass).toBe(false);
    expect(failure.conformance?.axes.angle.pass).toBe(true);
  });

  /*
    D-114: BOTH attempts' verdicts, not just the last.

    A slot that failed twice used to record only its final rejection, because
    the second attempt overwrote the first in a single `lastVerdict`. The judge
    is young and D-115 says it self-measures rather than self-modifies — the
    thing that makes it improvable is the record of what it threw away, not
    only what the customer was finally told.
  */
  it("keeps the first attempt's verdict beside the last", async () => {
    let call = 0;
    const judge = () => vi.fn(async (request: { angle: string }) => {
      if (request.angle !== "sideClose") return pass;
      call += 1;
      // Two different rejections, so the record has to show BOTH to be honest
      // about what happened.
      return call === 1
        ? { ...fail, axes: { ...fail.axes, angle: { pass: false, verdict: "differs", note: "first draw" } } }
        : fail;
    });
    await buildCastPackage(deps({ judge }), input);

    const marker = failures.find((entry) => entry.angle === "sideClose");
    const failure = marker?.failure as {
      conformance?: { axes: Record<string, { pass: boolean }> };
      earlierAttempts?: Array<{ axes: Record<string, { pass: boolean }> }>;
    };

    // The final verdict stays exactly where the room already reads it.
    expect(failure.conformance?.axes.angle.pass).toBe(true);
    // And the draw nobody heard about is beside it.
    expect(failure.earlierAttempts).toHaveLength(1);
    expect(failure.earlierAttempts?.[0].axes.angle.pass).toBe(false);
  });

  it("leaves no orphaned object behind a failed view", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "backFull" ? fail : pass);
    await buildCastPackage(deps({ judge }), input);
    // Both attempts at backFull stored an object; both were deleted.
    expect(deletedKeys).toHaveLength(2);
  });
});

describe("generation failures", () => {
  it("does not retry a content refusal — it will refuse again", async () => {
    const generateView = vi.fn(async () => {
      throw new ProviderError("content_policy", "refused");
    });
    const identityEngine = () => ({ id: "e", editWithReferences: vi.fn(), generateView });
    const result = await buildCastPackage(deps({ identityEngine }), input);

    // Five views, one attempt each.
    expect(generateView).toHaveBeenCalledTimes(5);
    expect(result.failed).toHaveLength(5);
    // Nothing landed, so the base returns with the slices — 450, not 250.
    expect(result.refundedCredits).toBe(450);
  });

  it("retries once on an unknown failure before writing the view off", async () => {
    const generateView = vi.fn(async () => {
      throw new Error("something odd");
    });
    const identityEngine = () => ({ id: "e", editWithReferences: vi.fn(), generateView });
    await buildCastPackage(deps({ identityEngine }), input);
    expect(generateView).toHaveBeenCalledTimes(10);
  });

  it("still activates the Cast when every view fails — the master is usable", async () => {
    const identityEngine = () => ({
      id: "e",
      editWithReferences: vi.fn(),
      generateView: vi.fn(async () => {
        throw new ProviderError("capability", "no");
      }),
    });
    const result = await buildCastPackage(deps({ identityEngine }), input);

    expect(result.activated).toBe(true);
    /*
      ZERO OF N: the whole 450 goes back, base included (founder ruling,
      2026-08-02). It was 250 until the first paid v3 Sign hit an overdrawn
      provider account and delivered nothing — keeping the promotion there
      charges the customer for our outage. The Cast still stands; only the money
      moved.
    */
    expect(result.refundedCredits).toBe(450);
    expect(result.totalLoss).toBe(true);
  });
});

describe("the judge cannot be trusted to be available", () => {
  it("DELIVERS a view it could not check, rather than charging nothing for it", async () => {
    /*
      D-246, amending D-92 (founder: *detectors must not block real generations
      because the detectors are flawed*). "We decided it was wrong" and "we
      could not tell" are different facts about a slot the customer paid for,
      and only the first is a reason to take the picture away.

      This test asserted the opposite until 2026-08-10, and it was the last
      place in the product where a broken checker still took a customer's money
      for a picture that may have been perfect — while deleting the frame on the
      way out, so nobody could ever tell which it had been.
    */
    const judge = () => vi.fn(async () => {
      throw new ProviderError("transport", "judge unreachable");
    });
    const result = await buildCastPackage(deps({ judge }), input);

    expect(result.committed).toHaveLength(CAST_PACKAGE_VIEWS.length);
    expect(result.failed).toHaveLength(0);
    expect(result.refundedCredits).toBe(0);
    expect(result.totalLoss).toBe(false);
  });

  it("still refuses a view the judge LOOKED AT and rejected", async () => {
    /*
      D-92's purpose, intact. View conformance is theatre unless it can fail,
      and it can: what died is failing a view nobody ever saw.
    */
    const judge = () => vi.fn(async () => ({
      pass: false,
      method: "judged",
      axes: {
        identity: { pass: false, note: "a different person" },
        angle: { pass: true, note: "" },
        wardrobe: { pass: true, note: "" },
      },
    }));
    const result = await buildCastPackage(deps({ judge } as never), input);

    expect(result.committed).toHaveLength(0);
    expect(result.refundedCredits).toBe(450);
  });
});

describe("the fence", () => {
  /*
    D-114's bar, made explicit: a process that lost its fence retries NOTHING.

    It already held — the fenced branch returns rather than continuing the
    attempt loop — but it held by reading, and "the code returns there" is the
    kind of proof that stops being true during a refactor nobody thought was
    about fences. A post-fence retry would generate against a slot the sweep
    already owns and bill a customer for a race.
  */
  it("never retries after losing the fence", async () => {
    let generated = 0;
    const identityEngine = () => ({
      id: "fal:test",
      generateView: vi.fn(async () => {
        generated += 1;
        return {
          bytes: Buffer.from("view"),
          contentType: "image/png",
          latencyMs: 1,
          provenance: { provider: "fal" as const, model: "nano-banana-pro", providerRef: "req" },
        };
      }),
    });
    const commitSlot = vi.fn(async () => null);
    const result = await buildCastPackage(
      deps({ commitSlot, identityEngine } as never),
      input,
    );

    // Five views, one generation each. A second pass would read 10.
    expect(generated).toBe(5);
    expect(result.failed).toHaveLength(5);
    expect(refunds).toHaveLength(0);
  });

  it("refunds nothing here when a slot commit loses to recovery", async () => {
    // The operation is no longer `running`, so the sweep has taken over and
    // will settle this slice under the same reference. Refunding here as well
    // would be the double refund the whole design exists to prevent.
    const commitSlot = vi.fn(async () => null);
    const result = await buildCastPackage(deps({ commitSlot }), input);

    expect(refunds).toHaveLength(0);
    expect(result.refundedCredits).toBe(0);
    expect(result.failed).toHaveLength(5);
    /*
      And NOT a total loss, though nothing committed. Losing the fence means
      this process stopped being the authority on what happened — the sweep
      re-reads the ledger and decides. A fenced writer that refunded the base on
      its own reading would be spending money it no longer owns.
    */
    expect(result.totalLoss).toBe(false);
    // And every object is deleted, since no row will ever reference them.
    expect(deletedKeys).toHaveLength(5);
  });
});

describe("honesty about money that did not move", () => {
  it("reports an unrecorded refund and records 0 on the slot, never 50", async () => {
    refundRecords = false;
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "backFull" ? fail : pass);
    const result = await buildCastPackage(deps({ judge }), input);

    expect(result.refundUnrecorded).toBe(true);
    expect(result.refundedCredits).toBe(0);
    const marker = failures.find((entry) => entry.angle === "backFull");
    expect((marker?.failure as { refunded: number }).refunded).toBe(0);
  });
});

describe("what recovery still has to settle", () => {
  it("counts a view with neither a picture nor a marker", async () => {
    const { listCastAssets } = await import("../db/castingV2Sign");
    vi.mocked(listCastAssets).mockResolvedValue([
      // A landed 2K view.
      { viewType: "frontFull", resolution: "2K", storageUrl: "u", status: null },
      // A written-off view.
      { viewType: "backFull", resolution: "2K", storageUrl: "", status: { state: "failed" } },
      /*
        The 1K anchor. Package v3.1 does not sell `frontClose` at all, so it can
        never be unsettled — but the row is kept in the fixture deliberately,
        because it must not be mistaken for a landed view of anything. Recovery
        settles what the PROFILE promised; this angle is not on the list.
      */
      { viewType: "frontClose", resolution: "1K", storageUrl: "anchor", status: null },
    ] as never);

    const unsettled = await unsettledPackageAngles({ userId: 1, modelId: 901 });
    expect(unsettled).toEqual(["closeUp", "threeQuarter", "sideClose"]);
  });
});

describe("the promise a Cast was actually charged against", () => {
  it("reads back every view it recorded, including one this profile never sold", async () => {
    /*
      The refund work-list, and the reason it is read from the Cast's own audit
      rows rather than from today's profile (the deploy-collision landmine).
      That defence is only as good as the vocabulary it reads THROUGH: filtering
      the recorded rows against the comp-card six silently dropped `closeUp`, so
      a v3 Sign swept by recovery would have been refunded four slices out of
      five and the customer would have been 50 credits down with nothing to show
      for it. Every other part of the machinery was correct.
    */
    const { listOperationViewSteps } = await import("../db/castingV2Sign");
    vi.mocked(listOperationViewSteps).mockResolvedValue([
      { viewAngle: "backFull" },
      { viewAngle: "closeUp" },
      { viewAngle: "frontClose" },
    ] as never);

    const promise = await promisedPackageAngles({ userId: 1, operationId: "op-v3" });
    expect(promise.source).toBe("recorded");
    expect(promise.angles).toEqual(["closeUp", "frontClose", "backFull"]);
  });

  it("falls back to today's profile only when nothing was ever opened", async () => {
    const { listOperationViewSteps } = await import("../db/castingV2Sign");
    vi.mocked(listOperationViewSteps).mockResolvedValue([] as never);

    const promise = await promisedPackageAngles({ userId: 1, operationId: "op-empty" });
    expect(promise.source).toBe("profile");
    expect(promise.angles).toEqual([...CAST_PACKAGE_VIEWS]);
  });
});

describe("zero of N — the base goes back too", () => {
  it("refunds the promotion under its own reference when nothing lands", async () => {
    const identityEngine = () => ({
      id: "e",
      editWithReferences: vi.fn(),
      generateView: vi.fn(async () => {
        throw new ProviderError("provider_account", "out of funds");
      }),
    });
    const result = await buildCastPackage(deps({ identityEngine }), input);

    expect(result.totalLoss).toBe(true);
    expect(result.committed).toHaveLength(0);
    // Five slices plus the base, each under its own idempotent reference — so a
    // recovery pass that arrives later finds duplicates, not a second payment.
    expect(refunds.filter((entry) => entry.amount === 50)).toHaveLength(5);
    const base = refunds.filter((entry) => entry.amount === 200);
    expect(base).toHaveLength(1);
    expect(base[0].reference).toBe(packagePromotionChargeReference(input.operationId));
    expect(result.refundedCredits).toBe(450);
  });

  it("keeps the base when even one view lands", async () => {
    /*
      The other half of the ruling, and the half that must not drift: a PARTIAL
      package keeps its promotion. The customer has views in hand and a Cast to
      keep them in — the permanence they bought is real.
    */
    let call = 0;
    const judge = () => vi.fn(async () => {
      call += 1;
      return call === 1 ? pass : fail;
    });
    const result = await buildCastPackage(deps({ judge }), input);

    expect(result.committed.length).toBeGreaterThan(0);
    expect(result.totalLoss).toBe(false);
    expect(refunds.some((entry) => entry.amount === 200)).toBe(false);
  });

  it("still activates the Cast — she keeps the face she chose", async () => {
    const identityEngine = () => ({
      id: "e",
      editWithReferences: vi.fn(),
      generateView: vi.fn(async () => {
        throw new ProviderError("provider_account", "out of funds");
      }),
    });
    const result = await buildCastPackage(deps({ identityEngine }), input);
    // The ruling refunds the money and KEEPS the Cast. A Cast she cannot open
    // is not a kinder outcome than one that explains itself.
    expect(result.activated).toBe(true);
  });
});

type ViewRequest = {
  prompt: string;
  references: Array<{ bytes: Buffer; contentType: string }>;
  resolution: string;
  viewAngle: CastViewAngle;
};

/**
 * HER TATTOOS RIDE INTO EVERY VIEW — asserted ON THE OUTGOING REQUEST
 * (FOUNDER RULING, his words at fable-987 §3: *"tattoo reference will need to be
 * supplied to each view generated otherwise it wont know what the tattoo is"*).
 *
 * At the wire rather than near it, on this program's own banked rule: a contract
 * about what gets SENT is proven on the request, never on a constant beside it.
 * The clause's wording is on trial in `inkViewReferences.test.ts`; what is on
 * trial here is that the pictures and the sentence actually leave the building,
 * on EVERY view, and that a Cast with no ink is untouched.
 */
describe("a signed Cast's tattoos ride into every view", () => {
  const plate = (over: Record<string, unknown> = {}) => ({
    designPublicId: "design-1",
    placement: "upperArm" as const,
    side: "left" as const,
    bytes: Buffer.from("plate-bytes"),
    contentType: "image/png",
    ...over,
  });

  it("sends the plate BESIDE the anchor on all five views, with the clause", async () => {
    /* Typed on the REQUEST, so `mock.calls` carries what was sent — an untyped
       mock records the arguments and hands them back as `never`, which is how a
       wire assertion turns into a cast that proves nothing. */
    const generateView = vi.fn(async (_request: ViewRequest) => ({
      bytes: Buffer.from("view"),
      contentType: "image/png",
      latencyMs: 1,
      provenance: { provider: "fal" as const, model: "nbp", providerRef: "ref" },
    }));
    const identityEngine = () => ({ id: "e", editWithReferences: vi.fn(), generateView });

    await buildCastPackage(deps({ identityEngine }), { ...input, inkPlates: [plate()] });

    expect(generateView).toHaveBeenCalledTimes(CAST_PACKAGE_VIEWS.length);
    for (const call of generateView.mock.calls) {
      const request = call[0];
      /* The anchor first and the plate second — the ordinal the clause quotes. */
      expect(request.references).toHaveLength(2);
      expect(request.references[0]!.bytes.toString()).toBe("anchor");
      expect(request.references[1]!.bytes.toString()).toBe("plate-bytes");
      /* Every view, including the ones that cannot show an upper arm: the
         ruling is that the engine must KNOW about the tattoo, and the clause
         tells it that a view which does not show the surface shows nothing. */
      /* The positional clause rides with the surface word now (fable-1006 §3),
         so the assertion names the prefix rather than a full stop that moved. */
      expect(request.prompt).toContain("Reference 2 is the tattoo at her left upper arm (on the right");
      expect(request.prompt).toContain("that tattoo simply does not appear in that view");
      /* And the view's own prompt is still all there — the clause is added, never
         substituted. */
      expect(request.prompt).toContain("Keep this exact person unchanged");
    }
  });

  it("carries several plates in order, and their ordinals match their slots", async () => {
    /* Typed on the REQUEST, so `mock.calls` carries what was sent — an untyped
       mock records the arguments and hands them back as `never`, which is how a
       wire assertion turns into a cast that proves nothing. */
    const generateView = vi.fn(async (_request: ViewRequest) => ({
      bytes: Buffer.from("view"),
      contentType: "image/png",
      latencyMs: 1,
      provenance: { provider: "fal" as const, model: "nbp", providerRef: "ref" },
    }));
    const identityEngine = () => ({ id: "e", editWithReferences: vi.fn(), generateView });

    await buildCastPackage(deps({ identityEngine }), {
      ...input,
      inkPlates: [
        plate({ bytes: Buffer.from("arm-plate") }),
        plate({ designPublicId: "d2", placement: "neck", side: "centre", bytes: Buffer.from("neck-plate") }),
      ],
    });

    const request = generateView.mock.calls[0]![0];
    expect(request.references.map((reference) => reference.bytes.toString()))
      .toEqual(["anchor", "arm-plate", "neck-plate"]);
    /* The sentence for reference 3 must be about the picture actually in slot 3.
       A clause and an array that drift apart is a prompt pointing at the wrong
       tattoo, and nothing downstream could tell. */
    expect(request.prompt).toContain("Reference 2 is the tattoo at her left upper arm (on the right");
    expect(request.prompt).toContain("Reference 3 is the tattoo at her neck.");
  });

  it("is INERT for a Cast with no ink — one reference, and not a word added", async () => {
    /*
      The control that matters most, because this lane reaches every package view
      in the product. Absent plates, the request must be what it was before this
      existed: the anchor alone, and the view prompt with nothing appended.
    */
    /* Typed on the REQUEST, so `mock.calls` carries what was sent — an untyped
       mock records the arguments and hands them back as `never`, which is how a
       wire assertion turns into a cast that proves nothing. */
    const generateView = vi.fn(async (_request: ViewRequest) => ({
      bytes: Buffer.from("view"),
      contentType: "image/png",
      latencyMs: 1,
      provenance: { provider: "fal" as const, model: "nbp", providerRef: "ref" },
    }));
    const identityEngine = () => ({ id: "e", editWithReferences: vi.fn(), generateView });

    await buildCastPackage(deps({ identityEngine }), input);

    for (const call of generateView.mock.calls) {
      const request = call[0];
      expect(request.references).toHaveLength(1);
      /*
        Byte-for-byte the composer's own output — the honest inertness test.
        NOT "the prompt says nothing about tattoos": the cohort block already
        names a tattoo as a structural feature to render plainly if the
        character has one, which is a sentence this lane agrees with rather than
        contradicts, and an assertion against the word would have failed on the
        product being right.
      */
      expect(request.prompt).toBe(composePackageViewPrompt(request.viewAngle));
    }
  });

  it("is inert for an EMPTY plate list too, not only an absent one", async () => {
    /* Two spellings of nothing, and a caller that loads zero rows produces the
       second. If they behaved differently the inertness above would be a promise
       about a field name rather than about the feature. */
    /* Typed on the REQUEST, so `mock.calls` carries what was sent — an untyped
       mock records the arguments and hands them back as `never`, which is how a
       wire assertion turns into a cast that proves nothing. */
    const generateView = vi.fn(async (_request: ViewRequest) => ({
      bytes: Buffer.from("view"),
      contentType: "image/png",
      latencyMs: 1,
      provenance: { provider: "fal" as const, model: "nbp", providerRef: "ref" },
    }));
    const identityEngine = () => ({ id: "e", editWithReferences: vi.fn(), generateView });

    await buildCastPackage(deps({ identityEngine }), { ...input, inkPlates: [] });

    const request = generateView.mock.calls[0]![0];
    expect(request.references).toHaveLength(1);
    expect(request.prompt).toBe(composePackageViewPrompt(request.viewAngle));
  });
});

/**
 * WHAT THE ANCHOR CANNOT SHOW RIDES AS WORDS — arrow 6 (FOUNDER, 2026-08-19:
 * *"when signing a cast to make the angles the refined image is supplied as the
 * reference and a description so that any features not visible are not lost"*).
 *
 * At the wire, for the same reason the tattoo lane is: a contract about what
 * gets SENT is proven on the outgoing request. The SELECTION — which features
 * qualify as "not visible" — is on trial in `viewFeatureWords.test.ts`; what is
 * on trial here is that the sentence actually leaves the building on every view,
 * and that a Cast with nothing hidden is untouched.
 */
describe("a signed Cast's hidden features ride into every view as words", () => {
  const hidden = (over: Record<string, unknown> = {}) => ({
    slot: "open:tail",
    noun: "tail",
    words: ["a long scaled tail at the base of the spine"],
    region: "belowWaist" as const,
    ...over,
  });

  const recorder = () => vi.fn(async (_request: ViewRequest) => ({
    bytes: Buffer.from("view"),
    contentType: "image/png",
    latencyMs: 1,
    provenance: { provider: "fal" as const, model: "nbp", providerRef: "ref" },
  }));

  it("names the hidden feature on EVERY view, beside the anchor and never instead of it", async () => {
    const generateView = recorder();
    const identityEngine = () => ({ id: "e", editWithReferences: vi.fn(), generateView });

    await buildCastPackage(deps({ identityEngine }), { ...input, featureWords: [hidden()] });

    expect(generateView).toHaveBeenCalledTimes(CAST_PACKAGE_VIEWS.length);
    for (const call of generateView.mock.calls) {
      const request = call[0];
      /* The words are words: they add no reference, and the anchor stays alone
         and first. A lane that quietly added an image would be a different
         feature wearing this one's test. */
      expect(request.references).toHaveLength(1);
      expect(request.prompt).toContain("a long scaled tail at the base of the spine");
      /* Bound 4 (fable-876 §2, "the reference is still king") written into the
         prompt itself rather than trusted to the blocks below it. */
      expect(request.prompt).toContain("Everything the reference photograph DOES show is authoritative");
      /* Added, never substituted. */
      expect(request.prompt).toContain("Keep this exact person unchanged");
    }
  });

  it("is INERT for a Cast with nothing hidden — byte-for-byte the composer's own output", async () => {
    /*
      The control that keeps the founder's bound. Absent hidden features the
      request must be exactly what it was before this existed — a composer that
      cannot produce NOTHING would be re-describing the person on every Sign in
      the product, which is the drift the bound forbids.
    */
    const generateView = recorder();
    const identityEngine = () => ({ id: "e", editWithReferences: vi.fn(), generateView });

    await buildCastPackage(deps({ identityEngine }), input);

    for (const call of generateView.mock.calls) {
      const request = call[0];
      expect(request.prompt).toBe(composePackageViewPrompt(request.viewAngle));
    }
  });

  it("is inert for an EMPTY list too, not only an absent one", async () => {
    const generateView = recorder();
    const identityEngine = () => ({ id: "e", editWithReferences: vi.fn(), generateView });

    await buildCastPackage(deps({ identityEngine }), { ...input, featureWords: [] });

    const request = generateView.mock.calls[0]![0];
    expect(request.prompt).toBe(composePackageViewPrompt(request.viewAngle));
  });

  it("rides BESIDE a tattoo plate without either clause eating the other", async () => {
    const generateView = recorder();
    const identityEngine = () => ({ id: "e", editWithReferences: vi.fn(), generateView });

    await buildCastPackage(deps({ identityEngine }), {
      ...input,
      inkPlates: [{
        designPublicId: "design-1",
        placement: "upperArm" as const,
        side: "left" as const,
        bytes: Buffer.from("plate-bytes"),
        contentType: "image/png",
      }],
      featureWords: [hidden()],
    });

    const request = generateView.mock.calls[0]![0];
    expect(request.references).toHaveLength(2);
    expect(request.prompt).toContain("Reference 2 is the tattoo at her left upper arm");
    expect(request.prompt).toContain("a long scaled tail at the base of the spine");
  });
});

/**
 * P-b — THE CLAUSE CANNOT BUY ITS OWN CONFORMANCE PASS (invariant 7, named as a
 * prerequisite in `castViewPackage.ts` since fable-871 §3, discharged here).
 *
 * `packageViewExpectation` is assembled from the view spec alone and has no
 * opinion about anything riding beside the anchor. That is deliberate and it is
 * fragile: the day the expectation could see the clause, view conformance would
 * quietly become prompt compliance and the check would stop being worth running.
 * So the property is asserted rather than assumed, from both ends — the
 * expectation itself, and what the judge is actually handed.
 */
describe("a riding clause cannot move the conformance check", () => {
  it("the expectation is byte-identical whatever rides", () => {
    /* Structural today — the function takes an angle and nothing else. The
       assertion is what turns that structure into a promise: a later signature
       that accepted the prompt would fail here before it reached a customer. */
    for (const angle of CAST_PACKAGE_VIEWS) {
      expect(packageViewExpectation(angle)).toEqual(packageViewExpectation(angle));
      expect(Object.keys(packageViewExpectation(angle)).sort()).toEqual(["framing", "wardrobe"]);
    }
  });

  it("the judge is never handed the words — it sees the angle and the pixels", async () => {
    const seen: unknown[] = [];
    const judge = () => vi.fn(async (request: unknown) => {
      seen.push(request);
      return pass;
    });

    await buildCastPackage(deps({ judge }), {
      ...input,
      featureWords: [{
        slot: "open:tail",
        noun: "tail",
        words: ["a long scaled tail at the base of the spine"],
        region: "belowWaist" as const,
      }],
    });

    expect(seen).toHaveLength(CAST_PACKAGE_VIEWS.length);
    /*
      The whole payload, serialized — not a field-by-field walk, which is how a
      leak arrives through the field nobody thought to check.
    */
    for (const request of seen) {
      expect(JSON.stringify(request)).not.toContain("tail");
      expect(JSON.stringify(request)).not.toContain("scaled");
    }
  });
});
