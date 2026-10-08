import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE PAID REDO — the money sequence for a whole package asked for again
 * (#1903 slice 2).
 *
 * **His ruling, verbatim (2026-10-07):** *"maybe we should allow retry by
 * default incase they didnt like the outfit that was invented or whatever but
 * it costs per retry and regens all views not just one"*, and **his price,
 * 2026-10-08: *"on this card make both sign and redo/regenerate 650 credis"***
 * — one flat charge for the press, with no per-view refund.
 *
 * ⚠ **THE SHAPE OF THIS SUITE MOVED WITH HIS PRICE, and the arms that went
 * with it are named here rather than quietly deleted.** It used to assert five
 * deducts of a slice, a refund of ONE slice when one view failed, and a refund
 * under that view's own reference. None of those is the product any more: a
 * slot carries no money at all, and credits come back only when NOTHING
 * arrived.
 *
 * What earns a place now, because each is a way this road could take money and
 * give nothing:
 *
 * - **EVERY SLOT IS CLAIMED BEFORE THE ONE DEDUCT**, so a busy slot is a
 *   refusal that charged nothing rather than a half-bought package. Asserted on
 *   the JOURNAL, because "claimed then charged" and "charged then claimed" are
 *   the same calls in a different order and only the order is the control.
 * - **ONE CHARGE, ON THE PRESS**, whatever she owns — the slot rows plan zero.
 * - **A FAILED VIEW REFUNDS NOTHING** while anything else arrived, and the
 *   picture the customer already had stays in that slot.
 * - **ZERO DELIVERED REFUNDS THE WHOLE PRICE, EXACTLY ONCE.**
 * - **TWO SHEETS, NOT FIVE RENDERS AND A PLATE** — the road the Sign itself
 *   took in #1957, which is what makes his 650 the right price rather than a
 *   loss.
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
  success: vi.fn(async (input: unknown) => {
    /*
      A RECEIPT THAT WILL NOT WRITE — the relay's own second route into a
      rejected slice (#1903 finding 2): *"or if a genuinely swept view's
      `completeDirectOperationSuccess` throws"*. It is awaited OUTSIDE
      `redoOneView`'s try/catch, so it propagates straight out of the slice.
    */
    const { operationId } = input as { operationId: string };
    if (receiptRefusals.has(operationId)) {
      throw new Error("the success receipt could not be written");
    }
  }),
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
import { CASTING_V2_PACKAGE_REDO_PRICE_CREDITS } from "../casting/castingCreditCosts";
import { derivedClientRequestId } from "../casting/operationContract";
import sharp from "sharp";
import { CAST_PACKAGE_VIEWS, castPackageView } from "./castViewPackage";
import {
  PACKAGE_REDO_BUSY_MESSAGE,
  PACKAGE_REDO_FACE_MISSING_MESSAGE,
  PACKAGE_REDO_NOT_READY_MESSAGE,
  redoCastPackage,
  type PackageRedoServiceDependencies,
} from "./packageRedoService";
import { signSheetPlan, type SignSheetKind } from "./signSheet";
import type { CastSlotProjection } from "./castProjection";

/* ONE number, read from the declaration the client is served (#1903, his flat
   650). There is no slice to compose a total from any more. */
const PACKAGE_PRICE = CASTING_V2_PACKAGE_REDO_PRICE_CREDITS;
const PRESS = "11111111-1111-4111-8111-111111111111";

const journal: string[] = [];
const deducts: Array<{ amount: number; reference: string }> = [];
const refunds: Array<{ amount: number; reference: string }> = [];
const committed: Array<{
  angle: string;
  operationId: string;
  pointsCost: number;
  provenance: Record<string, unknown>;
  pressOperationId?: string;
}> = [];
/** Every reference list the identity engine was posted, per view. */
const enginePosts: Array<{ prompt: string; references: Array<{ bytes: Buffer }> }> = [];
/** Every sheet the press asked for, by kind — two per redo, one per sheet. */
const sheetCalls: SignSheetKind[] = [];
let sheetBehaviour: "ok" | "throw" = "ok";
let balance = 10_000_000;
/** The ONE deduct of a press either lands or does not; there are no slices. */
let chargeFails = false;
/** Views whose PANEL the judge refuses — the only per-view failure the sheet
 *  road has, now that no view calls an engine of its own. */
let judgeRefuses: ReadonlySet<string> = new Set();
let busySlotAngles: readonly string[] = [];
let castStatus: "building" | "ready" = "ready";
/** Which angles `begin` refuses as locked, by the angle in the claim payload. */
let lockedAngles: ReadonlySet<string> = new Set();
/** What a replayed PRESS hands back, or null for a first press. */
let pressReplay: unknown = null;
/**
 * WHAT THE COMMIT DOES, PER ANGLE — #1903's review finding 1.
 *
 * `null` is the FENCED read (`renderViewAttempts` maps it to
 * `status: "fenced"`), and `throw` is the road the repair moved the other
 * three onto. The default stays "land it", so no existing arm moves.
 */
/**
 * ⚠ `throw-once` EXISTS FOR THE RETRY QUESTION THE RELAY ASKED (#1903).
 *
 * A commit that throws rolls its transaction back, so the asset row it was
 * inserting never exists; the attempt loop then asks again. What must be true
 * is that the slot ends with exactly ONE asset, never two.
 */
let commitBehaviour: Record<string, "null" | "throw" | "throw-once"> = {};
const commitThrows: Record<string, number> = {};
/** Every `markGenerationOperationRunning` the service asked for, in order. */
const running: Array<{
  operationId: string;
  plannedCredits: number;
  heartbeat: boolean;
  lockKey: string | null;
}> = [];
/** Every operation handed to the sweep, in order. */
const handedOff: string[] = [];
/** Operation ids whose success receipt refuses to write. */
let receiptRefusals: ReadonlySet<string> = new Set();

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

/**
 * A SHEET THAT CAN ACTUALLY BE CUT — panels of unequal width with white
 * dividers between them, the orchestrator suite's own fixture shape.
 *
 * ⚠ **IT HAS TO BE A REAL IMAGE.** `renderSignSheet` converts the anchor
 * with `sharp` and the coordinator cuts the returned bytes with it, so a
 * thirteen-byte ASCII stand-in reads as a sheet that never arrived — which
 * would make every arm below pass for the wrong reason (a dead redo refunds
 * the whole price, and most arms here would be satisfied by that).
 */
async function syntheticSheetBytes(panels: number): Promise<Buffer> {
  const width = 100 * panels + 20 * (panels - 1);
  const height = 40;
  const widths = Array.from({ length: panels }, (_, index) => 100 + (index % 2 === 0 ? 12 : -12));
  const spare = width - widths.reduce((a, b) => a + b, 0) - 4 * (panels - 1);
  widths[widths.length - 1] = widths[widths.length - 1]! + spare;
  const raw = Buffer.alloc(width * height, 0);
  let x = 0;
  widths.forEach((panelWidth, index) => {
    for (let y = 0; y < height; y += 1) {
      raw.fill(40 + index * 20, y * width + x, y * width + x + panelWidth);
    }
    x += panelWidth;
    if (index < widths.length - 1) {
      for (let y = 0; y < height; y += 1) raw.fill(255, y * width + x, y * width + x + 4);
      x += 4;
    }
  });
  return sharp(raw, { raw: { width, height, channels: 1 } }).png().toBuffer();
}

const sheetPngs = new Map<SignSheetKind, Buffer>();

/** Her master, as a real image, for `renderSignSheet`'s own JPEG conversion. */
const ANCHOR_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

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
      /* A real PNG: the sheet road converts the master before dispatch, so the
         old ASCII stand-in would fail every sheet (see `syntheticSheetBytes`). */
      bytes: ANCHOR_PNG,
      contentType: "image/png",
    }),
    readBalance: async () => ({ balance }),
    begin: (async (request: { clientRequestId: string; kind: string; payload: unknown }) => {
      /*
        TWO SHAPES THROUGH ONE SEAM (#1903, the flat price): the PRESS, which
        names no angle and carries the whole price, and the five SLOTS, which
        name an angle and carry none. The fixture tells them apart the way the
        service does — by kind — rather than by sniffing the payload.
      */
      if (request.kind === "castingV2.packageRedoPress") {
        journal.push("claim:press");
        if (pressReplay !== null) {
          return { type: "replay" as const, operationId: "op-press", result: pressReplay };
        }
        return { type: "execute" as const, operationId: request.clientRequestId };
      }
      const angle = (request.payload as { angle: string }).angle;
      journal.push(`claim:${angle}`);
      if (lockedAngles.has(angle)) {
        throw new TRPCError({ code: "CONFLICT", message: PACKAGE_REDO_BUSY_MESSAGE });
      }
      /* The operation id is derived from the request id the entrance composed,
         so an arm can tie a commit back to the angle it belongs to. */
      return { type: "execute" as const, operationId: request.clientRequestId };
    }) as PackageRedoServiceDependencies["begin"],
    markRunning: (async (request: {
      operationId: string;
      plannedCredits: number;
      heartbeat?: boolean;
      requiredLockKey?: string;
    }) => {
      journal.push("running");
      running.push({
        operationId: request.operationId,
        plannedCredits: request.plannedCredits,
        heartbeat: request.heartbeat === true,
        lockKey: request.requiredLockKey ?? null,
      });
      return { operationId: request.operationId, chargeReferenceId: `op:${request.operationId}:charge` };
    }) as PackageRedoServiceDependencies["markRunning"],
    deduct: (async (
      _userId: number,
      amount: number,
      _kind: string,
      _description: string,
      reference: string,
    ) => {
      journal.push("deduct");
      if (chargeFails) return { success: false, error: "Not enough credits" };
      deducts.push({ amount, reference });
      return { success: true };
    }) as PackageRedoServiceDependencies["deduct"],
    handoffToRecovery: (async (request: { operationId: string }) => {
      journal.push("handoff");
      handedOff.push(request.operationId);
    }) as PackageRedoServiceDependencies["handoffToRecovery"],
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
      pressOperationId?: string;
    }) => {
      journal.push("commit");
      const behaviour = commitBehaviour[request.angle];
      if (behaviour === "null") return null;
      if (behaviour === "throw") throw new Error("the commit transaction was lost");
      if (behaviour === "throw-once") {
        commitThrows[request.angle] = (commitThrows[request.angle] ?? 0) + 1;
        /* The FIRST call throws, as a lost transaction does, and leaves no row
           behind it. Every later call behaves normally, which is what makes
           the "exactly one asset" assertion mean something. */
        if (commitThrows[request.angle] === 1) {
          throw new Error("the commit transaction was lost after it was sent");
        }
      }
      committed.push({
        angle: request.angle,
        operationId: request.operationId,
        pointsCost: request.pointsCost,
        provenance: request.provenance,
        /* ⚠ RECORDED AT THE WIRE (#1903 review finding 1). The fence lives in
           the commit's own statement, so what this service must be proven to
           do is HAND IT the press id — as a named argument, not buried in the
           provenance bag. Working law 5: the contract is proven on the
           outgoing request. */
        pressOperationId: request.pressOperationId,
      });
      return 4242;
    }) as PackageRedoServiceDependencies["commitRetried"],
    /*
      ⚠ **THE VIEW ENGINE IS STILL BUILT, EVEN THOUGH NO VIEW CALLS IT.**
      `renderViewAttempts` constructs it at the top of the loop — before it
      learns there are sheets — and the real `castingViewEngine()` throws on a
      missing `FAL_KEY`, which without this double fails all five views
      instantly and reads as a dead redo. Its `generateView` THROWS on purpose:
      if this road ever fell back to a per-view render, the arm that counts
      sheets would not notice, and this would.
    */
    identityEngine: (() => ({
      id: "test-identity",
      editWithReferences: async () => { throw new Error("a redo edits nothing per view"); },
      generateView: async () => { throw new Error("a redo renders no view of its own"); },
    })) as never,
    signSheetEngine: ((kind: SignSheetKind) => ({
      id: `test-sheet-${kind}`,
      editWithReferences: async (request: { prompt: string; references?: Array<{ bytes: Buffer }> }) => {
        journal.push("render");
        sheetCalls.push(kind);
        enginePosts.push({ prompt: request.prompt, references: request.references ?? [] });
        if (sheetBehaviour === "throw") throw new Error("the sheet door refused");
        return {
          bytes: sheetPngs.get(kind) as Buffer,
          contentType: "image/png",
          latencyMs: 61_000,
          provenance: {
            provider: "fal" as const,
            model: `sunburst-sheet-${kind}`,
            providerRef: `sheet-ref-${kind}`,
          },
        };
      },
      generateView: async () => { throw new Error("a redo renders no view of its own"); },
    })) as never,
    judge: (() => async (request: { angle: string }) => {
      /*
        THE ONLY PER-VIEW FAILURE A SHEET ROAD HAS. No view calls an engine of
        its own any more, so "this one did not arrive" is a panel the judge
        refuses — which is also the real road a customer meets (#1903's
        catastrophic axes).
      */
      const refused = judgeRefuses.has(request.angle);
      return {
        pass: !refused,
        method: "model",
        axes: {
          identity: { pass: !refused, note: refused ? "not her" : "" },
          intact: { pass: true, note: "" },
          people: { pass: true, note: "" },
        },
      };
    }) as never,
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

beforeAll(async () => {
  /* Derived from the plan, never a literal pair: a third sheet kind gets its
     own fixture by existing. */
  for (const plan of signSheetPlan()) {
    sheetPngs.set(plan.kind, await syntheticSheetBytes(plan.panelOrder.length));
  }
});

beforeEach(() => {
  journal.length = 0;
  deducts.length = 0;
  refunds.length = 0;
  committed.length = 0;
  enginePosts.length = 0;
  sheetCalls.length = 0;
  sheetBehaviour = "ok";
  balance = 10_000_000;
  chargeFails = false;
  judgeRefuses = new Set();
  busySlotAngles = [];
  castStatus = "ready";
  lockedAngles = new Set();
  pressReplay = null;
  commitBehaviour = {};
  for (const key of Object.keys(commitThrows)) delete commitThrows[key];
  running.length = 0;
  handedOff.length = 0;
  receiptRefusals = new Set();
  receipts.success.mockClear();
  receipts.failClaimed.mockClear();
  carried.inkAsked.mockClear();
});

describe("a redo that lands", () => {
  it("charges ONE flat price and replaces every slot", async () => {
    const result = await redoCastPackage(dependencies(), input);

    expect(result.committed.sort()).toEqual([...CAST_PACKAGE_VIEWS].sort());
    expect(result.failed).toEqual([]);
    expect(result.chargedCredits).toBe(PACKAGE_PRICE);
    expect(result.refundedCredits).toBe(0);
    expect(result.refundRecorded).toBe(true);

    /*
      HIS PRICE, AT THE TILL — ⚠ **ONE deduct, not one per view.** This arm read
      five of a slice until his word of 2026-10-08, and the count is the whole
      assertion: five deducts summing to the same total would be the old shape
      wearing the new number, and a slot could then be refunded on its own
      again.
    */
    expect(deducts).toHaveLength(1);
    expect(deducts[0]?.amount).toBe(PACKAGE_PRICE);
    expect(refunds).toEqual([]);
    /* And it is charged on the PRESS's own reference — the row that plans the
       credits is the row the sweep can give them back from. */
    expect(deducts[0]?.reference).toBe(`op:${PRESS}:charge`);
  });

  it("plans the money on the press and ZERO on every slot", async () => {
    /*
      ⚠ THE FIELD THE RECOVERY SWEEP READS. `plannedCredits` is what an
      unsettled row owes back, so a slot carrying the flat price would hand a
      customer a whole redo whenever that slot was the one left unsettled —
      even with its four siblings delivered. The press is the only row with
      credits on it, and this is the arm that says so.
    */
    const planned: Array<{ kind: string; plannedCredits: number }> = [];
    await redoCastPackage(
      dependencies({
        begin: (async (request: {
          clientRequestId: string;
          kind: string;
          payload: unknown;
          plannedCredits?: number;
        }) => {
          planned.push({ kind: request.kind, plannedCredits: request.plannedCredits ?? -1 });
          return { type: "execute" as const, operationId: request.clientRequestId };
        }) as PackageRedoServiceDependencies["begin"],
      }),
      input,
    );

    const press = planned.filter((row) => row.kind === "castingV2.packageRedoPress");
    const slotRows = planned.filter((row) => row.kind === "castingV2.packageRedo");
    expect(press).toHaveLength(1);
    expect(press[0]?.plannedCredits).toBe(PACKAGE_PRICE);
    expect(slotRows).toHaveLength(CAST_PACKAGE_VIEWS.length);
    for (const row of slotRows) expect(row.plannedCredits).toBe(0);
  });

  it("⚠ marks the PRESS running, with a heartbeat, before the money moves", async () => {
    /*
      ⚠ **A CLAIMED ROW CANNOT BE SETTLED.** `finalizeGenerationOperationSuccess`
      updates `WHERE status = 'running'`, so a press left `claimed` cannot be
      sealed: the receipt affects no rows, falls into
      `markRecoveryAfterReceiptFailure`, and parks a perfectly good redo for
      support review with the customer's credits unsettled. Found by the
      security review on PR #1924, and invisible to every other arm in this file
      because they mock the receipt rather than the row it needs.

      The HEARTBEAT is asserted too: a press lives as long as both sheets take,
      and a lease that lapsed under it would hand a live redo to the sweep.
    */
    await redoCastPackage(dependencies(), input);

    const press = running.find((row) => row.operationId === PRESS);
    expect(press, "the press was never marked running — its receipt cannot write").toBeDefined();
    expect(press?.heartbeat).toBe(true);
    expect(press?.plannedCredits).toBe(PACKAGE_PRICE);
    /* It holds no lock, so it must not claim to require one. */
    expect(press?.lockKey).toBeNull();
    /* And it happens BEFORE the deduct: the row has to be settleable before it
       is the row that was charged. */
    expect(running[0]?.operationId).toBe(PRESS);
    expect(journal.indexOf("running")).toBeLessThan(journal.indexOf("deduct"));
  });

  it("claims the press and EVERY view before it charges anything", async () => {
    /*
      ⚠ THE ORDER IS THE CONTROL. A claim is free; a deduct is not. Claiming the
      whole set first is what turns "somebody is already asking for her profile"
      into a refusal that charged nothing, instead of a redo that charged and
      then met a busy slot. Charged-then-claimed is the same set of calls in a
      different order, so only the journal can tell them apart.
    */
    await redoCastPackage(dependencies(), input);
    const lastClaim = journal.reduce(
      (last, entry, index) => (entry.startsWith("claim:") ? index : last),
      -1,
    );
    const firstDeduct = journal.indexOf("deduct");
    expect(journal[0]).toBe("claim:press");
    expect(lastClaim).toBeGreaterThanOrEqual(0);
    expect(firstDeduct).toBeGreaterThan(lastClaim);
  });

  it("stamps the road, the slot and the PRESS on every new picture", async () => {
    await redoCastPackage(dependencies(), input);
    expect(committed).toHaveLength(CAST_PACKAGE_VIEWS.length);
    for (const row of committed) {
      /* The only field that says WHICH road replaced this view. */
      expect(row.provenance.source).toBe("castingV2.packageRedo");
      /* The per-slot fork variable, the same key the Try again writes. */
      expect(row.provenance.retryOperationId).toBe(row.operationId);
      /*
        ⚠ AND THE PRESS, which is what the flat price needed: the money is on
        that row, so the sweep's question is *did any view of this press land*
        and this field is the only thing that can answer it from the assets.
      */
      expect(row.provenance.pressOperationId).toBe(PRESS);
      /* A slot's picture costs nothing of its own — the press paid once. */
      expect(row.pointsCost).toBe(0);
    }
  });

  it("gives each view its own derived request id", async () => {
    await redoCastPackage(dependencies(), input);
    for (const angle of CAST_PACKAGE_VIEWS) {
      expect(committed.map((row) => row.operationId))
        .toContain(derivedClientRequestId(PRESS, angle));
    }
  });

  it("carries her tattoos and her master into the sheets", async () => {
    await redoCastPackage(dependencies(), input);
    /*
      HER IDENTITY NEVER MOVES — his card: *"The identity stays fixed across a
      redo"*. ⚠ **It rides into the SHEETS now, once per sheet rather than once
      per view**, which is the thing that makes the views of one redo agree with
      each other. Her ink is asked for ONCE per press for the same reason.
    */
    expect(enginePosts).toHaveLength(signSheetPlan().length);
    for (const post of enginePosts) {
      expect(post.references.length).toBeGreaterThan(0);
    }
    expect(carried.inkAsked).toHaveBeenCalledTimes(1);
  });
});

describe("the outfit", () => {
  it("renders TWO sheets and no per-view request at all", async () => {
    /*
      ⚠ **THE RELAY'S SECOND FINDING ON PR #1924, AS AN ARM.** The road this
      replaces rendered one wardrobe plate and then five separate per-view
      requests — about $0.90 where a Sign costs about $0.22, with front and back
      free to disagree because nothing cut them from one frame. His 650 rests on
      *"on the two sheets it costs the same as a Sign"*, so the price is only
      right if this is true.
    */
    await redoCastPackage(dependencies(), input);
    expect(sheetCalls.sort()).toEqual(signSheetPlan().map((plan) => plan.kind).sort());
    /* One request per sheet, and nothing else asked an engine for a picture:
       the per-view road would have put five more entries in this journal. */
    expect(journal.filter((entry) => entry === "render")).toHaveLength(signSheetPlan().length);
  });

  it("refunds the WHOLE price when the sheets never arrive", async () => {
    /*
      A sheet that throws reaches every view as a picture that never came, so
      nothing is delivered — which is the one state his rule refunds. The old
      road's plate could fail and still deliver five views on the master alone;
      a sheet IS the picture, so there is no master-only fallback to assert.
    */
    sheetBehaviour = "throw";
    const result = await redoCastPackage(dependencies(), input);
    expect(result.committed).toEqual([]);
    expect(result.failed.sort()).toEqual([...CAST_PACKAGE_VIEWS].sort());
    expect(result.chargedCredits).toBe(PACKAGE_PRICE);
    expect(result.refundedCredits).toBe(PACKAGE_PRICE);
    expect(refunds).toHaveLength(1);
  });
});

describe("a redo that partly fails", () => {
  it("refunds NOTHING when something arrived, and leaves that slot alone", async () => {
    /*
      ⚠ **HIS RULE, AND IT IS THE OPPOSITE OF WHAT THIS ARM USED TO ASSERT.**
      It read *"refunds ONLY the slice that did not arrive"*, which was right
      while the charge decomposed. His word of 2026-10-08: *"Credits only come
      back if the Sign can't be delivered at all"* — and the redo renders from
      the same two sheets, so a refused view costs the house a whole re-rendered
      sheet rather than a fifth of one.

      What the customer still gets: the picture they already had stays in the
      refused slot. A redo never lands a hole.
    */
    judgeRefuses = new Set(["backFull"]);
    const result = await redoCastPackage(dependencies(), input);

    expect(result.failed).toEqual(["backFull"]);
    expect(result.committed).toHaveLength(CAST_PACKAGE_VIEWS.length - 1);
    expect(result.committed).not.toContain("backFull");
    expect(result.chargedCredits).toBe(PACKAGE_PRICE);
    expect(result.refundedCredits).toBe(0);
    expect(result.refundRecorded).toBe(true);
    expect(refunds).toEqual([]);
    /* NOTHING is committed for the failed angle — no confession, no marker. */
    expect(committed.map((row) => row.angle)).not.toContain("backFull");
  });

  it("refunds the whole price, once, only when NOTHING arrived", async () => {
    /*
      THE TOTAL-LOSS ROAD, which is the only refund this road can make. Driven
      by refusing every panel rather than by killing the sheets, so the sheets
      really did arrive and really were paid for — which is the case his rule is
      actually about.
    */
    judgeRefuses = new Set(CAST_PACKAGE_VIEWS);
    const result = await redoCastPackage(dependencies(), input);

    expect(result.committed).toEqual([]);
    expect(result.failed.sort()).toEqual([...CAST_PACKAGE_VIEWS].sort());
    expect(result.refundedCredits).toBe(PACKAGE_PRICE);
    expect(result.refundRecorded).toBe(true);
    /* ONCE. A refund per slot would be five times his price. */
    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.amount).toBe(PACKAGE_PRICE);
    /* Under the press's own charge reference, so a repeat is harmless. */
    expect(refunds[0]?.reference).toBe(`op:${PRESS}:charge`);
  });

  it("⚠ does NOT refund when the ROWS say a picture landed, whatever this process believed", async () => {
    /*
      THE SECURITY REVIEW'S THIRD FINDING ON PR #1924, and it is working law 1
      on a money path: `committed` is what this process BELIEVES, and the asset
      rows are the fact.

      A slot that committed its picture and then threw past its own settlement
      — a receipt that will not write is the measured route — is counted failed
      here, correctly, because this process cannot say otherwise. If that
      happened to every slot the belief would be "nothing arrived" while new
      pictures sat on the Cast, and the refund would hand back a redo the
      customer received. So the total-loss branch is confirmed against the same
      reader the sweep uses before any credit moves.
    */
    receiptRefusals = new Set(CAST_PACKAGE_VIEWS.map((angle) => derivedClientRequestId(PRESS, angle)));

    const result = await redoCastPackage(
      dependencies({ pressLanded: (async () => true) as never }),
      input,
    );

    expect(result.committed, "this process saw no delivery — which is the premise").toEqual([]);
    expect(result.refundedCredits, "a redo the customer received was refunded").toBe(0);
    expect(refunds).toEqual([]);
    /* The pictures really are there, which is what the reader is agreeing with. */
    expect(committed.map((entry) => entry.angle).sort()).toEqual([...CAST_PACKAGE_VIEWS].sort());
  });

  it("THE CONTROL: it DOES refund when the rows agree nothing landed", async () => {
    /*
      Without this, a confirmation that always answered "something landed"
      would satisfy the arm above and quietly end the only refund this road
      has.
    */
    receiptRefusals = new Set(CAST_PACKAGE_VIEWS.map((angle) => derivedClientRequestId(PRESS, angle)));

    const result = await redoCastPackage(
      dependencies({ pressLanded: (async () => false) as never }),
      input,
    );

    expect(result.refundedCredits).toBe(PACKAGE_PRICE);
    expect(refunds).toHaveLength(1);
  });

  it("renders nothing and charges nothing when the one deduct refuses", async () => {
    /*
      The whole price was proved affordable at the admission, so reaching here
      means the balance moved underneath us. ⚠ Under a flat charge there is no
      "four of five" state left: either the press is bought or nothing happens.
    */
    chargeFails = true;
    await expect(redoCastPackage(dependencies(), input)).rejects.toThrow(TRPCError);
    expect(deducts).toEqual([]);
    expect(refunds).toEqual([]);
    expect(committed).toEqual([]);
    expect(sheetCalls).toEqual([]);
    /* Every row it had taken is failed free — the five slots and the press. */
    expect(receipts.failClaimed).toHaveBeenCalledTimes(CAST_PACKAGE_VIEWS.length + 1);
  });
});

describe("the free refusals, all of them before any claim", () => {
  const expectNothingSpent = () => {
    expect(deducts).toEqual([]);
    expect(refunds).toEqual([]);
    expect(committed).toEqual([]);
    expect(sheetCalls).toEqual([]);
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

  it("refuses an unaffordable redo, quoting the price the button carried", async () => {
    /*
      The sentence is the repair: a customer quoted anything but the real price
      tops up by the wrong amount and is refused again. Under the flat price
      there is no slice it could accidentally quote instead, which is one way
      the shape is simply safer than the one it replaces.
    */
    balance = PACKAGE_PRICE - 1;
    await expect(redoCastPackage(dependencies(), input)).rejects.toThrow("650 credits");
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
  it("unwinds every claim it already took, the press included, and charges nothing", async () => {
    /*
      ⚠ THE RACE THE TWO-PHASE CLAIM EXISTS FOR, and the arm that proves the
      unwind. The admission read said nothing was in flight; by the claim, a
      slot's lock is taken. Without the unwind the rows already held would sit
      claimed with their locks — slots a customer could never ask for again
      until the sweep arrived — and the receipt would be a refusal over live
      claims.
    */
    lockedAngles = new Set(["frontFull"]);
    await expect(redoCastPackage(dependencies(), input))
      .rejects.toThrow(PACKAGE_REDO_BUSY_MESSAGE);

    /* Nothing was charged: the deduct is below the claims, which is the
       premise of the whole order. */
    expect(deducts).toEqual([]);
    expect(refunds).toEqual([]);
    expect(committed).toEqual([]);
    /*
      `frontFull` is third in the view list, so two slots were already held —
      ⚠ **plus the PRESS, which this arm reads as three rather than two.** A
      press left claimed would hold the money row open with no lock to show for
      it, and the sweep would eventually refund a redo that never ran.
    */
    expect(receipts.failClaimed).toHaveBeenCalledTimes(3);
    /* And nothing rendered — the sheets are asked for only after the whole set
       is claimed and charged. */
    expect(sheetCalls).toEqual([]);
    expect(journal.filter((entry) => entry === "render")).toEqual([]);
  });
});

describe("the same press arriving twice", () => {
  it("returns what the first press bought instead of a second package", async () => {
    /*
      Idempotency on a money path, and ⚠ **it is now decided on ONE row.** The
      press is claimed first under the customer's own request id, so a second
      press replays there — before a slot is claimed, before the deduct, before
      a sheet is asked for. The arm that used to live here replayed five slot
      rows and rebuilt a receipt from them; there is one receipt now and the
      press is holding it.
    */
    pressReplay = {
      castId: input.castId,
      committed: [...CAST_PACKAGE_VIEWS],
      failed: [],
      chargedCredits: PACKAGE_PRICE,
      refundedCredits: 0,
      refundRecorded: true,
    };

    const result = await redoCastPackage(dependencies(), input);
    expect(result.committed.sort()).toEqual([...CAST_PACKAGE_VIEWS].sort());
    expect(result.chargedCredits).toBe(PACKAGE_PRICE);
    expect(deducts).toEqual([]);
    expect(committed).toEqual([]);
    expect(sheetCalls).toEqual([]);
    /* Not one slot was even claimed. */
    expect(journal).toEqual(["claim:press"]);
  });
});

/**
 * ⚠ THE TWO FINDINGS THE RELAY HELD THIS PULL REQUEST ON (#1903, head
 * `65141978a`), each driven at the one observable that separates the repair
 * from the bug — and both still hold under the flat price, which is why they
 * are kept rather than rewritten.
 *
 * **Why these could not be seen by the arms above.** Every arm written before
 * them drives a commit that LANDS, and the defect lives entirely in what
 * happens when it does not.
 */
describe("a view whose commit did not land (review finding 1)", () => {
  it("hands the slot to the sweep and seals NO receipt for it", async () => {
    /*
      THE DEFECT: this exit used to call `completeDirectOperationSuccess` on a
      row it had just declared it does not own. On a row still `running` that
      receipt is TERMINAL, so the sweep never looked again.

      ⚠ **WHAT CHANGED WITH THE FLAT PRICE** is only the money sentence: the
      slot owes nothing either way now, because the press is the only row that
      can refund. The handoff still matters — the sweep is what closes the
      operation, and a sealed success would leave a picture that does not exist
      recorded as delivered.
    */
    commitBehaviour = { closeUp: "null" };

    const result = await redoCastPackage(dependencies(), input);

    /* THE ONE ASSERTION THE BUG FAILS: no success receipt for that slot. */
    const sealed = receipts.success.mock.calls.map(
      ([call]) => (call as { operationId: string }).operationId,
    );
    expect(sealed).not.toContain(derivedClientRequestId(PRESS, "closeUp"));
    /* And the lease went to the sweep instead, named. */
    expect(handedOff).toEqual([derivedClientRequestId(PRESS, "closeUp")]);

    expect(result.failed).toEqual(["closeUp"]);
    expect(result.committed).not.toContain("closeUp");
    /* Four arrived, so his rule keeps the charge — and the press's own receipt
       is sealed normally. */
    expect(result.committed.sort()).toEqual(
      CAST_PACKAGE_VIEWS.filter((angle) => angle !== "closeUp").sort(),
    );
    expect(result.chargedCredits).toBe(PACKAGE_PRICE);
    expect(result.refundedCredits).toBe(0);
    expect(refunds).toEqual([]);
  });

  it("never reports a fenced slot as delivered", async () => {
    /* The negative control for the arm above: the bug's receipt said
       `succeeded`, so a reader could conclude the view was handed over. */
    const angle = CAST_PACKAGE_VIEWS[3]!;
    expect(angle).toBe("sideClose");
    commitBehaviour = { [angle]: "null" };
    const result = await redoCastPackage(dependencies(), input);
    expect(result.committed).not.toContain(angle);
    expect(result.failed).toContain(angle);
  });

  /**
   * ⚠ **THE PRESS'S ID REACHES THE COMMIT AS A NAMED ARGUMENT — #1903 review
   * finding 1, asserted at the wire.**
   *
   * The repair is a second fence inside the commit's own statement: a slot may
   * not land its picture unless the PRESS row holding the money is still
   * `running`. That statement can only ask the question if this service hands
   * it the id, so this is the half of the repair that lives here — and it is
   * checked as a named argument rather than inside `provenance`, because a
   * fence keyed on a free-form bag fails SILENTLY when the key is misspelled:
   * it would skip the fence and read exactly like a road that has one.
   *
   * The provenance copy is asserted beside it and is a different job: it is
   * what the sweep reads back off the asset rows hours later.
   */
  it("hands the slot commit the press's id by name, not only inside the provenance", async () => {
    const result = await redoCastPackage(dependencies(), input);
    expect(result.committed).toHaveLength(CAST_PACKAGE_VIEWS.length);
    expect(committed).toHaveLength(CAST_PACKAGE_VIEWS.length);

    for (const row of committed) {
      /* THE FENCE'S INPUT — a named argument on every one of the five. */
      expect(row.pressOperationId, `${row.angle} did not carry the press id`).toBe(PRESS);
      /* THE SWEEP'S FORK VARIABLE — the same id, its other job. */
      expect(row.provenance.pressOperationId).toBe(PRESS);
      /* And it is the PRESS, never the slot's own operation: reading the slot
         id into the fence would make it a restatement of the fence that was
         already there, and prove nothing about the money. */
      expect(row.pressOperationId).not.toBe(row.operationId);
    }
  });

  /**
   * ⚠ **A SLOT WHOSE PRESS THE SWEEP HAS ALREADY SETTLED REFUNDS NOTHING AND
   * DELIVERS NOTHING — the relay's own arm, in its own words: "press swept
   * while a slot is still running → no refund, or the slot commit refused".**
   *
   * The repair chose *refused*, which is option (a) and the one the relay
   * preferred, because it also stops a late picture landing under a settled
   * press. In the real statement the refusal is the press row not being
   * `running`; here the commit seam answers `null`, which is what that
   * statement returns and what `renderViewAttempts` maps to `fenced`.
   *
   * ⚠ **THE MONEY IS THE ASSERTION, not the status.** The failure this closes
   * is *the customer keeps the new views AND the 3,250*: the sweep refunds the
   * press because nothing had committed yet, and the slots then commit anyway.
   * So what must be true is that this process adds no second refund of its own
   * — the press's settlement is the sweep's — and that the fenced slot is
   * never reported as delivered.
   */
  it("adds no refund of its own when the press has been settled under it", async () => {
    const angle = CAST_PACKAGE_VIEWS[1]!;
    commitBehaviour = { [angle]: "null" };

    const result = await redoCastPackage(dependencies(), input);

    /* Four landed, so by his rule the press keeps its charge and this process
       refunds nothing — the swept slot's money was never this slot's. */
    expect(result.committed).not.toContain(angle);
    expect(result.failed).toContain(angle);
    expect(result.refundedCredits).toBe(0);
    expect(refunds).toEqual([]);
    /* The lease goes to the sweep rather than being sealed here. */
    expect(handedOff).toContain(derivedClientRequestId(PRESS, angle));
  });

  /**
   * ⚠ **A COMMIT THAT WAS LOST LANDS ONE ASSET, NEVER TWO — the relay's
   * interaction arm for #2039's retrying sheet road.**
   *
   * Its words: *"#2039's sheet road keeps retrying after an arrival-time
   * throw, which for the redo can be the commit itself, so add an arm that a
   * retried commit cannot land a second asset for one slot."*
   *
   * Read at the code, the redo runs on the sheet road, where `paidFrameInHand`
   * is `false` (the frame is the coordinator's settled panel, so re-storing it
   * costs no engine call) — so #1994's terminal break does NOT apply and a
   * thrown commit IS re-attempted. The protection is the transaction: a commit
   * that throws rolls back, so its row never existed and the next attempt
   * inserts the first and only one.
   *
   * ⚠ **AND THE HONEST REMAINDER, because this arm cannot reach it:** if the
   * statement COMMITTED and the acknowledgement was lost in transit, the row
   * exists and the retry inserts a second. The customer sees one picture —
   * `slotEvidence` takes the newest filled asset per angle — so the cost is a
   * duplicate row and one storage object nobody will ever show. Closing it
   * needs an idempotency key on the commit, which is a new control rather than
   * part of this repair, and it is filed instead of folded in.
   */
  it("lands exactly one asset for a slot whose commit was lost and retried", async () => {
    const angle = CAST_PACKAGE_VIEWS[2]!;
    commitBehaviour = { [angle]: "throw-once" };

    const result = await redoCastPackage(dependencies(), input);

    /* The slot was DELIVERED — the retry is the point, not the failure. */
    expect(result.committed).toContain(angle);
    expect(result.failed).not.toContain(angle);
    /* The commit was reached twice and landed ONCE. */
    expect(commitThrows[angle]).toBeGreaterThan(1);
    expect(committed.filter((row) => row.angle === angle)).toHaveLength(1);
    /* Every slot delivered, so nothing comes back under the flat price. */
    expect(result.refundedCredits).toBe(0);
    expect(refunds).toEqual([]);
  });

  it("⚠ a press whose every slot fenced refunds the whole price", async () => {
    /*
      THE CORNER WHERE THE TWO RULES MEET, and it is the one a crash actually
      produces: five fenced slots is zero delivered, so his rule refunds — even
      though not one of them reached the `failed` exit. The decision is made
      from what the press SAW, which is why it is counted once at the end
      rather than per slot.
    */
    commitBehaviour = Object.fromEntries(CAST_PACKAGE_VIEWS.map((angle) => [angle, "null"]));
    const result = await redoCastPackage(dependencies(), input);

    expect(result.committed).toEqual([]);
    expect(result.refundedCredits).toBe(PACKAGE_PRICE);
    expect(refunds).toHaveLength(1);
    expect(handedOff.sort()).toEqual(
      CAST_PACKAGE_VIEWS.map((angle) => derivedClientRequestId(PRESS, angle)).sort(),
    );
  });
});

describe("one view's trouble and the other four (review finding 2)", () => {
  /*
    THE DEFECT, STATED AS A SENTENCE: `redoOneView` re-throws when a view goes
    wrong past its own settlement — on purpose, so the lease reaches the sweep
    rather than this process sealing a receipt it cannot stand behind. Under
    `Promise.all` that single rejection rejected the WHOLE press, and the
    customer was told *"Those views couldn't be asked for again"* while the
    other four were sitting on the Cast, rendered and charged.
  */
  it("reports what actually landed instead of failing the whole press", async () => {
    const angle = "threeQuarter" as const;
    expect(CAST_PACKAGE_VIEWS).toContain(angle);
    receiptRefusals = new Set([derivedClientRequestId(PRESS, angle)]);

    /* THE ASSERTION THE BUG FAILS: it rejected, so there was no result. */
    const result = await redoCastPackage(dependencies(), input);

    expect(result.failed).toEqual([angle]);
    expect(result.committed.sort()).toEqual(
      CAST_PACKAGE_VIEWS.filter((candidate) => candidate !== angle).sort(),
    );
    /* ⚠ The picture DID land and was committed — only its receipt could not be
       written. The slot is reported failed because this process cannot say
       otherwise, and the sweep will find the asset and close it. */
    expect(committed.map((entry) => entry.angle).sort())
      .toEqual([...CAST_PACKAGE_VIEWS].sort());
    expect(result.chargedCredits).toBe(PACKAGE_PRICE);
    /* Four others arrived, so nothing is owed back — his rule, not the old
       slice arithmetic, decides this. */
    expect(result.refundedCredits).toBe(0);
  });

  it("still reports the rest when the trouble is on a full-length view", async () => {
    /*
      The full-length pair are cut from the BODY sheet and the other three from
      the head sheet, so a rejection on one arrives by a different schedule into
      the same `allSettled` — asserted because the two halves of that schedule
      are not one code path.
    */
    const angle = "frontFull" as const;
    expect(CAST_PACKAGE_VIEWS).toContain(angle);
    receiptRefusals = new Set([derivedClientRequestId(PRESS, angle)]);

    const result = await redoCastPackage(dependencies(), input);
    expect(result.failed).toEqual([angle]);
    expect(result.committed).toHaveLength(CAST_PACKAGE_VIEWS.length - 1);
    expect(result.refundedCredits).toBe(0);
  });

  it("a commit that throws costs the customer nothing extra and never reaches the sweep", async () => {
    /*
      A lost commit transaction is the reachable road (five concurrent
      `.for("update")` locks on one `models` row). It lands in the attempt
      loop's catch, is re-attempted, and settles through the `failed` exit.
      ⚠ Under the flat price that exit refunds NOTHING — four siblings arrived
      — where it used to hand back a slice. The customer keeps the picture they
      already had in that slot.
    */
    const angle = "closeUp" as const;
    commitBehaviour = { [angle]: "throw" };

    const result = await redoCastPackage(dependencies(), input);

    expect(result.failed).toEqual([angle]);
    expect(result.refundedCredits).toBe(0);
    expect(refunds).toEqual([]);
    /* It settled in this process, so nothing was handed to the sweep. */
    expect(handedOff).toEqual([]);
  });
});
