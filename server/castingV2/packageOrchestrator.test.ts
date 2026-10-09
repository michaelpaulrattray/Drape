import { join, resolve } from "node:path";

import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderError } from "../providers/types";
import { withRetry } from "../providers/providerQueue";
import type { RenderBudget } from "../providers/renderBudget";
/* The REAL composition the failed-slot row is stored with — #1492's seam arm
   below drives the writer's own function rather than a copy of it. */
import { slotFailureStatus } from "./slotFailureRecord";
import {
  CONFORMANCE_AXES,
  unjudgedVerdict,
  viewConformanceRefuses,
  type ViewConformanceVerdict,
} from "./viewConformance";
import { pronounsForSex } from "./castPronouns";
import { MAX_CLAUSE_CHARACTERS } from "./viewFeatureWords";

/*
  ⚠ THE LOGGER IS REPLACED FOR THIS FILE, and it is for exactly one arm.

  A dropped feature's only observable is the log — that IS the shape of the
  defect the drop-log fixes — so the arm at the bottom of this file needs a seam
  the process can see. An earlier draft captured `process.stdout.write` and
  caught NOTHING: pino does not write through that seam under vitest, and a
  green arm would have been the danger.

  Nothing else in this file asserts a log, so silencing them costs nothing.
*/
const loggedWarnings: unknown[][] = [];
vi.mock("../logging/logger", () => {
  const sink = (...args: unknown[]) => { loggedWarnings.push(args); };
  const shape = { info: () => {}, warn: sink, error: () => {}, debug: () => {} };
  return { logger: shape, createModuleLogger: () => shape };
});

/**
 * The package's six independently refundable units (plan §F, §H.4).
 *
 * Every case here is of the sharp form the billing law demands: exactly the
 * views that did not arrive were refunded, never one that did, never twice, and
 * never more than a slice. Plus the rules that are easy to lose in a refactor —
 * the TWO attempt budgets (#1208: a judged rejection keeps its single
 * regeneration; a view that never arrived is asked for again, spaced, up to the
 * arrival budget), and a commit that loses its fence refunds NOTHING here
 * because recovery owns it.
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
  renderViewAttempts,
  refusedViewReason,
  unsettledPackageAngles,
  VIEW_ARRIVAL_ATTEMPTS,
  VIEW_JUDGED_ATTEMPTS,
  VIEW_STORE_ATTEMPTS,
  VIEW_STORE_BACKOFF_MS,
} = await import("./packageOrchestrator");
const { CAST_PACKAGE_VIEWS } = await import("./castViewPackage");
const { CASTING_V2_SIGN_PRICE_CREDITS } = await import("../casting/castingCreditCosts");
const { refusedSheetViewRefund } = await import("../casting/flatPressCharge");
/**
 * THE PACKAGE'S MONEY, READ FROM THE PRODUCT — #1601 item 1, 2026-10-01.
 *
 * ⚠ **`50`, `200` AND `450` WERE LITERALS IN EVERY MONEY ARM HERE, AND THEY ALL
 * WENT RED ON TWO CONSTANT EDITS.** The arms are about WHICH reference a refund
 * lands under and whether anything comes back at all — true at any price — so
 * they read the price. The literals left in this file are prose narrating what
 * a ruling cost on the day it was made.
 *
 * ⚠ **AND THERE IS ONLY ONE NUMBER LEFT, WHICH IS THE WHOLE OF #1968.**
 * `VIEW_PRICE` (a view's refundable slice) and `PROMOTION` (the base) are gone
 * with the decomposition they named: his word of 2026-10-08 made the Sign one
 * flat charge with no per-view refund, so there is nothing for a per-slice
 * figure to assert about. An arm that still wanted one would be asserting the
 * old rule.
 */
const SIGN_PRICE = CASTING_V2_SIGN_PRICE_CREDITS;
import type { CastViewAngle } from "../../shared/boardTypes";
import {
  composeSignSheetPrompt,
  signSheetKindFor,
  signSheetPlan,
  type SignSheetKind,
} from "./signSheet";
import { SHEET_MAX_RENDERS } from "./signSheetCoordinator";
import { joinSentences, refundOutcomeText } from "../../shared/refundCopy";
import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";
import { readListedSource } from "../testing/listedSource";

/*
  ⚠ **THE TREE READER PUT THIS SUITE IN #741'S POPULATION, AND IT FOUND OUT AT
  THE GUARD RATHER THAN BY BEING REMEMBERED — which is the guard working.**

  One arm here reads `ViewTabs.tsx` off the real tree so that the refusal line's
  join is DERIVED rather than quoted, and `sourceSweepSuites` keys on reaching
  for the tree reader at all rather than on how many files a suite then reads.
  That is deliberate on its part — a population keyed on the files already fixed
  stops watching the moment one is fixed — so the floor is declared here rather
  than argued about on the ground that this suite reads exactly one file.
*/
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const pass: ViewConformanceVerdict = {
  pass: true,
  method: "judge:test",
  axes: {
    identity: { pass: true, note: "same person" },
    intact: { pass: true, note: "a clean render" },
    people: { pass: true, note: "one person" },
  },
};
const fail: ViewConformanceVerdict = {
  pass: false,
  method: "judge:test",
  axes: {
    identity: { pass: false, note: "different bone structure" },
    intact: { pass: true, note: "" },
    people: { pass: true, note: "" },
  },
};

const refunds: Array<{ amount: number; reference: string }> = [];
const committed: string[] = [];
/**
 * WHICH FRAME EACH DELIVERED VIEW CAME FROM — the asset row's own provenance.
 *
 * ⚠ **Added for #1904, because his ruling's load-bearing clause is
 * unassertable without it**: *"replace all of that sheet's views together, so
 * the views on a sheet always come from one render"*. Every other signal in
 * this suite — the commit count, the refund count, the engine count — is
 * identical whether a re-rendered sheet replaces all of its views or only the
 * refused one. The `providerRef` the sheet stamps on its panels is the one
 * field that can tell those two apart, and the product persists it.
 */
const committedProvenance: Array<{ angle: string; providerRef?: string }> = [];
const failures: Array<Record<string, unknown>> = [];
const storedKeys: string[] = [];
const deletedKeys: string[] = [];
/** Every refused frame this loop handed to the keeper (#1492). */
const captured: Array<{
  userId: number;
  operationId: string;
  reason: string;
  names: string[];
  bytes: string[];
}> = [];
/**
 * Every wait the orchestrator ASKED for between arrival retries, in order.
 *
 * Recorded rather than performed: a suite that actually slept would pay 5.5s
 * per failing view, and an arm that only counted attempts could not tell
 * "spaced" from "hammered" — which is the half of #1208 a customer feels when
 * a provider is rate-limiting us.
 */
const waitedMs: number[] = [];
let refundRecords = true;

/**
 * THE SHEETS EVERY SIGN NOW RENDERS, as synthetic frames (#1904, reshaped to
 * his #1926 two-sheet ruling).
 *
 * ⚠ **REAL IMAGES, not `Buffer.from("view")` stand-ins, and they have to be**:
 * the orchestrator cuts the bytes it is handed with `sharp`, so a sheet that is
 * not an image fails the cut and every arm below would read as a dead Sign.
 * Panels of DIFFERENT widths with white dividers between them, so the cut
 * exercises its detector rather than falling back to equal shares.
 *
 * ⚠ **ONE PER KIND, keyed by the panel count the plan asks for.** A single
 * synthetic sheet would be cut into three panels for the head sheet and two for
 * the body sheet from the same bytes — which passes, and proves nothing about
 * whether each view was routed to its own sheet.
 */
async function syntheticSheetBytes(panels: number): Promise<Buffer> {
  const width = 100 * panels + 20 * (panels - 1);
  const height = 40;
  /* Deliberately unequal, so a fallback to equal shares is visible. */
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

/**
 * HER MASTER, AS A REAL IMAGE — and it has to be one now (#1904).
 *
 * ⚠ **This was `Buffer.from("anchor")` and the sheet road made that fatal.**
 * `renderSignSheet` converts the anchor to JPEG with `sharp` before dispatch
 * (`sheetReferenceFromMaster`, for the measured 13.8% size saving), so a
 * stand-in that is not an image rejects the sheet promise with *"Input buffer
 * contains unsupported image format"* — which reaches every view as a sheet
 * that never arrived, and reads in this suite as a dead Sign rather than as a
 * broken fixture. The per-view road never cared, because it passed the bytes
 * through untouched.
 */
const ANCHOR_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * The default sheet engines — TWO calls per Sign, one per sheet, each recorded
 * with the kind it was asked for so an arm can count and attribute them.
 *
 * ⚠ **The count and the KIND are both the point.** Five views used to mean five
 * engine calls and now mean two, and an arm that could not see the difference
 * would pass just as happily if every view quietly rendered its own sheet. The
 * kind matters for the same reason the engine takes a size at all: the two
 * sheets differ only in their pixels, so a double that ignored the argument
 * would let every arm pass while both rendered at one shape.
 */
const sheetCalls: {
  kind: SignSheetKind;
  prompt: string;
  /**
   * ⚠ **THE REFERENCES THEMSELVES, NOT A COUNT — widened for #1904.** The ink
   * crops and the master now ride the SHEET rather than five view requests, so
   * the ordinal arms (*"the sentence quoting reference N and the picture in slot
   * N come from one list"*) have nowhere else to be driven. A count cannot hold
   * that rule; it cannot even tell the master from a crop.
   */
  references: Array<{ bytes: string; contentType: string }>;
}[] = [];

function defaultSheetEngine(kind: SignSheetKind) {
  return {
    id: `test-sheet-${kind}`,
    editWithReferences: vi.fn(async (request: { prompt: string; references: unknown[] }) => {
      sheetCalls.push({
        kind,
        prompt: request.prompt,
        references: (request.references as Array<{ bytes: Buffer; contentType: string }>).map(
          (reference) => ({ bytes: reference.bytes.toString(), contentType: reference.contentType }),
        ),
      });
      /*
        ⚠ **THE REF NAMES THE GENERATION — #1904, his option A.** The provenance
        travels from the sheet onto every asset row it painted, so a ref that
        counted only the kind could not tell a first frame's panel from a
        re-rendered one. His *"replace all of that sheet's views together"* is a
        claim about exactly that, and this is what makes it assertable.
      */
      const generation = sheetCalls.filter((call) => call.kind === kind).length;
      return {
        bytes: sheetPngs.get(kind) as Buffer,
        contentType: "image/png",
        latencyMs: 61_000,
        provenance: {
          provider: "fal" as const,
          model: `sunburst-sheet-${kind}`,
          providerRef: `sheet-ref-${kind}-gen${generation}`,
        },
      };
    }),
    generateView: vi.fn(),
  };
}

/**
 * A SHEET ENGINE THAT NEVER DELIVERS — the dead-sheet road, both kinds.
 *
 * ⚠ **It records its call in `sheetCalls` BEFORE throwing**, which is the only
 * thing that lets an arm COUNT renders rather than infer them. The claim the
 * dead-sheet arms are about is that the views awaiting one sheet do not buy one
 * render each: the orchestrator's own docblock says *"a settled rejection
 * re-throws instantly, so a dead sheet costs the arrival budget's waiting and
 * never a second call"*, and until these arms moved to this double nothing
 * anywhere held it.
 */
function deadSheetEngine(makeError: () => unknown) {
  return (kind: SignSheetKind) => ({
    id: `test-sheet-${kind}`,
    editWithReferences: vi.fn(async (request: { prompt: string; references: unknown[] }) => {
      sheetCalls.push({
        kind,
        prompt: request.prompt,
        references: (request.references as Array<{ bytes: Buffer; contentType: string }>).map(
          (reference) => ({ bytes: reference.bytes.toString(), contentType: reference.contentType }),
        ),
      });
      throw makeError();
    }),
    generateView: vi.fn(),
  });
}

/** How many times each sheet kind was asked for — the render budget, counted. */
function rendersPerSheet(): Record<SignSheetKind, number> {
  return Object.fromEntries(
    signSheetPlan().map((plan) => [
      plan.kind,
      sheetCalls.filter((call) => call.kind === plan.kind).length,
    ]),
  ) as Record<SignSheetKind, number>;
}

function deps(overrides: Record<string, unknown> = {}) {
  return {
    signSheetEngine: defaultSheetEngine,
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
      committedProvenance.push({
        angle: input.angle as string,
        providerRef: (input.provenance as { providerRef?: string } | undefined)?.providerRef,
      });
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
    wait: vi.fn(async (ms: number) => { waitedMs.push(ms); }),
    capture: vi.fn(async (input: {
      userId: number;
      operationId: string;
      reason: string;
      frames: ReadonlyArray<{ name: string; bytes: Buffer }>;
    }) => {
      captured.push({
        userId: input.userId,
        operationId: input.operationId,
        reason: input.reason,
        names: input.frames.map((frame) => frame.name),
        bytes: input.frames.map((frame) => frame.bytes.toString()),
      });
      return { captured: true, keys: input.frames.map((frame) => frame.name) };
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
  anchor: { bytes: ANCHOR_PNG, contentType: "image/png" },
  /*
    What this Sign was charged — read from the live constant rather than typed,
    so his next price word moves every money arm in this suite with it (#1968).
    The orchestrator refunds THIS figure on a total loss and nothing else.
  */
  chargedCredits: CASTING_V2_SIGN_PRICE_CREDITS,
};

beforeAll(async () => {
  /* Derived from the plan, never a literal pair: a third sheet kind gets its
     synthetic frame without this block being remembered. */
  for (const plan of signSheetPlan()) {
    sheetPngs.set(plan.kind, await syntheticSheetBytes(plan.panelOrder.length));
  }
});

beforeEach(() => {
  sheetCalls.length = 0;
  refunds.length = 0;
  committed.length = 0;
  committedProvenance.length = 0;
  failures.length = 0;
  storedKeys.length = 0;
  deletedKeys.length = 0;
  captured.length = 0;
  waitedMs.length = 0;
  generations.length = 0;
  refundRecords = true;
  vi.clearAllMocks();
});

/**
 * ⚠ THE CAST'S OUTFIT REACHES BOTH THE ENGINE AND THE JUDGE (design §3.3,
 * item 6) — asserted on the outgoing request and on the judge's own argument,
 * never on a constant near them (invariant 5).
 *
 * The failure this closes costs money rather than looks: a judge told a
 * different outfit than the prompt asked for fails a view for obeying its
 * instructions, and a failed slot is a refunded slice.
 */
describe("the Cast's wardrobe line, at the wire", () => {
  const LINE = "dark canvas work jacket, straight jeans, plain boots";

  /*
    ⚠ FOUR OF THE FIVE, NOT ALL FIVE. The `closeUp` slot carries its own
    wardrobe sentence — written about the REFERENCE rather than about a spec, so
    it is correct on every path — and asserting the line on it would be
    asserting a substitution the design deliberately does not make. Found by
    driving it: the first version of these arms failed on the close-up's prompt.
  */
  function recording() {
    const prompts: { angle: string; prompt: string }[] = [];
    const judged: unknown[] = [];
    return {
      prompts,
      judged,
      identityEngine: () => ({
        id: "test-identity",
        editWithReferences: vi.fn(),
        generateView: vi.fn(async (request: { prompt: string; viewAngle: string }) => {
          prompts.push({ angle: request.viewAngle, prompt: request.prompt });
          return {
            bytes: Buffer.from("view"),
            contentType: "image/png",
            latencyMs: 1,
            provenance: { provider: "fal" as const, model: "nbp", providerRef: "ref" },
          };
        }),
      }),
      judge: () => vi.fn(async (judgeInput: unknown) => {
        judged.push(judgeInput);
        return pass;
      }),
    };
  }

  it("carries the line into BOTH sheet prompts, and into NO judge call (#1903)", async () => {
    const seen = recording();
    await buildCastPackage(
      deps({ identityEngine: seen.identityEngine, judge: seen.judge }),
      { ...input, wardrobeLine: LINE },
    );
    /*
      ⚠ **NO VIEW COMPOSES A PROMPT ANY MORE — #1904, and the arm moved to the
      wire the outfit is actually sent on.** The five pictures are panels of two
      sheets, so the line is said TWICE (once per sheet) instead of five times
      and `generateView` is never reached. The claim is unchanged and is the one
      that costs money: the outfit the Cast's record carries is what the engine
      is told. The empty expectation beside it is the control — an assertion
      about sheet prompts that passed while views were still rendering their own
      would prove nothing about the split.
    */
    expect(seen.prompts, "no view renders its own picture on the sheet road").toEqual([]);
    expect(sheetCalls).toHaveLength(2);
    for (const call of sheetCalls) expect(call.prompt, call.kind).toContain(LINE);
    /* Five judgements still — one per panel, across the two sheets. */
    expect(seen.judged).toHaveLength(5);
    /*
      ⚠ **THE JUDGE IS HANDED NO OUTFIT AT ALL — #1903, and this arm asserted
      the opposite until his ruling.**

      It read `wardrobeLine).toBe(LINE)` on every judged call, because the
      judge's wardrobe axis had to be told the same outfit the prompt was
      composed from — a judge told a different one fails a view for obeying its
      instructions, and a refused slice is a refunded slice.

      There is no wardrobe axis now, so the field is gone from the judge's input
      entirely and the absence is what is held. It is an arm at the WIRE and not
      at a type, because a type can be widened back without anyone noticing.
    */
    for (const call of seen.judged) {
      expect((call as { wardrobeLine?: unknown }).wardrobeLine).toBeUndefined();
      expect((call as { description?: unknown }).description).toBeUndefined();
    }
  });

  it("⚠ CONTROL — with no line the wire carries the SHARED sentence, not the line's", async () => {
    /*
      Every Cast signed to date — and, measured at production on 2026-09-25,
      that is 5 of 5: no Cast has ever carried a stored line, so this arm is the
      only one of the pair that describes a real package.

      ⚠ **It asserted `"the SAME plain unbranded crew-neck top"` until #1207**,
      because that is what the shared sentence said. The claim here is about
      WHICH sentence reaches the wire, never about the garment it named, so the
      arm stands and its literal moves: the sentence now defers to the reference
      instead of naming a top his customer never asked for.
    */
    const seen = recording();
    await buildCastPackage(deps({ identityEngine: seen.identityEngine, judge: seen.judge }), input);
    /*
      ⚠ **THIS ARM WENT VACUOUS WHEN THE SHEET ROAD LANDED AND IT PASSED ANYWAY
      — #1904.** It looped over `seen.prompts`, which is now empty on every
      Sign, so a `for` over nothing asserted nothing and the file stayed green.
      The sentence it is about moved to the sheet, so the loop did too, and the
      length assertion below is what stops the same thing happening again.
    */
    expect(sheetCalls, "two sheets, so two outfit sentences to check").toHaveLength(2);
    for (const call of sheetCalls) {
      expect(call.prompt, call.kind).not.toContain(LINE);
      /* The sheet's own wording for a Cast with neither a stored line nor a
         brief: it names reference 1 and invents no adjective. */
      expect(call.prompt, call.kind).toContain("OUTFIT is the one reference 1 shows");
    }
    /* And with no line either, the judge is still told nothing — the same
       absence, so the arm above is not passing on the fixture's emptiness. */
    expect(seen.judged).toHaveLength(5);
    for (const call of seen.judged) {
      expect((call as { wardrobeLine?: unknown }).wardrobeLine).toBeUndefined();
    }
  });
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
  /**
   * ⚠ **THE RE-RENDER IS THE SHEET'S NOW, AND IT REPLACES ALL OF THAT SHEET'S
   * VIEWS — his #1904 ruling of 2026-10-08, verbatim and entire: *"go with A"*.**
   *
   * This arm read *"keeps a view that passes on the second attempt"* and drove
   * a judge that failed its FIRST call, whichever panel that happened to be.
   * Two things make that the wrong shape now, and the second is why it had to
   * be rewritten rather than retargeted:
   *
   * 1. **The two sheets judge concurrently**, so "the first call" is a
   *    scheduling fact rather than a statement about a view — the arm would
   *    have been a clock in disguise.
   * 2. **A re-render replaces every view on its sheet.** So the thing to hold
   *    is not that one view came back good; it is that BOTH body views came
   *    from the SECOND body frame while the head sheet was never touched —
   *    which is his consistency clause, and the only assertion here that a
   *    per-view latch would fail.
   */
  it("re-renders the refused view's SHEET once and replaces all of its views together", async () => {
    const seen = new Map<string, number>();
    const judge = () => vi.fn(async (request: { angle: string }) => {
      const nth = (seen.get(request.angle) ?? 0) + 1;
      seen.set(request.angle, nth);
      /* One panel, on its first judgement only — so the body sheet is re-rendered
         exactly once and comes back clean. */
      return request.angle === "backFull" && nth === 1 ? fail : pass;
    });
    const result = await buildCastPackage(deps({ judge }), input);

    expect(result.failed).toHaveLength(0);
    expect(refunds).toHaveLength(0);
    expect(committed).toHaveLength(5);
    /* ONE re-render, and only of the sheet that held the refusal. */
    expect(rendersPerSheet()).toEqual({ body: 2, head: 1 });
    /*
      ⚠ **THE CLAUSE THAT NEEDS THE PROVENANCE: both body views come from the
      SECOND frame, including `frontFull`, which PASSED on the first one.**
      Delivering `frontFull` from frame 1 beside `backFull` from frame 2 would
      satisfy every other expectation in this arm and would be exactly the
      inconsistency his ruling forbids — two views of one person in two
      different outfits.
    */
    const refOf = (angle: string) =>
      committedProvenance.find((entry) => entry.angle === angle)?.providerRef;
    expect(refOf("frontFull")).toBe("sheet-ref-body-gen2");
    expect(refOf("backFull")).toBe("sheet-ref-body-gen2");
    /* And the head sheet's three are untouched by a body refusal. */
    for (const angle of ["closeUp", "threeQuarter", "sideClose"]) {
      expect(refOf(angle), angle).toBe("sheet-ref-head-gen1");
    }
    /*
      ⚠ **NOTHING IS ORPHANED AND NOTHING IS DELETED, which is a CHANGE and is
      the better direction.** The per-view road stored a picture and then
      dropped it when the judge turned it down; a sheet panel is judged before
      it is ever stored, so a refused frame costs no bucket write at all. The
      old assertion here was `deletedKeys.length > 0`, and it would now pass
      only if something were storing refused panels.
    */
    expect(deletedKeys).toEqual([]);
    expect(storedKeys).toHaveLength(5);
  });

  /*
    ⚠ **THIS ARM READ *"fails and refunds exactly one slice"* UNTIL #1968, AND
    THE INVERSION IS THE CARD.** His word of 2026-10-08: views are cut from two
    sheets and *"can't be refunded one by one... Credits only come back if the
    Sign can't be delivered at all."* So a refused view now refunds NOTHING
    and the four that landed are still delivered.

    It asserts on `refunds` being EMPTY rather than on the absence of one
    amount, because a reader keyed on a figure goes quietly inert the day the
    figure changes — and the whole of this card is a figure changing.
  */
  it("refunds NOTHING for a view refused twice, and still delivers the rest", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "backFull" ? fail : pass);
    const result = await buildCastPackage(deps({ judge }), input);

    expect(result.failed).toEqual(["backFull"]);
    expect(refunds, "no slice comes back for a refused view (#1968)").toEqual([]);
    expect(result.refundedCredits).toBe(0);
    // Four landed. A failed view never blocks the others.
    expect(committed).toHaveLength(4);
  });

  it("persists the per-axis verdict on the failed slot, so a dispute is answerable", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "sideClose" ? fail : pass);
    await buildCastPackage(deps({ judge }), input);

    const marker = failures.find((entry) => entry.angle === "sideClose");
    const failure = marker?.failure as { conformance?: { axes: Record<string, { pass: boolean }> } };
    expect(failure.conformance?.axes.identity.pass).toBe(false);
    expect(failure.conformance?.axes.intact.pass).toBe(true);
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
        ? { ...fail, axes: { ...fail.axes, intact: { pass: false, verdict: "differs", note: "first draw" } } }
        : fail;
    });
    await buildCastPackage(deps({ judge }), input);

    const marker = failures.find((entry) => entry.angle === "sideClose");
    const failure = marker?.failure as {
      conformance?: { axes: Record<string, { pass: boolean }> };
      earlierAttempts?: Array<{ axes: Record<string, { pass: boolean }> }>;
    };

    // The final verdict stays exactly where the room already reads it.
    expect(failure.conformance?.axes.intact.pass).toBe(true);
    // And the draw nobody heard about is beside it.
    expect(failure.earlierAttempts).toHaveLength(1);
    expect(failure.earlierAttempts?.[0].axes.intact.pass).toBe(false);
  });

  /*
    ⚠ AND IT REACHES A ROW — #1492, AND FOR THIRTEEN MONTHS IT DID NOT.

    The arm above asserts against the INJECTED `recordFailure`, so it proves the
    composer and stops at the seam. On the other side of that seam the real
    writer re-listed the fields it inserts — `reason`, `refunded`,
    `refundReference`, and a conditional spread for `conformance` — knew nothing
    of `earlierAttempts`, and dropped it. D-114's promise, *"a slot that failed
    twice now says so, and says what the first draw was rejected for"*, was true
    of this file and false of the database, and nothing anywhere went red.

    So this arm takes the record the orchestrator ACTUALLY composed above and
    runs it through the REAL composition the writer stores. A field added to one
    side and missed on the other cannot survive it, which is the only property
    worth having here.
  */
  it("stores the earlier attempt, not merely composes it", async () => {
    let call = 0;
    const judge = () => vi.fn(async (request: { angle: string }) => {
      if (request.angle !== "sideClose") return pass;
      call += 1;
      return call === 1
        ? { ...fail, axes: { ...fail.axes, intact: { pass: false, verdict: "differs", note: "first draw" } } }
        : fail;
    });
    await buildCastPackage(deps({ judge }), input);

    const marker = failures.find((entry) => entry.angle === "sideClose");
    const stored = slotFailureStatus(
      marker!.failure as Parameters<typeof slotFailureStatus>[0],
      "2026-09-30T00:00:00.000Z",
    ) as {
      state: string;
      reason: string;
      refunded: number;
      refundReference?: string;
      conformance?: { axes: Record<string, { pass: boolean }> };
      earlierAttempts?: Array<{ axes: Record<string, { pass: boolean }> }>;
      at: string;
    };

    /* The row the room already reads keeps its shape; since #1968 its money
       line is zero and it quotes no reference, because nothing was owed. */
    expect(stored.state).toBe("failed");
    expect(stored.refunded).toBe(0);
    expect(stored.refundReference, "no refund was attempted, so there is nothing to quote")
      .toBeUndefined();
    expect(stored.conformance?.axes.intact.pass).toBe(true);
    expect(stored.at).toBe("2026-09-30T00:00:00.000Z");
    /* And the draw nobody heard about is IN THE ROW. */
    expect(stored.earlierAttempts).toHaveLength(1);
    expect(stored.earlierAttempts?.[0].axes.intact.pass).toBe(false);
  });

  it("stores no empty key for a verdict that does not exist", () => {
    /* Derivation must not turn "there was no judged attempt" into a field
       carrying nothing — the old conditional spreads existed for this reason
       and the derived version has to keep it. */
    const stored = slotFailureStatus(
      /* A REFUNDED fixture on purpose: this arm is about `slotFailureStatus`
         dropping absent keys, and the refresh/mint road still refunds per slot,
         so a record carrying money is still a legal one to derive from. */
      { reason: "The view could not be generated", refunded: 1000, refundReference: "ref" },
      "2026-09-30T00:00:00.000Z",
    );
    expect(Object.keys(stored).sort())
      .toEqual(["at", "reason", "refundReference", "refunded", "state"]);
  });

  it("leaves no orphaned object behind a failed view — by never storing one", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "backFull" ? fail : pass);
    await buildCastPackage(deps({ judge }), input);
    /*
      ⚠ **THIS ARM READ `deletedKeys).toHaveLength(2)` AND THE SHEET ROAD MAKES
      THE RIGHT ANSWER ZERO — #1904.** The per-view road stored every picture
      before judging it, so a refusal had an object to drop and the only
      question was whether it remembered to. A sheet's panel is judged in the
      coordinator, above the views, so a refused panel never reaches storage:
      there is nothing to orphan rather than something that was cleaned up.
      The pair below is what makes that a measurement and not a weakening — the
      four delivered views DID store, so a road storing nothing at all would
      redden here.
    */
    expect(deletedKeys).toEqual([]);
    expect(storedKeys).toHaveLength(4);
  });
});

/*
  THE PICTURE THE JUDGE TURNED DOWN IS KEPT — #1492, his own Jingu.

  He retried two views several times, every attempt refused on `angle`, and the
  record could say "angle" and nothing else: the frame is deleted one line after
  the verdict and the judge's note never leaves the process. So there was
  nothing for his eye to overrule (law 9) and nothing for a court to read.

  ⚠ These arms were on `renderViewAttempts`'s refusal branch rather than on
  either road, because ONE call site serves both the Sign's five views and a Try
  again — and the retry is the half he was actually stuck in. ⚠ **THE SIGN'S
  HALF MOVED TO `signSheetCoordinator` WITH #1904** — it is where the panels are
  judged now, so it is where a refused one is held — and the Try again still
  takes the per-view branch unchanged (`viewRetryService.test.ts` is its
  control). The claim is the same on both roads and so is the hazard: the KEY
  must distinguish the frames, or a capture that keeps one of two is worse than
  none because it looks like evidence.
*/
describe("a refused view keeps its frame", () => {
  it("hands the refused frame to the keeper before deleting the object", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "backFull" ? fail : pass);
    await buildCastPackage(deps({ judge }), input);

    /* Two renders of the body sheet, so two refused frames of backFull — and
       the PAIR is the point: it is what shows whether the engine drew the same
       wrong thing twice, which is exactly the question his three retries could
       not answer. */
    expect(captured).toHaveLength(2);
    expect(captured.every((entry) => entry.userId === 1)).toBe(true);
    expect(captured.every((entry) => entry.operationId === OPERATION_ID)).toBe(true);
    /* One frame per call: only the refused panel is kept, never the sheet's
       passing neighbours. */
    expect(captured.map((entry) => entry.names.length)).toEqual([1, 1]);
  });

  it("names the angle AND the sheet generation, so the second never overwrites the first", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "backFull" ? fail : pass);
    await buildCastPackage(deps({ judge }), input);

    /*
      ⚠ `diagnosticKey` is `…/<userId>/<operationId>/<name>.png`, and ONE Sign
      renders five angles under ONE operation id. ⚠ **The second segment used to
      be the view's ATTEMPT and is the SHEET's GENERATION now (#1904)**, because
      that is what actually distinguishes the two frames on this road: a panel
      gets one judgement per render, and the two renders are the sheet's.
    */
    expect(captured.flatMap((entry) => entry.names))
      .toEqual(["view-backFull-sheet1", "view-backFull-sheet2"]);
  });

  it("says which axes refused it, and which view, so the frame is not an unlabelled picture", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "closeUp" ? fail : pass);
    await buildCastPackage(deps({ judge }), input);

    /*
      `fail`'s own shape: identity refuses, the other two pass. ⚠ **The ANGLE is
      in the reason now as well as in the frame name**, because one capture call
      can carry several refused panels of one sheet — a reason naming only the
      axes could not say which of three head views it was about.
    */
    expect(captured[0]!.reason).toBe("sheet_view_refused:closeUp:identity");
  });

  it("keeps NOTHING when every view passes", async () => {
    await buildCastPackage(deps(), input);
    expect(captured, "a clean Sign writes no diagnostics").toEqual([]);
  });

  it("keeps nothing for a view that never ARRIVED — there is no frame to keep", async () => {
    /*
      The budgets are two roads (#1208): an arrival failure has no picture at
      all, so there is nothing to capture and no refusal to diagnose. Asserted
      so a later widening to the arrival road is a deliberate act rather than a
      side effect.
    */
    const identityEngine = () => ({
      id: "test-identity",
      editWithReferences: vi.fn(),
      generateView: vi.fn(async () => { throw new ProviderError("render_fault", "gone"); }),
    });
    await buildCastPackage(deps({ identityEngine }), input);
    expect(captured).toEqual([]);
  });

  it("cannot break the Sign when the keeper throws", async () => {
    /*
      It runs at the moment a customer is being refused and refunded. A capture
      failure that became a different error would make the diagnostics worse
      than useless — and the production capture never throws, so this arm is
      about THIS call site rather than about that promise.
    */
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "backFull" ? fail : pass);
    const capture = vi.fn(async () => { throw new Error("private bucket on fire"); });
    const result = await buildCastPackage(deps({ judge, capture }), input);

    expect(result.failed).toEqual(["backFull"]);
    /* The refusal still stood and the other four still landed. No money moves
       for a refused view since #1968, so the arm reads the DELIVERY rather than
       the refund it used to read. */
    expect(refunds).toEqual([]);
    expect(committed).toHaveLength(4);
    /*
      ⚠ AND THE ROAD IS UNCHANGED, WHICH IS THE ARM THAT MATTERS AND THE ONE
      THIS SUITE ALMOST DID NOT HAVE.

      On the per-view road the capture sat inside the attempt loop's `try`, so a
      keeper that threw was caught as an ARRIVAL failure — wrong budget, skipped
      `drop`, orphaned object. ⚠ **On the sheet road the stake is HIGHER and
      that is why the `.catch()` moved with the capture**: the keeper runs
      between the first judgement and the decision to spend house money on a
      second frame, so a keeper that threw would abort the whole SHEET — two or
      three paid slices refunded because a diagnostic bucket was full. These
      numbers are what prove the catch is there.
    */
    expect(rendersPerSheet(), "the re-render still happened, keeper or no keeper")
      .toEqual({ body: SHEET_MAX_RENDERS, head: 1 });
    expect(failures.find((entry) => entry.angle === "backFull")).toBeDefined();
  });
});

/*
  ⚠ THE BUDGETS ARE PINNED AT THE NUMBERS HIS RULINGS NAME, NOT AT THEIR OWN
  CONSTANTS — found by sabotage, on this card, one case MISSED.

  Every other arm below expresses its expectation as `VIEW_ARRIVAL_ATTEMPTS`,
  which reads well and proves the loop honours its budget. It cannot prove the
  budget is the RIGHT one: dropping the constant from 3 to 2 moved the code and
  every assertion together and the suite stayed green — the constant compared to
  itself, which is the exact defect that let "repairs come with revisions"
  survive a green file for thirteen months, met again in the same commit that
  removed it.

  So these two arms carry the literals, and they are the only place a number
  appears twice on purpose. Changing a budget is a product decision — his "up to
  three times" and D-39/D-40's one regeneration — and it should cost a
  deliberate edit here, where the ruling is quoted beside it.
*/
describe("the attempt budgets are the ones that were ruled", () => {
  it("asks three times for a view that never arrived (#1208, his yes)", () => {
    expect(VIEW_ARRIVAL_ATTEMPTS).toBe(3);
  });

  it("renders a SHEET at most twice (#1904, his \"at most one automatic re-render per sheet\")", () => {
    /*
      ⚠ **ITS OWN LITERAL, BESIDE THE OTHER TWO AND FOR THE SAME REASON.** This
      number and `VIEW_JUDGED_ATTEMPTS` are both 2 and they answer different
      questions about different money — one is how many draws a CUSTOMER's paid
      slice gets, the other is how many frames the HOUSE pays for to rescue a
      sheet. An arm reading `SHEET_MAX_RENDERS` against itself would let his
      ruling move silently; this is where moving it costs a deliberate edit.
    */
    expect(SHEET_MAX_RENDERS).toBe(2);
  });

  it("keeps ONE regeneration after a judged rejection (D-39/D-40, untouched)", () => {
    expect(VIEW_JUDGED_ATTEMPTS).toBe(2);
  });
});

/*
  ⚠ **THE PICTURE COMES FROM A SHEET NOW, SO THESE ARMS DRIVE THE SHEET ENGINE
  — #1904.** They drove `generateView`, which a Sign no longer calls at all, so
  every one of them was measuring a road this package does not take. What they
  are ABOUT is unchanged and is still the whole of #1208/#1212/#1301: which
  provider faults are worth asking again about, how long a customer waits, and
  whether her money comes back either way.

  ⚠ **AND THE ARRIVAL BUDGET IS THE SHEET'S NOW — #1966, his *"2) go with your
  recc"* of 2026-10-08.** These arms used to read *"a dead sheet costs ONE
  render, and five views spend their budget waiting on it"*, and that was the
  defect: a transport fault lost two or three views at once where the same fault
  on a single view would have been re-asked twice more. The SHEET is what can be
  re-asked, so it asks `VIEW_ARRIVAL_ATTEMPTS` times, spaced — and a settled
  sheet rejection is terminal in the per-view loop (`SignSheetUnavailableError`),
  because repeating it there would spend one budget twice and put ~5 s of silence
  in front of a refund.

  **So the two readings that moved are the frame count and the wait count, and
  they moved in opposite directions**: frames per dead sheet 1 → 3, waits
  10 (5 views × 2) → 4 (2 sheets × 2). Nobody waits who cannot change the answer.
*/
describe("generation failures", () => {
  it("asks for a refused sheet ONCE more at our cost, then refunds — never a third time", async () => {
    /*
      ⚠ **THIS ARM READ *"does not retry a content refusal — it will refuse
      again"* UNTIL #2127**, and cast 71 disproved its premise: the provider's
      checker refused that face sheet AFTER drawing it, and the same request,
      sent again unchanged, was delivered. His word of 2026-10-09 accepted the
      free retry; what this arm still pins is that it is ONE retry, unspaced.
    */
    const result = await buildCastPackage(
      deps({ signSheetEngine: deadSheetEngine(() => new ProviderError("content_policy", "refused")) }),
      input,
    );

    expect(rendersPerSheet()).toEqual({ body: 2, head: 2 });
    expect(waitedMs, "the free retry waits for nothing").toEqual([]);
    expect(result.failed).toHaveLength(5);
    // Nothing landed: the whole Sign comes back — shares and remainder together.
    expect(result.refundedCredits).toBe(SIGN_PRICE);
  });

  /*
    #1208, his "yes": something that NEVER ARRIVED is our failure to deliver
    something already paid for, so it is asked for again — three times, spaced
    — before it is written off.

    ⚠ **THE SHEET IS WHAT GETS ASKED AGAIN, AND UNTIL #1966 NOTHING DID.** This
    arm used to assert `{ body: 1, head: 1 }` and five views' worth of waiting:
    one request per sheet, and the per-view budget spent on an already-settled
    rejection that re-throws instantly.

    ⚠ **AND ITS FIXTURE WAS A PLAIN `Error`, WHICH PINNED A DEFECT (the relay's
    finding on PR #1982).** The old body threw `new Error("something odd")` and
    asserted three renders, on the reasoning that an unmapped fault is `unknown`
    to `mayStillArrive` and must not quietly cost a paid view its attempts. That
    is right on the per-view road and wrong here: this thunk is the whole of
    `renderSignSheet`, so a plain `Error` out of it means **the frame arrived
    and the CUT failed** — and each re-ask bought another ~$0.11 Sunburst sheet
    that failed the same way. A real non-arrival is a `ProviderError`, because
    `server/providers/falTransport.ts` maps every transport fault to one; the
    fixture now says what it means.
  */
  it("asks three times for a sheet that never arrived, and no view repeats it", async () => {
    await buildCastPackage(
      deps({
        signSheetEngine: deadSheetEngine(() => new ProviderError("transport", "fal.ai unreachable")),
      }),
      input,
    );
    expect(rendersPerSheet())
      .toEqual({ body: VIEW_ARRIVAL_ATTEMPTS, head: VIEW_ARRIVAL_ATTEMPTS });
    /* Two waits per SHEET, two sheets — and not one more from the five views,
       whose own budget a settled rejection no longer spends. */
    expect(waitedMs).toHaveLength(2 * (VIEW_ARRIVAL_ATTEMPTS - 1));
  });

  /*
    ⚠ **THE MONEY ARM (the relay's finding on PR #1982): A FRAME THAT ARRIVED
    AND COULD NOT BE CUT IS ASKED FOR ONCE.**

    Everything after the engine call — the decode, `findSheetPanelGeometry`, the
    panel cut, the provenance check — throws a plain `Error`
    (`signSheet.ts` 477, 511, 512, 578, 780, ~839), and every one of those is a
    picture that ARRIVED and was paid for. They are deterministic, so a re-ask
    buys another sheet and fails identically; at `ARRIVAL_ATTEMPTS` per sheet
    per generation that is up to four wasted Sunburst sheets on one Sign.

    This drives the REAL post-arrival road rather than faking it: the engine
    returns successfully with bytes `sharp` cannot decode, so the throw comes
    out of the product's own cut.
  */
  it("asks ONCE for a sheet that arrived and could not be cut", async () => {
    const arrivedUnusable = (kind: SignSheetKind) => ({
      id: `test-sheet-${kind}`,
      editWithReferences: vi.fn(async (request: { prompt: string; references: unknown[] }) => {
        sheetCalls.push({ kind, prompt: request.prompt, references: [] });
        /* It ARRIVED — the engine resolved, the money is spent — and it is
           not an image, so the cut throws a plain Error. */
        return {
          bytes: Buffer.from("this is not a png"),
          contentType: "image/png",
          latencyMs: 61_000,
          provenance: {
            provider: "fal" as const,
            model: `sunburst-sheet-${kind}`,
            providerRef: `sheet-ref-${kind}-gen1`,
          },
        };
      }),
      generateView: vi.fn(),
    });

    const result = await buildCastPackage(deps({ signSheetEngine: arrivedUnusable }), input);

    expect(
      rendersPerSheet(),
      "a frame that arrived must never be re-bought — it fails the same way every time",
    ).toEqual({ body: 1, head: 1 });
    expect(waitedMs, "nothing waits for a sheet that already arrived").toEqual([]);
    /* The customer is still made whole: nothing was delivered, so the whole
       Sign comes back exactly as it does for a terminal refusal. */
    expect(result.failed).toHaveLength(5);
    expect(result.refundedCredits).toBe(SIGN_PRICE);
  });

  /*
    ⚠ **THE SECOND MONEY ARM (the relay's second finding on PR #1982): A
    FRAME THE PROVIDER ALREADY FINISHED IS ASKED FOR ONCE, WHATEVER ITS CLASS.**

    The arm above covers a frame that arrived and threw a plain `Error` out of
    the cut. These cover the harder half: four of fal's faults are raised AFTER
    the job reports `COMPLETED`, so they are real `ProviderError`s with
    RETRYABLE classes — `"could not download fal.ai result"` is `transport`,
    `"fal.ai completed without an image"` and the malformed data URI are
    `unknown`, and a non-ok result fetch is whatever its status maps to. Every
    one of them had been bought and billed, and every one of them was re-asked.

    Worst case before this: 3 arrival attempts x 2 sheet renders = 6 frames per
    sheet where the budget intends 2, on top of the engine's own `withRetry`.

    ⚠ **ONE CASE PER ARM, NEVER A LOOP INSIDE ONE** — `beforeEach` fires
    between arms and not between iterations, which this suite has already been
    bitten by (the sentence arm at the foot of this file). The first case would
    record its refund and the second would read a deduped zero.
  */
  it.each([
    ["a result that would not download", () => new ProviderError(
      "transport", "could not download fal.ai result", { providerRef: "req-1", completed: true },
    )],
    ["a completed job with no image in it", () => new ProviderError(
      "unknown", "fal.ai completed without an image", { providerRef: "req-2", completed: true },
    )],
    ["a result fetch the provider rate-limited", () => new ProviderError(
      "rate_limit", "fal.ai result fetch failed (429): slow down",
      { providerRef: "req-3", status: 429, completed: true },
    )],
  ])("asks ONCE for a frame the provider finished: %s", async (_what, fault) => {
    const result = await buildCastPackage(
      deps({ signSheetEngine: deadSheetEngine(fault) }),
      input,
    );

    expect(
      rendersPerSheet(),
      "a frame that was already bought was re-bought — asking again renders a NEW one",
    ).toEqual({ body: 1, head: 1 });
    expect(waitedMs, "nothing waits for a frame that already arrived").toEqual([]);
    /* The customer is still made whole: nothing was delivered, so the whole
       Sign comes back exactly as it does for a terminal refusal. */
    expect(result.failed).toHaveLength(5);
    expect(result.refundedCredits).toBe(SIGN_PRICE);
  });

  /*
    THE CONTROL FOR THE THREE ARMS ABOVE (law 2). The SAME classes, with the
    provider never having finished, are still asked for three times — so those
    arms are reading the flag and not the class, and nothing retryable was
    quietly made terminal for every road.
  */
  it.each([
    ["an unreachable host", () => new ProviderError("transport", "fal.ai unreachable")],
    ["a submit with no request id", () => new ProviderError("unknown", "fal.ai returned no request id")],
    ["a refused submit", () => new ProviderError(
      "rate_limit", "fal.ai refused the request (429): slow down", { status: 429 },
    )],
  ])("still asks three times when the job never ran: %s", async (_what, fault) => {
    await buildCastPackage(deps({ signSheetEngine: deadSheetEngine(fault) }), input);

    expect(
      rendersPerSheet(),
      "a job that never ran stopped being re-asked — it is still owed its attempts",
    ).toEqual({ body: VIEW_ARRIVAL_ATTEMPTS, head: VIEW_ARRIVAL_ATTEMPTS });
    expect(waitedMs).toHaveLength(2 * (VIEW_ARRIVAL_ATTEMPTS - 1));
  });

  it("SPACES the arrival retries rather than hammering the provider", async () => {
    await buildCastPackage(
      deps({ signSheetEngine: deadSheetEngine(() => new ProviderError("timeout", "no answer")) }),
      input,
    );

    // One wait between attempts, never after the last: two per SHEET, two sheets.
    expect(waitedMs).toHaveLength(2 * (VIEW_ARRIVAL_ATTEMPTS - 1));
    // Every wait is a real pause, and the ladder really climbs (#1966).
    expect(waitedMs.every((ms) => ms > 0)).toBe(true);
    expect(
      Math.max(...waitedMs),
      "the second wait is not longer than the first — the backoff ladder is flat",
    ).toBeGreaterThan(Math.min(...waitedMs));
  });

  /*
    THE TWO BUDGETS ARE SEPARATE, and this is the arm that proves it rather
    than the arithmetic agreeing by accident. A judge that LOOKED and rejected
    keeps its single regeneration (D-39/D-40) — the arrival budget must not
    lift it, which is the defect a one-number loop would have shipped.
  */
  it("does NOT extend the SHEET's one re-render with the arrival budget", async () => {
    /*
      ⚠ **THE JUDGED BUDGET ON THIS ROAD IS THE SHEET'S, AND IT IS ITS OWN
      NUMBER — `SHEET_MAX_RENDERS`, never `VIEW_JUDGED_ATTEMPTS` (#1904).**
      The two are both 2 today and they answer different questions about
      different money: one is how many draws a customer's paid slice gets, the
      other is how many frames the HOUSE pays for to rescue a sheet. This arm
      reads the sheet's constant so that moving either does not silently move
      the other.
    */
    const judge = () => vi.fn(async () => fail);
    const result = await buildCastPackage(deps({ judge }), input);

    expect(rendersPerSheet())
      .toEqual({ body: SHEET_MAX_RENDERS, head: SHEET_MAX_RENDERS });
    expect(result.failed).toHaveLength(5);
    /* Five panels judged twice — one judgement per rendered panel, no more. */
    expect(result.refundedCredits).toBe(SIGN_PRICE);
    // Nothing waited: a rejection is not an arrival failure.
    expect(waitedMs).toHaveLength(0);
  });

  /*
    A slot may take BOTH roads in one build, and the budgets are counted rather
    than read off the attempt number — which is the only thing that can tell
    "one arrival failure then two rejections" from "three attempts".
  */
  it("counts each budget separately when one sheet dies and the other is refused", async () => {
    /*
      ⚠ **THE TWO ROADS ARE PER-SHEET NOW, so "a view failing both ways" is no
      longer reachable and the honest arm is the one this is (#1904).** A view
      is a panel: either its sheet arrived (and the coordinator's render budget
      governs) or it did not (and the view's arrival budget governs). What CAN
      happen in one Sign is both at once on different sheets, and the budgets
      must not borrow from each other across them.
    */
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "backFull" ? fail : pass);
    const signSheetEngine = (kind: SignSheetKind) => (
      kind === "head"
        ? deadSheetEngine(() => new ProviderError("transport", "dropped"))(kind)
        : defaultSheetEngine(kind)
    );
    const result = await buildCastPackage(deps({ judge, signSheetEngine }), input);

    /*
      The head sheet never arrived: its own arrival budget, spaced (#1966). The
      body sheet arrived and was refused: its one house re-render, and no waits
      at all — a rejection is not an arrival failure. Neither budget lends to
      the other, which is the whole of this arm.
    */
    expect(rendersPerSheet())
      .toEqual({ head: VIEW_ARRIVAL_ATTEMPTS, body: SHEET_MAX_RENDERS });
    expect(waitedMs).toHaveLength(VIEW_ARRIVAL_ATTEMPTS - 1);
    /* Four of the five refund; `frontFull` rode the good body frame. */
    expect(result.failed.sort())
      .toEqual(["backFull", "closeUp", "sideClose", "threeQuarter"]);
    expect(committed).toEqual(["frontFull"]);
  });

  /*
    ⚠ THE NEGATIVE CONTROL ON THE REVERTED REPAIR (#1208).

    Deriving the terminal set from the provider contract's `isRetryable` was
    written and driven on this card, and REVERTED: the contract calls `unknown`
    terminal so an unmapped fault fails closed, which would have taken a paid
    view from two attempts to one. This arm pins the direction — an unmapped
    engine fault is a view that did not arrive, and it gets the arrival budget.
  */
  it("treats an unmapped engine fault as a view that did not arrive, not a refusal", async () => {
    await buildCastPackage(
      deps({ signSheetEngine: deadSheetEngine(() => new ProviderError("unknown", "no idea")) }),
      input,
    );
    /* The direction is what this pins: `unknown` keeps RETRYING, so both the
       waits and the extra frames are there (#1966). */
    expect(waitedMs).toHaveLength(2 * (VIEW_ARRIVAL_ATTEMPTS - 1));
    expect(rendersPerSheet())
      .toEqual({ body: VIEW_ARRIVAL_ATTEMPTS, head: VIEW_ARRIVAL_ATTEMPTS });
  });

  /*
    ⚠ THE ONLY CLASS #1212 MOVED - AND IT IS UNREACHABLE ON THIS ROAD, WHICH
    IS SAID HERE RATHER THAN LEFT FOR A READER TO DISCOVER.

    Nothing in the view road raises `cannot_say`: the only raiser in the product
    is `refineService.ts`'s `RepaintCannotSayError`, on the repaint road, and it
    extends `Error` rather than `ProviderError`, so it could not even reach the
    `instanceof ProviderError` branch. **No customer wait is saved by this
    change.** The first draft of this suite and its PR said fifteen calls became
    five; that was wrong and the reviewer caught it at the bytes.

    The arm stays because it is the ONLY way to prove the loop now asks the
    contract instead of naming its own classes: `content_policy` and
    `capability` were already terminal, so they cannot tell the two
    implementations apart. Throwing a class the road cannot raise is a
    deliberate synthetic - it measures the WIRING, and the wiring is what this
    card was about.
  */
  it("asks the terminal set, not two class names - driven on a class only the set knows", async () => {
    await buildCastPackage(
      deps({ signSheetEngine: deadSheetEngine(() => new ProviderError("cannot_say", "no slot for that")) }),
      input,
    );
    /* ⚠ The WAITS are the reading here, not the frame count: one frame per
       sheet is true of a retrying class too, so a terminal class can only be
       told apart from a retrying one by the absence of the spacing. The old
       arm read 5 engine calls against 15, which the sheet road cannot express. */
    expect(waitedMs).toEqual([]);
    expect(rendersPerSheet()).toEqual({ body: 1, head: 1 });
  });

  /*
    AND THE CLASSES DELIBERATELY LEFT ON THE ARRIVAL BUDGET, driven at the road
    rather than only asserted at the set. A redraw from a stochastic engine is a
    different draw, and she has already paid for a frame she does not have.

    ⚠ `provider_account` WAS IN THIS ARM UNTIL #1301 AND IS NOW THE ARM BELOW —
    it is the one class of that card's four with a reachable raiser on this road
    and a measured incident behind it.
  */
  it("still spends the arrival budget on a class that might come back clean", async () => {
    for (const failure of ["render_fault", "facts_missing"] as const) {
      sheetCalls.length = 0;
      waitedMs.length = 0;
      await buildCastPackage(
        deps({ signSheetEngine: deadSheetEngine(() => new ProviderError(failure, failure)) }),
        input,
      );
      expect(waitedMs, failure).toHaveLength(2 * (VIEW_ARRIVAL_ATTEMPTS - 1));
      expect(rendersPerSheet(), failure)
        .toEqual({ body: VIEW_ARRIVAL_ATTEMPTS, head: VIEW_ARRIVAL_ATTEMPTS });
    }
  });

  /*
    ⚠ THE ONE MEASURED WIN OF #1301, DRIVEN AT THE ROAD AND AT THE MONEY.

    An exhausted provider account is the incident the class was split out of
    `capability` for: `falTransport.ts` maps 401/403 to it, `generateView` goes
    through that transport, and its own declaration says *"every candidate after
    it will fail the same way, and no user action can fix it."* So the customer
    was waiting through FIFTEEN guaranteed-403 calls with backoff — five views,
    three attempts, 1.5 s then 4 s between each — to reach the answer the first
    one had already given in full.

    Both halves are asserted, and the second is the one that makes this a wait
    change rather than a money change: **five calls, no waits at all, and the
    whole 450 still goes back.** A slice that never landed refunds either way
    (`buildOneView`'s per-slot settlement), which is why narrowing this is not a
    money decision — it was the only reason #1212 declined to take it.
  */
  it("asks ONCE when our provider account is unusable — and still refunds every credit", async () => {
    const result = await buildCastPackage(
      deps({ signSheetEngine: deadSheetEngine(() => new ProviderError("provider_account", "402 no funds")) }),
      input,
    );

    // Two frames, one per sheet, and no second attempt at either.
    expect(rendersPerSheet()).toEqual({ body: 1, head: 1 });
    // And not one spaced wait, which is the whole of what she stops sitting through.
    expect(waitedMs).toHaveLength(0);
    expect(result.failed).toHaveLength(5);
    // Zero of N: the base comes back with the slices, exactly as before.
    expect(result.refundedCredits).toBe(SIGN_PRICE);
  });

  it("still activates the Cast when every view fails — the master is usable", async () => {
    const result = await buildCastPackage(
      deps({ signSheetEngine: deadSheetEngine(() => new ProviderError("capability", "no")) }),
      input,
    );

    expect(result.activated).toBe(true);
    /*
      ZERO OF N: the whole 450 goes back, base included (founder ruling,
      2026-08-02). It was 250 until the first paid v3 Sign hit an overdrawn
      provider account and delivered nothing — keeping the promotion there
      charges the customer for our outage. The Cast still stands; only the money
      moved.
    */
    expect(result.refundedCredits).toBe(SIGN_PRICE);
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
    /*
      AND THE ROW IS WHERE THE FACT LIVES (#1220). The delivery was asserted
      here; what it was RECORDED as was not, and that field is the only trace a
      customer's unchecked view leaves — it is what the census read to find three
      of them charged on his two Sifr casts.
    */
    const provenances: Array<Record<string, unknown>> = [];
    const result = await buildCastPackage(
      deps({
        judge,
        commitSlot: vi.fn(async (slot: Record<string, unknown>) => {
          provenances.push(slot.provenance as Record<string, unknown>);
          committed.push(slot.angle as string);
          return committed.length;
        }),
      }),
      input,
    );

    expect(result.committed).toHaveLength(CAST_PACKAGE_VIEWS.length);
    expect(result.failed).toHaveLength(0);
    expect(result.refundedCredits).toBe(0);
    expect(result.totalLoss).toBe(false);
    expect(provenances).toHaveLength(CAST_PACKAGE_VIEWS.length);
    for (const provenance of provenances) {
      expect(provenance.conformanceMethod).toBe("unavailable");
    }
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
    expect(result.refundedCredits).toBe(SIGN_PRICE);
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
    const commitSlot = vi.fn(async () => null);
    const result = await buildCastPackage(deps({ commitSlot }), input);

    /*
      ⚠ **READ AT THE SHEETS NOW — #1904.** It counted `generateView` calls and
      asserted five rather than ten; a Sign renders two sheets, so the same
      claim is that neither sheet is asked for twice. A fenced view that looped
      would re-await its settled sheet and generate nothing, so the frame count
      alone could no longer catch it — the STORE count is what does: five
      pictures stored, not ten, and every one of them dropped.
    */
    expect(rendersPerSheet()).toEqual({ body: 1, head: 1 });
    expect(storedKeys).toHaveLength(5);
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
  /*
    ⚠ **RE-POINTED AT THE TOTAL LOSS BY #1968.** It drove a single refused view
    with `refundRecords = false`, because that view used to attempt a slice
    refund that could fail. Nothing is attempted for a refused view now, so that
    fixture had stopped being able to produce an unrecorded refund at all — it
    would have passed forever on `refundUnrecorded: false` and measured nothing.

    The honesty it guards is the same and now sits on the only road that pays:
    a Sign that delivered nothing, whose one refund did not record, must say so
    rather than sealing a clean receipt.
  */
  it("reports an unrecorded refund on a total loss, and never claims money moved", async () => {
    refundRecords = false;
    const result = await buildCastPackage(
      deps({ signSheetEngine: deadSheetEngine(() => new ProviderError("provider_account", "out of funds")) }),
      input,
    );

    expect(result.refundUnrecorded).toBe(true);
    /* It ASKED for the whole charge and the ledger did not take it, so the
       receipt reports zero moved — never the amount it tried to send. */
    expect(result.refundedCredits).toBe(0);
    expect(result.totalLoss).toBe(true);
  });

  it("records 0 on a refused view's slot, with no reference to quote", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "backFull" ? fail : pass);
    await buildCastPackage(deps({ judge }), input);

    const marker = failures.find((entry) => entry.angle === "backFull");
    expect((marker?.failure as { refunded: number }).refunded).toBe(0);
    /* ⚠ The ABSENCE is the signal (#1968): a zero with a reference means a
       refund failed, and a zero without one means none was owed. The room draws
       a different sentence for each, so the row must not carry a blank. */
    expect((marker?.failure as { refundReference?: string }).refundReference)
      .toBeUndefined();
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

describe("zero of N — the whole charge goes back", () => {
  /*
    ⚠ **THIS DESCRIBE READ *"the base goes back too"* AND ITS ARM COUNTED FIVE
    SLICES PLUS A BASE — #1968.** His flat price makes a Sign one charge, so a
    total loss is ONE refund of the whole thing under ONE reference. The
    assertion is now a complete statement of the refunds rather than a filter
    over amounts: `toEqual` on the array would have been satisfied by five
    slices and a base before, and is satisfied by exactly one row now, so the
    arm can tell the two rules apart. A filter could not.
  */
  it("refunds the WHOLE charge, once, under one reference when nothing lands", async () => {
    const result = await buildCastPackage(
      deps({ signSheetEngine: deadSheetEngine(() => new ProviderError("provider_account", "out of funds")) }),
      input,
    );

    expect(result.totalLoss).toBe(true);
    expect(result.committed).toHaveLength(0);
    /* ONE row, the whole charge, under the idempotent reference — so a recovery
       pass arriving later finds a duplicate, not a second payment. */
    expect(refunds).toEqual([
      {
        amount: SIGN_PRICE,
        reference: packagePromotionChargeReference(input.operationId),
      },
    ]);
    expect(result.refundedCredits).toBe(SIGN_PRICE);
  });

  it("keeps the base when even one view lands", async () => {
    /*
      The other half of the ruling, and the half that must not drift: a PARTIAL
      package keeps its promotion. The customer has views in hand and a Cast to
      keep them in — the permanence they bought is real.
    */
    /*
      ⚠ **DRIVEN PER ANGLE RATHER THAN PER CALL — #1904.** It read `call === 1 ?
      pass : fail`, which on the sheet road says "whichever panel the scheduler
      judged first survives" — a clock in disguise, and with the body sheet then
      re-rendered the survivor could change between runs. One named sheet passes
      and the other is refused twice, which is the same partial package stated
      as a fact about views instead of about timing.
    */
    const judge = () => vi.fn(async (request: { angle: string }) =>
      signSheetKindFor(request.angle as CastViewAngle) === "head" ? pass : fail);
    const result = await buildCastPackage(deps({ judge }), input);

    expect(result.committed).toEqual(["closeUp", "threeQuarter", "sideClose"]);
    expect(result.totalLoss).toBe(false);
    /* ⚠ **NOT ONE CREDIT MOVES ON A PARTIAL PACKAGE SINCE #1968**, which is a
       stronger statement than the one this arm used to make (that the BASE was
       not refunded). Two of five views were refused and nothing comes back for
       them: his *"credits only come back if the Sign can't be delivered at
       all"*. The customer has three views and a Cast to keep them in. */
    expect(refunds).toEqual([]);
    expect(result.refundedCredits).toBe(0);
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

/*
  ⚠ `ViewRequest`, the `plate()` fixture and `recordView()` STOOD HERE AND ARE
  GONE — #1904, and they are deleted rather than kept "for the retry road".

  All three existed to read a per-view `generateView` request, which a Sign no
  longer sends: the pictures are panels of two sheets, so the wire these arms
  are driven on is `sheetCalls`. The Try again road still composes per-view
  requests and has its own typed recorder in `viewRetryService.test.ts`, which
  is where that road's arms live — a spare copy here would be a fixture nothing
  drives, and a fixture nothing drives is how an arm comes to pass by reading
  it. `plate()` had already outlived its lane (#1158 slice 4f) and only the
  deletion of its last reader made that visible.
*/

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

  it("carries several crops in order, and their ordinals match their slots", async () => {
    /*
      ⚠ **RE-POINTED FROM THE PLATE LANE BY #1158 slice 4f, and it is the one arm
      in this block that was doing work for a rule that OUTLIVED its subject.**

      The rule is not about plates: it is that the sentence quoting reference N
      and the picture actually sitting in slot N are built from one list. A
      clause and an array that drift apart is a prompt pointing at the wrong
      tattoo, on a package a customer paid for, and nothing downstream could
      tell. It was driven here only through `inkPlates` — so deleting that lane
      without re-pointing would have left the surviving lane's ordinals proved
      at the CLAUSE (`inkViewReferences.test.ts`) and nowhere at the WIRE.
    */
    await buildCastPackage(deps(), {
      ...input,
      inkCrops: [
        crop({ bytes: Buffer.from("arm-crop") }),
        crop({
          bytes: Buffer.from("neck-crop"),
          slot: "ink:neck",
          placement: "neck",
          side: "centre",
          noun: "neck tattoo",
        }),
      ],
      pronouns: pronounsForSex("male"),
    });

    /*
      ⚠ **BOTH SHEETS, NOT ONE VIEW — #1904.** The crops rode five view requests
      and now ride two sheet requests, so the ordinal rule is checked on each of
      them: the sentence quoting reference N and the picture sitting in slot N
      are built from one list, and a sheet whose crops arrived in a different
      order from its sentence would paint the wrong tattoo on every panel it
      holds rather than on one view.

      ⚠ **Her tattoos go to BOTH sheets on purpose** — they are facts about the
      PERSON, true of every camera, and splitting them by apparent relevance
      would be inventing a taxonomy no reader here can apply.
    */
    expect(sheetCalls).toHaveLength(2);
    for (const call of sheetCalls) {
      /* The master is reference 1, re-encoded as a JPEG for the measured
         latency saving — so it is identified by its TYPE, never by the PNG
         bytes it was handed. */
      expect(call.references, call.kind).toHaveLength(3);
      expect(call.references[0]!.contentType, call.kind).toBe("image/jpeg");
      expect(call.references.slice(1).map((reference) => reference.bytes), call.kind)
        .toEqual(["arm-crop", "neck-crop"]);
      expect(call.prompt, call.kind)
        .toContain("Reference 2 is the exact left upper arm tattoo he already has");
      expect(call.prompt, call.kind)
        .toContain("Reference 3 is the exact neck tattoo he already has");
    }
  });

  it("is INERT for a Cast with no ink — one reference, and not a word added", async () => {
    /*
      The control that matters most, because this lane reaches every package view
      in the product. Absent crops, the request must be what it was before this
      existed: the master alone, and the sheet prompt with nothing appended.

      ⚠ **THIS ARM WENT VACUOUS WHEN THE SHEET ROAD LANDED AND PASSED ANYWAY —
      #1904.** It looped over `generateView.mock.calls`, which a Sign no longer
      fills, so the `for` ran zero times and asserted nothing. The length
      expectation below is what stops that happening again, and it is why the
      inertness is now stated against the sheet composer's own output.
    */
    await buildCastPackage(deps(), input);

    expect(sheetCalls).toHaveLength(2);
    for (const call of sheetCalls) {
      expect(call.references, call.kind).toHaveLength(1);
      /*
        Byte-for-byte the sheet composer's own output — the honest inertness
        test. NOT "the prompt says nothing about tattoos": the sheet's reference
        paragraph already names any tattoos the master SHOWS, which is a
        sentence this lane agrees with rather than contradicts, and an assertion
        against the word would have failed on the product being right.
      */
      const plan = signSheetPlan().find((candidate) => candidate.kind === call.kind)!;
      expect(call.prompt, call.kind).toBe(composeSignSheetPrompt({
        panelOrder: plan.panelOrder,
      }));
    }
  });

  it("sends the DELIVERED CROP beside the master on every sheet, with its own sentence", async () => {
    /*
      The lane that actually carries something. Its source is the frame that
      really delivered the ink, so the sentence is the transform road's — the
      picture is HER, and the mannequin disclaimer would be a lie about it.
    */
    await buildCastPackage(deps(), {
      ...input,
      inkCrops: [crop()],
      pronouns: pronounsForSex("male"),
    });

    expect(sheetCalls).toHaveLength(2);
    for (const call of sheetCalls) {
      expect(call.references, call.kind).toHaveLength(2);
      expect(call.references[0]!.contentType, call.kind).toBe("image/jpeg");
      expect(call.references[1]!.bytes, call.kind).toBe("arm-crop");
      /* The picture is named as what it IS — cut out of a photograph of him —
         and placed where prose is the only thing that can carry the side. */
      expect(call.prompt, call.kind)
        .toContain("Reference 2 is the exact left upper arm tattoo he already has");
      expect(call.prompt, call.kind).toContain("It is on his left upper arm (on the right");
      /* And never the plate lane's sentence about a form that is not there. */
      expect(call.prompt, call.kind).not.toContain("plain grey mannequin form");
    }
  });

  it("is INERT for a Cast with no delivered crop — absent and empty alike", async () => {
    await buildCastPackage(deps(), { ...input, inkCrops: [] });

    /* The second spelling of nothing: an empty array must behave exactly as an
       absent field does, which is the arm above. */
    expect(sheetCalls).toHaveLength(2);
    for (const call of sheetCalls) {
      expect(call.references, call.kind).toHaveLength(1);
      const plan = signSheetPlan().find((candidate) => candidate.kind === call.kind)!;
      expect(call.prompt, call.kind).toBe(composeSignSheetPrompt({
        panelOrder: plan.panelOrder,
      }));
    }
  });

  /*
    ⚠ **TWO PLATE ARMS STOOD HERE AND #1158 slice 4f TOOK THEM — the empty-list
    one had a LIVE rule, and this is where it went.**

      "puts the crops AFTER the plates"   the two-lane ORDERING. Its subject is
                                          gone: there is one ink lane now, so
                                          there is nothing left to order.
      "is inert for an EMPTY plate list"  *two spellings of nothing must behave
                                          alike*, which is a real rule about a
                                          caller that loads zero rows. It is
                                          held above, on the lane that has rows
                                          — "absent and empty alike" drives
                                          `inkCrops: []`, and "no ink" drives
                                          the absent spelling.
  */
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
  /* The ink fixture this block's last arm needs — a delivered crop, declared
     here rather than lifted to the file because the tattoo block above owns its
     own and two blocks sharing one mutable default is how a fixture edit moves
     an assertion nobody was looking at. */
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
  const hidden = (over: Record<string, unknown> = {}) => ({
    slot: "open:tail",
    noun: "tail",
    words: ["a long scaled tail at the base of the spine"],
    region: "belowWaist" as const,
    ...over,
  });

  /** The sheet prompt each kind composes when nothing rides — the inertness floor. */
  const bareSheetPrompt = (kind: SignSheetKind) => composeSignSheetPrompt({
    panelOrder: signSheetPlan().find((plan) => plan.kind === kind)!.panelOrder,
  });

  it("names the hidden feature on EVERY sheet, beside the master and never instead of it", async () => {
    await buildCastPackage(deps(), { ...input, featureWords: [hidden()] });

    /*
      ⚠ **BOTH SHEETS — #1904, and *"every view"* is now *"every sheet"*.** Five
      view requests became two sheet requests, and the words go to BOTH for the
      reason the crops do: a hidden feature is a fact about the PERSON, true of
      every camera, and no reader here can tell a facial scar from a tail.
    */
    expect(sheetCalls).toHaveLength(2);
    for (const call of sheetCalls) {
      /* The words are words: they add no reference, and the master stays alone
         and first. A lane that quietly added an image would be a different
         feature wearing this one's test. */
      expect(call.references, call.kind).toHaveLength(1);
      expect(call.prompt, call.kind).toContain("a long scaled tail at the base of the spine");
      /* Bound 4 (fable-876 §2, "the reference is still king") written into the
         prompt itself rather than trusted to the blocks around it. */
      expect(call.prompt, call.kind)
        .toContain("Everything the reference photograph DOES show is authoritative");
    }
  });

  it("is INERT for a Cast with nothing hidden — byte-for-byte the composer's own output", async () => {
    /*
      The control that keeps the founder's bound. Absent hidden features the
      request must be exactly what it was before this existed — a composer that
      cannot produce NOTHING would be re-describing the person on every Sign in
      the product, which is the drift the bound forbids.
    */
    await buildCastPackage(deps(), input);

    expect(sheetCalls).toHaveLength(2);
    for (const call of sheetCalls) {
      expect(call.prompt, call.kind).toBe(bareSheetPrompt(call.kind));
    }
  });

  it("is inert for an EMPTY list too, not only an absent one", async () => {
    await buildCastPackage(deps(), { ...input, featureWords: [] });

    expect(sheetCalls).toHaveLength(2);
    for (const call of sheetCalls) {
      expect(call.prompt, call.kind).toBe(bareSheetPrompt(call.kind));
    }
  });

  it("rides BESIDE a delivered crop without either clause eating the other", async () => {
    /*
      ⚠ **RE-POINTED FROM THE PLATE LANE BY #1158 slice 4f.** The rule is that
      two things appended to one prompt both survive — it was driven with a
      plate because that lane existed, never because the rule was about plates.
      The surviving ink lane is the delivered crop, so it drives it now.

      ⚠ **AND IT IS NOW CHECKED ON BOTH SHEETS RATHER THAN ONE VIEW (#1904).**
      It read the FIRST `generateView` call, which was one of five identical
      compositions; the two sheets are genuinely different asks, so reading one
      of them would leave the other's appends unproven.
    */
    await buildCastPackage(deps(), {
      ...input,
      inkCrops: [crop()],
      pronouns: pronounsForSex("male"),
      featureWords: [hidden()],
    });

    expect(sheetCalls).toHaveLength(2);
    for (const call of sheetCalls) {
      expect(call.references, call.kind).toHaveLength(2);
      expect(call.prompt, call.kind)
        .toContain("Reference 2 is the exact left upper arm tattoo he already has");
      expect(call.prompt, call.kind).toContain("a long scaled tail at the base of the spine");
    }
  });
});

/**
 * P-b — THE CLAUSE CANNOT BUY ITS OWN CONFORMANCE PASS (invariant 7, named as a
 * prerequisite in `castViewPackage.ts` since fable-871 §3, discharged here).
 *
 * The day the check could see the clause, view conformance would quietly
 * become prompt compliance and stop being worth running.
 *
 * ⚠ **ONE OF THIS PAIR IS GONE — #1903.** It read
 * `packageViewExpectation(angle)` and held its keys to `["framing",
 * "wardrobe"]`, turning "the function takes an angle and nothing else" into a
 * promise. **The judge is handed no expectation at all now**, so there is no
 * signature left to widen and the arm has no subject. The surviving arm is the
 * one that always mattered more: what the judge is ACTUALLY handed, read at the
 * wire rather than at a helper.
 */
describe("a riding clause cannot move the conformance check", () => {

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

describe("⚠ what the character cap pushed out is said out loud", () => {
  /*
    THE SURVEY FINDING THIS ARM EXISTS FOR (opus-1231 §1, ordered fable-1607).

    `composeViewFeatureWordsClause` returns `{ clause, dropped }` and its own
    docblock says why it hands `dropped` back: *"a cap that silently truncates
    reads, from the outside, exactly like a feature that was never there."* Its
    ONLY consumer took `.clause` and discarded the rest — so a feature falling
    off the tail of an 8,500-credit package left no log, no counter and no row.
    **The producer's arms were all green while that was true**, which is
    arm-at-the-producer's exact silhouette.
  */
  const working = () => ({
    id: "e",
    editWithReferences: vi.fn(),
    generateView: vi.fn(async () => ({
      bytes: Buffer.from("view"),
      contentType: "image/png",
      latencyMs: 1,
      provenance: { provider: "fal" as const, model: "nbp", providerRef: "ref" },
    })),
  });

  /** Long enough that two of them cannot both fit the character cap. */
  const wordy = (slot: string) => ({
    slot,
    noun: slot.replace("open:", ""),
    words: ["w".repeat(MAX_CLAUSE_CHARACTERS)],
    region: "belowWaist" as const,
  });

  const capWarnings = () => loggedWarnings.filter(
    (call) => String(call[1] ?? "").includes("hit its character cap"),
  );

  it("is logged, by SLOT and never by the customer's own words", async () => {
    loggedWarnings.length = 0;
    await buildCastPackage(deps({ identityEngine: working }), {
      ...input, featureWords: [wordy("open:tail"), wordy("open:wings")],
    });
    const said = capWarnings();
    expect(said.length).toBeGreaterThan(0);
    const payload = said[0]![0] as { droppedSlots: string[] };
    expect(payload.droppedSlots).toContain("open:wings");
    /* SLOTS ONLY. The words are the customer's own and a log is not where they
       belong — the same discipline the Sign's own feature line already keeps. */
    expect(JSON.stringify(payload)).not.toContain("wwwwwwwwww");
  });

  it("⚠ CONTROL — a package that drops nothing says nothing", async () => {
    loggedWarnings.length = 0;
    await buildCastPackage(deps({ identityEngine: working }), { ...input, featureWords: [] });
    expect(capWarnings()).toHaveLength(0);
  });
});

/**
 * ⚠ **ONLY IDENTITY TAKES A PICTURE AWAY — #1612 part 2, his ruling
 * 2026-09-30: *"i agree with you"*.**
 *
 * Every arm in this block is a money arm, and the population behind them is a
 * production read rather than an argument: **8 refused views on signed casts,
 * all time — 5 on wardrobe, 3 on angle, 0 on identity.** So before tonight this
 * product had never once refused a view for the reason refusal exists, and
 * every refund it ever paid was for a picture the customer never saw and might
 * well have kept.
 *
 * ⚠ **THE COVERAGE HOLE THAT LET THAT SHIP IS WHY THIS BLOCK IS LONG.** The
 * whole file's rejection fixture, `fail`, carries `identity: pass false` — so
 * every arm above drives the one axis that still refuses, and **the change to
 * the refusal rule passed all 5,761 existing tests without reddening one of
 * them.** A suite that cannot tell WHICH axis refused is a suite that would
 * have let this rule move by accident, in either direction.
 */
/**
 * ⚠ **THE REFUSAL RULE AT THE MONEY, AFTER #1903 — his ruling of 2026-10-07.**
 *
 * This describe was *"only identity takes a picture away"*, and it held the
 * #1612 part 2 rule: three axes, one veto, framing and wardrobe delivered. His
 * ruling **deleted the framing and wardrobe axes outright**, so the questions
 * those arms asked no longer have a road — a judge cannot turn a crop down
 * because nobody asks it about the crop.
 *
 * ⚠ **WHAT WAS DELETED FROM HERE, NAMED RATHER THAN QUIETLY DROPPED**, because
 * two of them were his own measured history:
 *
 *  - *"delivers a view whose WARDROBE was turned down"* and *"… whose FRAMING
 *    was turned down"* — both axes are gone;
 *  - *"replays all 8 production refusals"*, the card's own done-when 6: every
 *    refusal this product had ever made (5 wardrobe, 3 angle, **0 identity**),
 *    each delivering under #1612's rule. **That table is now unreachable by
 *    construction** rather than handled — a verdict naming `wardrobe` or
 *    `angle` cannot be produced at all, which is the stronger version of the
 *    same guarantee. The eight rows are kept in prose here because they are the
 *    measurement his ruling rests on: his account was refunded 400 credits for
 *    eight pictures he never saw, and not one of them was *it isn't her*.
 *
 * What stays is every arm about money, and the three catastrophes replace the
 * one veto.
 */
describe("only a catastrophe takes a picture away", () => {
  /** A judge that looked, and turned down exactly the axes named. */
  const rejecting = (
    angle: CastViewAngle,
    axes: Partial<Record<"identity" | "intact" | "people", "differs" | "unsure">>,
  ) => () => vi.fn(async (request: { angle: string }) => {
    if (request.angle !== angle) return pass;
    /*
      ⚠ THE FIXTURE OBEYS THE PRODUCT'S ASYMMETRY — `unsure` passes on the two
      catastrophe axes and fails on identity, which is `AXIS_REFUSES_ON_UNSURE`.
      A fixture carrying its own rule would drift from the product and every arm
      below would keep passing while the behaviour changed.
    */
    const axis = (name: "identity" | "intact" | "people") => {
      const word = axes[name];
      if (word === undefined) return { pass: true, verdict: "matches" as const, note: "" };
      const refuses = word === "differs" || name === "identity";
      return { pass: !refuses, verdict: word, note: name };
    };
    const built = { identity: axis("identity"), intact: axis("intact"), people: axis("people") };
    return {
      pass: Object.values(built).every((entry) => entry.pass),
      method: "judge:test",
      axes: built,
    } as ViewConformanceVerdict;
  });

  it("⚠ delivers a view whose non-identity axes were merely UNSURE — charged, kept, nothing refunded", async () => {
    await buildCastPackage(
      deps({ judge: rejecting("sideClose", { intact: "unsure", people: "unsure" }) }),
      input,
    );

    expect(committed).toContain("sideClose");
    expect(failures.some((entry) => entry.angle === "sideClose")).toBe(false);
    /* The money: nothing came back, because nothing was taken away. */
    expect(refunds).toHaveLength(0);
    /*
      ⚠ THE DROP IS THE ARM EASIEST TO MISS: the refusal road deletes the stored
      object one line after the judge speaks. A rule that delivered but kept
      deleting would hand the room a committed slot pointing at bytes that are
      gone — a broken picture instead of a refund, which is worse than both.
    */
    expect(deletedKeys).toHaveLength(0);
  });

  it("⚠ still REFUSES when IDENTITY differs — the promise a signed Cast makes", async () => {
    await buildCastPackage(deps({ judge: rejecting("sideClose", { identity: "differs" }) }), input);

    expect(committed).not.toContain("sideClose");
    /* The refusal is the promise; the refund is not. Since #1968 a refused view
       returns nothing — and this arm is deliberately kept pointing at IDENTITY,
       because that is the one axis #1903 left able to refuse a view at all. */
    expect(refunds).toEqual([]);
    const marker = failures.find((entry) => entry.angle === "sideClose");
    expect((marker?.failure as { reason: string }).reason)
      .toBe("This view didn't clearly look like this character, so we didn't keep it");
  });

  /**
   * ⚠ **THE CUSTOMER READS THIS SENTENCE, AND IT WAS WRONG FOR TWO OF THE THREE
   * CATASTROPHES — the repair owed on PR #1915.**
   *
   * One string was set for every refusal. So the day #1903 gave this judge two
   * more catastrophes, a blank frame and a two-person frame both told a paying
   * customer their picture *"didn't hold the signed likeness"* — in the room's
   * failed tile and in the health dialog, verbatim, beside the refund. The arm
   * above is now the CONTROL for the one axis that sentence was always true of.
   *
   * ⚠ **AND THE THREE SENTENCES ARE YUNA'S NOW, ON HIS WORD — #1904,
   * 2026-10-08, posted with his *"go with A"*.** Two things changed that these
   * arms hold: *"signed likeness"* is gone everywhere (a term of art from the
   * pipeline, on a path a customer cannot avoid), and each sentence says what
   * we DID with the picture rather than only what was wrong with it.
   */
  const reasonFor = async (
    axes: Partial<Record<"identity" | "intact" | "people", "differs" | "unsure">>,
    castName?: string,
  ): Promise<string> => {
    /*
      ⚠ **SELF-CONTAINED, because `failures.find` returns the FIRST match and
      `beforeEach` only fires between arms.** An arm calling this twice read the
      first Sign's sentence back for the second one and passed on it — found the
      hard way on the name arm below, which asks the same angle two different
      questions in one `it`.
    */
    failures.length = 0;
    refunds.length = 0;
    committed.length = 0;
    sheetCalls.length = 0;
    await buildCastPackage(
      deps({ judge: rejecting("sideClose", axes) }),
      castName === undefined ? input : { ...input, castName },
    );
    const marker = failures.find((entry) => entry.angle === "sideClose");
    return (marker?.failure as { reason: string }).reason;
  };

  it("⚠ a DAMAGED frame says so, and never that it wasn't her", async () => {
    const reason = await reasonFor({ intact: "differs" });
    expect(reason).toBe("This view came out broken, so we didn't keep it");
    expect(reason).not.toContain("likeness");
  });

  it("⚠ a frame with the wrong PEOPLE in it says so, and never that it wasn't her", async () => {
    const reason = await reasonFor({ people: "differs" });
    expect(reason).toBe("This view didn't show just this character, so we didn't keep it");
    expect(reason).not.toContain("likeness");
  });

  it("⚠ a BROKEN frame that also fails identity confesses the breakage — the commonest compound failure", async () => {
    /*
      The order is the judgement, and this is the arm that holds it. Nothing can
      be recognised in a half-black picture, so a damaged frame drags identity
      down with it; identity-first would tell a customer their picture is not
      them when what actually happened is that it did not render.
    */
    expect(await reasonFor({ intact: "differs", identity: "differs" }))
      .toBe("This view came out broken, so we didn't keep it");
  });

  it("⚠ WRONG PEOPLE outranks identity too — his order, 2026-10-08", async () => {
    /*
      ⚠ **HIS WORD, verbatim: *"If several fail, show one line, in this order:
      broken, then wrong people, then not her."*** The order was
      intact → identity → people; `people` moved ahead of `identity`, and this
      is the only arm that can tell the two orders apart. The reasoning is the
      damaged-frame one gone one step further: a frame holding two people, or
      nobody, has no single face to recognise — so *"didn't show just X"* is the
      true fault and *"didn't clearly look like X"* is its symptom.
    */
    expect(await reasonFor({ people: "differs", identity: "differs" }))
      .toBe("This view didn't show just this character, so we didn't keep it");
  });

  /**
   * ⚠ **THE CAST'S NAME STANDS WHERE *"signed likeness"* STOOD — his ruling's
   * own words: *"use the Cast's name, or \"this character\" when it has none"*.**
   *
   * Both halves are driven, because the fallback is the ordinary case rather
   * than an edge: `SignInput.name` is optional and *"a Cast with no name shows
   * its KI id until its owner gives it one"*. ⚠ **The id is never the answer
   * here** — it is the machinery showing through on a path a refused customer
   * cannot avoid.
   */
  it("⚠ names the Cast when it has a name", async () => {
    expect(await reasonFor({ identity: "differs" }, "Sifr"))
      .toBe("This view didn't clearly look like Sifr, so we didn't keep it");
    expect(await reasonFor({ people: "differs" }, "Sifr"))
      .toBe("This view didn't show just Sifr, so we didn't keep it");
  });

  it("⚠ a blank name is no name, not a gap in the sentence", async () => {
    /* `"  "` would read "didn't clearly look like  , so we didn't keep it",
       which is worse than the generic sentence. */
    expect(await reasonFor({ identity: "differs" }, "   "))
      .toBe("This view didn't clearly look like this character, so we didn't keep it");
  });

  it("⚠ CONTROL — every catastrophe has its own sentence, derived from the axis set and not from a list here", () => {
    /*
      Working law 4: the arm must break when an axis is ADDED to the judge and
      its copy is forgotten, so the population comes from `CONFORMANCE_AXES`
      rather than from three literals typed beside it. A missing axis would fall
      through to the fallback, which is a true sentence about the wrong thing.
    */
    const sentences = CONFORMANCE_AXES.map((axis) => refusedViewReason([axis]));
    expect(new Set(sentences).size).toBe(CONFORMANCE_AXES.length);
    expect(sentences).not.toContain("This view didn't come out right");
    for (const sentence of sentences) {
      /* Her words, not the road's — no axis name, no verdict word, no number. */
      expect(sentence).toMatch(/^This view /);
      expect(sentence.toLowerCase()).not.toMatch(/identity|intact|people|axis|verdict|judge/);
    }
  });

  it("⚠ CONTROL — a refusal naming no axis the product knows still says something true", () => {
    /* `method: "forced"` fails every axis with no axis being the story. */
    expect(refusedViewReason([])).toBe("This view didn't come out right");
    expect(refusedViewReason(["angle", "wardrobe"])).toBe("This view didn't come out right");
  });

  it("⚠ CONTROL — `!pass` and `refuses` are the same answer, which is what let the deliver-anyway branch go", () => {
    /*
      The orchestrator's branch was `!verdict.pass` with a `!viewConformanceRefuses`
      arm inside it that could never be entered; it is now the rule itself. This
      holds the equivalence that made the deletion safe, over every axis and every
      verdict word, so a fourth axis that separates the two reddens HERE — where
      the reason is written down — rather than silently refusing a customer's view.
    */
    for (const axis of CONFORMANCE_AXES) {
      for (const word of ["matches", "differs", "unsure"] as const) {
        const axes = Object.fromEntries(
          CONFORMANCE_AXES.map((name) => [
            name,
            name === axis
              ? { pass: !(word === "differs" || (word === "unsure" && name === "identity")), verdict: word, note: "" }
              : { pass: true, verdict: "matches" as const, note: "" },
          ]),
        ) as ViewConformanceVerdict["axes"];
        const verdict = {
          pass: Object.values(axes).every((entry) => entry.pass),
          method: "judge:test",
          axes,
        } as ViewConformanceVerdict;
        expect(viewConformanceRefuses(verdict)).toBe(!verdict.pass);
      }
    }
  });

  it("⚠ refuses on an UNSURE identity too — fail-closed is the whole of §I on this axis", async () => {
    await buildCastPackage(deps({ judge: rejecting("sideClose", { identity: "unsure" }) }), input);

    expect(committed).not.toContain("sideClose");
    /* It refuses. It does not refund — #1968. */
    expect(refunds).toEqual([]);
  });

  /*
    ⚠ **HIS OTHER TWO CATASTROPHES, AT THE MONEY** — a broken picture and the
    wrong number of people each refuse exactly as identity does.
    They are refusal roads on a money path, so they are driven here and not
    only as pure functions: the failure marker and what the customer is charged
    are what she actually experiences.

    ⚠ **AND SINCE #1968 WHAT THEY PROVE AT THE MONEY IS THAT NOTHING MOVES.**
    They read *"refuses and refunds"* while a view was a refundable slice; his
    reprice makes the refusal free of money in both directions, and the arm
    says so rather than being deleted for having nothing left to check — "a
    catastrophe refunds nothing" is precisely the rule a later reader would
    otherwise re-add a slice refund against.
  */
  for (const axis of ["intact", "people"] as const) {
    it(`refuses and refunds NOTHING when ${axis} DIFFERS — his catastrophe list, at the money`, async () => {
      await buildCastPackage(deps({ judge: rejecting("sideClose", { [axis]: "differs" }) }), input);

      expect(committed).not.toContain("sideClose");
      expect(refunds).toEqual([]);
    });
  }

  it("refuses when identity fails BESIDE another — no axis rescues another", async () => {
    await buildCastPackage(
      deps({ judge: rejecting("sideClose", { identity: "differs", intact: "differs" }) }),
      input,
    );

    expect(committed).not.toContain("sideClose");
    /* It refuses, and refunds nothing (#1968). */
    expect(refunds).toEqual([]);
    expect(failures.some((entry) => entry.angle === "sideClose")).toBe(true);
  });

  /*
    ⚠ **THE REGENERATION BUDGET IS ONLY EVER SPENT ON A CATASTROPHE.**

    A framing rejection used to buy a second render, which meant DROPPING the
    frame in hand to draw an unknown one. Under this rule the frame in hand is
    deliverable unless it is catastrophically wrong, so spending ~30–60 s and a
    second house render to replace it is a gamble the customer now owns. The
    alternative was declined deliberately, and this arm is what holds it: a
    delivered view costs exactly ONE generation.
  */
  it("spends ONE sheet render on a delivered package, and the budget on a refusal", async () => {
    /*
      ⚠ **THE SPEND IS THE SHEET'S NOW — #1904.** It counted `generateView`
      calls per angle; a Sign renders two sheets, so the same claim is about
      frames per SHEET: a package nothing refuses costs one render of each, and
      only a catastrophe buys the second. `sideClose` is a head-sheet view, so a
      refusal on it must move the head count and leave the body's alone.
    */
    await buildCastPackage(
      deps({ judge: rejecting("sideClose", { intact: "unsure" }) }),
      input,
    );
    expect(rendersPerSheet(), "an UNSURE delivers, so nothing is re-rendered")
      .toEqual({ head: 1, body: 1 });

    sheetCalls.length = 0;
    await buildCastPackage(
      deps({ judge: rejecting("sideClose", { identity: "differs" }) }),
      input,
    );
    expect(rendersPerSheet(), "a refusal buys its own sheet one more frame, and only its own")
      .toEqual({ head: SHEET_MAX_RENDERS, body: 1 });
  });

  /*
    The refused-frame keeper (#1492) exists because a refused frame is DROPPED
    and there is nothing left for his eye. A delivered frame is not dropped —
    it is the customer's — so a capture here would be a second copy of a picture
    we already kept.
  */
  it("keeps no diagnostic copy of a delivered view, and still keeps one of a refused one", async () => {
    await buildCastPackage(deps({ judge: rejecting("sideClose", { intact: "unsure" }) }), input);
    expect(captured).toHaveLength(0);

    captured.length = 0;
    await buildCastPackage(deps({ judge: rejecting("sideClose", { identity: "differs" }) }), input);
    expect(captured.length).toBeGreaterThan(0);
    expect(captured[0]!.reason).toBe("sheet_view_refused:sideClose:identity");
  });

  /*
    ⚠ **A DELIVERED VIEW CARRIES NO MARK — #1903, asserted at the ROW rather
    than at the log** (invariant 5's shape: prove the contract where it is
    written, not on a constant near it).

    This arm used to hold the opposite: it read the FAILING axis off the stored
    provenance, because that failing axis is what made the room say
    `Unchecked · Try again` at a price of zero. Under his ruling a view that
    is delivered has no failing axis to record — every axis that can fail now
    refuses — so the row must read as CHECKED through the same function the
    room uses. A row that still read as unchecked here would offer a free Try
    again on a picture nothing is wrong with.
  */
  it("writes a CLEAN row for a delivered view — no mark, nothing free to claim", async () => {
    const rows: Array<Record<string, unknown>> = [];
    await buildCastPackage(
      deps({
        judge: rejecting("sideClose", { intact: "unsure" }),
        commitSlot: vi.fn(async (entry: Record<string, unknown>) => {
          rows.push(entry);
          return rows.length;
        }),
      }),
      input,
    );

    const row = rows.find((entry) => entry.angle === "sideClose");
    const provenance = row?.provenance as {
      conformanceMethod?: string;
      conformance?: Record<string, { pass: boolean; verdict?: string }>;
    };
    /* The verdict IS persisted — support can still read what was asked. */
    expect(provenance.conformanceMethod).toBe("judge:test");
    expect(provenance.conformance?.intact.verdict).toBe("unsure");
    /* And the axis the judge was unsure about PASSED, which is the whole of
       "unsure is not a catastrophe": the row records the doubt and the view is
       delivered clean.

       ⚠ **A LINE BELOW THIS USED TO RE-READ THE ROW THROUGH THE ROOM'S OWN
       delivered-unchecked reader — that function is deleted with the free ask
       (#1903 slice 3), so there is no second reader left to agree with.** What
       replaced it is the stronger statement the deletion makes possible: the
       room cannot mark this row at all, because nothing reads a stored axis any
       more. `viewRetryNoFreeAsk.test.ts` holds that end. */
    expect(provenance.conformance?.intact.pass).toBe(true);
  });

  /*
    ⚠ **THE D-246 ROAD IS UNTOUCHED, AND THIS ARM IS WHY THE RULE READS
    `unjudged` FIRST.** A judge that could not answer writes `pass: false` on
    EVERY axis — so a refusal rule that read the axes without checking
    `unjudged` would start refusing every view a flaky judge could not reach,
    which is exactly the failure D-246 was written to end. It would look like a
    tightening and be a regression.

    ⚠ It matters MORE after #1903: the rule is now "any failing axis refuses",
    and `unjudged` fails all of them at once.
  */
  it("⚠ CONTROL — a view nobody could judge still delivers, exactly as D-246 says", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) => {
      if (request.angle !== "sideClose") return pass;
      return unjudgedVerdict("unavailable", "the view could not be checked");
    });
    await buildCastPackage(deps({ judge }), input);

    expect(committed).toContain("sideClose");
    expect(refunds).toHaveLength(0);
  });

  /*
    The forced-fail switch is a server-owned rehearsal of the refusal path with
    real money on a real Cast. It writes every axis false and does NOT set
    `unjudged`, so it still refuses — the only behaviour that makes the switch
    worth having.
  */
  it("⚠ CONTROL — the forced-fail switch still walks the refusal path", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) => {
      if (request.angle !== "sideClose") return pass;
      const forced = { pass: false, note: "forced failure switch" };
      return {
        pass: false,
        method: "forced",
        axes: {
          identity: { ...forced },
          intact: { ...forced },
          people: { ...forced },
        },
      } as ViewConformanceVerdict;
    });
    await buildCastPackage(deps({ judge }), input);

    expect(committed).not.toContain("sideClose");
    /*
      ⚠ **THIS CONTROL READ `refunds).toHaveLength(1)` AND #1968 TOOK ITS SIGNAL
      AWAY.** A refused view moves no money, so a refund count can no longer
      tell "walked the refusal path" from "did nothing at all" — both are now
      zero. It reads the FAILURE MARKER instead, which is the durable thing the
      refusal road writes and the room confesses from.
    */
    expect(refunds).toEqual([]);
    expect(failures.map((entry) => entry.angle)).toEqual(["sideClose"]);
  });

  /*
    ⚠ **MONEY CONSERVED — the arm every money-path change in this repository
    owes**: charged = kept + refunded, across one Sign that mixes a delivery, a
    refusal and a pass.
  */
  it("⚠ conserves the money across a package with a delivery, a refusal and a pass", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) => {
      if (request.angle === "sideClose") {
        return {
          pass: true,
          method: "judge:test",
          axes: {
            identity: { pass: true, verdict: "matches" as const, note: "" },
            intact: { pass: true, verdict: "unsure" as const, note: "hard to tell" },
            people: { pass: true, verdict: "matches" as const, note: "" },
          },
        } as ViewConformanceVerdict;
      }
      if (request.angle === "backFull") return fail;
      return pass;
    });
    const result = await buildCastPackage(deps({ judge }), input);

    /*
      ⚠ **THE CONSERVATION SUM HERE WAS `kept + refunded === charged` OVER
      PER-VIEW SLICES, AND #1968 DISSOLVES IT RATHER THAN RE-DERIVING IT.**
      There are no slices to add up: one flat charge buys the package, and the
      customer keeps whatever landed. So the money statement is the whole of
      what moves — nothing — and the DELIVERY statement is what this arm was
      really about: an unsure non-identity axis delivers, a differing one does
      not, in the same package.
    */
    const refunded = refunds.reduce((sum, entry) => sum + entry.amount, 0);

    expect(committed).toContain("sideClose");
    expect(committed).not.toContain("backFull");
    expect(refunded, "a partial package refunds nothing (#1968)").toBe(0);
    expect(result.refundedCredits).toBe(0);
    expect(result.totalLoss, "four of five landed, so this is not a total loss").toBe(false);
  });
});

/**
 * ⚠ **WHAT A SIGN SPENDS ON SHEETS — and the arm that was MISSING.**
 *
 * `sheetCalls` has been recorded on every engine call since the sheet road was
 * written, and its own docblock says *"the count is the point of recording
 * it"* — while **nothing asserted on it**. A number collected and summed
 * nowhere is a number nobody has: every arm in this file would have passed just
 * as happily if each of the five views had quietly rendered its own sheet, at
 * five times the house cost and five different outfits.
 *
 * His #1926 ruling is TWO renders a Sign. That is the whole assertion.
 */
describe("⚠ what a Sign spends on sheets — two renders, not one per view", () => {
  it("renders exactly one sheet per KIND, whatever the view count", async () => {
    const result = await buildCastPackage(deps(), input);
    expect(result.committed).toHaveLength(5);

    /* Two calls, not five — the regression this arm exists for. */
    expect(sheetCalls).toHaveLength(signSheetPlan().length);
    expect(sheetCalls).toHaveLength(2);
    expect([...sheetCalls.map((call) => call.kind)].sort()).toEqual(["body", "head"]);

    /*
      ⚠ **AND EACH SHEET WAS ASKED FOR ITS OWN PANELS** — the kind argument is
      the only thing separating the two engines, so an arm that counted two
      calls without reading their prompts would pass if both had been asked for
      the same sheet twice.
    */
    for (const plan of signSheetPlan()) {
      const call = sheetCalls.find((candidate) => candidate.kind === plan.kind);
      expect(call, `no sheet call for ${plan.kind}`).toBeDefined();
      expect(call!.prompt).toContain(`${plan.panelOrder.length} vertical panels`);
      /* One reference each — her master, and nothing else. Both sheets take the
         master alone; the head sheet does NOT wait for the body sheet, which is
         what "in parallel" costs and buys. */
      expect(call!.references).toHaveLength(1);
    }

    /* The two prompts are genuinely different asks. Without this the loop above
       would pass if the plan returned the same panel list twice. */
    expect(sheetCalls[0]!.prompt).not.toBe(sheetCalls[1]!.prompt);
  });
});

/**
 * ⚠ **THE SHEET COORDINATOR'S OWN RULES — his option A, driven through the real
 * `buildCastPackage` rather than against the coordinator alone (#1904,
 * 2026-10-08, his word verbatim and entire: *"go with A"*).**
 *
 * Driven through the entrance on purpose: every one of these claims is about
 * what a CUSTOMER is charged and handed, and the coordinator cannot answer that
 * by itself — the refund, the commit and the confession are all on the other
 * side of it. A unit test of `settleSignSheet` would pass on a coordinator
 * whose settled map nothing consumed, which is the shape invariant 7 exists
 * for.
 */
describe("⚠ the free re-render is OURS, and its limits", () => {
  it("does NOT buy a re-render for a panel nobody could judge", async () => {
    /*
      ⚠ **D-246 AT THE SPEND, WHICH IS WHERE IT COSTS US RATHER THAN HER.** An
      unreachable judge fails every axis closed, so a coordinator asking
      *"did any axis fail?"* would re-render BOTH sheets of EVERY Sign during a
      judge outage — house money spent on frames nobody can have an opinion
      about, five times a Sign. `viewConformanceRefuses` excludes `unjudged` and
      this is the arm that holds the spending decision to it.
    */
    const judge = () => vi.fn(async () => {
      throw new ProviderError("transport", "judge unreachable");
    });
    const result = await buildCastPackage(deps({ judge }), input);

    expect(rendersPerSheet()).toEqual({ body: 1, head: 1 });
    /* And D-246's own half: the pictures are delivered, not refunded. */
    expect(result.committed).toHaveLength(5);
    expect(refunds).toEqual([]);
  });

  it("settles from the FIRST frame when the free re-render does not arrive", async () => {
    /*
      ⚠ **THE ASYMMETRY THIS FILE'S HARDEST MONEY DECISION RESTS ON.** A fault
      in the FIRST render has nothing to deliver, so it propagates and every
      slice refunds. A fault in the SECOND must NOT: that frame is house money
      bought to rescue one refused slice, and letting its failure fail the sheet
      would take views the customer already paid for and the judge already
      passed, to pay for OUR outage — which is what the confession law forbids.

      `frontFull` passed on the body sheet's first frame and must still be
      delivered, from that frame, after the re-render dies.

      ⚠ **THE FIXTURE FAILS EVERY RE-RENDER ATTEMPT, AND IT USED TO FAIL ONLY
      THE SECOND CALL — #1966.** With the sheet's arrival retries in place, one
      transient fault is now RESCUED (the arm below drives exactly that), so a
      fixture that threw once would stop measuring this asymmetry altogether
      and would have read as a pass while proving the opposite thing.
    */
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "backFull" ? fail : pass);
    const signSheetEngine = (kind: SignSheetKind) => {
      const working = defaultSheetEngine(kind);
      return {
        ...working,
        editWithReferences: vi.fn(async (request: { prompt: string; references: unknown[] }) => {
          const already = sheetCalls.filter((call) => call.kind === kind).length;
          if (kind === "body" && already >= 1) {
            sheetCalls.push({ kind, prompt: request.prompt, references: [] });
            throw new ProviderError("transport", "the second frame never came");
          }
          return working.editWithReferences(request);
        }),
      };
    };
    const result = await buildCastPackage(deps({ judge, signSheetEngine }), input);

    /* The first frame, then the re-render asked for its full arrival budget and
       never arriving (#1966). It is NOT `SHEET_MAX_RENDERS` any more: that
       budget counts frames the house PAYS for, and a request that produced no
       frame paid for nothing. */
    expect(rendersPerSheet()).toEqual({ body: 1 + VIEW_ARRIVAL_ATTEMPTS, head: 1 });
    /* The view that passed on frame 1 is delivered FROM frame 1. */
    expect(committed.sort())
      .toEqual(["closeUp", "frontFull", "sideClose", "threeQuarter"]);
    expect(
      committedProvenance.find((entry) => entry.angle === "frontFull")?.providerRef,
    ).toBe("sheet-ref-body-gen1");
    /* A PARTIAL package, not a total loss — and since #1968 nothing comes back
       for the refused view either. */
    expect(result.failed).toEqual(["backFull"]);
    expect(refunds).toEqual([]);
    expect(result.totalLoss).toBe(false);
  });

  it("⚠ #1966 — a re-render that drops ONCE is asked again, and rescues its sheet", async () => {
    /*
      THE OTHER SIDE OF THE ARM ABOVE, and the reason this card exists. A
      transport fault is not a judgement: nothing came back, so nothing was
      drawn and nothing was judged. Before #1966 this exact sequence settled
      from frame 1 and refunded `backFull` — a slice lost to OUR dropped
      request, which is what the per-view road has refused to do since #1208.

      The budgets stay apart: the house still pays for ONE re-render
      (`SHEET_MAX_RENDERS`), and the second ASK for it is a repeat of a request
      that produced nothing.
    */
    const judge = () => {
      let judged = 0;
      return vi.fn(async (request: { angle: string }) => {
        /* backFull fails on generation 1 and passes on generation 2 — the
           sheet's one house re-render doing its job, once it arrives. */
        if (request.angle !== "backFull") return pass;
        judged += 1;
        return judged === 1 ? fail : pass;
      });
    };
    let bodyDrops = 0;
    const signSheetEngine = (kind: SignSheetKind) => {
      const working = defaultSheetEngine(kind);
      return {
        ...working,
        editWithReferences: vi.fn(async (request: { prompt: string; references: unknown[] }) => {
          const already = sheetCalls.filter((call) => call.kind === kind).length;
          if (kind === "body" && already === 1 && bodyDrops === 0) {
            bodyDrops += 1;
            sheetCalls.push({ kind, prompt: request.prompt, references: [] });
            throw new ProviderError("transport", "the re-render's request dropped");
          }
          return working.editWithReferences(request);
        }),
      };
    };
    const result = await buildCastPackage(deps({ judge, signSheetEngine }), input);

    /* One frame, one dropped request, then the frame the house paid for. */
    expect(rendersPerSheet()).toEqual({ body: 3, head: 1 });
    expect(waitedMs, "the retry was hammered rather than spaced").toHaveLength(1);
    expect(waitedMs[0]).toBeGreaterThan(0);

    /* Nobody refunds, and every view is delivered. */
    expect(result.failed).toEqual([]);
    expect(refunds).toEqual([]);
    expect(committed.sort())
      .toEqual(["backFull", "closeUp", "frontFull", "sideClose", "threeQuarter"]);
    /*
      And the whole body sheet comes from ONE frame — his *"replace all of that
      sheet's views together"* — namely the one that actually arrived.

      ⚠ The fixture's ref counts REQUESTS, not generations, so the rescued frame
      is `gen3`: request 1 drew it, request 2 dropped, request 3 is the house's
      one paid re-render arriving. That the two views agree on a single ref is
      the claim; which number it carries is the fixture's arithmetic.
    */
    const bodyRefs = committedProvenance
      .filter((entry) => entry.angle === "frontFull" || entry.angle === "backFull")
      .map((entry) => entry.providerRef);
    expect(bodyRefs).toEqual(["sheet-ref-body-gen3", "sheet-ref-body-gen3"]);
  });

  it("charges the customer NOTHING for the second frame, and never a third", async () => {
    /*
      His ruling's two money sentences, together: *"at our cost"* and *"at most
      one automatic re-render per sheet per Sign. No loop."* A judge that
      refuses forever is the worst case, and the whole of what it may cost is
      one extra frame per sheet and the customer's full refund.
    */
    const judge = () => vi.fn(async () => fail);
    const result = await buildCastPackage(deps({ judge }), input);

    expect(rendersPerSheet())
      .toEqual({ body: SHEET_MAX_RENDERS, head: SHEET_MAX_RENDERS });
    /* ⚠ **THE WHOLE CHARGE, ONCE** — nothing extra was charged for the four
       re-rendered frames, and nothing was withheld because of them. It read as
       five slices plus a base until #1968; one row is the stronger assertion,
       because it also refuses a build that paid a slice on top. */
    expect(result.refundedCredits).toBe(SIGN_PRICE);
    expect(refunds).toEqual([
      {
        amount: SIGN_PRICE,
        reference: packagePromotionChargeReference(input.operationId),
      },
    ]);
  });

  it("judges each rendered panel exactly ONCE", async () => {
    /*
      ⚠ **THE DEFECT THIS REPLACED, named because it was measured and not
      supposed:** on the per-view road `VIEW_JUDGED_ATTEMPTS` gave a refused
      slot a second attempt, and on a sheet that second attempt re-read the SAME
      settled pixels — one more paid judge call asking an identical question
      about an identical picture, and then the slice failed anyway.

      So the count is the arm: five panels on a clean Sign is five judgements,
      and five panels across two re-rendered sheets is ten. Never fifteen.
    */
    const clean: Array<string> = [];
    await buildCastPackage(
      deps({ judge: () => vi.fn(async (request: { angle: string }) => {
        clean.push(request.angle);
        return pass;
      }) }),
      input,
    );
    expect(clean.sort()).toEqual([...CAST_PACKAGE_VIEWS].sort());

    const refused: Array<string> = [];
    sheetCalls.length = 0;
    await buildCastPackage(
      deps({ judge: () => vi.fn(async (request: { angle: string }) => {
        refused.push(request.angle);
        return fail;
      }) }),
      input,
    );
    /* Ten: every panel judged once per frame, two frames per sheet. */
    expect(refused).toHaveLength(CAST_PACKAGE_VIEWS.length * SHEET_MAX_RENDERS);
    for (const angle of CAST_PACKAGE_VIEWS) {
      expect(refused.filter((seen) => seen === angle), angle).toHaveLength(SHEET_MAX_RENDERS);
    }
  });
});

/**
 * ⚠ **THE WHOLE LINE THE CUSTOMER READS, COMPOSED THROUGH THE REAL HELPERS —
 * and it is the arm that would have caught the defect this card nearly shipped.**
 *
 * Yuna's sentences are complete sentences ending in *"so we didn't keep it"*,
 * and `ViewTabs`'s failed slot composes `${label} failed — ${reason}.
 * ${money}`. Shipped with their own full stop they read *"…we didn't keep
 * it.."* on the one surface a Sign's refusal actually lands on — a punctuation
 * bug nobody would find by reading either file alone, because the sentence is
 * right in `packageOrchestrator` and the composition is right in `ViewTabs`.
 *
 * So the LINE is the subject here, not the sentence: the reason this road
 * raises is pushed through the money helper every surface shares, and the
 * composed result is read for the two things a reader cannot see from one side
 * — no doubled stop, and no term of art. **It is a mechanizable design law and
 * therefore an assertion rather than review memory** (the UI milestone
 * contract's own rule).
 *
 * ⚠ **The `.` is `ViewTabs`'s and is quoted from it rather than invented**, so
 * an arm that passed while the real surface composed something else is not what
 * this is. If that expression changes, this arm's own comment is the pointer to
 * change with it.
 */
describe("⚠ the refusal line a customer reads, end to end", () => {
  /*
    ⚠ **THE MONEY HALF OF THIS SENTENCE IS GONE, AND THAT IS #1968.**

    It composed `refundOutcomeText({ refunded: VIEW_PRICE })` and asserted the
    line contained *" credits returned."*. A refused view on a signed package
    refunds nothing now, so the honest line ends at Yuna's sentence — and the
    arm below proves the line says nothing about money AT ALL, in either
    direction. That second half is the one worth having: the old reading of
    `refunded: 0` would have appended *"The automatic refund couldn't be
    recorded — contact support to restore the credits."*, an invented fault and
    an invented errand under a picture that was never refundable.
  */
  const compose = (reason: string) =>
    /* `client/src/features/casting/components/ImageViewer/ViewTabs.tsx`'s
       `FailedSlot`, composed through the same `joinSentences` so an empty money
       half cannot leave a double space — #1940 B18, #1968. The lead is
       `{label}:` because the reason is already the whole account of what
       happened (see that component's own note). */
    joinSentences(`Front: ${reason}.`, refundOutcomeText({ refunded: 0 }));

  it("reads as one sentence, with no doubled stop and no term of art", () => {
    for (const axis of CONFORMANCE_AXES) {
      const line = compose(refusedViewReason([axis], "Sifr"));
      expect(line, axis).not.toContain("..");
      /* The pipeline's own words, each one checked by name: an axis name, a
         verdict word, and the term his ruling removed. */
      expect(line.toLowerCase(), axis).not.toContain("likeness");
      expect(line.toLowerCase(), axis).not.toMatch(/identity|intact|people|axis|verdict|judge/);
      /* It says what happened and what we did, and stops. */
      expect(line, axis).toContain("so we didn't keep it.");
      /*
        ⚠ **AND IT SAYS NOTHING ABOUT MONEY, IN EITHER DIRECTION — #1968.**
        No credits came back for this view, so a line claiming they did would be
        false and a line sending her to support would invent a fault. Both
        spellings are refused by name.
      */
      expect(line, axis).not.toContain("credits returned");
      expect(line, axis).not.toContain("refunded");
      expect(line.toLowerCase(), axis).not.toContain("support");
      expect(line.toLowerCase(), axis).not.toContain("credits");
      /* No trailing join artefact where the money half used to be. */
      expect(line, axis).toBe(line.trim());
      expect(line, axis).not.toContain("  ");
    }
  });

  it("⚠ CONTROL — the arm reddens on a sentence carrying its own stop", () => {
    /*
      Without this the arm above could pass on a reader that never looked at the
      join. The failing shape is the exact one a well-meaning edit produces:
      Yuna's sentence pasted in with the full stop she wrote.
    */
    expect(compose("This view came out broken, so we didn't keep it.")).toContain("..");
  });

  it("⚠ DERIVES its join from the real surface, so a quoted composition cannot rot", () => {
    /*
      ⚠ **THE ARM ABOVE QUOTES `ViewTabs`, AND A QUOTE IS A MIRROR (working law
      4).** If that component stops putting a full stop after the reason, the
      arm above goes on passing while the real line changes shape — which is
      the drift this repository has paid for repeatedly. So the join is READ
      out of the component rather than trusted: the expression must still put
      a `.` between the reason and the money, because that is the whole reason
      these sentences ship without one.
    */
    const source = readListedSource(join(
      resolve(import.meta.dirname, "../.."),
      "client/src/features/casting/components/ImageViewer/ViewTabs.tsx",
    ));
    expect(source, "the surface this arm derives from is gone — re-point it").not.toBeNull();
    /*
      ⚠ **THE DERIVED STRINGS MOVED WITH #1968 AND THAT IS THIS ARM EARNING ITS
      KEEP.** The surface used to interpolate the money half directly; it now
      joins around it, because the half can be empty. Both halves of the real
      composition are read: the reason still carries its own full stop, and the
      money still goes through `refundOutcomeText` rather than being spelled out
      at the surface.
    */
    expect(source!).toContain("`${label}: ${bareReason(failure.reason)}.`");
    expect(source!).toContain("refundOutcomeText(failure)");
    expect(source!, "the join is what lets the money half be empty").toContain("joinSentences(");
  });
  it("names the Cast in the line, or calls it this character", () => {
    expect(compose(refusedViewReason(["identity"], "Sifr")))
      .toBe("Front: This view didn't clearly look like Sifr, so we didn't keep it.");
    expect(compose(refusedViewReason(["identity"]))).toContain("this character");
  });
});

/*
  ⚠ **THE PER-VIEW ROAD NEVER RE-BUYS A FRAME THAT ARRIVED — #1994**, the
  sibling of the sheet road's PR #1982 finding, on the road that one did not
  reach. This road is the Try again (`viewRetryService` renders through
  `renderViewAttempts` with no sheets), so these arms drive the loop directly
  with no `signSheets`, and the engine is a per-view `generateView`.

  The loop's `try` wraps the store and the landing as well as the engine, and a
  plain `Error` from either read as `unknown` — retryable — so a picture that
  had ARRIVED and been paid for was asked for again. Counted here at the engine:
  each `generateView` call is one paid frame.
*/
describe("⚠ a view that arrived is never bought twice (#1994)", () => {
  function perViewEngine(fault?: () => unknown) {
    const generateView = vi.fn(async () => {
      if (fault) throw fault();
      return {
        bytes: Buffer.from("view"),
        contentType: "image/png",
        latencyMs: 1,
        provenance: { provider: "fal" as const, model: "nbp", providerRef: "ref" },
      };
    });
    return {
      generateView,
      identityEngine: () => ({ id: "test-identity", editWithReferences: vi.fn(), generateView }),
    };
  }

  const landed = async (value: { stored: { key: string } }) => ({ key: value.stored.key });

  it("asks ONCE when the frame arrived and could NEVER be stored — the same bytes re-offered, then it gives up", async () => {
    const { generateView, identityEngine } = perViewEngine();
    const offered: string[] = [];
    const storeImage = vi.fn(async (offer: { bytes: Buffer }) => {
      offered.push(offer.bytes.toString());
      throw new Error("S3: the bucket did not answer");
    });

    const result = await renderViewAttempts(
      deps({ identityEngine, storeImage }) as never,
      input as never,
      "frontClose",
      landed as never,
    );

    expect(generateView, "a frame that arrived was re-bought because the store failed")
      .toHaveBeenCalledTimes(1);
    expect(result.status).toBe("failed");
    /* #2045: the bytes in hand are offered to storage VIEW_STORE_ATTEMPTS
       times — the SAME bytes, spaced by the store ladder and nothing else. */
    expect(offered, "the frame in hand was not re-stored before giving up")
      .toEqual(Array(VIEW_STORE_ATTEMPTS).fill("view"));
    expect(waitedMs, "the only waits are the re-store spacing — no arrival backoff for a frame that arrived")
      .toEqual(VIEW_STORE_BACKOFF_MS.slice(0, VIEW_STORE_ATTEMPTS - 1));
    expect(result.tally.arrivalFailures, "it ARRIVED — this is not an arrival failure").toBe(0);
  });

  /*
    #2045 — THE LOSS #1994 LEFT STANDING. The store failing once used to break
    the loop with the picture still in memory; now the same bytes are stored
    again and the view lands, on ONE paid frame.
  */
  it("a store that fails ONCE then succeeds lands the view on the one frame it bought (#2045)", async () => {
    const { generateView, identityEngine } = perViewEngine();
    let failedOnce = false;
    const offered: string[] = [];
    const storeImage = vi.fn(async (offer: { bytes: Buffer }) => {
      offered.push(offer.bytes.toString());
      if (!failedOnce) {
        failedOnce = true;
        throw new Error("S3: the bucket did not answer");
      }
      const key = `casting-v2/casts/${OPERATION_ID}/views/${storedKeys.length}.png`;
      storedKeys.push(key);
      return { key, url: `https://cdn.example/${key}` };
    });

    const result = await renderViewAttempts(
      deps({ identityEngine, storeImage }) as never,
      input as never,
      "frontClose",
      landed as never,
    );

    expect(result.status, "a passing storage fault cost her the view").toBe("landed");
    expect(generateView, "re-storing bought a second frame").toHaveBeenCalledTimes(1);
    expect(offered).toEqual(["view", "view"]);
    expect(waitedMs).toEqual([VIEW_STORE_BACKOFF_MS[0]]);
    expect(result.tally).toMatchObject({ attempts: 1, arrivalFailures: 0 });
  });

  it("asks ONCE when the frame arrived, passed, and its LANDING threw", async () => {
    const { generateView, identityEngine } = perViewEngine();
    const land = vi.fn(async () => {
      throw new Error("the commit lost its connection");
    });

    const result = await renderViewAttempts(
      deps({ identityEngine }) as never,
      input as never,
      "frontClose",
      land as never,
    );

    expect(generateView, "a frame that arrived was re-bought because the commit failed")
      .toHaveBeenCalledTimes(1);
    expect(land).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("failed");
    expect(waitedMs).toEqual([]);
    /* The stored object is dropped, so nothing is left in the bucket that no
       row will ever point at. */
    expect(deletedKeys).toEqual(storedKeys);
    expect(storedKeys).toHaveLength(1);
  });

  /*
    THE CONTROLS (law 2): the flag reads WHEN the throw happened, not what it
    was. The same plain `Error`, thrown BY the engine — the frame never arrived
    — still spends the whole arrival budget; and a landed view is still landed.
  */
  it("⚠ CONTROL — the same plain Error from the ENGINE still gets every arrival attempt", async () => {
    const { generateView, identityEngine } = perViewEngine(() => new Error("an unmapped engine fault"));

    const result = await renderViewAttempts(
      deps({ identityEngine }) as never,
      input as never,
      "frontClose",
      landed as never,
    );

    expect(generateView, "a frame that never arrived stopped being re-asked")
      .toHaveBeenCalledTimes(VIEW_ARRIVAL_ATTEMPTS);
    expect(result.status).toBe("failed");
    expect(waitedMs).toHaveLength(VIEW_ARRIVAL_ATTEMPTS - 1);
  });

  it("⚠ CONTROL — a view whose store and landing succeed lands on the first frame", async () => {
    const { generateView, identityEngine } = perViewEngine();

    const result = await renderViewAttempts(
      deps({ identityEngine }) as never,
      input as never,
      "frontClose",
      landed as never,
    );

    expect(result.status).toBe("landed");
    expect(generateView).toHaveBeenCalledTimes(1);
  });

  /*
    ⚠ THE SHEET ROAD IS LEFT RETRYING, AND THIS IS THE ARM THAT SAYS SO. There
    the frame is the coordinator's settled panel — one promise per sheet — so a
    second attempt re-stores the SAME bytes and buys nothing. A store that fails
    once must still deliver the view, and still on one render per sheet.
  */
  it("⚠ CONTROL — on the SHEET road a store hiccup re-stores the same panel and buys nothing", async () => {
    let failedOnce = false;
    const storeImage = vi.fn(async () => {
      if (!failedOnce) {
        failedOnce = true;
        throw new Error("S3: the bucket did not answer");
      }
      const key = `casting-v2/casts/${OPERATION_ID}/views/${storedKeys.length}.png`;
      storedKeys.push(key);
      return { key, url: `https://cdn.example/${key}` };
    });

    const result = await buildCastPackage(deps({ storeImage }), input);

    expect(result.failed, "a free re-store was turned into a refunded view").toHaveLength(0);
    expect(rendersPerSheet()).toEqual({ body: 1, head: 1 });
  });
});

/**
 * ⚠ **CID'S PAID-RENDER CAP, COUNTED IN SUBMISSIONS RATHER THAN IN RENDER
 * CALLS — the condition his flat price rests on (card 1968, his word
 * 2026-10-08).**
 *
 * The card labels it required: *"at most 2 head-sheet and 2 body-sheet renders
 * per Sign, re-makes and arrival retries from one pool, or Cid's figure is
 * about 1,100."*
 *
 * ⚠ **AND THE ENGINE FIXTURE HERE ROUTES THROUGH THE REAL `withRetry`, WHICH
 * IS THE ONLY REASON THESE ARMS MEAN ANYTHING.** `deadSheetEngine` above calls
 * nothing but the thunk, so it records ONE `sheetCalls` row per `render()` and
 * can never see the third loop — and the third loop is where the multiplying
 * happens. Production's sheet engine is
 * `queue.run(… withRetry("fal.signSheet", () => runFalImageJob(…)))`, so one
 * `editWithReferences` is up to THREE submissions. This fixture has the same
 * shape and counts attempts, so the number it reports is the number of jobs fal
 * would have been sent and could have billed for.
 */
describe("the Sign's paid renders are capped per sheet", () => {
  /** Submissions — one per job the provider would have been sent. */
  const submissions: SignSheetKind[] = [];

  /**
   * Production's shape: the retrying loop lives INSIDE the engine, under the
   * budget the request carries.
   */
  function retryingSheetEngine(makeError: () => unknown) {
    return (kind: SignSheetKind) => ({
      id: `test-sheet-${kind}`,
      editWithReferences: vi.fn(async (request: {
        prompt: string;
        references: unknown[];
        renderBudget?: RenderBudget;
      }) => {
        sheetCalls.push({
          kind,
          prompt: request.prompt,
          references: (request.references as Array<{ bytes: Buffer; contentType: string }>).map(
            (reference) => ({ bytes: reference.bytes.toString(), contentType: reference.contentType }),
          ),
        });
        return withRetry(
          "fal.signSheet",
          async () => {
            submissions.push(kind);
            throw makeError();
          },
          {
            retries: 2,
            baseDelayMs: 0,
            ...(request.renderBudget ? { budget: request.renderBudget } : {}),
          },
        );
      }),
      generateView: vi.fn(),
    });
  }

  const submissionsPerSheet = () =>
    Object.fromEntries(
      signSheetPlan().map((plan) => [
        plan.kind,
        submissions.filter((kind) => kind === plan.kind).length,
      ]),
    ) as Record<SignSheetKind, number>;

  beforeEach(() => {
    submissions.length = 0;
  });

  it("THE CAP — a sheet that keeps hitting the deadline costs two renders, not eighteen", async () => {
    /*
      ⚠ **THE DEADLINE IS THE ONE FAULT THAT CAN BILL WITHOUT SAYING SO**, and
      it is why reading the three existing guards was not enough to discharge
      this condition. `falTransport` cancels on the deadline and sets
      `completed` only when fal answers 400 ALREADY_COMPLETED; its own note
      records that whether a cancel stops a job already IN_PROGRESS is
      unverified. `timeout` is retryable and is not arrival-terminal, so before
      this cap all three loops ran: withRetry 3 x arrival 3 x re-make 2 = 18
      submissions on one sheet, every one of them possibly billed, under a flat
      price that paid for two.
    */
    const result = await buildCastPackage(
      deps({
        signSheetEngine: retryingSheetEngine(() =>
          new ProviderError("timeout", "fal.ai did not complete within the deadline", {
            providerRef: "req-deadline",
            completed: false,
          })),
      }),
      input,
    );

    expect(submissionsPerSheet()).toEqual({ body: SHEET_MAX_RENDERS, head: SHEET_MAX_RENDERS });

    /* And the customer is not left charged for nothing: nothing was delivered,
       so the whole flat charge goes back under the one idempotent reference. */
    expect(result.totalLoss).toBe(true);
    expect(result.committed).toHaveLength(0);
    expect(refunds).toEqual([
      { amount: SIGN_PRICE, reference: packagePromotionChargeReference(input.operationId) },
    ]);
  });

  it("THE CONTROL — a fault that never reached the provider keeps its free retries", async () => {
    /*
      ⚠ **Without this arm the one above is satisfied by any change that simply
      breaks the arrival retry.** Cid's note asks for the distinction in as many
      words: *"a transport failure that returned no frame is usually not billed
      by the provider. Say on the PR which attempts actually cost money, and
      count those."* An unreachable host is the free case, so its rescue is
      untouched and it spends none of the budget.
    */
    await buildCastPackage(
      deps({ signSheetEngine: retryingSheetEngine(() => new ProviderError("transport", "fal.ai unreachable")) }),
      input,
    );

    /* Three withRetry attempts x three arrival attempts, charged nothing. */
    const perSheet = submissionsPerSheet();
    expect(perSheet.head).toBeGreaterThan(SHEET_MAX_RENDERS);
    expect(perSheet).toEqual({ body: 9, head: 9 });
  });

  it("the re-make and the arrival retries draw on ONE pool, not two", async () => {
    /*
      The money shape the card names: a first generation that spent both its
      renders cannot then buy a house re-make. The first submission DELIVERS a
      sheet the judge refuses — so the re-make is wanted — and the second
      hits the deadline, which leaves the pool empty. The re-make must refuse
      before it submits, and the sheet settles from the frame we have.
    */
    let calls = 0;
    const signSheetEngine = (kind: SignSheetKind) => ({
      id: `test-sheet-${kind}`,
      editWithReferences: vi.fn(async (request: {
        prompt: string;
        references: unknown[];
        renderBudget?: RenderBudget;
      }) => withRetry(
        "fal.signSheet",
        async () => {
          submissions.push(kind);
          calls += 1;
          if (calls > 1) {
            throw new ProviderError("timeout", "deadline", {
              providerRef: `req-${calls}`,
              completed: false,
            });
          }
          return defaultSheetEngine(kind).editWithReferences(request as never);
        },
        {
          retries: 2,
          baseDelayMs: 0,
          ...(request.renderBudget ? { budget: request.renderBudget } : {}),
        },
      )),
      generateView: vi.fn(),
    });

    await buildCastPackage(
      deps({
        signSheetEngine,
        judge: () => vi.fn(async () => fail),
      }),
      input,
    );

    /*
      Two per sheet and no more — the delivered frame plus one deadline. The
      pool is the cap whichever road spends it.
    */
    for (const count of Object.values(submissionsPerSheet())) {
      expect(count).toBeLessThanOrEqual(SHEET_MAX_RENDERS);
    }
  });
});

/*
  #2125 — THE TWO LOG LINES A READER OF CAST 71's SIGN MET FIRST, AND BOTH LIED.

  The face sheet came back `content_policy` and every one of its three views
  logged `failureClass: "unknown"`, because the settled sheet reaches the
  per-view catch wrapped in `SignSheetUnavailableError`. And the package line
  said *"failed views refunded their slices"* beside `refundedCredits: 0` —
  false since #1968 made the Sign one flat charge. These arms read the lines a
  real build writes, through the real coordinator, not a constant.
*/
describe("⚠ the logs tell the truth about a sheet that did not arrive (#2125)", () => {
  const viewFailureLines = () => loggedWarnings
    .filter(([, message]) => message === "[packageOrchestrator] view generation failed")
    .map(([fields]) => fields as { angle: string; failureClass: unknown });

  it("logs the provider's own class on every view of a refused sheet", async () => {
    loggedWarnings.length = 0;
    const signSheetEngine = (kind: SignSheetKind) => (
      kind === "head"
        ? deadSheetEngine(() => new ProviderError("content_policy", "flagged by a content checker"))(kind)
        : defaultSheetEngine(kind)
    );
    const result = await buildCastPackage(deps({ signSheetEngine }), input);

    expect(result.failed.sort()).toEqual(["closeUp", "sideClose", "threeQuarter"]);
    const lines = viewFailureLines();
    expect(lines.map((line) => line.angle).sort()).toEqual(["closeUp", "sideClose", "threeQuarter"]);
    for (const line of lines) expect(line.failureClass, line.angle).toBe("content_policy");
  });

  it("logs null — not a made-up class — when the sheet ARRIVED and a later step failed", async () => {
    /* The negative control: a frame that came back and would not cut has no
       provider class, and the line must not borrow one. */
    loggedWarnings.length = 0;
    const arrivedUnusable = (kind: SignSheetKind) => ({
      id: `test-sheet-${kind}`,
      editWithReferences: vi.fn(async () => ({
        bytes: Buffer.from("this is not a png"),
        contentType: "image/png",
        latencyMs: 1,
        provenance: { provider: "fal" as const, model: `sunburst-sheet-${kind}` },
      })),
      generateView: vi.fn(),
    });
    await buildCastPackage(deps({ signSheetEngine: arrivedUnusable }), input);

    const lines = viewFailureLines();
    expect(lines).toHaveLength(5);
    for (const line of lines) expect(line.failureClass, line.angle).toBeNull();
  });

  it("never says a partial Sign refunded anything it did not", async () => {
    loggedWarnings.length = 0;
    const signSheetEngine = (kind: SignSheetKind) => (
      kind === "head"
        ? deadSheetEngine(() => new ProviderError("provider_account", "402 no funds"))(kind)
        : defaultSheetEngine(kind)
    );
    const result = await buildCastPackage(deps({ signSheetEngine }), input);

    expect(result.refundedCredits).toBe(0);
    const incomplete = loggedWarnings.filter(([, message]) =>
      typeof message === "string" && message.includes("package incomplete"));
    expect(incomplete).toHaveLength(1);
    const [fields, message] = incomplete[0] as [Record<string, unknown>, string];
    expect(message).not.toMatch(/refund/i);
    expect(fields).toMatchObject({ delivered: 2, refundedCredits: 0 });
    /* And nothing anywhere on this build claims a refund happened. */
    for (const [, line] of loggedWarnings) {
      if (typeof line === "string") expect(line).not.toMatch(/refunded their slices|this slice refunds/);
    }
  });
});

/*
  #2127 — A SHEET THE PROVIDER REFUSES IS RETRIED ONCE FOR FREE, AND THE VIEWS
  STILL MISSING ARE REFUNDED. His word, 2026-10-09 (terminal), verbatim: *"im
  happy with your reccomendation on the sheet refunding etc"*.

  Driven on each money outcome the card names — the retry delivers; the retry
  is refused again; a sheet lost any OTHER way is unchanged — plus the total
  loss (never paid twice) and the render budget (the retry cannot loop).
*/
describe("⚠ a refused sheet: one free retry, then its views are refunded (#2127)", () => {
  /* The unit, derived from the charge and the promise and never typed:
     3,250 ledger over five views is 650 each today. */
  const share = refusedSheetViewRefund({
    chargedCredits: SIGN_PRICE,
    promisedViews: CAST_PACKAGE_VIEWS.length,
  });
  const HEAD_VIEWS = ["closeUp", "sideClose", "threeQuarter"];

  /** A head sheet the provider refuses `refusals` times, then draws. */
  function refusingHead(refusals: number) {
    let calls = 0;
    return (kind: SignSheetKind) => {
      if (kind !== "head") return defaultSheetEngine(kind);
      const delivering = defaultSheetEngine(kind);
      return {
        ...delivering,
        editWithReferences: vi.fn(async (request: { prompt: string; references: unknown[] }) => {
          calls += 1;
          if (calls <= refusals) {
            sheetCalls.push({ kind, prompt: request.prompt, references: [] });
            throw new ProviderError("content_policy", "flagged by a content checker", { completed: true });
          }
          return delivering.editWithReferences(request);
        }),
      };
    };
  }

  it("is in the units his card states: one fifth of the Sign per view", () => {
    expect(share * CAST_PACKAGE_VIEWS.length).toBe(SIGN_PRICE);
    expect(share).toBeGreaterThan(0);
  });

  it("THE RETRY DELIVERS — every view arrives, the head sheet cost two renders, nothing is refunded", async () => {
    const result = await buildCastPackage(deps({ signSheetEngine: refusingHead(1) }), input);

    expect(rendersPerSheet()).toEqual({ head: 2, body: 1 });
    expect(waitedMs, "the free retry is not spaced").toEqual([]);
    expect(result.failed).toEqual([]);
    expect([...committed].sort()).toEqual([...CAST_PACKAGE_VIEWS].sort());
    expect(refunds).toEqual([]);
    expect(result.refundedCredits).toBe(0);
  });

  it("REFUSED AGAIN — that sheet's three views are refunded one share each, the body's views stand", async () => {
    const result = await buildCastPackage(deps({ signSheetEngine: refusingHead(2) }), input);

    expect(rendersPerSheet(), "one free retry, never a third").toEqual({ head: 2, body: 1 });
    expect([...result.failed].sort()).toEqual(HEAD_VIEWS);
    expect([...committed].sort()).toEqual(["backFull", "frontFull"]);
    /* Under each view's own slot reference — the key the recovery sweep
       already sums, so a later total-loss settle can never pay it twice. */
    expect([...refunds].sort((a, b) => a.reference.localeCompare(b.reference))).toEqual(
      HEAD_VIEWS.map((angle) => ({
        amount: share,
        reference: packageSlotChargeReference(OPERATION_ID, angle as never),
      })).sort((a, b) => a.reference.localeCompare(b.reference)),
    );
    expect(result.refundedCredits).toBe(share * HEAD_VIEWS.length);
    expect(result.totalLoss).toBe(false);
    /* And the marker the room reads says what recorded. */
    for (const failure of failures) {
      const marker = failure.failure as { refunded: number; refundReference?: string };
      expect(marker.refunded, String(failure.angle)).toBe(share);
      expect(marker.refundReference).toMatch(/:slot:/);
    }
  });

  it("A SHEET LOST ANY OTHER WAY IS UNCHANGED — no retry for a refusal it never had, and nothing comes back", async () => {
    const signSheetEngine = (kind: SignSheetKind) => (
      kind === "head"
        ? deadSheetEngine(() => new ProviderError("provider_account", "402 no funds"))(kind)
        : defaultSheetEngine(kind)
    );
    const result = await buildCastPackage(deps({ signSheetEngine }), input);

    expect(rendersPerSheet()).toEqual({ head: 1, body: 1 });
    expect([...result.failed].sort()).toEqual(HEAD_VIEWS);
    expect(refunds).toEqual([]);
    for (const failure of failures) {
      const marker = failure.failure as { refunded: number; refundReference?: string };
      expect(marker.refunded).toBe(0);
      expect(marker.refundReference).toBeUndefined();
    }
  });

  it("A VIEW THE JUDGE TOOK AWAY IS UNCHANGED — its sheet arrived, so the flat rule holds", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "closeUp" ? fail : pass);
    const result = await buildCastPackage(deps({ judge }), input);

    expect(result.failed).toEqual(["closeUp"]);
    expect(refunds).toEqual([]);
  });

  it("BOTH SHEETS REFUSED TWICE — the whole charge comes back exactly once, shares and remainder together", async () => {
    const result = await buildCastPackage(
      deps({ signSheetEngine: deadSheetEngine(() => new ProviderError("content_policy", "refused", { completed: true })) }),
      input,
    );

    expect(result.totalLoss).toBe(true);
    const paid = refunds.reduce((sum, entry) => sum + entry.amount, 0);
    expect(paid, "never more than was charged").toBe(SIGN_PRICE);
    expect(result.refundedCredits).toBe(SIGN_PRICE);
  });

  it("THE RETRY SPENDS INSIDE THE SHEET'S RENDER BUDGET — a spent budget refuses it, and the views are still refunded", async () => {
    /*
      Production's shape: the retrying loop and the budget live inside the
      engine. The head sheet's first render bills a deadline AND a refusal
      (two submissions = the whole budget of SHEET_MAX_RENDERS), so the free
      retry is refused BEFORE it submits. The sheet's last error is then the
      budget's, not the provider's — and the views must still be refunded,
      because the provider DID refuse that sheet.
    */
    const submissions: SignSheetKind[] = [];
    const signSheetEngine = (kind: SignSheetKind) => {
      if (kind !== "head") return defaultSheetEngine(kind);
      let submitted = 0;
      return {
        id: `test-sheet-${kind}`,
        editWithReferences: vi.fn(async (request: { prompt: string; references: unknown[]; renderBudget?: RenderBudget }) => {
          sheetCalls.push({ kind, prompt: request.prompt, references: [] });
          return withRetry(
            "fal.signSheet",
            async () => {
              submissions.push(kind);
              submitted += 1;
              if (submitted === 1) {
                throw new ProviderError("timeout", "deadline", { providerRef: "req-deadline", completed: false });
              }
              throw new ProviderError("content_policy", "flagged", { completed: true });
            },
            { retries: 2, baseDelayMs: 0, ...(request.renderBudget ? { budget: request.renderBudget } : {}) },
          );
        }),
        generateView: vi.fn(),
      };
    };
    const result = await buildCastPackage(deps({ signSheetEngine }), input);

    expect(rendersPerSheet().head, "the free retry WAS asked for").toBe(2);
    expect(submissions.length, "and refused before it submitted: the cap holds").toBe(SHEET_MAX_RENDERS);
    expect([...result.failed].sort()).toEqual(HEAD_VIEWS);
    expect(refunds.reduce((sum, entry) => sum + entry.amount, 0)).toBe(share * HEAD_VIEWS.length);
  });
});
