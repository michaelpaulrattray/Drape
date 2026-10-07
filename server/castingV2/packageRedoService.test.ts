import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE PAID REDO — the money sequence for a whole package asked for again
 * (#1903 slice 2).
 *
 * **His ruling, verbatim (2026-10-07):** *"maybe we should allow retry by
 * default incase they didnt like the outfit that was invented or whatever but
 * it costs per retry and regens all views not just one"*, at ***"350"*** display
 * credits.
 *
 * Every arm is about what moves and in what order. The four that earn their
 * place, because each is a way this road could take money and give nothing:
 *
 * - **ALL FIVE CLAIMS HAPPEN BEFORE ANY DEDUCT**, so a busy slot is a refusal
 *   that charged nothing rather than a half-bought package. Asserted on the
 *   JOURNAL, because "claimed then charged" and "charged then claimed" are the
 *   same set of calls in a different order and only the order is the control.
 * - **A FAILED VIEW REFUNDS ITS OWN SLICE AND NOTHING ELSE** — the other four
 *   stand, and the picture the customer already had stays in the failed slot.
 * - **ONE PLATE, TWO PANELS, FIVE VIEWS** — a redo whose outfit differed per
 *   view would be the thing his ruling exists to fix, delivered by the fix.
 * - **A PLATE THAT THROWS NEVER FAILS THE REDO.** His rule from path E, on a
 *   road that has now charged five slices by the time the plate is asked for.
 */

vi.hoisted(() => {
  process.env.R2_ENDPOINT ||= "https://r2-unit-test.invalid";
  process.env.R2_BUCKET ||= "unit-test-bucket";
  process.env.R2_PUBLIC_URL ||= "https://pub-test.r2.dev";
  process.env.R2_ACCESS_KEY_ID ||= "unit-test-access-key";
  process.env.R2_SECRET_ACCESS_KEY ||= "unit-test-secret";
});

vi.mock("../logging/logger", () => {
  const shape = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
  return { logger: shape, createModuleLogger: () => shape };
});

/** The frozen-account read, which every paid entrance makes first. */
vi.mock("../db/connection", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [{ frozenAt: null }] }) }),
    }),
  }),
  withTransaction: async (run: (tx: unknown) => Promise<unknown>) => run({}),
}));

vi.mock("../db/generations", () => ({
  createGeneration: vi.fn(async () => ({ success: true, generationId: 1 })),
  updateGeneration: vi.fn(async () => ({ success: true })),
}));

vi.mock("../storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key, url: `https://public/${key}` })),
  storageDelete: vi.fn(async () => undefined),
  storageReadBytes: vi.fn(async () => ({ bytes: Buffer.from("anchor"), contentType: "image/png" })),
}));

const receipts = {
  success: vi.fn(async (_input: unknown) => undefined),
  /** `failClaimedDirectOperation` always throws — that is its contract. */
  failClaimed: vi.fn(async (input: { error: unknown }) => { throw input.error; }),
};
vi.mock("../casting/directOperation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../casting/directOperation")>()),
  completeDirectOperationSuccess: vi.fn(async (input: unknown) => receipts.success(input)),
  failClaimedDirectOperation: vi.fn(async (input: { error: unknown }) => receipts.failClaimed(input)),
}));

/*
  HER TATTOOS AND HER CARRIED WORDS — the Sign's own two readers, stubbed so an
  arm can see that a REDONE view still carries them. A redo that quietly lost
  her ink would be the fidelity law's exact failure on the one road a customer
  has just paid to put right.
*/
const carried = { inkAsked: vi.fn((_input: unknown) => undefined) };
vi.mock("./signService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./signService")>()),
  carriedInkCrops: vi.fn(async (_deps: unknown, request: unknown) => {
    carried.inkAsked(request);
    return {
      crops: [{
        cropPublicId: "crop-public",
        slot: "free.ink",
        placement: "upperChest" as const,
        side: "centre" as const,
        noun: "swallow",
        bytes: Buffer.from("her-tattoo"),
        contentType: "image/png",
      }],
      dispositions: [],
    };
  }),
  carriedFeatureWords: vi.fn(async () => [{
    slot: "free.tail",
    noun: "tail",
    words: ["a long banded tail"],
    region: "back" as const,
  }]),
}));

import { TRPCError } from "@trpc/server";
import { CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS } from "../casting/castingCreditCosts";
import { derivedClientRequestId } from "../casting/operationContract";
import { renderLikeFrame } from "../testing/renderLikeFrame";
import {
  CASTING_V2_PACKAGE_REDO_PRICE_CREDITS,
  CAST_PACKAGE_VIEWS,
  castPackageView,
} from "./castViewPackage";
import { PLATE_ANGLES } from "./outfitPlate";
import {
  PACKAGE_REDO_BUSY_MESSAGE,
  PACKAGE_REDO_FACE_MISSING_MESSAGE,
  PACKAGE_REDO_NOT_READY_MESSAGE,
  redoCastPackage,
  type PackageRedoServiceDependencies,
} from "./packageRedoService";
import type { CastSlotProjection } from "./castProjection";

const SLICE = CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS;
const PRESS = "11111111-1111-4111-8111-111111111111";

const journal: string[] = [];
const deducts: Array<{ amount: number; reference: string }> = [];
const refunds: Array<{ amount: number; reference: string }> = [];
const committed: Array<{
  angle: string;
  operationId: string;
  pointsCost: number;
  provenance: Record<string, unknown>;
}> = [];
/** Every reference list the identity engine was posted, per view. */
const enginePosts: Array<{ prompt: string; references: Array<{ bytes: Buffer }> }> = [];
let plateCalls = 0;
let plateBehaviour: "ok" | "throw" = "ok";
let balance = 10_000_000;
let chargeFails: ReadonlySet<string> = new Set();
let engineFails: ReadonlySet<string> = new Set();
let busySlotAngles: readonly string[] = [];
let castStatus: "building" | "ready" = "ready";
/** Which angles `begin` refuses as locked, by the angle in the claim payload. */
let lockedAngles: ReadonlySet<string> = new Set();
/** A replayed press: angle -> the receipt the first press settled. */
let replays: Record<string, unknown> = {};

function slots(): CastSlotProjection[] {
  return CAST_PACKAGE_VIEWS.map((angle) => ({
    angle,
    label: angle,
    state: "ready",
    url: `https://public/old-${angle}.png`,
    note: null,
    refundedCredits: null,
    ...(busySlotAngles.includes(angle) ? { retrying: true as const } : {}),
  }) as CastSlotProjection);
}

function dependencies(
  overrides: Partial<PackageRedoServiceDependencies> = {},
): PackageRedoServiceDependencies {
  return {
    readSlots: async () => ({
      modelId: 7,
      status: castStatus,
      slots: slots(),
      deliveredOutfitKeys: {},
      freeRetrySpentAngles: [],
    }),
    readSource: async () => ({
      modelId: 7,
      anchorStorageKey: "casting-v2/casts/op/anchor.png",
      identityRevisionId: "rev-1",
      identityText: "identity",
      technicalSchema: { subject: { sex: "female" } },
      briefText: "a courier in a storm",
      candidateId: 11,
      candidatePublicId: "cand-public",
      selectedVariantId: 22,
      anchorDeltas: null,
    }),
    readAnchorBytes: async () => ({
      bytes: Buffer.from("her-signed-face"),
      contentType: "image/png",
    }),
    readBalance: async () => ({ balance }),
    begin: (async (request: { clientRequestId: string; payload: unknown }) => {
      const angle = (request.payload as { angle: string }).angle;
      journal.push(`claim:${angle}`);
      if (lockedAngles.has(angle)) {
        throw new TRPCError({ code: "CONFLICT", message: PACKAGE_REDO_BUSY_MESSAGE });
      }
      if (angle in replays) {
        return { type: "replay" as const, operationId: `op-${angle}`, result: replays[angle] };
      }
      /* The operation id is derived from the request id the entrance composed,
         so an arm can tie a commit back to the angle it belongs to. */
      return { type: "execute" as const, operationId: request.clientRequestId };
    }) as PackageRedoServiceDependencies["begin"],
    markRunning: (async (request: { operationId: string }) => {
      journal.push("running");
      return { operationId: request.operationId, chargeReferenceId: `op:${request.operationId}:charge` };
    }) as PackageRedoServiceDependencies["markRunning"],
    deduct: (async (
      _userId: number,
      amount: number,
      _kind: string,
      description: string,
      reference: string,
    ) => {
      journal.push("deduct");
      /* The ledger line carries the view's LABEL ("Full back"), never its
         angle key — so the fixture maps back through the same function the
         service composed it with rather than guessing at the string. */
      const angle = CAST_PACKAGE_VIEWS.find((candidate) =>
        description.includes(castPackageView(candidate).label));
      if (angle && chargeFails.has(angle)) return { success: false, error: "Not enough credits" };
      deducts.push({ amount, reference });
      return { success: true };
    }) as PackageRedoServiceDependencies["deduct"],
    refund: (async (_userId: number, amount: number, _d: string, reference: string) => {
      journal.push("refund");
      refunds.push({ amount, reference });
      return { recorded: true, amount, reference, duplicate: false };
    }) as PackageRedoServiceDependencies["refund"],
    commitRetried: (async (request: {
      angle: string;
      operationId: string;
      pointsCost: number;
      provenance: Record<string, unknown>;
    }) => {
      journal.push("commit");
      committed.push({
        angle: request.angle,
        operationId: request.operationId,
        pointsCost: request.pointsCost,
        provenance: request.provenance,
      });
      return 4242;
    }) as PackageRedoServiceDependencies["commitRetried"],
    outfitPlateEngine: () => ({
      editWithReferences: async () => {
        plateCalls += 1;
        if (plateBehaviour === "throw") throw new Error("the plate door refused");
        /* A REAL, SPLITTABLE IMAGE — `splitOutfitPlate` cuts it with sharp, so
           thirteen bytes of ASCII would make every plate arm pass for the wrong
           reason (the #1903 fixture finding, one seam over). Landscape, because
           the plate is two panels side by side. */
        return { bytes: await renderLikeFrame(128, 96), contentType: "image/png" };
      },
    }) as never,
    identityEngine: () => ({
      generateView: async (request: { prompt: string; references?: Array<{ bytes: Buffer }> }) => {
        journal.push("render");
        enginePosts.push({ prompt: request.prompt, references: request.references ?? [] });
        /* WHICH VIEW IS THIS? Read off the one thing in the prompt that is
           unique to an angle — its own `directive`, which
           `composePackageViewPrompt` composes in. The angle KEY is not in the
           prompt at all, which is how the first draft of this fixture targeted
           nothing and three arms passed by never failing anything. */
        const angle = CAST_PACKAGE_VIEWS.find((candidate) =>
          request.prompt.includes(castPackageView(candidate).directive));
        if (angle && engineFails.has(angle)) throw new Error("engine down");
        return {
          bytes: Buffer.from("view"),
          contentType: "image/png",
          provenance: { model: "test-engine", provider: "test" },
        };
      },
    }) as never,
    judge: (() => async () => ({
      pass: true,
      method: "model",
      axes: {
        identity: { pass: true, note: "" },
        intact: { pass: true, note: "" },
        people: { pass: true, note: "" },
      },
    })) as never,
    storeImage: async (request: { operationId: string }) => ({
      key: `views/${request.operationId}.png`,
      url: `https://public/views/${request.operationId}.png`,
    }),
    deleteObject: async () => ({ success: true as const }),
    wait: async () => undefined,
    ...overrides,
  };
}

const input = { userId: 1, clientRequestId: PRESS, castId: "KI-AAAA-BBBB-CCCC-DDDD" };

beforeEach(() => {
  journal.length = 0;
  deducts.length = 0;
  refunds.length = 0;
  committed.length = 0;
  enginePosts.length = 0;
  plateCalls = 0;
  plateBehaviour = "ok";
  balance = 10_000_000;
  chargeFails = new Set();
  engineFails = new Set();
  busySlotAngles = [];
  castStatus = "ready";
  lockedAngles = new Set();
  replays = {};
  receipts.success.mockClear();
  receipts.failClaimed.mockClear();
  carried.inkAsked.mockClear();
});

describe("a redo that lands", () => {
  it("charges one slice per view and replaces every slot", async () => {
    const result = await redoCastPackage(dependencies(), input);

    expect(result.committed.sort()).toEqual([...CAST_PACKAGE_VIEWS].sort());
    expect(result.failed).toEqual([]);
    expect(result.chargedCredits).toBe(CASTING_V2_PACKAGE_REDO_PRICE_CREDITS);
    expect(result.refundedCredits).toBe(0);
    expect(result.refundRecorded).toBe(true);

    /* HIS PRICE, AT THE TILL — five deducts of the slice and no sixth. */
    expect(deducts).toHaveLength(CAST_PACKAGE_VIEWS.length);
    for (const deduct of deducts) expect(deduct.amount).toBe(SLICE);
    expect(deducts.reduce((sum, d) => sum + d.amount, 0))
      .toBe(CASTING_V2_PACKAGE_REDO_PRICE_CREDITS);
    expect(refunds).toEqual([]);
    /* Each slice is charged under ITS OWN operation's reference, which is what
       lets one view refund without touching the other four. */
    expect(new Set(deducts.map((d) => d.reference)).size).toBe(CAST_PACKAGE_VIEWS.length);
  });

  it("claims EVERY view before it charges ANY of them", async () => {
    /*
      ⚠ THE ORDER IS THE CONTROL AND IT IS THIS ROAD'S ONE STRUCTURAL ADDITION.
      A claim is free; a deduct is not. Claiming the whole set first is what
      turns "somebody is already asking for her profile" into a refusal that
      charged nothing, instead of a redo that charged two slices and then met a
      busy slot. Charged-then-claimed is the same set of calls in a different
      order, so only the journal can tell them apart.
    */
    await redoCastPackage(dependencies(), input);
    const lastClaim = journal.reduce(
      (last, entry, index) => (entry.startsWith("claim:") ? index : last),
      -1,
    );
    const firstDeduct = journal.indexOf("deduct");
    expect(lastClaim).toBeGreaterThanOrEqual(0);
    expect(firstDeduct).toBeGreaterThan(lastClaim);
  });

  it("stamps the road on every new picture, and the operation the sweep reads", async () => {
    await redoCastPackage(dependencies(), input);
    expect(committed).toHaveLength(CAST_PACKAGE_VIEWS.length);
    for (const row of committed) {
      /* The only field that says WHICH road replaced this view. Its sibling is
         the kind on the operation row. */
      expect(row.provenance.source).toBe("castingV2.packageRedo");
      /* The sweep's fork variable — deliberately the same key the Try again
         writes, because `retriedViewLanded` asks the right question on both
         roads. Written WITH the picture, so a landed view can never look
         unpaid. */
      expect(row.provenance.retryOperationId).toBe(row.operationId);
      expect(row.pointsCost).toBe(SLICE);
    }
  });

  it("gives each view its own derived request id, so a double press replays", async () => {
    await redoCastPackage(dependencies(), input);
    for (const angle of CAST_PACKAGE_VIEWS) {
      expect(committed.map((row) => row.operationId))
        .toContain(derivedClientRequestId(PRESS, angle));
    }
  });

  it("carries her tattoos and her master into every view", async () => {
    await redoCastPackage(dependencies(), input);
    /*
      HER IDENTITY NEVER MOVES — his card: *"The identity stays fixed across a
      redo"*. The anchor is the first reference on every view, and her ink crops
      ride behind it.
    */
    expect(enginePosts).toHaveLength(CAST_PACKAGE_VIEWS.length);
    for (const post of enginePosts) {
      expect(post.references[0]?.bytes.toString()).toBe("her-signed-face");
      expect(post.references.some((reference) => reference.bytes.toString() === "her-tattoo"))
        .toBe(true);
    }
    expect(carried.inkAsked).toHaveBeenCalledTimes(CAST_PACKAGE_VIEWS.length);
  });
});

describe("the outfit", () => {
  it("mints ONE plate and hands the two full-length views their own panels", async () => {
    /*
      ⚠ THE WHOLE POINT OF HIS RULING IN ONE ARM: *"regens all views not just
      one"* only means something if the five share one invented outfit. A second
      plate call would be a second invention, and the package would come back in
      two outfits — the defect he reported about hems and shoes, delivered by
      the thing built to fix it.
    */
    await redoCastPackage(dependencies(), input);
    expect(plateCalls).toBe(1);

    /*
      Her face, her one ink crop, and — on the two full-length views only — a
      plate panel. So three references there and two everywhere else, which is
      asserted as a COUNT rather than by sniffing the prompt.
    */
    const postFor = (angle: string) => enginePosts.find((candidate) =>
      candidate.prompt.includes(castPackageView(angle as never).directive));
    for (const angle of CAST_PACKAGE_VIEWS) {
      const dressed = (PLATE_ANGLES as readonly string[]).includes(angle);
      expect(postFor(angle)?.references).toHaveLength(dressed ? 3 : 2);
    }
    /* Both panels came from ONE plate and they are DIFFERENT halves: a split
       that handed both views the same side would dress her back with her
       front, and every count above would still be right. */
    const panels = PLATE_ANGLES.map((angle) =>
      postFor(angle)?.references.at(-1)?.bytes.toString("base64") ?? null);
    expect(panels[0]).not.toBeNull();
    expect(panels[1]).not.toBeNull();
    expect(panels[0]).not.toBe(panels[1]);
  });

  it("delivers all five on the master alone when the plate throws", async () => {
    /*
      HIS RULE FROM PATH E, on a road that has already charged five slices by
      the time the plate is asked for: a plate failure never fails the redo and
      never refunds. A rejected promise here would reject the whole
      `Promise.all` and leave five charged views never ATTEMPTED — the one
      failure mode with no refund path out of it.
    */
    plateBehaviour = "throw";
    const result = await redoCastPackage(dependencies(), input);
    expect(result.committed.sort()).toEqual([...CAST_PACKAGE_VIEWS].sort());
    expect(result.failed).toEqual([]);
    expect(result.chargedCredits).toBe(CASTING_V2_PACKAGE_REDO_PRICE_CREDITS);
    expect(refunds).toEqual([]);
  });
});

describe("a redo that partly fails", () => {
  it("refunds ONLY the slice that did not arrive", async () => {
    /*
      HIS CATASTROPHIC REFUND RULE, UNCHANGED, which is the whole reason the
      charge decomposes: one view goes back, four stand, and the picture the
      customer already had stays in the failed slot — a redo never lands a hole.
    */
    engineFails = new Set(["backFull"]);
    const result = await redoCastPackage(dependencies(), input);

    expect(result.failed).toEqual(["backFull"]);
    expect(result.committed).toHaveLength(CAST_PACKAGE_VIEWS.length - 1);
    expect(result.committed).not.toContain("backFull");
    expect(result.chargedCredits).toBe(CASTING_V2_PACKAGE_REDO_PRICE_CREDITS);
    expect(result.refundedCredits).toBe(SLICE);
    expect(result.refundRecorded).toBe(true);

    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.amount).toBe(SLICE);
    /* NOTHING is committed for the failed angle — no confession, no marker. The
       slot keeps the picture it had. */
    expect(committed.map((row) => row.angle)).not.toContain("backFull");
  });

  it("refunds under the SAME operation's reference the slice was charged on", async () => {
    /*
      A refund under another view's reference would give one customer their
      money back out of a different view's charge, and the ledger's uniqueness
      would stop a repeat being harmless.
    */
    engineFails = new Set(["closeUp"]);
    await redoCastPackage(dependencies(), input);
    const charged = deducts.find((deduct) =>
      deduct.reference === `op:${derivedClientRequestId(PRESS, "closeUp")}:charge`);
    expect(charged?.amount).toBe(SLICE);
    expect(refunds[0]?.reference).toBe(charged?.reference);
  });

  it("charges nothing for a view whose deduct refused, and does not render it", async () => {
    /*
      The whole price was proved affordable at the admission, so reaching here
      means the balance moved underneath us. The other slices stand on their
      own; this one is simply not rendered, and nothing is owed back for it
      because nothing was taken.
    */
    chargeFails = new Set(["sideClose"]);
    const result = await redoCastPackage(dependencies(), input);
    expect(result.failed).toEqual(["sideClose"]);
    expect(result.chargedCredits)
      .toBe(SLICE * (CAST_PACKAGE_VIEWS.length - 1));
    expect(result.refundedCredits).toBe(0);
    expect(refunds).toEqual([]);
    expect(committed.map((row) => row.angle)).not.toContain("sideClose");
  });
});

describe("the free refusals, all of them before any claim", () => {
  const expectNothingSpent = () => {
    expect(deducts).toEqual([]);
    expect(refunds).toEqual([]);
    expect(committed).toEqual([]);
    expect(plateCalls).toBe(0);
  };

  it("refuses a Cast that is still being made", async () => {
    castStatus = "building";
    await expect(redoCastPackage(dependencies(), input))
      .rejects.toThrow(PACKAGE_REDO_NOT_READY_MESSAGE);
    expect(journal).toEqual([]);
    expectNothingSpent();
  });

  it("refuses while ANY ONE of her views is already in flight", async () => {
    busySlotAngles = ["threeQuarter"];
    await expect(redoCastPackage(dependencies(), input))
      .rejects.toThrow(PACKAGE_REDO_BUSY_MESSAGE);
    expect(journal).toEqual([]);
    expectNothingSpent();
  });

  it("refuses when her signed face cannot be read", async () => {
    await expect(redoCastPackage(
      dependencies({ readAnchorBytes: async () => { throw new Error("gone"); } }),
      input,
    )).rejects.toThrow(PACKAGE_REDO_FACE_MISSING_MESSAGE);
    expectNothingSpent();
  });

  it("refuses an unaffordable redo, quoting the WHOLE price and not a slice", async () => {
    /*
      A customer told "you need 70 credits" for a 350-credit button would top up
      and be refused again. 69 display credits is one short of the price.
      Asserted on the SENTENCE because the sentence is the whole repair.
    */
    balance = CASTING_V2_PACKAGE_REDO_PRICE_CREDITS - 1;
    await expect(redoCastPackage(dependencies(), input)).rejects.toThrow("350 credits");
    expectNothingSpent();
  });

  it("refuses a Cast with no slots", async () => {
    await expect(redoCastPackage(
      dependencies({
        readSlots: async () => ({
          modelId: 7, status: "ready", slots: [], deliveredOutfitKeys: {}, freeRetrySpentAngles: [],
        }),
      }),
      input,
    )).rejects.toThrow(TRPCError);
    expectNothingSpent();
  });
});

describe("a slot locked between the read and the claim", () => {
  it("unwinds every claim it already took and charges nothing", async () => {
    /*
      ⚠ THE RACE THE TWO-PHASE CLAIM EXISTS FOR, and the arm that proves the
      unwind. The admission read said nothing was in flight; by the claim, the
      fourth slot's lock is taken. Without the unwind the first three rows would
      sit claimed with their locks held — slots a customer could never ask for
      again until the sweep arrived — and the receipt would be a refusal over
      three live claims.
    */
    lockedAngles = new Set(["frontFull"]);
    await expect(redoCastPackage(dependencies(), input))
      .rejects.toThrow(PACKAGE_REDO_BUSY_MESSAGE);

    /* Nothing was charged: a claim moves no money, which is the premise. */
    expect(deducts).toEqual([]);
    expect(refunds).toEqual([]);
    expect(committed).toEqual([]);
    /* The claims taken BEFORE the refusal were each failed free. `frontFull` is
       third in the view list, so two were already held. */
    expect(receipts.failClaimed).toHaveBeenCalledTimes(2);
    /* And nothing rendered — the plate is minted only after the whole set is
       claimed, so a refused claim cannot spend house money either. */
    expect(plateCalls).toBe(0);
    expect(journal.filter((entry) => entry === "render")).toEqual([]);
  });
});

describe("the same press arriving twice", () => {
  it("returns what the first press bought instead of a second package", async () => {
    /*
      Idempotency on a money path: the five request ids are derived from the
      press, so every claim reads as a replay and the receipt is rebuilt from
      what each operation settled. Nothing renders and nothing is charged again.
    */
    replays = Object.fromEntries(CAST_PACKAGE_VIEWS.map((angle) => [angle, {
      castId: input.castId,
      committed: [angle],
      failed: [],
      chargedCredits: SLICE,
      refundedCredits: 0,
      refundRecorded: true,
    }]));

    const result = await redoCastPackage(dependencies(), input);
    expect(result.committed.sort()).toEqual([...CAST_PACKAGE_VIEWS].sort());
    expect(result.chargedCredits).toBe(CASTING_V2_PACKAGE_REDO_PRICE_CREDITS);
    expect(deducts).toEqual([]);
    expect(committed).toEqual([]);
    expect(plateCalls).toBe(0);
  });
});
