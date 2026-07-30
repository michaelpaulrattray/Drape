import { describe, expect, it, vi } from "vitest";

vi.mock("../storage", () => ({
  storagePublicUrl: (key: string) => `https://public.example/${key}`,
}));

const { projectCandidate, projectCandidateStatus, projectRoll, readChips } = await import(
  "./rollProjection"
);

/**
 * Projection boundary (plan §J, access-control invariant 8).
 *
 * The test that matters most here is the negative one. A projection is only a
 * boundary if the fields on the wrong side of it are *provably* absent — and
 * "I wrote the DTO carefully" is not proof, because the failure mode is
 * somebody later adding a field to the row and the projection inheriting it.
 */

function candidateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    publicId: "cand-1",
    rollId: 1,
    sessionId: 1,
    userId: 7,
    position: 3,
    status: "ready",
    pointsCost: 20,
    imageKey: "casting-v2/candidates/abc.png",
    thumbKey: null,
    provider: "fal",
    providerModel: "openai/gpt-image-2",
    providerRef: "req-9",
    personaLine: "Warm, unhurried",
    internalPrompt: { prompt: "the compiled instruction" },
    keptAt: null,
    discardedAt: null,
    attemptCount: 1,
    failureClass: null,
    signedCastId: null,
    createdAt: new Date("2026-07-31T00:00:00.000Z"),
    expiresAt: null,
    ...overrides,
  } as never;
}

function rollRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    publicId: "roll-1",
    sessionId: 1,
    userId: 7,
    rollIndex: 2,
    briefText: "a wiry cyclist in her 20s",
    compiledBrief: {
      compiler: "deterministic-v1",
      framingBlock: "internal framing text",
      chips: [{ label: "a wiry cyclist in her 20s", kind: "subject", removable: false }],
    },
    cohortKey: "photoreal_human",
    styleKey: null,
    styleProfile: null,
    lockContract: { sex: "female" },
    parentRollId: null,
    parentCandidateId: null,
    status: "complete",
    priceCredits: 160,
    operationId: "66666666-6666-4666-8666-666666666666",
    createdAt: new Date("2026-07-31T00:00:00.000Z"),
    ...overrides,
  } as never;
}

describe("nothing internal crosses the boundary", () => {
  it("omits provider identity, prompts and storage keys from a candidate", () => {
    const projected = JSON.stringify(projectCandidate(candidateRow()));
    // Quoted, so the assertion is about a JSON value and not about "fal"
    // happening to live inside the word "false".
    for (const secret of ['"fal"', "gpt-image-2", "req-9", "internalPrompt", "compiled instruction"]) {
      expect(projected, secret).not.toContain(secret);
    }
    // The image is reachable, but as a URL built from the key — the key
    // itself, which is what a deletion path keys on, never leaves.
    expect(JSON.parse(projected).imageUrl).toContain("casting-v2/candidates/abc.png");
  });

  it("omits the compiled brief and lock contract from a roll", () => {
    const projected = JSON.stringify(
      projectRoll({ roll: rollRow(), candidates: [candidateRow()] }),
    );
    for (const secret of ["deterministic-v1", "internal framing text", "lockContract", "operationId"]) {
      expect(projected, secret).not.toContain(secret);
    }
    // The user's own sentence comes back, because it is theirs.
    expect(JSON.parse(projected).briefText).toBe("a wiry cyclist in her 20s");
  });

  it("reads chips through a validator rather than forwarding them", () => {
    // The compiled brief will one day be written by an LLM behind the compiler
    // seam. A projection that forwarded whatever it found there would be an
    // injection path straight to the client.
    const chips = readChips({
      chips: [
        { label: "ok", kind: "subject", removable: true },
        { label: "bad kind", kind: "javascript:", removable: true },
        { label: 42, kind: "subject", removable: true },
        { kind: "subject", removable: true },
        { label: "x".repeat(500), kind: "style", removable: false },
      ],
    });
    expect(chips.map((chip) => chip.label)).toEqual(["ok", "x".repeat(60)]);
    expect(readChips(null)).toEqual([]);
    expect(readChips({ chips: "not an array" })).toEqual([]);
  });
});

describe("lifecycle states collapse to the three the client knows", () => {
  it("maps in-flight states to casting and delivered ones to ready", () => {
    expect(projectCandidateStatus("queued")).toBe("casting");
    expect(projectCandidateStatus("dispatched")).toBe("casting");
    expect(projectCandidateStatus("ready")).toBe("ready");
    expect(projectCandidateStatus("signed")).toBe("ready");
  });

  it("labels failed and cancelled as refunded, because they were", () => {
    expect(projectCandidateStatus("failed")).toBe("failed-refunded");
    expect(projectCandidateStatus("cancelled")).toBe("failed-refunded");
  });

  it("shows nothing at all for expired, rather than claiming a refund", () => {
    // An expired candidate arrived after its roll was cancelled: delivered, so
    // never refunded (§H.6). Labelling it `failed-refunded` would tell the
    // user they got credits back that they did not.
    expect(projectCandidateStatus("expired")).toBeNull();
    expect(projectCandidateStatus("discarded")).toBeNull();

    const projected = projectRoll({
      roll: rollRow({ status: "cancelled" }),
      candidates: [candidateRow({ status: "expired" }), candidateRow({ status: "discarded" })],
    });
    expect(projected.candidates).toHaveLength(0);
    expect(projected.status).toBe("cancelled");
  });

  it("labels positions for display without keying anything by them", () => {
    expect(projectCandidate(candidateRow({ position: 0 }))?.indexLabel).toBe("01");
    expect(projectCandidate(candidateRow({ position: 7 }))?.indexLabel).toBe("08");
  });
});
