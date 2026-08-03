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
  });

  it("gives a signed candidate its own state, because collapsing it lost a Cast", () => {
    /*
      `signed` used to collapse into `ready`, and the cost was concrete: the
      founder signed a candidate for 450 credits, left her room, and could not
      find her again — the tile looked like every other ready candidate and
      offered to sign her a second time.

      A permanent purchase is reachable from the place it was made.
    */
    expect(projectCandidateStatus("signed")).toBe("signed");
  });

  it("labels failed and cancelled as refunded, because they were", () => {
    expect(projectCandidateStatus("failed")).toBe("failed-refunded");
    expect(projectCandidateStatus("cancelled")).toBe("failed-refunded");
  });

  it("keeps the expired TILE and suppresses its IMAGE, which is what makes refunding it safe", () => {
    /*
      REWRITTEN, deliberately. This asserted that an expired candidate is not
      projected at all — and the constraint it was protecting is about the
      IMAGE, not the tile. Returning null enforced it by removing both.

      The founder found what that costs: cancel a roll whose eight were already
      dispatched, every candidate lands and expires, and the sheet empties out
      completely — a blank page where eight faces had been, with no account of
      what happened to them.

      The rule that actually matters is unchanged and is now asserted directly:
      no image URL ever reaches a refunded candidate, so cancelling can never
      become a way to buy images for nothing.
    */
    expect(projectCandidateStatus("expired")).toBe("failed-refunded");
    // `discarded` still vanishes: the user removed it, and it is gone.
    expect(projectCandidateStatus("discarded")).toBeNull();

    const projected = projectRoll({
      roll: rollRow({ status: "cancelled" }),
      candidates: [
        candidateRow({ status: "expired", imageKey: "real/key.png", thumbKey: "real/thumb.png" }),
        candidateRow({ status: "discarded" }),
      ],
    });

    // The sheet still accounts for the candidate the user paid for.
    expect(projected.candidates).toHaveLength(1);
    expect(projected.candidates[0].status).toBe("failed-refunded");
    // And it carries no way to see it, even though the object exists in R2.
    expect(projected.candidates[0].imageUrl).toBeNull();
    expect(projected.candidates[0].thumbUrl).toBeNull();
    expect(projected.status).toBe("cancelled");
  });

  it("suppresses the image on every refunded candidate, not only expired ones", () => {
    // Enforced at the projection so no future caller can reintroduce the leak
    // by rendering a field it happened to find on the object.
    for (const status of ["failed", "cancelled", "expired"] as const) {
      const projected = projectRoll({
        roll: rollRow({ status: "cancelled" }),
        candidates: [candidateRow({ status, imageKey: "real/key.png", thumbKey: "real/thumb.png" })],
      });
      expect(projected.candidates[0].imageUrl, status).toBeNull();
      expect(projected.candidates[0].thumbUrl, status).toBeNull();
    }
  });

  it("labels positions for display without keying anything by them", () => {
    expect(projectCandidate(candidateRow({ position: 0 }))?.indexLabel).toBe("01");
    expect(projectCandidate(candidateRow({ position: 7 }))?.indexLabel).toBe("08");
  });
});

describe("lineage", () => {
  it("carries the parent as public ids, never the internal ones", () => {
    const projected = projectRoll({
      roll: rollRow({ parentRollId: 41, parentCandidateId: 907 }),
      candidates: [candidateRow()],
      parentRollPublicId: "roll-parent",
      parentCandidatePublicId: "cand-parent",
    });

    expect(projected.lineage).toEqual({
      fromRollId: "roll-parent",
      fromCandidateId: "cand-parent",
    });
    // The numeric ids are internal and must not appear anywhere (§J).
    expect(JSON.stringify(projected)).not.toContain("907");
    expect(JSON.stringify(projected)).not.toContain("41");
  });

  it("still names the parent roll when the parent candidate has been purged", () => {
    /*
      A discarded candidate past its 24h floor is purgeable once it is no
      longer the active roll's (§G.6), while its roll lives as long as the
      session. So "I came from roll 04" outlives "I came from that face" — and
      the pill keys on the roll for exactly this reason.
    */
    const projected = projectRoll({
      roll: rollRow({ parentRollId: 41, parentCandidateId: 907 }),
      candidates: [candidateRow()],
      parentRollPublicId: "roll-parent",
      parentCandidatePublicId: null,
    });

    expect(projected.lineage.fromRollId).toBe("roll-parent");
    expect(projected.lineage.fromCandidateId).toBeUndefined();
  });

  it("is empty for a roll that followed nothing", () => {
    const projected = projectRoll({ roll: rollRow(), candidates: [candidateRow()] });
    expect(projected.lineage).toEqual({});
  });
});

/**
 * THE JOINT, not the two halves.
 *
 * Both ends of these two facts were already tested — the compiler writes
 * `interpreted`, `statesWardrobe` has its own suite, and `sheetNotice` decides
 * which line wins. What nothing tested was the middle: `readFellBack` reaches
 * into untyped JSON by string key, so renaming the field in `briefCompiler`
 * would kill the confession outright with every one of those suites still
 * green. That is the invoked-but-inert class this codebase keeps meeting, and
 * a projection field nobody asserts is a control that does not exist.
 */
describe("the sheet's two confessions survive the projection", () => {
  it("reports a roll that fell back to the raw sentence", () => {
    const projected = projectRoll({
      roll: rollRow({ compiledBrief: { compiler: "pathA-v1", interpreted: false } }),
      candidates: [candidateRow()],
    });
    expect(projected.fellBack).toBe(true);
  });

  it("does not report an interpreted roll", () => {
    const projected = projectRoll({
      roll: rollRow({ compiledBrief: { compiler: "pathA-v1", interpreted: true } }),
      candidates: [candidateRow()],
    });
    expect(projected.fellBack).toBe(false);
  });

  /*
    Absent is not "it fell back". Rolls compiled before the field existed have
    no value, and reporting an unknown as a failure would put a confession on
    sheets that never had anything to confess.
  */
  it("stays silent about a roll that predates the field", () => {
    const projected = projectRoll({ roll: rollRow(), candidates: [candidateRow()] });
    expect(projected.fellBack).toBe(false);
  });

  it("reports a brief that stated clothing", () => {
    const projected = projectRoll({
      roll: rollRow({ briefText: "a musician in a red leather jacket, late 20s" }),
      candidates: [candidateRow()],
    });
    expect(projected.statedWardrobe).toBe(true);
  });

  it("stays silent about a brief that stated an accessory the sheet honours", () => {
    const projected = projectRoll({
      roll: rollRow({ briefText: "a dad in his 30s wearing chunky glasses" }),
      candidates: [candidateRow()],
    });
    expect(projected.statedWardrobe).toBe(false);
  });
});

/**
 * The producer and the reader, compiled together.
 *
 * The cases above would all still pass if `briefCompiler` renamed its field
 * tomorrow, because they hand-write the JSON the reader expects. This one
 * drives the REAL compiler with an interpreter that cannot answer, and asserts
 * the confession comes out the far end — so the two halves cannot drift apart
 * without something going red.
 */
describe("a real failed compile reaches the sheet as a confession", () => {
  it("projects fellBack from what the compiler actually wrote", async () => {
    const { castingBriefCompiler } = await import("./briefCompiler");

    const compiled = await castingBriefCompiler({
      briefText: "an East Asian woman in her 40s, close-cropped silver hair",
      candidateCount: 8,
      rollSeed: "11111111-1111-4111-8111-111111111111",
      unlock: [],
      // The interpreter is unreachable. Fail-open: the roll still compiles from
      // the sentence itself, and every stated lock is lost.
      engine: { complete: async () => { throw new Error("interpreter unreachable"); } } as never,
    });

    const projected = projectRoll({
      roll: rollRow({ compiledBrief: compiled.compiledBrief }),
      candidates: [candidateRow()],
    });

    expect(projected.fellBack).toBe(true);
  });
});
