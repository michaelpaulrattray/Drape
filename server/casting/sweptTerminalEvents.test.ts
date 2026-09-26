/**
 * THE RECOVERY SWEEP'S TERMINAL EVENTS (#1425, #509 part 2's sweep half).
 *
 * The defect these arms exist for: `operationRecovery.ts` held no
 * `captureProductEvent` call at all while genuinely settling operations
 * terminally and moving credits, so a generation the sweep settled had a
 * `generation started` and no terminal — for the life of the stream. Rolls
 * started would permanently exceed delivered plus failed, and the honest
 * reading of that gap ("some generations vanish") would have been wrong.
 *
 * # WHY THESE DRIVE THE REAL ADJUDICATOR
 *
 * The capture sits behind the adjudicator's own door, and that door IS the
 * exactly-once gate — `claimed` / `running` / a fenced Sign in, `"skipped"` for
 * everything else. An arm that called the capture directly would prove the
 * payload and skip the only interesting part. So every arm here goes through
 * `adjudicateStaleGenerationOperation`, with the far end stubbed: a fake
 * database that serves the recovery claim and the receipt read, and the
 * per-kind recoverer mocked to reach a chosen verdict.
 *
 * ⚠ **`castingV2.roll` and `castingV2.refine` are the two kinds used, and the
 * choice is not arbitrary.** Both dispatch to a recoverer in ANOTHER module, so
 * it can be mocked; a kind whose recoverer lives inside `operationRecovery.ts`
 * could not be reached without faking the whole evidence layer. `refine` is the
 * one used for the park arm because its `recovery_required` branch only logs and
 * returns — every other kind writes the park through `../db/generationOperations`
 * and would need that module mocked too, which buys nothing.
 *
 * ⚠ **THE MOCKED TRANSPORT IS A HOLE AND THE LAST ARM CLOSES IT.** With
 * `captureProductEvent` mocked, the catalogue's projection never runs, so a
 * payload the real transport would REFUSE looks identical here to one it would
 * send — that is the inert-arm class, and this suite would have shipped five
 * green arms over an event nobody could ever receive. The final arm feeds every
 * payload these arms recorded through the REAL `projectProductEvent` and
 * requires a `send` verdict with nothing dropped.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

/* ── the transport, recorded rather than sent ──────────────────────────────── */
const captured: Array<{ name: string; userId: number; properties: Record<string, unknown> }> = [];
vi.mock("../monitoring/productEvents", () => ({
  captureProductEvent: (name: string, userId: number, properties: Record<string, unknown>) => {
    captured.push({ name, userId, properties });
  },
}));

/* ── the database: the recovery claim, then the receipt read ───────────────── */
type Receipt = {
  status: string;
  errorCode: string | null;
  chargedCredits: number;
  refundedCredits: number;
};
let receipt: Receipt | null = null;
let claimAffectedRows = 1;
let selects = 0;

const fakeDb = {
  update: () => ({ set: () => ({ where: async () => ({ affectedRows: claimAffectedRows }) }) }),
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => {
          selects += 1;
          return receipt ? [receipt] : [];
        },
      }),
    }),
  }),
};
vi.mock("../db/connection", () => ({
  getDb: async () => fakeDb,
  withTransaction: async () => {
    throw new Error("no arm here should open a transaction");
  },
}));

/* ── the per-kind recoverers ───────────────────────────────────────────────── */
const mockRollRecovery = vi.fn();
vi.mock("../castingV2/rollRecovery", () => ({
  ROLL_RECOVERY_SENTENCE: { supportReview: (id: string) => `support ${id}` },
  recoverCastingV2RollOperation: (...args: unknown[]) => mockRollRecovery(...args),
}));
const mockRefineRecovery = vi.fn();
vi.mock("../castingV2/refineRecovery", () => ({
  recoverCastingV2RefineOperation: (...args: unknown[]) => mockRefineRecovery(...args),
}));

import { adjudicateStaleGenerationOperation } from "./operationRecovery";
import { projectProductEvent } from "../../shared/productEventCatalogue";

type Operation = Parameters<typeof adjudicateStaleGenerationOperation>[0];

function operation(overrides: Partial<Record<string, unknown>> = {}): Operation {
  return {
    id: "op_1425",
    userId: 77,
    kind: "castingV2.roll",
    status: "running",
    subjectDeletedAt: null,
    recoveryAttemptedAt: null,
    errorCode: null,
    chargedCredits: 0,
    refundedCredits: 0,
    plannedCredits: 160,
    chargeReferenceId: "charge:op_1425",
    modelId: null,
    ...overrides,
  } as unknown as Operation;
}

beforeEach(() => {
  captured.length = 0;
  selects = 0;
  claimAffectedRows = 1;
  receipt = null;
  vi.clearAllMocks();
});

describe("a generation the sweep settles records its terminal event (#1425)", () => {
  it("sends `generation delivered` with complete, the real noun and the money, for a durable success", async () => {
    mockRollRecovery.mockResolvedValue({ type: "durable_success" });
    receipt = { status: "succeeded", errorCode: null, chargedCredits: 160, refundedCredits: 0 };

    await expect(adjudicateStaleGenerationOperation(operation())).resolves.toBe("durable_success");

    expect(captured).toEqual([{
      name: "generation delivered",
      userId: 77,
      /* `action: "roll"` and not `"unnamed action"`: the direct road remembers the
         kind in a per-process map that a swept operation was never in, and its
         docblock names that limit. The sweep holds the ROW, so it reads the kind
         off the column. */
      properties: { action: "roll", outcome: "complete", creditsCharged: 160, creditsRefunded: 0 },
    }]);
  });

  it("sends `partial` when the RECEIPT says partial — the decision could not have told us", async () => {
    /* The point of reading the row. `StaleOperationDecision` folds a partial
       delivery into `durable_success`, so a roll that delivered six of eight and
       one that delivered all eight leave the adjudicator as the same word. The
       receipt distinguishes them, and `outcome` is that distinction. */
    mockRollRecovery.mockResolvedValue({ type: "durable_success" });
    receipt = { status: "partial", errorCode: null, chargedCredits: 160, refundedCredits: 40 };

    await expect(adjudicateStaleGenerationOperation(operation())).resolves.toBe("durable_success");

    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      name: "generation delivered",
      properties: { outcome: "partial", creditsCharged: 160, creditsRefunded: 40 },
    });
  });

  it("sends `generation failed` with the row's own error code and the money both ways", async () => {
    mockRollRecovery.mockResolvedValue({ type: "paid_failure", chargedCredits: 160, refundedCredits: 160 });
    receipt = { status: "failed", errorCode: "INTERNAL_SERVER_ERROR", chargedCredits: 160, refundedCredits: 160 };

    await expect(adjudicateStaleGenerationOperation(operation())).resolves.toBe("paid_failure");

    expect(captured).toEqual([{
      name: "generation failed",
      userId: 77,
      properties: {
        action: "roll",
        errorCode: "INTERNAL_SERVER_ERROR",
        creditsCharged: 160,
        creditsRefunded: 160,
      },
    }]);
  });

  it("sends a failure with zeroes for a free failure — nothing charged is a fact, not an absence", async () => {
    mockRollRecovery.mockResolvedValue({ type: "free_failure" });
    receipt = { status: "failed", errorCode: "TIMEOUT", chargedCredits: 0, refundedCredits: 0 };

    await expect(adjudicateStaleGenerationOperation(operation({ status: "claimed" }))).resolves.toBe("free_failure");

    expect(captured).toEqual([{
      name: "generation failed",
      userId: 77,
      properties: { action: "roll", errorCode: "TIMEOUT", creditsCharged: 0, creditsRefunded: 0 },
    }]);
  });

  it("names an unrecognised error code rather than passing it through", async () => {
    /* The catalogue's vocabulary is closed, and a code outside it REFUSES the
       whole event. `productErrorCode` is what keeps a strange column value from
       silencing a failure entirely. */
    mockRollRecovery.mockResolvedValue({ type: "paid_failure", chargedCredits: 160, refundedCredits: 160 });
    receipt = { status: "failed", errorCode: "ENOTAREALCODE", chargedCredits: 160, refundedCredits: 160 };

    await adjudicateStaleGenerationOperation(operation());

    expect(captured[0]?.properties).toMatchObject({ errorCode: "UNRECOGNISED" });
  });
});

describe("exactly once, and never over a row that did not settle", () => {
  it("a second pass over the settled row sends NOTHING — the door is the gate", async () => {
    /* The sweep runs every 60 s and re-examines rows; this is the duplication
       shape #509 part 2's money edges were placed to avoid. Nothing new guards
       it — the adjudicator already refuses a row that is not `claimed`,
       `running` or a fenced Sign, and a settled row is none of those. Driven
       rather than asserted, because "it returns skipped" is the whole argument. */
    mockRollRecovery.mockResolvedValue({ type: "durable_success" });
    receipt = { status: "succeeded", errorCode: null, chargedCredits: 160, refundedCredits: 0 };

    await expect(adjudicateStaleGenerationOperation(operation({ status: "succeeded" }))).resolves.toBe("skipped");

    expect(captured).toEqual([]);
    expect(mockRollRecovery, "the settled row reached a recoverer at all").not.toHaveBeenCalled();
    expect(selects, "the settled row was read back for an event it cannot have").toBe(0);
  });

  it("a failed row is equally refused on a later pass", async () => {
    await expect(adjudicateStaleGenerationOperation(operation({ status: "failed" }))).resolves.toBe("skipped");
    expect(captured).toEqual([]);
  });

  it("an operation PARKED for support sends nothing — it has not terminated", async () => {
    /* `recovery_required` is not a terminal outcome: a human looks at it, and it
       terminates later. Sending a delivery or a failure here would be a count of
       something that has not happened; the gap it leaves in the arithmetic is
       honest, because the generation genuinely has no end yet. */
    mockRefineRecovery.mockResolvedValue({ type: "recovery_required", reason: "ledger disagrees" });
    receipt = { status: "recovery_required", errorCode: null, chargedCredits: 300, refundedCredits: 0 };

    await expect(
      adjudicateStaleGenerationOperation(operation({ kind: "castingV2.refine" })),
    ).resolves.toBe("recovery_required");

    expect(captured).toEqual([]);
    expect(selects, "a park read the receipt back, so the gate is the status and not the decision").toBe(0);
  });

  it("NEGATIVE CONTROL — a terminal decision over a NON-terminal receipt sends nothing", async () => {
    /* The receipt is the gate, not the decision. If the two ever disagree that
       is a defect to read about in the log, never an event claiming a delivery
       over a row that is still running. Without this arm the capture could read
       the decision instead and every arm above would still pass. */
    mockRollRecovery.mockResolvedValue({ type: "durable_success" });
    receipt = { status: "running", errorCode: null, chargedCredits: 160, refundedCredits: 0 };

    await expect(adjudicateStaleGenerationOperation(operation())).resolves.toBe("durable_success");

    expect(captured).toEqual([]);
    expect(selects, "the receipt was never read").toBe(1);
  });

  it("NEGATIVE CONTROL — a missing receipt sends nothing", async () => {
    mockRollRecovery.mockResolvedValue({ type: "durable_success" });
    receipt = null;

    await expect(adjudicateStaleGenerationOperation(operation())).resolves.toBe("durable_success");

    expect(captured).toEqual([]);
  });

  it("a deleted subject and an unclaimed attempt both send nothing", async () => {
    await expect(adjudicateStaleGenerationOperation(operation({ subjectDeletedAt: new Date() })))
      .resolves.toBe("skipped");
    expect(captured).toEqual([]);

    claimAffectedRows = 0;
    await expect(adjudicateStaleGenerationOperation(operation())).resolves.toBe("skipped");
    expect(captured).toEqual([]);
  });
});

describe("the settlement is unaffected by the analytics, and vice versa", () => {
  it("a capture that cannot be composed does not change the decision the sweep counts", async () => {
    /* The sweep's counters and its callers must not move because an analytics
       line failed. The read is inside a `try` whose catch only logs, so a
       database that answers the claim and then refuses the receipt read still
       returns the real verdict. */
    mockRollRecovery.mockResolvedValue({ type: "durable_success" });
    const broken = vi.spyOn(fakeDb, "select").mockImplementation(() => {
      throw new Error("the receipt read blew up");
    });
    try {
      await expect(adjudicateStaleGenerationOperation(operation())).resolves.toBe("durable_success");
      expect(captured).toEqual([]);
    } finally {
      broken.mockRestore();
    }
  });

  it("the capture is the LAST act, after the settlement returned", async () => {
    /* `directOperation.ts:255` records why this ordering matters on the direct
       road: a capture inside the block that guards the receipt would let an
       analytics failure be read as a settlement failure. Here the structure says
       it — the wrapper cannot run until the inner function has returned — and
       this arm reads that structure rather than trusting the comment. */
    const source = readFileSync("server/casting/operationRecovery.ts", "utf8");
    const wrapper = source.slice(
      source.indexOf("export async function adjudicateStaleGenerationOperation"),
      source.indexOf("async function recordSweptTerminalEvent"),
    );
    expect(wrapper).toContain("const decision = await settleStaleGenerationOperation(operation, now);");
    expect(wrapper).toContain("await recordSweptTerminalEvent(operation, decision);");
    expect(wrapper.indexOf("settleStaleGenerationOperation")).toBeLessThan(
      wrapper.indexOf("recordSweptTerminalEvent"),
    );

    /* And there is exactly ONE capture site in the module. Eight settlement
       sites each sending their own event is the duplication this shape exists to
       prevent, and it is the change a later hand would most plausibly make. */
    expect(source.match(/captureProductEvent\(/g) ?? []).toHaveLength(2);
  });
});

describe("the payloads pass the real catalogue, not only the mock", () => {
  it("every event these arms recorded projects to `send` with nothing dropped", async () => {
    /* ⚠ THE ARM THAT MAKES THE REST WORTH ANYTHING. Mocking the transport means
       the catalogue's projection never runs, so a payload it would REFUSE reads
       exactly like one it would send — an undeclared property, a noun outside
       the vocabulary, a negative count. Every arm above would stay green over an
       event nobody could ever receive. */
    const payloads: Array<[string, Record<string, unknown>]> = [];

    mockRollRecovery.mockResolvedValue({ type: "durable_success" });
    receipt = { status: "partial", errorCode: null, chargedCredits: 160, refundedCredits: 40 };
    await adjudicateStaleGenerationOperation(operation());

    mockRollRecovery.mockResolvedValue({ type: "paid_failure", chargedCredits: 160, refundedCredits: 160 });
    receipt = { status: "failed", errorCode: "SERVICE_UNAVAILABLE", chargedCredits: 160, refundedCredits: 160 };
    await adjudicateStaleGenerationOperation(operation());

    receipt = { status: "failed", errorCode: "ENOTAREALCODE", chargedCredits: 0, refundedCredits: 0 };
    await adjudicateStaleGenerationOperation(operation());

    for (const event of captured) payloads.push([event.name, event.properties]);
    expect(payloads, "no payload was recorded — this arm is reading nothing").toHaveLength(3);

    for (const [name, properties] of payloads) {
      const verdict = projectProductEvent(name as never, {
        ...properties,
        /* The two the transport attaches itself, so the projection sees a whole
           event rather than one missing its required pair. */
        world: "local",
        release: "abcdef1",
      });
      expect(verdict.verdict, `${name} would be refused: ${JSON.stringify(verdict)}`).toBe("send");
      expect(
        verdict.verdict === "send" ? verdict.dropped : [],
        `${name} sends a property the catalogue does not declare`,
      ).toEqual([]);
    }
  });

  it("POSITIVE CONTROL — the projection this arm relies on can refuse", () => {
    /* Without this, the loop above passes because `projectProductEvent` always
       says `send`, which is the same class of mistake as the mocked transport. */
    const refused = projectProductEvent("generation delivered" as never, {
      action: "not a noun we declare",
      outcome: "complete",
      creditsCharged: 160,
      creditsRefunded: 0,
      world: "local",
      release: "abcdef1",
    });
    expect(refused.verdict).toBe("refuse");
  });
});
