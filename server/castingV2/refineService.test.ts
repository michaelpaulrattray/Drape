import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Refine's MONEY and its ORDER (M8 §10, §12).
 *
 * One invariant, stated the way the Sign suite states its own:
 *
 *   **a variant exists ⟹ money was taken, and money was taken ⟹ a variant
 *   exists or the whole charge came back.**
 *
 * A refine is one image and one unit, so there is no partial state to defend —
 * which makes the interesting cases the boundaries rather than the middle: the
 * refusals that must happen BEFORE anything is claimed, and the failures after
 * the charge that must give back all 25 rather than some of it.
 */

const journal: string[] = [];
const ledger = {
  charges: [] as Array<{ amount: number; reference: string }>,
  refunds: [] as Array<{ amount: number; description: string }>,
};

let chargeSucceeds = true;
let candidateRow: Record<string, unknown>;
let variantRows: Array<Record<string, unknown>>;
let landedVariant: Record<string, unknown> | null = null;
let engineThrows: Error | null = null;
let renderFault = false;

vi.mock("./spendGuards", () => ({ assertNotFrozen: vi.fn(async () => undefined) }));

vi.mock("../db/castingV2", () => ({
  getOwnedCandidateWithSelectedFace: vi.fn(async () => {
    journal.push("read");
    if (!candidateRow) return null;
    const selected = variantRows.find((v) => v.publicId === candidateRow.selectedVariantPublicId);
    return {
      candidate: candidateRow,
      variantId: selected ? (selected.id as number) : null,
      variantPublicId: selected ? (selected.publicId as string) : null,
      imageKey: selected ? selected.imageKey : candidateRow.imageKey,
      thumbKey: null,
      internalPrompt: selected ? selected.internalPrompt : candidateRow.internalPrompt,
    };
  }),
}));

vi.mock("../db/castingV2Variants", () => ({
  VariantOwnershipError: class extends Error {},
  listCandidateVariants: vi.fn(async () => variantRows),
  claimVariant: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("claim");
    return {
      id: 500 + variantRows.length,
      publicId: `variant-${variantRows.length + 1}`,
      candidateId: 1,
      sessionId: 1,
      baseImageKey: candidateRow.imageKey as string,
      baseInternalPrompt: candidateRow.internalPrompt,
      claimedInstructions: input.instructions,
      claimedDeltas: input.deltas,
    };
  }),
  markVariantDispatched: vi.fn(async () => true),
  VariantLandingError: class extends Error {},
  landVariant: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("land");
    landedVariant = input;
  }),
  failVariant: vi.fn(async () => {
    journal.push("fail");
    return true;
  }),
}));

vi.mock("../db/credits", () => ({
  deductCredits: vi.fn(async (
    _userId: number,
    amount: number,
    _type: string,
    _label: string,
    reference: string,
  ) => {
    journal.push("deduct");
    if (!chargeSucceeds) return { success: false, error: "Not enough credits" };
    ledger.charges.push({ amount, reference });
    return { success: true };
  }),
}));

vi.mock("../casting/atomicCredits", () => ({
  recordRefund: vi.fn(async (_userId: number, amount: number, description: string) => {
    journal.push("refund");
    ledger.refunds.push({ amount, description });
    return { recorded: true };
  }),
  refundReferenceFor: (reference: string) => `refund:${reference}`,
}));

vi.mock("../db/generationOperations", () => ({
  markGenerationOperationRunning: vi.fn(async () => {
    journal.push("running");
  }),
}));

vi.mock("../casting/directOperation", () => ({
  beginDirectOperation: vi.fn(async () => {
    journal.push("begin");
    return { type: "claimed", operationId: "11111111-1111-4111-8111-111111111111" };
  }),
  completeDirectOperationSuccess: vi.fn(async () => {
    journal.push("seal:success");
  }),
  completeDirectOperationFailure: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:failure");
    throw input.error;
  }),
  failClaimedDirectOperation: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:claimed-failure");
    throw input.error;
  }),
}));

vi.mock("../storage", () => ({
  storageReadBytes: vi.fn(async () => ({ bytes: Buffer.from("base"), contentType: "image/png" })),
  storagePut: vi.fn(async (key: string) => ({ key, url: `https://cdn.example/${key}` })),
}));

vi.mock("../db/connection", () => ({
  withTransaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) => run({})),
}));

/*
  The register-before-write manifest. Journalled because its ORDER is the point:
  the key must be handed to the cleanup worker before the bytes exist, or a
  crash strands a paid picture of a person at a permanent public URL.
*/
vi.mock("../db/storageCleanup", () => ({
  createStorageCleanupManifestIn: vi.fn(async () => {
    journal.push("manifest");
    return { id: "batch-1" };
  }),
}));

vi.mock("./renderFault", () => ({
  detectRenderFault: vi.fn(async () => ({
    fault: renderFault,
    reason: renderFault ? "seam" : "clean",
    detail: "a horizontal seam",
  })),
}));

vi.mock("./signEngine", () => ({
  castingIdentityEngine: () => ({
    id: "test",
    editWithReferences: vi.fn(async () => {
      journal.push("generate");
      if (engineThrows) throw engineThrows;
      return {
        bytes: Buffer.from("refined"),
        contentType: "image/png",
        width: 1024,
        height: 1536,
        latencyMs: 10,
        provenance: { provider: "fal", model: "nbp", providerRef: "req-1" },
      };
    }),
    generateView: vi.fn(),
  }),
}));

const { refineCandidate } = await import("./refineService");

beforeEach(() => {
  journal.length = 0;
  ledger.charges.length = 0;
  ledger.refunds.length = 0;
  chargeSucceeds = true;
  engineThrows = null;
  renderFault = false;
  landedVariant = null;
  variantRows = [];
  candidateRow = {
    id: 1,
    publicId: "candidate-public",
    imageKey: "casting-v2/candidates/abc.png",
    signedCastId: null,
    selectedVariantPublicId: null,
    internalPrompt: {
      prompt: "the composed casting instruction",
      resolved: {
        sex: "female",
        ageBand: "30s",
        energy: "warm",
        heritage: [{ heritage: "Nordic", pct: 100 }],
        realized: { eyeColour: "brown", eyeShape: null },
      },
    },
  };
  vi.clearAllMocks();
});

const input = {
  userId: 1,
  clientRequestId: "22222222-2222-4222-8222-222222222222",
  candidatePublicId: "candidate-public",
  instruction: "make her eyes green",
};

const greenEyes = { interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" as const } }) };

describe("refusals land before anything is claimed", () => {
  /*
    §10's whole argument. An out-of-tier ask is a real thing a user will type,
    and it must cost nothing and say so at once — not take 25 credits to make a
    picture that was never going to be what they asked for.
  */
  it("refuses an out-of-tier instruction for free", async () => {
    await expect(refineCandidate(
      { interpret: async () => ({ ok: false, refusal: { reason: "out_of_tier", asked: "her age" } }) },
      { ...input, instruction: "make her older" },
    )).rejects.toThrow(/can't change her age yet/);

    expect(journal).not.toContain("begin");
    expect(journal).not.toContain("deduct");
    expect(ledger.charges).toHaveLength(0);
  });

  it("refuses when the interpreter cannot be reached, rather than guessing", async () => {
    await expect(refineCandidate(
      { interpret: async () => ({ ok: false, refusal: { reason: "unreadable" } }) },
      input,
    )).rejects.toThrow(/Nothing was charged/);
    expect(ledger.charges).toHaveLength(0);
  });

  it("refuses a candidate that has already been signed", async () => {
    candidateRow.signedCastId = 42;
    await expect(refineCandidate(greenEyes, input)).rejects.toThrow(/already been signed/);
    expect(journal).not.toContain("begin");
  });

  it("refuses a real TOO_MANY_REQUESTS when the queue is full, before the claim", async () => {
    await expect(refineCandidate(
      { ...greenEyes, admit: () => false },
      input,
    )).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(journal).not.toContain("begin");
    expect(ledger.charges).toHaveLength(0);
  });
});

describe("the order, and the money", () => {
  it("claims, runs, charges, generates, lands — in that order", async () => {
    await refineCandidate(greenEyes, input);
    expect(journal).toEqual([
      "read", "begin", "claim", "running", "deduct", "generate", "manifest", "land", "seal:success",
    ]);
    expect(ledger.charges).toEqual([
      { amount: 25, reference: "op:11111111-1111-4111-8111-111111111111:charge" },
    ]);
    expect(ledger.refunds).toHaveLength(0);
  });

  it("never charges when the deduct is refused, and fails the variant row", async () => {
    chargeSucceeds = false;
    await expect(refineCandidate(greenEyes, input)).rejects.toThrow(/Not enough credits/);
    expect(ledger.charges).toHaveLength(0);
    expect(ledger.refunds).toHaveLength(0);
    /* The claimed row must not sit there queued forever. */
    expect(journal).toContain("fail");
  });

  it("gives back the WHOLE charge when the generation throws", async () => {
    engineThrows = new Error("the provider fell over");
    await expect(refineCandidate(greenEyes, input)).rejects.toThrow();
    expect(ledger.refunds).toEqual([
      { amount: 25, description: "Refine refunded — the generation failed" },
    ]);
    expect(ledger.charges.at(-1)?.amount).toBe(ledger.refunds.at(-1)?.amount);
  });

  /*
    D-93's alarm, borrowed. A seamed frame is not something anyone should pay 25
    credits to receive, and the ledger line says what actually happened rather
    than blaming a provider that did its job.
  */
  it("refunds a damaged frame, and says so honestly on the receipt", async () => {
    renderFault = true;
    await expect(refineCandidate(greenEyes, input)).rejects.toThrow();
    expect(ledger.refunds).toEqual([
      { amount: 25, description: "Refine refunded — the image came back damaged" },
    ]);
  });
});

describe("the record and the picture come from the same place", () => {
  it("writes the composed edit into the variant's identity", async () => {
    await refineCandidate(greenEyes, input);
    const internal = landedVariant?.internalPrompt as { prompt: string; resolved: Record<string, unknown> };
    expect(internal.resolved).toMatchObject({ realized: { eyeColour: "green" } });
    /* The prompt is derived from the same delta — never the raw sentence. */
    expect(internal.prompt).toContain("green");
    expect(internal.prompt).not.toContain("make her eyes green");
  });

  /*
    BASE-ANCHORING. Every variant is one edit of the ORIGINAL, so drift cannot
    accumulate: the tenth refinement is as close to the face the user picked as
    the first. This asserts the reference is the candidate's own image even when
    a refinement is already selected.
  */
  it("edits the ORIGINAL even when a variant is selected", async () => {
    variantRows = [{
      id: 500,
      publicId: "variant-1",
      imageKey: "casting-v2/variants/first.png",
      instructions: ["make her eyes green"],
      deltas: { eyeColour: "green" },
      internalPrompt: { prompt: "p", resolved: { realized: { eyeColour: "green" } } },
    }];
    candidateRow.selectedVariantPublicId = "variant-1";

    const { claimVariant } = await import("../db/castingV2Variants");
    await refineCandidate(
      { interpret: async () => ({ ok: true as const, delta: { eyeShape: "hooded" as const } }) },
      { ...input, instruction: "hood her eyes a little" },
    );
    const claimed = vi.mocked(claimVariant).mock.results[0].value as Promise<Record<string, unknown>>;
    expect((await claimed).baseImageKey).toBe("casting-v2/candidates/abc.png");
  });

  /*
    The stack extends the SELECTED variant, not the newest one — which is what
    makes "edit from here" branch instead of appending to whatever came last,
    and what stops every earlier instruction being repeated once per variant.
  */
  it("extends the selected variant's stack, without repeating its instructions", async () => {
    variantRows = [{
      id: 500,
      publicId: "variant-1",
      imageKey: "casting-v2/variants/first.png",
      instructions: ["make her eyes green"],
      deltas: { eyeColour: "green" },
      internalPrompt: { prompt: "p", resolved: { realized: { eyeColour: "green" } } },
    }];
    candidateRow.selectedVariantPublicId = "variant-1";

    const { claimVariant } = await import("../db/castingV2Variants");
    await refineCandidate(
      { interpret: async () => ({ ok: true as const, delta: { eyeShape: "hooded" as const } }) },
      { ...input, instruction: "hood her eyes a little" },
    );
    const call = vi.mocked(claimVariant).mock.calls[0][0];
    expect(call.instructions).toEqual(["make her eyes green", "hood her eyes a little"]);
    /* Both edits survive, because composition is per-axis. */
    expect(call.deltas).toEqual({ eyeColour: "green", eyeShape: "hooded" });
  });
});

/**
 * The three money holes Fable found, each with the test that would catch it.
 *
 * All three were the same shape: a state where the ledger and the row disagree,
 * or where the receipt and the number beside it disagree. None of them threw.
 */
describe("the landing cannot half-commit, and the receipt cannot lie", () => {
  it("registers the object for cleanup BEFORE the bytes exist", async () => {
    await refineCandidate(greenEyes, input);
    /*
      Order, not presence. A manifest written after the put leaves the window
      it exists to close — the crash lands between them.
    */
    expect(journal.indexOf("manifest")).toBeLessThan(journal.indexOf("land"));
    expect(journal.indexOf("manifest")).toBeGreaterThan(journal.indexOf("generate"));
  });

  /*
    `landVariant` now THROWS rather than returning false, because
    `withTransaction` commits on any non-throw return: a boolean would have
    committed a `ready` variant that nothing points at, while the caller
    refunded it in full. Ready picture plus full refund, and the sweep would
    read the same row as a durable success and keep the charge.
  */
  it("refunds the whole charge when the landing refuses, with nothing half-written", async () => {
    const { landVariant } = await import("../db/castingV2Variants");
    vi.mocked(landVariant).mockRejectedValueOnce(new Error("not_selectable"));

    await expect(refineCandidate(greenEyes, input)).rejects.toThrow();
    expect(ledger.refunds).toEqual([
      { amount: 25, description: "Refine refunded — the generation failed" },
    ]);
    expect(ledger.charges.at(-1)?.amount).toBe(ledger.refunds.at(-1)?.amount);
  });

  /*
    The receipt is persisted and replayed to whoever asks about the operation
    later, so a message promising money back beside `refundedCredits: 0` is a
    receipt claiming money moved when it did not.
  */
  it("never promises a refund that did not record", async () => {
    const { recordRefund } = await import("../casting/atomicCredits");
    vi.mocked(recordRefund).mockResolvedValueOnce({ recorded: false } as never);
    engineThrows = new Error("the provider fell over");

    await expect(refineCandidate(greenEyes, input))
      .rejects.toThrow(/could not be recorded — quote operation/);
  });
});
