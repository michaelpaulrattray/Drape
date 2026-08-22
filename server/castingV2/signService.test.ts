import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Sign ceremony's ORDER and its MONEY (plan §F, §H.4, D-92).
 *
 * Sign inverts the roll's ordering: the charge comes BEFORE the durable
 * boundary, because that boundary creates authority — a Cast, and a spent
 * candidate — and an unpaid Cast is unacceptable. Everything in between must
 * therefore be compensable, and this file is the proof, case by case, of the
 * one invariant the whole design serves:
 *
 *   **authority exists ⟹ money was taken.**
 *
 * The sequence is asserted as an OBSERVED ORDER of calls rather than by reading
 * the code, because the adjudicator's verdicts are only correct while that
 * order holds: swap the deduct and the boundary and a crash between them
 * silently produces a free Cast; move the manifest after the copy and a crash
 * leaks a customer's face into the bucket with nothing pointing at it.
 */

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const journal: string[] = [];

const ledger = {
  charges: [] as Array<{ amount: number; reference: string }>,
  refunds: [] as Array<{ amount: number; reference: string }>,
};
/**
 * THE SHEET THIS CANDIDATE WAS CAST ON WEARS — the two paths (design §3.1).
 *
 * Both NULL is every Cast signed to date: the sheet was cast before the paths
 * existed. Mutable so the wardrobe arms can move it and everything else keeps
 * exercising the unpathed product.
 */
/** Every `buildPackage` call's argument object, in order. */
const packageInputs: Record<string, unknown>[] = [];

let rollWardrobe: { path: "wardrobe" | "basics" | null; line: string | null } = {
  path: null,
  line: null,
};

let chargeSucceeds = true;
let refundRecords = true;

/** The candidate row, with a REAL compare-and-set on it. */
const candidateRow = {
  id: 55,
  publicId: "candidate-public",
  status: "ready" as string,
  signedCastId: null as number | null,
  imageKey: "casting-v2/candidates/abc.png",
  thumbKey: "casting-v2/candidates/abc-thumb.png",
  personaLine: "Dry and flat",
  position: 3,
  internalPrompt: { prompt: "the composed casting instruction", resolved: { sex: "female" } },
};

/**
 * The selected refinement, when the test sets one (M8 §11/§14).
 *
 * Null in every test that predates Refine, which is the parity these suites
 * prove: with nothing selected, Sign must behave exactly as it did.
 */
let selectedVariant: {
  id: number;
  publicId: string;
  imageKey: string;
  thumbKey: string | null;
  internalPrompt: unknown;
} | null = null;

/** What the durable boundary was actually handed, for the record-lies checks. */
const boundaryInputs: Array<Record<string, unknown>> = [];
/** Which object the anchor was copied FROM. */
const copiedFrom: string[] = [];

const casts: Array<{ modelId: number; agencyId: string; candidateId: number }> = [];
let nextModelId = 900;
let copyThrows = false;
let manifestThrows = false;
const cleanupBatches: string[] = [];
const receipts: Array<Record<string, unknown>> = [];

class TestSignPersistenceError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

vi.mock("./spendGuards", () => ({ assertNotFrozen: vi.fn(async () => undefined) }));

vi.mock("../db/castingV2Sign", () => ({
  SignPersistenceError: TestSignPersistenceError,
  getSignableCandidate: vi.fn(async () => {
    journal.push("read");
    if (candidateRow.status !== "ready") return null;
    return {
      candidate: candidateRow,
      face: selectedVariant
        ? {
          variantId: selectedVariant.id,
          variantPublicId: selectedVariant.publicId,
          imageKey: selectedVariant.imageKey,
          thumbKey: selectedVariant.thumbKey,
          internalPrompt: selectedVariant.internalPrompt,
          /* The branch's composed state, read in the same statement as its
             pixels — which is what says WHICH tattoos this face wears. */
          deltas: (selectedVariant as { deltas?: unknown }).deltas ?? null,
        }
        : {
          variantId: null,
          variantPublicId: null,
          imageKey: candidateRow.imageKey,
          thumbKey: candidateRow.thumbKey,
          internalPrompt: candidateRow.internalPrompt,
          /* The pristine master, which wears nothing. */
          deltas: null,
        },
      roll: {
        id: 22,
        publicId: "roll-public",
        briefText: "a redhead in her 30s",
        cohortKey: "photoreal-human",
        styleKey: null,
        styleProfile: null,
        createdAt: new Date("2026-08-02T10:00:00Z"),
        /* The two paths. NULL on both is every Cast signed to date — the sheet
           was cast before the paths existed. Overridden by the arms that care. */
        path: rollWardrobe.path,
        wardrobeLine: rollWardrobe.line,
      },
      session: { id: 10, publicId: "session-public" },
    };
  }),
  signCandidateIntoCast: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("boundary");
    boundaryInputs.push(input);
    /*
      The CAS, for real: `status='ready' AND signedCastId IS NULL`, plus the
      selection fence. Null-safe on both sides, mirroring the `<=>` in the
      statement — a JS `===` between two nulls is true, which is precisely the
      behaviour SQL needed `<=>` to get.
    */
    if (candidateRow.status !== "ready" || candidateRow.signedCastId !== null) {
      throw new TestSignPersistenceError("candidate_unavailable");
    }
    if ((input.selectedVariantId ?? null) !== (selectedVariant?.id ?? null)) {
      throw new TestSignPersistenceError("candidate_unavailable");
    }
    nextModelId += 1;
    candidateRow.status = "signed";
    candidateRow.signedCastId = nextModelId;
    // The manifest is discharged inside the same transaction.
    const index = cleanupBatches.indexOf(input.cleanupBatchId as string);
    if (index >= 0) cleanupBatches.splice(index, 1);
    casts.push({
      modelId: nextModelId,
      agencyId: input.agencyId as string,
      candidateId: input.candidateId as number,
    });
    return {
      modelId: nextModelId,
      agencyId: input.agencyId as string,
      anchorAssetId: 1,
      identitySnapshotId: "snapshot-1",
      identityRevisionId: input.identityRevisionId as string,
    };
  }),
}));

vi.mock("../db/credits", () => ({
  deductCredits: vi.fn(async (_userId: number, amount: number, _type: string, _label: string, reference: string) => {
    journal.push("deduct");
    if (!chargeSucceeds) return { success: false, error: "Not enough credits" };
    ledger.charges.push({ amount, reference });
    return { success: true };
  }),
}));

vi.mock("../casting/atomicCredits", () => ({
  recordRefund: vi.fn(async (_userId: number, amount: number, _label: string, chargeReference: string) => {
    journal.push("refund");
    const reference = `refund:${chargeReference}`;
    if (!refundRecords) return { recorded: false, amount: 0, reference };
    if (ledger.refunds.some((entry) => entry.reference === reference)) {
      // The ledger's uniqueness: a repeated reference is a no-op, not a second
      // refund.
      return { recorded: true, amount, reference };
    }
    ledger.refunds.push({ amount, reference });
    return { recorded: true, amount, reference };
  }),
  refundReferenceFor: (reference: string) => `refund:${reference}`,
}));

vi.mock("../casting/directOperation", () => ({
  beginDirectOperation: vi.fn(async () => {
    journal.push("claim");
    return { type: "execute", operationId: OPERATION_ID };
  }),
  completeDirectOperationFailure: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:failure");
    receipts.push({ kind: "failure", ...input });
    throw input.error;
  }),
  failClaimedDirectOperation: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:claimed-failure");
    receipts.push({ kind: "claimed-failure", ...input });
    throw input.error;
  }),
}));

vi.mock("../db/generationOperations", () => ({
  markGenerationOperationRunning: vi.fn(async () => {
    journal.push("running");
  }),
  finalizeGenerationOperationSuccess: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:success");
    receipts.push({ kind: "success", ...input });
  }),
  bindGenerationOperationModel: vi.fn(async () => {
    journal.push("bind");
  }),
  markGenerationOperationRecoveryRequired: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:recovery");
    receipts.push({ kind: "recovery", ...input });
  }),
}));

vi.mock("../db/storageCleanup", () => ({
  createStorageCleanupManifestIn: vi.fn(async (_tx: unknown, input: Record<string, unknown>) => {
    journal.push("manifest");
    if (manifestThrows) throw new Error("manifest failed");
    cleanupBatches.push(input.id as string);
    return { id: input.id as string };
  }),
}));

vi.mock("../db/connection", () => ({
  withTransaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) => run({})),
}));

vi.mock("../storage", () => ({
  storageCopyExact: vi.fn(async (input: { sourceKey: string; destinationKey: string }) => {
    journal.push("copy");
    copiedFrom.push(input.sourceKey);
    if (copyThrows) throw new Error("copy failed");
    return {
      key: input.destinationKey,
      url: `https://cdn.example/${input.destinationKey}`,
      byteSize: 10,
      contentHash: "hash",
      contentType: "image/png",
    };
  }),
  storageReadBytes: vi.fn(async () => ({ bytes: Buffer.from("anchor"), contentType: "image/png" })),
  storagePut: vi.fn(async () => ({ key: "k", url: "u" })),
  storageDelete: vi.fn(async () => ({ success: true })),
  storagePublicUrl: (key: string) => `https://cdn.example/${key}`,
}));

const { carriedInkPlates, signCandidate } = await import("./signService");
const { CASTING_V2_SIGN_PRICE_CREDITS } = await import("./castViewPackage");
const { basicsWardrobeLine } = await import("./wardrobeLine");

/** A package that behaves however the case needs it to. */
/** What the package build is handed — typed so `mock.calls` carries it, rather
 *  than recording the arguments and handing them back as `never`. */
type PackageBuildInput = {
  userId: number;
  operationId: string;
  anchor: { bytes: Buffer; contentType: string };
  inkPlates?: ReadonlyArray<{
    designPublicId: string;
    placement: string;
    side: string;
    bytes: Buffer;
    contentType: string;
  }>;
  /* The delivered-crop lane's half of the same wire. */
  inkCrops?: ReadonlyArray<{
    cropPublicId: string;
    slot: string;
    placement: string;
    side: string;
    noun: string;
    bytes: Buffer;
    contentType: string;
  }>;
  pronouns?: { subject: string; object: string; possessive: string; plural: boolean };
};

function packageReturning(result: {
  committed?: number;
  failed?: number;
  refundedCredits?: number;
  refundUnrecorded?: boolean;
}) {
  return vi.fn(async (_dependencies: unknown, buildInput: PackageBuildInput) => {
    journal.push("package");
    /* What the package was actually asked to build — the wire the wardrobe
       line has to cross, and the one a snapshot arm cannot see. */
    packageInputs.push(buildInput as unknown as Record<string, unknown>);
    return {
      committed: Array.from({ length: result.committed ?? 5 }, () => "frontFull" as const),
      failed: Array.from({ length: result.failed ?? 0 }, () => "backFull" as const),
      refundedCredits: result.refundedCredits ?? 0,
      refundUnrecorded: result.refundUnrecorded ?? false,
      activated: true,
      totalLoss: (result.committed ?? 5) === 0,
    };
  });
}

/** Tests await the package; production detaches it. */
const awaitPackage = (run: () => Promise<void>) => run();

beforeEach(() => {
  journal.length = 0;
  ledger.charges.length = 0;
  ledger.refunds.length = 0;
  receipts.length = 0;
  cleanupBatches.length = 0;
  boundaryInputs.length = 0;
  copiedFrom.length = 0;
  casts.length = 0;
  chargeSucceeds = true;
  refundRecords = true;
  /* A stateful fixture re-establishes its state in front of every row it is
     asked about — the census corpus's own first law, arriving in a unit suite. */
  rollWardrobe = { path: null, line: null };
  packageInputs.length = 0;
  copyThrows = false;
  manifestThrows = false;
  candidateRow.status = "ready";
  candidateRow.signedCastId = null;
  selectedVariant = null;
  vi.clearAllMocks();
});

const input = {
  userId: 1,
  clientRequestId: "22222222-2222-4222-8222-222222222222",
  candidatePublicId: "candidate-public",
  name: "Nine",
};

describe("the Sign ceremony's order", () => {
  it("charges BEFORE the durable boundary, and registers the copy before making it", async () => {
    await signCandidate(
      { schedulePackage: awaitPackage, buildPackage: packageReturning({}) },
      input,
    );

    expect(journal).toEqual([
      "read",
      "claim",
      "running",
      "deduct",
      "manifest",
      "copy",
      "boundary",
      "package",
      "bind",
      "seal:success",
    ]);
  });

  it("binds the Cast to its receipt before the receipt is sealed", async () => {
    // `bindGenerationOperationModel` is gated on `running`; sealing first would
    // make it a control that is never on the path.
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(journal.indexOf("bind")).toBeLessThan(journal.indexOf("seal:success"));
  });
});

describe("Sign's money", () => {
  it("takes the whole price once, and gives nothing back when everything lands", async () => {
    const result = await signCandidate(
      { schedulePackage: awaitPackage, buildPackage: packageReturning({}) },
      input,
    );

    expect(result.chargedCredits).toBe(CASTING_V2_SIGN_PRICE_CREDITS);
    expect(ledger.charges).toHaveLength(1);
    expect(ledger.charges[0].amount).toBe(450);
    expect(ledger.refunds).toHaveLength(0);
    expect(casts).toHaveLength(1);
    expect(receipts.at(-1)).toMatchObject({ kind: "success", chargedCredits: 450, refundedCredits: 0 });
  });

  it("refuses for free when the balance is short — no claim spent, no candidate spent", async () => {
    chargeSucceeds = false;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow(/Not enough credits/);

    expect(ledger.charges).toHaveLength(0);
    expect(ledger.refunds).toHaveLength(0);
    expect(casts).toHaveLength(0);
    expect(candidateRow.status).toBe("ready");
    expect(receipts.at(-1)).toMatchObject({ kind: "failure", chargedCredits: 0, refundedCredits: 0 });
  });

  /**
   * D-92's crash table, row "deduct / copy": a charge exists, the CAS is unset
   * and no model exists. That is a PAID failure and the whole price goes back.
   */
  it("refunds the whole price when the copy fails after the charge", async () => {
    copyThrows = true;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow();

    expect(ledger.charges[0].amount).toBe(450);
    expect(ledger.refunds).toHaveLength(1);
    expect(ledger.refunds[0].amount).toBe(450);
    // The candidate is untouched: it can be signed again.
    expect(candidateRow.status).toBe("ready");
    expect(candidateRow.signedCastId).toBeNull();
    expect(casts).toHaveLength(0);
  });

  it("leaves the copy owned by its cleanup manifest when the boundary never commits", async () => {
    copyThrows = true;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow();

    // The manifest survives the failure — the worker deletes the orphan. If the
    // manifest were registered after the copy, this list would be empty and the
    // object would be unreachable forever.
    expect(cleanupBatches).toHaveLength(1);
  });

  it("discharges the manifest inside the boundary, so a live Cast's anchor is never swept", async () => {
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(cleanupBatches).toHaveLength(0);
  });

  it("tells the truth when a refund does not record", async () => {
    copyThrows = true;
    refundRecords = false;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow(/support will restore the balance/);
    expect(receipts.at(-1)).toMatchObject({ chargedCredits: 450, refundedCredits: 0 });
  });
});

describe("the double Sign", () => {
  /**
   * Two distinct `clientRequestId`s racing one candidate charge twice by
   * construction — idempotency is per request, and neither request is a replay
   * of the other. The CAS decides who gets the Cast; the loser must take the
   * paid-failure exit.
   *
   * The assertion the review asked for is the LOSER'S MONEY, not merely the
   * winner's Cast: a test that only checks "one Cast exists" passes just as
   * happily when the loser was charged 500 and never refunded.
   */
  it("gives exactly one Cast, and gives the loser every credit back", async () => {
    const deps = { schedulePackage: awaitPackage, buildPackage: packageReturning({}) };
    const first = signCandidate(deps, input);
    const second = signCandidate(deps, {
      ...input,
      clientRequestId: "33333333-3333-4333-8333-333333333333",
    }).catch((error: Error) => error);

    const winner = await first;
    const loser = await second;

    expect(casts).toHaveLength(1);
    expect(winner.castPublicId).toBeTruthy();
    expect(loser).toBeInstanceOf(Error);
    expect((loser as Error).message).toMatch(/already signed or discarded/);

    // Both were charged — that is the construction, not a bug.
    expect(ledger.charges).toHaveLength(2);
    // And exactly one full refund exists: the loser's.
    expect(ledger.refunds).toHaveLength(1);
    expect(ledger.refunds[0].amount).toBe(450);
    // Conservation: the money kept equals one Sign.
    const charged = ledger.charges.reduce((sum, entry) => sum + entry.amount, 0);
    const refunded = ledger.refunds.reduce((sum, entry) => sum + entry.amount, 0);
    expect(charged - refunded).toBe(450);
  });

  it("refuses a candidate that was signed by an earlier ceremony", async () => {
    candidateRow.status = "signed";
    candidateRow.signedCastId = 901;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow(/discarded, expired, or already signed/);
    // Refused before the claim: free.
    expect(ledger.charges).toHaveLength(0);
  });
});

describe("the package's money, after the boundary", () => {
  it("keeps the promotion and refunds only the views that failed", async () => {
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({ committed: 3, failed: 2, refundedCredits: 100 }),
      },
      input,
    );

    // 450 charged, 2 × 50 back. The promotion is never refunded once the CAS is
    // set — the customer has the locked face it bought.
    expect(ledger.charges[0].amount).toBe(450);
    expect(receipts.at(-1)).toMatchObject({
      kind: "success",
      chargedCredits: 450,
      refundedCredits: 100,
      terminalStatus: "partial",
    });
    expect(casts).toHaveLength(1);
  });

  it("still delivers a Cast when every view fails, and refunds every view", async () => {
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({ committed: 0, failed: 5, refundedCredits: 250 }),
      },
      input,
    );

    expect(receipts.at(-1)).toMatchObject({
      chargedCredits: 450,
      refundedCredits: 250,
      terminalStatus: "partial",
    });
    // 200 kept — the promotion, which is exactly what was delivered.
    expect(candidateRow.status).toBe("signed");
  });

  it("never seals a clean receipt over a refund that did not record", async () => {
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({ committed: 4, failed: 1, refundedCredits: 0, refundUnrecorded: true }),
      },
      input,
    );

    expect(receipts.at(-1)).toMatchObject({ kind: "recovery" });
    expect(journal).not.toContain("seal:success");
  });

  it("leaves the Cast standing when the package throws — the sweep finishes it", async () => {
    const exploding = vi.fn(async () => {
      throw new Error("the package exploded");
    });
    // The mutation resolves: the Cast exists, and that is what the customer is
    // told. Nothing is refunded here, because nothing here knows what landed.
    const result = await signCandidate(
      { schedulePackage: awaitPackage, buildPackage: exploding },
      input,
    );
    expect(result.castPublicId).toBeTruthy();
    expect(casts).toHaveLength(1);
    expect(journal).not.toContain("seal:success");
    expect(ledger.refunds).toHaveLength(0);
  });
});

/**
 * WHAT A CAST IS WEARING, SNAPSHOTTED AT SIGN (design §3.1 and condition (v)).
 *
 * A Cast is immutable at Sign, so the outfit its six views are composed from
 * and judged against has to be decided here, once. The arms below assert on
 * `technicalSchema` — the sensitive blob that never crosses a projection
 * boundary — because that is where the recipe for reproducing this Cast lives.
 */
describe("the Cast's wardrobe snapshot", () => {
  it("⚠ UNPATHED is what every Cast signed to date carries, and it says so", async () => {
    /*
      NULL on both columns is not an error and never becomes one: it means the
      sheet was cast before the paths existed. The snapshot has to be able to
      SAY that rather than resolve to a house line, or a Cast that predates the
      feature becomes indistinguishable from one that chose Wardrobe.
    */
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    const boundary = boundaryInputs.at(-1)!;
    expect(boundary.technicalSchema).toMatchObject({
      wardrobe: { path: null, line: null, source: null },
    });
  });

  it("carries the roll's born line and where it came from", async () => {
    rollWardrobe = { path: "wardrobe", line: "a red apron over a plain white tee" };
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(boundaryInputs.at(-1)!.technicalSchema).toMatchObject({
      wardrobe: {
        path: "wardrobe",
        line: "a red apron over a plain white tee",
        source: "born",
      },
    });
  });

  it("carries the BASICS path, which is a different promise", async () => {
    rollWardrobe = { path: "basics", line: "shirtless, in plain black fitted shorts, barefoot" };
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(boundaryInputs.at(-1)!.technicalSchema).toMatchObject({
      wardrobe: { path: "basics", source: "born" },
    });
  });

  it("⚠ AT THE WIRE — the package is BUILT from the line the Cast records", async () => {
    /*
      The seam a snapshot arm cannot see, and it was genuinely untested until a
      sabotage said so: replacing this hand-off with `null` left 81 arms green.
      The six views are composed from this value and the judge judges against
      it, so what matters is that the sentence crossing into the package is the
      Cast's own — not re-resolved at the call site, where it could differ from
      the record by the time anyone compares them.
    */
    rollWardrobe = { path: "wardrobe", line: "a red apron over a plain white tee" };
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(packageInputs).toHaveLength(1);
    expect(packageInputs[0].wardrobeLine).toBe("a red apron over a plain white tee");
  });

  it("⚠ CONTROL — an unpathed Cast builds its package with no line at all", async () => {
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(packageInputs).toHaveLength(1);
    expect(packageInputs[0].wardrobeLine).toBeNull();
  });

  it("⚠ the outfit is NOT folded into the identity fingerprint", async () => {
    /*
      `identityText` opens "THIS PERSON MUST MATCH THE REFERENCE IMAGE EXACTLY"
      and is hashed onto the identity snapshot. An outfit is not a fact about a
      face — folding one in would make two Casts of the same person in different
      clothes read as two different people to everything that compares the
      fingerprint.
    */
    rollWardrobe = { path: "wardrobe", line: "a red apron over a plain white tee" };
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    const boundary = boundaryInputs.at(-1)!;
    expect(boundary.identityText).not.toContain("apron");
    /* CONTROL — the same string DOES carry the identity, so the arm above is
       reading an exclusion and not an empty field. */
    expect(boundary.identityText).toContain("IDENTITY");
  });
});

/**
 * Signing a REFINED face — §11's first landmine, and the fence that guards it.
 *
 * The whole reason Refine touches Sign at all. A refined candidate has two
 * faces on file: the original the sheet rolled, and the variant the user asked
 * for and is looking at. Sign must take BOTH the pixels and the identity
 * documents from the second one, and it must take them from the same read —
 * because a Cast's masterPrompt and technicalSchema are what every future
 * generation of that person is reproduced from, and a Cast whose record
 * describes a face it does not have is wrong permanently and silently.
 */
describe("Sign reads the selected face, not the candidate", () => {
  const REFINED = {
    id: 77,
    publicId: "variant-public",
    imageKey: "casting-v2/variants/refined.png",
    thumbKey: null,
    internalPrompt: {
      prompt: "the composed casting instruction, with green eyes",
      resolved: { sex: "female", eyeColour: "green" },
    },
  };

  it("copies the VARIANT's pixels and snapshots the VARIANT's record", async () => {
    selectedVariant = REFINED;
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);

    expect(copiedFrom).toEqual([REFINED.imageKey]);
    const boundary = boundaryInputs.at(-1)!;
    expect(boundary.masterPrompt).toBe(REFINED.internalPrompt.prompt);
    expect(boundary.technicalSchema).toMatchObject({ subject: { eyeColour: "green" } });
    expect(boundary.identityText).toContain("green");
    /* Lineage names the refinement, so the record does not credit the original. */
    expect(boundary.preferences).toMatchObject({ sourceVariantPublicId: REFINED.publicId });
  });

  it("still signs the original when nothing is selected, and says so in lineage", async () => {
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);

    expect(copiedFrom).toEqual([candidateRow.imageKey]);
    expect(boundaryInputs.at(-1)!.masterPrompt).toBe("the composed casting instruction");
    expect(boundaryInputs.at(-1)!.preferences).toMatchObject({ sourceVariantPublicId: null });
  });

  /*
    THE NULL FENCE. `selectedVariantId` is NULL for every candidate nobody has
    refined, and SQL's `x = NULL` is never true — so a fence written as ordinary
    equality would fail EVERY Sign in the product, not just the racing ones.
    The statement uses `<=>`; this is the case that would have caught it.
  */
  it("passes the fence when nothing was selected and nothing is selected", async () => {
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);

    expect(boundaryInputs.at(-1)!.selectedVariantId).toBeNull();
    expect(casts).toHaveLength(1);
    expect(ledger.refunds).toHaveLength(0);
  });

  it("arms the fence with the value it QUOTED, so a switch mid-Sign refunds", async () => {
    selectedVariant = REFINED;
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(boundaryInputs.at(-1)!.selectedVariantId).toBe(REFINED.id);

    /*
      Now the user switches selection between the quote and the commit. The CAS
      finds a different pointer and refuses; the money comes back whole, exactly
      as it does for a candidate discarded mid-Sign.
    */
    candidateRow.status = "ready";
    candidateRow.signedCastId = null;
    ledger.charges.length = 0;
    ledger.refunds.length = 0;
    const stale = { ...REFINED };
    selectedVariant = stale;
    (
      vi.mocked(await import("../db/castingV2Sign")).getSignableCandidate as unknown as {
        mockImplementationOnce: (fn: () => Promise<unknown>) => void;
      }
    ).mockImplementationOnce(async () => {
      /* Quoted against the old variant… */
      const quoted = {
        candidate: candidateRow,
        face: {
          variantId: stale.id,
          variantPublicId: stale.publicId,
          imageKey: stale.imageKey,
          thumbKey: stale.thumbKey,
          internalPrompt: stale.internalPrompt,
        },
        roll: {
          id: 22,
          publicId: "roll-public",
          briefText: "a redhead in her 30s",
          cohortKey: "photoreal-human",
          styleKey: null,
          styleProfile: null,
          createdAt: new Date("2026-08-02T10:00:00Z"),
        },
        session: { id: 10, publicId: "session-public" },
      };
      /* …and the selection moves before the boundary runs. */
      selectedVariant = { ...REFINED, id: 78, publicId: "variant-public-2" };
      return quoted;
    });

    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow();
    expect(ledger.refunds.at(-1)?.amount).toBe(ledger.charges.at(-1)?.amount);
  });
});

/**
 * HER PLATED TATTOOS REACH THE PACKAGE, AND EVERY WAY ONE FAILS TO IS NAMED
 * (FOUNDER RULING, his words at fable-987 §3: *"tattoo reference will need to be
 * supplied to each view generated otherwise it wont know what the tattoo is"*;
 * the naming ordered fable-1004 §3).
 *
 * A reference that quietly did not ride is indistinguishable from a Cast with no
 * tattoo — and the customer paid for the tattoo. So each of the three ways a
 * plate can fail to travel has its own arm here, and each one asserts that the
 * SIGN STILL SUCCEEDS: a tattoo missing from five frames is a smaller harm than
 * five frames nobody gets.
 */
/*
  Driven UN-DEFERRED throughout: the mannequin road is parked (fable-1053 §2)
  and these arms describe the road itself, so they keep their subject alive for
  the day it resumes. The deferral's own arms live in
  `inkMannequinDeferral.test.ts`.
*/
describe("the tattoos a Sign carries into its views", () => {
  const plateRow = (over: Record<string, unknown> = {}) => ({
    designPublicId: "design-1",
    placement: "upperArm" as const,
    side: "left" as const,
    engine: "fal-ai/nano-banana-pro",
    storageKey: "casting-v2/candidates/plate-1.png",
    digest: "d".repeat(64),
    mime: "image/png",
    ...over,
  });

  it("hands the package one carried plate per design, with its surface", async () => {
    const buildPackage = packageReturning({});
    await signCandidate({
      schedulePackage: awaitPackage,
      buildPackage,
      mannequinDeferred: false, listInkPlates: async () => [plateRow(), plateRow({
        designPublicId: "design-2", placement: "neck", side: "centre",
        storageKey: "casting-v2/candidates/plate-2.png",
      })],
      readBytes: async (key: string) => ({
        bytes: Buffer.from(`bytes:${key}`), contentType: "image/png",
      }),
    }, input);

    const sent = buildPackage.mock.calls[0]![1];
    expect(sent.inkPlates).toBeDefined();
    if (!sent.inkPlates) return;
    expect(sent.inkPlates.map((plate) => plate.designPublicId)).toEqual(["design-1", "design-2"]);
    expect(sent.inkPlates.map((plate) => `${plate.side}:${plate.placement}`))
      .toEqual(["left:upperArm", "centre:neck"]);
    /* The PLATE's own bytes, read from the plate's key — not the anchor's, which
       is the other thing this function reads and the easy thing to hand over by
       accident. */
    expect(sent.inkPlates[0]!.bytes.toString()).toContain("plate-1.png");
  });

  it("carries NOTHING, and still signs, when the candidate has no plated design", async () => {
    const buildPackage = packageReturning({});
    await signCandidate({
      schedulePackage: awaitPackage, buildPackage, mannequinDeferred: false, listInkPlates: async () => [],
    }, input);

    const sent = buildPackage.mock.calls[0]![1];
    expect(sent.inkPlates).toEqual([]);
    expect(journal).toContain("package");
  });

  it("REFUSES to pick between two engines' plates of one design", async () => {
    /*
      Which artwork is HER tattoo is the plate court's open question. Taking the
      newest would be a quiet dispatch fallback — the class this product has
      already paid for — so the design rides no view and the log says which
      design and which engines. The OTHER design still rides: one ambiguous
      answer must not silence an unambiguous one.
    */
    const buildPackage = packageReturning({});
    await signCandidate({
      schedulePackage: awaitPackage,
      buildPackage,
      mannequinDeferred: false, listInkPlates: async () => [
        plateRow(),
        plateRow({ engine: "gpt-image-2", storageKey: "casting-v2/candidates/plate-1b.png" }),
        plateRow({ designPublicId: "design-2", placement: "neck", side: "centre" }),
      ],
      readBytes: async (key: string) => ({
        bytes: Buffer.from(`bytes:${key}`), contentType: "image/png",
      }),
    }, input);

    const sent = buildPackage.mock.calls[0]![1];
    expect(sent.inkPlates).toBeDefined();
    if (!sent.inkPlates) return;
    expect(sent.inkPlates.map((plate) => plate.designPublicId)).toEqual(["design-2"]);
  });

  it("drops a plate whose BYTES are gone, keeps the others, and still signs", async () => {
    /* The row is there and the object is not — retention, a failed write, a
       bucket outage. The picture cannot ride; the Cast is still worth having. */
    const buildPackage = packageReturning({});
    await signCandidate({
      schedulePackage: awaitPackage,
      buildPackage,
      mannequinDeferred: false, listInkPlates: async () => [
        plateRow(),
        plateRow({ designPublicId: "design-2", storageKey: "gone.png" }),
      ],
      readBytes: async (key: string) => {
        if (key === "gone.png") throw new Error("NoSuchKey");
        return { bytes: Buffer.from(`bytes:${key}`), contentType: "image/png" };
      },
    }, input);

    const sent = buildPackage.mock.calls[0]![1];
    expect(sent.inkPlates).toBeDefined();
    if (!sent.inkPlates) return;
    expect(sent.inkPlates.map((plate) => plate.designPublicId)).toEqual(["design-1"]);
    expect(journal).toContain("package");
  });

  /* A refined face WEARING a tattoo — the branch's composed state is what says
     so, and it is read in the same statement as its pixels. Male on purpose:
     "her" is this room's oldest scar, and a pronoun that is derived rather than
     assumed has to be provable from a Cast that is not one. */
  const inkedBranch = () => ({
    id: 77,
    publicId: "variant-public",
    imageKey: "casting-v2/variants/refined.png",
    thumbKey: null,
    internalPrompt: {
      prompt: "the composed casting instruction",
      resolved: { sex: "male", eyeColour: "green" },
    },
    deltas: { inkDelivered: { "ink:upperArm@left": "11111111-1111-4111-8111-111111111111" } },
  });

  it("carries the tattoos the BRANCH wears into the package, as crops of her own frame", async () => {
    /*
      THE WIRE, end to end through a real Sign (fable-1297 §3). The plate lane
      above has never carried anything in either world — its table is empty
      while the mannequin road is parked — and this is the lane that does.

      Asserted on what leaves the building rather than on a constant beside it.
    */
    selectedVariant = inkedBranch();
    const buildPackage = packageReturning({});

    await signCandidate({
      schedulePackage: awaitPackage,
      buildPackage,
      listInkDeliveryCrops: async () => [{
        publicId: "11111111-1111-4111-8111-111111111111",
        designPublicId: null,
        slot: "ink:upperArm@left",
        storageKey: "casting-v2/candidates/ink-delivery/arm.png",
        digest: createHash("sha256").update(Buffer.from("bytes:casting-v2/candidates/ink-delivery/arm.png")).digest("hex"),
        width: 224,
        height: 348,
      }] as never,
      readBytes: async (key: string) => ({
        bytes: Buffer.from(`bytes:${key}`), contentType: "image/png",
      }),
    }, input);

    const sent = buildPackage.mock.calls[0]![1];
    expect(sent.inkCrops?.map((crop) => crop.slot)).toEqual(["ink:upperArm@left"]);
    expect(sent.inkCrops?.[0]!.noun).toBe("left upper arm tattoo");
    /* And the Cast's own pronoun rides with it, from the documents this Sign
       just sealed rather than from a default. */
    expect(sent.pronouns?.possessive).toBe("his");
  });

  it("never sends one tattoo TWICE when a design has both a plate and a delivered crop", async () => {
    /*
      Unreachable in production — the mannequin road is parked, so no plate row
      exists — and closed at the moment both lanes exist rather than on the day
      the deferral lifts (working law 7 run forwards). Two pictures of one
      tattoo with two different sentences about what it is would be the shape
      the recipe assembler refuses outright one road along.

      The CROP wins, and not by accident of ordering: it is the ink as it
      actually sits on her, and the plate is artwork on a grey form.
    */
    selectedVariant = inkedBranch();
    const buildPackage = packageReturning({});

    await signCandidate({
      schedulePackage: awaitPackage,
      buildPackage,
      mannequinDeferred: false,
      listInkPlates: async () => [plateRow(), plateRow({
        designPublicId: "design-2", placement: "neck", side: "centre",
        storageKey: "casting-v2/candidates/neck-plate.png",
      })],
      listInkDeliveryCrops: async () => [{
        publicId: "11111111-1111-4111-8111-111111111111",
        designPublicId: "design-1",
        slot: "ink:upperArm@left",
        storageKey: "casting-v2/candidates/ink-delivery/arm.png",
        digest: createHash("sha256").update(Buffer.from("bytes:casting-v2/candidates/ink-delivery/arm.png")).digest("hex"),
        width: 224,
        height: 348,
      }] as never,
      readBytes: async (key: string) => ({
        bytes: Buffer.from(`bytes:${key}`), contentType: "image/png",
      }),
    }, input);

    const sent = buildPackage.mock.calls[0]![1];
    expect(sent.inkCrops?.map((crop) => crop.slot)).toEqual(["ink:upperArm@left"]);
    /* design-1 rode as a crop, so it does not ride again as a plate — and the
       OTHER design still does: one lane's refusal never silences another's. */
    expect(sent.inkPlates?.map((plate) => plate.designPublicId)).toEqual(["design-2"]);
  });

  it("signs anyway when the plate STATEMENT itself fails", async () => {
    /* A database that will not answer must never cost somebody the Cast they
       just paid for. The views render without the tattoos and the error is
       loud. */
    const buildPackage = packageReturning({});
    await signCandidate({
      schedulePackage: awaitPackage,
      buildPackage,
      mannequinDeferred: false, listInkPlates: async () => { throw new Error("Database not available"); },
    }, input);

    const sent = buildPackage.mock.calls[0]![1];
    expect(sent.inkPlates).toEqual([]);
    expect(journal).toContain("package");
  });
});

/**
 * EVERY DESIGN GETS ONE DISPOSITION, RODE OR NOT — driven directly
 * (ordered fable-1005 §2).
 *
 * Driven rather than reached through a Sign, because three of the four answers
 * are unreachable from a caller that behaves: a design with no plate, a design
 * plated twice, and a plate whose object is gone. A backstop whose only test
 * runs through the happy path is a backstop nothing has tested.
 */
describe("what a Cast's views carry, design by design", () => {
  const designRow = (over: Record<string, unknown> = {}) => ({
    designPublicId: "design-1",
    placement: "upperArm" as const,
    side: "left" as const,
    engine: "fal-ai/nano-banana-pro",
    storageKey: "casting-v2/candidates/plate-1.png",
    digest: "d".repeat(64),
    mime: "image/png",
    ...over,
  });

  const drive = async (rows: unknown[], readBytes?: (key: string) => Promise<{ bytes: Buffer; contentType: string }>) =>
    carriedInkPlates({
      /* Driven UN-DEFERRED: the mannequin road is parked (fable-1053 §2) and
         these arms describe the road itself. Deleting them would leave the day
         it resumes with nothing proving how it behaves. The deferral's own arms
         live in `inkMannequinDeferral.test.ts`. */
      mannequinDeferred: false,
      listInkPlates: async () => rows as never,
      readBytes: readBytes ?? (async (key: string) => ({
        bytes: Buffer.from(`bytes:${key}`), contentType: "image/png",
      })),
    } as never, { userId: 1, candidateId: 9, operationId: "op-1" });

  it("says RODE for a design with exactly one plate", async () => {
    const { plates, dispositions } = await drive([designRow()]);
    expect(plates.map((plate) => plate.designPublicId)).toEqual(["design-1"]);
    expect(dispositions).toEqual([{ designPublicId: "design-1", rode: true }]);
  });

  it("says noPlate for a design that was never plated — the case a plate-only read cannot see", async () => {
    /*
      The LEFT JOIN's whole purpose. Read from the plates table alone, this
      design does not exist: an uploaded tattoo that never reached a view would
      be indistinguishable from a Cast that never had one.
    */
    const { plates, dispositions } = await drive([
      designRow({ engine: null, storageKey: null, digest: null, mime: null }),
    ]);
    expect(plates).toEqual([]);
    expect(dispositions).toEqual([{ designPublicId: "design-1", rode: false, reason: "noPlate" }]);
  });

  it("says engineUndecided, and NAMES the engines, for a design plated twice", async () => {
    const { plates, dispositions } = await drive([
      designRow(),
      designRow({ engine: "gpt-image-2", storageKey: "casting-v2/candidates/plate-1b.png" }),
    ]);
    expect(plates).toEqual([]);
    expect(dispositions).toEqual([{
      designPublicId: "design-1",
      rode: false,
      reason: "engineUndecided",
      engines: ["fal-ai/nano-banana-pro", "gpt-image-2"],
    }]);
  });

  it("says bytesUnreadable when the row is there and the object is not", async () => {
    const { plates, dispositions } = await drive([designRow()], async () => {
      throw new Error("NoSuchKey");
    });
    expect(plates).toEqual([]);
    expect(dispositions).toEqual([{
      designPublicId: "design-1", rode: false, reason: "bytesUnreadable",
    }]);
  });

  it("reports all four side by side, and one bad answer never silences a good one", async () => {
    const { plates, dispositions } = await drive([
      designRow(),
      designRow({ designPublicId: "d2", engine: null, storageKey: null }),
      designRow({ designPublicId: "d3" }),
      designRow({ designPublicId: "d3", engine: "gpt-image-2", storageKey: "b.png" }),
      designRow({ designPublicId: "d4", storageKey: "gone.png" }),
    ], async (key: string) => {
      if (key === "gone.png") throw new Error("NoSuchKey");
      return { bytes: Buffer.from(`bytes:${key}`), contentType: "image/png" };
    });

    expect(plates.map((plate) => plate.designPublicId)).toEqual(["design-1"]);
    expect(dispositions).toEqual([
      { designPublicId: "design-1", rode: true },
      { designPublicId: "d2", rode: false, reason: "noPlate" },
      { designPublicId: "d3", rode: false, reason: "engineUndecided", engines: ["fal-ai/nano-banana-pro", "gpt-image-2"] },
      { designPublicId: "d4", rode: false, reason: "bytesUnreadable" },
    ]);
  });
});

/**
 * A SURFACE THE PACKAGE'S WARDROBE COVERS DOES NOT RIDE — the interim ordered
 * fable-1006 §2, on the conformance court's own frames.
 */
describe("a covered surface says so on the same disposition surface", () => {
  const chestRow = {
    designPublicId: "chest-1",
    placement: "upperChest" as const,
    side: "centre" as const,
    engine: "fal-ai/nano-banana-pro",
    storageKey: "casting-v2/candidates/chest-plate.png",
    digest: "d".repeat(64),
    mime: "image/png",
  };

  it("refuses an upper-chest design its ride, and names the surface as the reason", async () => {
    /*
      Not `noPlate` — it HAS a plate, and a refusal that named the wrong fact
      would send the next person looking for a mint that already happened.
    */
    const { plates, dispositions } = await carriedInkPlates({
      /* Un-deferred — see the note on `drive` above. */
      mannequinDeferred: false,
      listInkPlates: async () => [chestRow] as never,
      readBytes: async () => ({ bytes: Buffer.from("plate"), contentType: "image/png" }),
    } as never, { userId: 1, candidateId: 9, operationId: "op-1", wardrobeLine: null });

    expect(plates).toEqual([]);
    expect(dispositions).toEqual([{
      designPublicId: "chest-1", rode: false, reason: "surfaceCovered",
    }]);
  });

  it("⚠ AND ON A BASICS CAST THE SAME DESIGN RIDES — the outfit decides, not the placement", async () => {
    /*
      Item 7a (countersigned fable-1368). The arm above passes `undefined` for
      the line, which is *no line recorded* and answers the house crew tee — so
      the two arms differ in exactly one thing, which is the whole claim.
    */
    const { plates, dispositions } = await carriedInkPlates({
      mannequinDeferred: false,
      listInkPlates: async () => [chestRow] as never,
      readBytes: async () => ({ bytes: Buffer.from("plate"), contentType: "image/png" }),
    } as never, {
      userId: 1, candidateId: 9, operationId: "op-1",
      wardrobeLine: basicsWardrobeLine("male"),
    });

    expect(plates).toHaveLength(1);
    expect(dispositions).toEqual([{ designPublicId: "chest-1", rode: true }]);
  });

  it("⚠ AN OUTFIT NOBODY HAS READ SAYS SO — it does not borrow the covering's name", async () => {
    /*
      fable-1368 ruling 1. Unknown fails closed like a covering and must never be
      REPORTED as one: *"her top covers her chest"* said about an outfit whose
      coverage nobody has read is a refusal that lies about why it closed, and
      that is how a customer learns to distrust every refusal we write.
    */
    const { plates, dispositions } = await carriedInkPlates({
      mannequinDeferred: false,
      listInkPlates: async () => [chestRow] as never,
      readBytes: async () => ({ bytes: Buffer.from("plate"), contentType: "image/png" }),
    } as never, {
      userId: 1, candidateId: 9, operationId: "op-1",
      wardrobeLine: "a charcoal roll-neck jumper, dark jeans and boots",
    });

    expect(plates).toEqual([]);
    expect(dispositions).toEqual([{
      designPublicId: "chest-1", rode: false, reason: "surfaceCoverageUnread",
    }]);
  });

  it("still carries the arm design beside it — one refusal never silences a ride", async () => {
    const { plates, dispositions } = await carriedInkPlates({
      /* Un-deferred — see the note on `drive` above. */
      mannequinDeferred: false,
      listInkPlates: async () => [chestRow, {
        ...chestRow, designPublicId: "arm-1", placement: "upperArm", side: "left",
        storageKey: "casting-v2/candidates/arm-plate.png",
      }] as never,
      readBytes: async (key: string) => ({
        bytes: Buffer.from(`bytes:${key}`), contentType: "image/png",
      }),
    } as never, { userId: 1, candidateId: 9, operationId: "op-1" });

    expect(plates.map((plate) => plate.designPublicId)).toEqual(["arm-1"]);
    expect(dispositions).toEqual([
      { designPublicId: "chest-1", rode: false, reason: "surfaceCovered" },
      { designPublicId: "arm-1", rode: true },
    ]);
  });
});
