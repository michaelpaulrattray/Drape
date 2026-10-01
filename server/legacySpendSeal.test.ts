/**
 * THE LEGACY LANE'S PAID PROCEDURES REFUSE A CUSTOMER *BEFORE* ANY DEDUCTION
 * (#1654 — his word, 2026-10-01: *"i agree with your reccs."*).
 *
 * The legacy studio PAGE has been admin-only since #364; its API was not. Three
 * procedures deduct credits and render through `aiService` → `geminiGeneration`
 * / `geminiViews`, which point at `gemini-3-pro-image-preview` — shut down by
 * Google on 2026-06-25 (`shared/vendorModelStatus.ts`). Any approved account
 * could spend on a call that cannot succeed.
 *
 * ⚠ THESE ARMS DRIVE THE REAL ROUTERS, NOT A REBUILT MIDDLEWARE CHAIN.
 * `server/approvalGate.test.ts` reconstructs the chain and says so, pinning the
 * composition with source reads — a fair design for a rule about the chain
 * itself. This card's claim is about three NAMED procedures, so the thing to
 * drive is those procedures: a caller is built on the real `castingImagingRouter`,
 * `castingRefinementRouter` and `castingExportRouter`, and the refusal comes out
 * of the real `adminProcedure` in `server/_core/trpc.ts`.
 *
 * ⚠ AND "BEFORE ANY DEDUCTION" IS PROVEN BY SPYING ON THE MONEY, NOT INFERRED
 * FROM THE ORDER OF THE SOURCE. `deductCredits` and `withAtomicCredits` are
 * mocked and must be called ZERO times on every refusal. A refusal that arrived
 * after a charge would pass an arm that only read the thrown code.
 *
 * THE POSITIVE CONTROL IS THE HALF THAT MATTERS (law 2): an admin caller must
 * get PAST the gate. With no database, `getModelById` answers undefined and the
 * handler throws NOT_FOUND — a different code from the gate's FORBIDDEN, which
 * is exactly the observable that says the middleware let it through. An arm that
 * only proved refusal would also pass if the procedure were broken for everyone.
 */
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it, vi, beforeEach } from "vitest";

import { readListedSource } from "./testing/listedSource";
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

/* The last block walks `server/` for test sources — #741's derived population.
   Declared once per FILE, never on an arm, so the arm written beside it
   tomorrow inherits it. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/* `vi.hoisted` because `vi.mock`'s factory is hoisted above every `const`. */
const { deductCredits, withAtomicCredits, getModelById } = vi.hoisted(() => ({
  deductCredits: vi.fn(),
  withAtomicCredits: vi.fn(),
  getModelById: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deductCredits,
  getModelById,
  getGenerationOperationKindByRequest: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./casting/atomicCredits", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  withAtomicCredits,
}));

import { castingImagingRouter } from "./routes/generation/castingImaging";
import { castingRefinementRouter } from "./routes/generation/castingRefinement";
import { castingExportRouter } from "./routes/generation/castingExport";

type Role = "user" | "moderator" | "admin";

/** The shape `adminProcedure` reads: a user, its role, and no suspension. */
const ctxFor = (role: Role | null) => ({
  user:
    role === null
      ? null
      : {
          id: 42,
          role,
          email: `${role}@example.com`,
          openId: `open-${role}`,
          name: role,
          approved: true,
          suspendedAt: null,
          lockedUntil: null,
        },
  req: undefined,
  res: undefined,
}) as never;

/* A real v4 UUID: zod checks the version and variant nibbles, and an
   invalid one makes every positive control a BAD_REQUEST that never reaches
   the handler — which is how a weak positive control gets written. */
const REQUEST = "c0ffee00-dead-4bee-8cab-000000000001";

/** The three paid procedures, with an input each schema accepts. */
const SEALED = [
  {
    id: "generation.castingImage",
    call: (role: Role | null) =>
      castingImagingRouter.createCaller(ctxFor(role)).castingImage({
        clientRequestId: REQUEST,
        modelId: 1,
      }),
  },
  {
    id: "generation.iterate",
    call: (role: Role | null) =>
      castingRefinementRouter.createCaller(ctxFor(role)).iterate({
        clientRequestId: REQUEST,
        modelId: 1,
        feedback: "make the hair shorter",
        assetId: 1,
      } as never),
  },
  {
    id: "generation.mintPackage",
    call: (role: Role | null) =>
      castingExportRouter.createCaller(ctxFor(role)).mintPackage({
        clientRequestId: REQUEST,
        modelId: 1,
        tier: "draft",
      } as never),
  },
] as const;

beforeEach(() => {
  deductCredits.mockClear();
  withAtomicCredits.mockClear();
  /* No row anywhere, so a caller past the gate meets the handler's NOT_FOUND. */
  getModelById.mockReset();
  getModelById.mockResolvedValue(undefined);
});

describe("the legacy lane's paid procedures", () => {
  for (const { id, call } of SEALED) {
    it(`⚠ ${id} answers FORBIDDEN to an ordinary approved account, and spends nothing`, async () => {
      await expect(call("user")).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(deductCredits).not.toHaveBeenCalled();
      expect(withAtomicCredits).not.toHaveBeenCalled();
    });

    it(`${id} answers FORBIDDEN to a moderator too — staff is not admin here`, async () => {
      await expect(call("moderator")).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(deductCredits).not.toHaveBeenCalled();
      expect(withAtomicCredits).not.toHaveBeenCalled();
    });

    it(`${id} answers UNAUTHORIZED to an anonymous caller, not FORBIDDEN`, async () => {
      /* The distinction is the client's: UNAUTHORIZED sends you to sign in. */
      await expect(call(null)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(deductCredits).not.toHaveBeenCalled();
    });

    it(`⚠ POSITIVE CONTROL — ${id} lets an ADMIN past the gate`, async () => {
      /*
        Past the gate it meets `getModelById`, mocked to find nothing, so the
        handler's own NOT_FOUND is the proof of passage. FORBIDDEN here would
        mean the seal refuses everybody, which an arm reading only the refusal
        could never tell apart.
      */
      await expect(call("admin")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  }
});

describe("what is deliberately NOT sealed", () => {
  it("⚠ generation.refreshSlots still admits an ordinary account — the canvas reaches it", async () => {
    /*
      It is the fourth paid procedure and the only one a customer can reach
      (`features/boards/canvas/nodes/useSheetController.ts:137`). Sealing it
      removes a live feature, which is a product decision; #1654 carries the
      options. This arm is here so the omission is a DECISION on the record
      rather than something a later reader finds and assumes was missed — and
      so that whoever answers the question has to come through this file.
    */
    await expect(
      castingExportRouter.createCaller(ctxFor("user")).refreshSlots({
        clientRequestId: REQUEST,
        modelId: 1,
        angles: ["frontFull"],
      } as never),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("mintPackagePlan stays open — a price read that four live surfaces query and that spends nothing", async () => {
    await expect(
      castingExportRouter.createCaller(ctxFor("user")).mintPackagePlan({ modelId: 1 } as never),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(deductCredits).not.toHaveBeenCalled();
  });
});

/**
 * ⚠ THE FALSE-PASS CLASS THIS SEAL CREATES, AND IT BIT FOUR TIMES WHILE THE
 * SEAL WAS BEING WRITTEN.
 *
 * An arm that drives one of the three with an ordinary caller and asserts
 * FORBIDDEN now gets FORBIDDEN **from the gate**. Two real examples, both found
 * only because a wider sweep was run: the foreign-owner arms in
 * `server/batch0-authority.test.ts` and `server/casting/typedIterationDoors.test.ts`
 * assert the OWNERSHIP refusal (`model.userId !== ctx.user.id`), and they went
 * on passing while testing nothing at all. An admin whose id is not the owner's
 * still meets that refusal, which is why those arms now call as admins.
 *
 * ⚠ IT IS A FLOOR AND NOT COVERAGE, AND THE DOCBLOCK SAYS SO RATHER THAN THE
 * REPORT. It matches this repository's house idiom — an `authCtx(…)` helper
 * inside the `it`-block — because there is no DECLARATION of a test's role to
 * read; a context built any other way is invisible to it. What it would have
 * caught is all four of the misses above, which is the whole of its claim.
 */
const ROOT = resolve(import.meta.dirname, "..");
const SEALED_CALLS = [".castingImage(", ".iterate(", ".mintPackage("];

function armsDrivingASealedProcedureWithAnOrdinaryCaller(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      /* A listed entry can be gone before it is classified (#223), and this
         tree carries hundreds of untracked disposables that come and go. */
      const stats = statSync(full, { throwIfNoEntry: false });
      if (!stats) continue;
      if (stats.isDirectory()) {
        walk(full);
        continue;
      }
      if (!full.endsWith(".test.ts")) continue;
      /* ⚠ This file is EXCLUDED, and it is the file that declares the rule.
         It necessarily contains every literal the reader matches — in the
         docblock, in `SEALED_CALLS`, and in the positive control's fixture —
         and the naive arm-slicing below swept that module-level code into the
         nearest `it(` block, flagging two of its own arms on the first run.
         Nothing is lost: the four procedures this file is about are DRIVEN
         above rather than read as text. */
      if (full.endsWith("legacySpendSeal.test.ts")) continue;
      const source = readListedSource(full);
      if (source === null) continue;
      if (!source.includes("authCtx(")) continue;

      const lines = source.split("\n");
      const opensAnArm = (line: string) =>
        line.trim().startsWith("it(") || line.trim().startsWith("it.each(");
      for (let i = 0; i < lines.length; i += 1) {
        if (!opensAnArm(lines[i])) continue;
        let j = i + 1;
        while (j < lines.length && !opensAnArm(lines[j])) j += 1;
        const body = lines.slice(i, j);
        const text = body.join("\n");
        if (!SEALED_CALLS.some((call) => text.includes(call))) continue;
        const callers = body.filter((line) => line.includes("authCtx("));
        if (callers.length === 0) continue;
        if (callers.every((line) => line.includes('"admin"'))) continue;
        const rel = full.split("\\").join("/").slice(ROOT.split("\\").join("/").length + 1);
        found.push(`${rel}:${i + 1} — ${lines[i].trim().slice(0, 90)}`);
      }
    }
  };
  walk(resolve(ROOT, "server"));
  return found.sort();
}

describe("no arm drives a sealed procedure as an ordinary account by accident", () => {
  it("⚠ the tree holds none — a FLOOR, read at the test sources", () => {
    expect(armsDrivingASealedProcedureWithAnOrdinaryCaller()).toEqual([]);
  });

  it("⚠ POSITIVE CONTROL — the reader finds the shape when it is there", () => {
    /*
      A guard whose only arm is "the tree is clean" is a guard that cannot be
      shown to work (law 2). This drives the matcher's own rule over a fixture
      of the exact shape it exists to catch, and over the corrected shape
      beside it.
    */
    const offending = [
      '  it("foreign owner: FORBIDDEN, nothing charged", async () => {',
      "    const caller = appRouter.createCaller(authCtx(1));",
      "    await expect(caller.generation.iterate({ modelId: 7 })).rejects.toMatchObject({ code: \"FORBIDDEN\" });",
      "  });",
    ].join("\n");
    const corrected = offending.replace("authCtx(1)", 'authCtx(1, "admin")');

    const matches = (source: string) => {
      const lines = source.split("\n");
      const body = lines.slice(0);
      const text = body.join("\n");
      const drivesSealed = SEALED_CALLS.some((call) => text.includes(call));
      const callers = body.filter((line) => line.includes("authCtx("));
      return drivesSealed && callers.length > 0 && !callers.every((line) => line.includes('"admin"'));
    };

    expect(matches(offending)).toBe(true);
    expect(matches(corrected)).toBe(false);
  });
});
