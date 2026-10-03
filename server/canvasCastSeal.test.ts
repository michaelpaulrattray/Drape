/**
 * THE CANVAS'S PAID CASTING ROADS REFUSE A CUSTOMER *BEFORE* ANY DEDUCTION
 * (#1785 — his word, 2026-10-03: *"1758) seal."*).
 *
 * Three procedures in `server/routes/boardOps.ts` declare
 * `plannedCredits: CREDIT_COSTS.castingImage` and render through
 * `generateCastingImage`, whose primary id AND whose entire fallback chain were
 * shut down by Google on 2026-06-25 (`shared/vendorModelStatus.ts`). The one a
 * customer actually meets is the **Refresh** button an out-of-sync cast node
 * draws: 70 display credits for a render that cannot land.
 *
 * ⚠ **THESE ARMS DRIVE THE REAL ROUTER.** The claim is about three named
 * procedures, so the thing to drive is those procedures — the refusal comes out
 * of the real `boardOpsRouter` and the real `assertCanvasCastOpen`.
 *
 * ⚠ **"BEFORE ANY DEDUCTION" IS PROVEN BY SPYING ON THE MONEY, NOT INFERRED
 * FROM THE ORDER OF THE SOURCE.** `deductCredits` and `withAtomicCredits` are
 * mocked and must be called ZERO times on every refusal. A refusal that arrived
 * after a charge would pass an arm that only read the thrown code — and a door
 * that bills and then refunds is the defect #1785 measured, not its fix.
 *
 * # The two positive controls, and the second is the one that matters (law 2)
 *
 * 1. **The free fork road must get PAST the door**, because it lives in the
 *    SAME handler as the sealed recast (`applyModelEdit.execute`,
 *    `decision: "fork"`, `plannedCredits: 0`, no engine). An arm that only
 *    proved refusal would pass just as happily if the gate had been put at that
 *    handler's mouth and closed a free road that works.
 * 2. **With `CANVAS_CAST_OPEN` flipped, the same calls must get past.** The
 *    door is a compiled constant, so a suite that never flips it cannot tell a
 *    working gate from a procedure that is broken for everybody — which is the
 *    shape of every instrument this repository has been bitten by. That arm
 *    re-imports the module graph under `vi.doMock` and asserts the calls then
 *    fail for a DIFFERENT, downstream reason.
 *
 * # And the last block is the instrument the card actually asked for
 *
 * #1785's own diagnosis was not "one road was unsealed", it was: ***"A list
 * that is one entry short reads exactly like a list that is complete."***
 * `WIRED_DESPITE_SHUTDOWN` named `refreshSlots` and not `boardOps`, and nothing
 * could tell. So the final arms do not read `CANVAS_CAST_CLOSED_PROCEDURES` and
 * trust it — they DERIVE the paid population from the router's own
 * `plannedCredits:` lines and from the pipeline's own `generateCastingImage`
 * call sites, and redden when a paid entrance or an engine-reaching function
 * has no gate. Each carries a positive control that feeds the reader a
 * synthetic ungated source, because a reader that cannot find the defect on
 * purpose proves nothing by not finding it by accident.
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi, beforeEach } from "vitest";

import { readListedSource } from "./testing/listedSource";
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

/* Declared once per FILE, never on an arm, so an arm written beside it
   tomorrow inherits it (#741's derived-population shape). */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/* `vi.hoisted` because `vi.mock`'s factory is hoisted above every `const`. */
const {
  deductCredits,
  withAtomicCredits,
  getBoardById,
  getBoardItemById,
  resolveModelBackedBoardOperation,
} = vi.hoisted(() => ({
  deductCredits: vi.fn(),
  withAtomicCredits: vi.fn(),
  getBoardById: vi.fn(),
  getBoardItemById: vi.fn(),
  resolveModelBackedBoardOperation: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deductCredits,
  getBoardById,
  getBoardItemById,
  getGenerationOperationKindByRequest: vi.fn().mockResolvedValue(undefined),
}));

/* ⚠ OWNERSHIP IS MOCKED TO *SUCCEED*, AND THE FIRST DRAFT OF THIS FILE DID THE
   OPPOSITE — WHICH IS WHY THIS COMMENT EXISTS. With no board in the mock, all
   three arms for `applyModelEdit.execute` read `NOT_FOUND: Board not found`
   and were asserting nothing about the door at all: that procedure gates
   AFTER ownership resolution on purpose (its free `fork` branch has to stay
   reachable), so a missing board fires before the door is ever consulted.
   Two of the three procedures were proven and the third was silently
   untested. Granting ownership is what makes the recast door drivable. */
vi.mock("./lib/boardOps", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveModelBackedBoardOperation,
}));

vi.mock("./casting/atomicCredits", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  withAtomicCredits,
}));

import { boardOpsRouter } from "./routes/boardOps";
import {
  CANVAS_CAST_CLOSED,
  CANVAS_CAST_CLOSED_CODE,
  CANVAS_CAST_CLOSED_PROCEDURES,
  CANVAS_CAST_OPEN,
} from "@shared/canvasCastDoor";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** An approved, unsuspended ordinary account — the one the card is about. */
const ctx = {
  user: {
    id: 42,
    role: "user",
    email: "user@example.com",
    openId: "open-user",
    name: "user",
    approved: true,
    suspendedAt: null,
    lockedUntil: null,
  },
  req: undefined,
  res: undefined,
} as never;

/* A real v4 UUID: zod checks the version and variant nibbles, and an invalid
   one makes every arm a BAD_REQUEST that never reaches the handler — which is
   how a weak positive control gets written. */
const REQUEST = "c0ffee00-dead-4bee-8cab-000000000002";

type Caller = {
  id: string;
  /** True when the door is this handler's FIRST statement. False for
   *  `applyModelEdit.execute`, whose free fork branch sits above it. */
  mouth: boolean;
  call: () => Promise<unknown>;
};

/** The three paid canvas asks, with an input each schema accepts. */
function sealedCalls(router: typeof boardOpsRouter): Caller[] {
  return [
    {
      id: "boardOps.runGeneration.execute",
      mouth: true,
      call: () =>
        router.createCaller(ctx).runGeneration.execute({
          clientRequestId: REQUEST,
          boardId: 1,
          itemId: 1,
          userPrompt: "a weathered sailor",
        } as never),
    },
    {
      id: "boardOps.applyModelEdit.execute",
      mouth: false,
      call: () =>
        router.createCaller(ctx).applyModelEdit.execute({
          clientRequestId: REQUEST,
          boardId: 1,
          itemId: 1,
          decision: "update",
          changes: {},
        } as never),
    },
    {
      id: "boardOps.runVariations.execute",
      mouth: true,
      call: () =>
        router.createCaller(ctx).runVariations.execute({
          clientRequestId: REQUEST,
          boardId: 1,
          itemId: 1,
          count: 2,
        } as never),
    },
  ];
}

/** The door's refusal, told apart from any other failure by its own code. */
async function doorRefusalOf(call: () => Promise<unknown>): Promise<string | null> {
  try {
    await call();
    return "RESOLVED — the call did not throw at all";
  } catch (error) {
    const e = error as { code?: string; message?: string; cause?: { message?: string } };
    if (e?.cause?.message === CANVAS_CAST_CLOSED_CODE) return null;
    return `${e?.code ?? "no code"}: ${e?.message ?? String(error)}`;
  }
}

beforeEach(() => {
  deductCredits.mockClear();
  withAtomicCredits.mockClear();
  /* A board and a node this account really owns, with a model behind the node,
     so each of the three reaches its OWN door instead of dying on a missing
     row. Anything past a door then fails further downstream — a different
     observable from the door's own code, which is what makes passage visible. */
  getBoardById.mockReset();
  getBoardById.mockResolvedValue({ id: 1, userId: 42, name: "board" });
  getBoardItemById.mockReset();
  getBoardItemById.mockResolvedValue({ id: 1, boardId: 1, deletedAt: null, metadata: {} });
  resolveModelBackedBoardOperation.mockReset();
  resolveModelBackedBoardOperation.mockResolvedValue({
    item: { id: 1, boardId: 1, deletedAt: null, metadata: {} },
    model: { id: 7, userId: 42, masterPrompt: "x", technicalSchema: {}, preferences: {} },
    provenance: { type: "cast" },
  });
});

describe("the canvas's paid casting roads", () => {
  it("the door is shut, which is the premise every arm below rests on", () => {
    expect(CANVAS_CAST_OPEN).toBe(false);
  });

  for (const { id, call, mouth } of sealedCalls(boardOpsRouter)) {
    it(`⚠ ${id} refuses an ordinary approved account, and spends nothing`, async () => {
      await expect(call()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(deductCredits).not.toHaveBeenCalled();
      expect(withAtomicCredits).not.toHaveBeenCalled();
    });

    it(`${id} carries the door's own sentence and machine code, not a generic failure`, async () => {
      /* The sentence is what a customer reads — PRECONDITION_FAILED is in
         `readableFailure`'s OURS set, so it reaches them as written. The code is
         what a branch may key on without matching prose. */
      expect(await doorRefusalOf(call)).toBeNull();
      await expect(call()).rejects.toMatchObject({ message: CANVAS_CAST_CLOSED });
    });

    it(`⚠ ${id} refuses ${mouth ? "at the MOUTH — the board is never even read" : "after ownership and before any charge — its free fork branch stays reachable"}`, async () => {
      /*
        ⚠ TWO SHAPES, STATED PER PROCEDURE RATHER THAN ASSERTED UNIFORMLY.
        `runGeneration` and `runVariations` gate at the first statement, so not
        even the board is read — the refusal costs nothing at all.
        `applyModelEdit` cannot: the same handler's `decision: "fork"` path is
        free and reaches no engine, so a mouth gate there would close a working
        road. Its door sits after ownership resolution and before
        `executeCanvasOperation` — still before any money moves, which is the
        claim that matters and is asserted here for both shapes.
      */
      expect(await doorRefusalOf(call)).toBeNull();
      if (mouth) expect(getBoardById).not.toHaveBeenCalled();
      else expect(getBoardById).toHaveBeenCalled();
      expect(deductCredits).not.toHaveBeenCalled();
      expect(withAtomicCredits).not.toHaveBeenCalled();
    });
  }

  it("the closed list names exactly the three procedures these arms drive", () => {
    expect([...CANVAS_CAST_CLOSED_PROCEDURES].sort()).toEqual(
      sealedCalls(boardOpsRouter)
        .map((c) => c.id)
        .sort(),
    );
  });
});

describe("⚠ POSITIVE CONTROLS — the gate is not a blanket, and it can let through", () => {
  it("the FREE fork road in the same handler gets PAST the door", async () => {
    /*
      `applyModelEdit.execute` with `decision: "fork"` declares
      `plannedCredits: 0`, copies a Cast through `forkEvidenceAwareCast`, and
      reaches no engine. It must therefore fail for some OTHER reason. If this
      ever returns null — the door's own code — the gate has been moved to the
      handler's mouth and a free, working road has been closed under this card's
      name, which is the "deletion wearing a door" the door file opens by
      refusing.
    */
    const outcome = await doorRefusalOf(() =>
      boardOpsRouter.createCaller(ctx).applyModelEdit.execute({
        clientRequestId: REQUEST,
        boardId: 1,
        itemId: 1,
        decision: "fork",
        changes: {},
      } as never),
    );
    expect(outcome).not.toBeNull();
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("the price-reading `plan` queries stay open — they spend nothing and reach no engine", async () => {
    /* #1654's own call, in its words: "Sealing a read to close a spend would
       take a working surface away for nothing." */
    const plans = [
      () => boardOpsRouter.createCaller(ctx).runGeneration.plan({ boardId: 1, itemId: 1 } as never),
      () => boardOpsRouter.createCaller(ctx).applyModelEdit.plan({ boardId: 1, itemId: 1 } as never),
      () =>
        boardOpsRouter
          .createCaller(ctx)
          .runVariations.plan({ boardId: 1, itemId: 1, count: 2 } as never),
    ];
    for (const plan of plans) {
      expect(await doorRefusalOf(plan)).not.toBeNull();
    }
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("⚠ WITH THE DOOR OPEN the same three calls get past it — a shut door is distinguishable from a broken procedure", async () => {
    /*
      THE control for a compiled constant. Without it this suite would pass
      unchanged if `assertCanvasCastOpen` threw unconditionally, or if all three
      procedures were broken for every caller for some unrelated reason.
    */
    vi.resetModules();
    vi.doMock("@shared/canvasCastDoor", async (importOriginal) => ({
      ...(await importOriginal<object>()),
      CANVAS_CAST_OPEN: true,
    }));
    try {
      const { boardOpsRouter: openRouter } = await import("./routes/boardOps");
      for (const { id, call } of sealedCalls(openRouter)) {
        expect(await doorRefusalOf(call), `${id} should be past the door`).not.toBeNull();
      }
    } finally {
      vi.doUnmock("@shared/canvasCastDoor");
      vi.resetModules();
    }
  });
});

/**
 * THE DERIVED HALF — #1785's actual diagnosis, turned into a reader.
 *
 * Neither reader below consults `CANVAS_CAST_CLOSED_PROCEDURES`. Each builds its
 * own population from the source that would carry a FOURTH entrance, so a paid
 * canvas ask added tomorrow without a gate reddens here rather than being
 * discovered by a customer's credit balance.
 */

/**
 * COMMENTS BLANKED, LINE NUMBERS KEPT — the one reader of *is this prose*,
 * shared by both scanners below (working law 4: a second copy of this would
 * drift, and the first draft of this file proved it by having two different
 * answers to the same question).
 *
 * ⚠ **IT EXISTS BECAUSE A PROSE FILTER THAT READS ONLY THE FIRST LINE OF A
 * BLOCK COMMENT IS NOT A PROSE FILTER.** The gate comments in
 * `server/routes/boardOps.ts` run several lines, and their CONTINUATION lines
 * say the words `plannedCredits: CREDIT_COSTS.castingImage` while starting with
 * an ordinary capital letter — so a `startsWith("*")` test skipped the opening
 * line and reported all three explanations as ungated paid entrances. Twice:
 * once with no filter, once with a filter that looked like one.
 *
 * Blanking rather than deleting keeps every reported line number honest, which
 * is the whole value of the report when it does fire.
 */
function withoutComments(source: string): string {
  let out = "";
  let inBlock = false;
  for (const line of source.split("\n")) {
    let kept = "";
    let i = 0;
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf("*/", i);
        if (end === -1) { i = line.length; break; }
        inBlock = false;
        i = end + 2;
        continue;
      }
      const open = line.indexOf("/*", i);
      const lineComment = line.indexOf("//", i);
      if (lineComment !== -1 && (open === -1 || lineComment < open)) {
        kept += line.slice(i, lineComment);
        i = line.length;
        break;
      }
      if (open === -1) { kept += line.slice(i); break; }
      kept += line.slice(i, open);
      inBlock = true;
      i = open + 2;
    }
    out += kept + "\n";
  }
  return out.slice(0, -1);
}
/**
 * Every non-zero `plannedCredits:` in a router source whose own handler does not
 * carry the door above it.
 */
function ungatedPaidEntrances(source: string): string[] {
  const lines = withoutComments(source).split("\n");
  const offenders: string[] = [];
  let insideHandler = false;
  let gateSinceHandler = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\.(mutation|query)\(async/.test(line)) {
      insideHandler = true;
      gateSinceHandler = false;
    }
    if (line.includes("assertCanvasCastOpen()")) gateSinceHandler = true;
    const paid = /plannedCredits:\s*(.+?),?\s*$/.exec(line);
    if (!paid) continue;
    const value = paid[1].replace(/,$/, "").trim();
    /* `0` is the free fork stating its own cost; `input.plannedCredits` and the
       `number;` type member belong to the shared helper, not to an ask. */
    if (value === "0" || value.startsWith("input.plannedCredits") || value === "number;") continue;
    if (!insideHandler || !gateSinceHandler) offenders.push(`line ${i + 1}: ${line.trim()}`);
  }
  return offenders;
}

/** Every function reaching the engine whose body does not carry the door. */
function ungatedEngineFunctions(source: string): string[] {
  const lines = withoutComments(source).split("\n");
  const offenders: string[] = [];
  let fnName: string | null = null;
  let gateSinceFn = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const decl = /^(?:export )?async function (\w+)/.exec(line);
    if (decl) {
      fnName = decl[1];
      gateSinceFn = false;
    }
    if (line.includes("assertCanvasCastOpen()")) gateSinceFn = true;
    /* A CALL. Comments are already gone, so no prose test is needed here. */
    if (/generateCastingImage(Raw)?\(/.test(line)) {
      if (fnName && !gateSinceFn) offenders.push(`${fnName} (line ${i + 1})`);
    }
  }
  return [...new Set(offenders)];
}

describe("no paid canvas entrance reaches the engine without the door", () => {
  it("⚠ the router holds no ungated paid ask — derived from its own plannedCredits lines", () => {
    const source = readListedSource(join(ROOT, "server", "routes", "boardOps.ts"));
    expect(source).not.toBeNull();
    expect(ungatedPaidEntrances(source as string)).toEqual([]);
  });

  it("⚠ POSITIVE CONTROL — the reader finds an ungated paid ask when one is there", () => {
    const planted = [
      "  somethingNew: router({",
      "    execute: protectedProcedure",
      "      .mutation(async ({ ctx, input }) => {",
      "        return executeCanvasOperation({",
      "          plannedCredits: CREDIT_COSTS.castingImage,",
      "        });",
      "      }),",
      "  }),",
    ].join("\n");
    expect(ungatedPaidEntrances(planted)).toHaveLength(1);
  });

  it("⚠ the pipeline holds no ungated engine call — derived from its own call sites", () => {
    const source = readListedSource(join(ROOT, "server", "lib", "boardOps.ts"));
    expect(source).not.toBeNull();
    expect(ungatedEngineFunctions(source as string)).toEqual([]);
  });

  it("⚠ POSITIVE CONTROL — the reader finds an ungated engine call when one is there", () => {
    const planted = [
      "export async function executeSomethingNew(input: Thing) {",
      "  const result = await generateCastingImage(prompt, options);",
      "  return result;",
      "}",
    ].join("\n");
    expect(ungatedEngineFunctions(planted)).toEqual(["executeSomethingNew (line 2)"]);
  });

  it("⚠ NEGATIVE CONTROLS — a gated function and a free ask are not reported", () => {
    const gated = [
      "export async function executeGated(input: Thing) {",
      "  assertCanvasCastOpen();",
      "  const result = await generateCastingImage(prompt, options);",
      "}",
    ].join("\n");
    expect(ungatedEngineFunctions(gated)).toEqual([]);

    /* ⚠ THE FALSE POSITIVE THIS READER ACTUALLY PRODUCED, TWICE, pinned in the
       exact shape that bit: the words sit on a CONTINUATION line of a block
       comment, starting with an ordinary capital letter. A filter that tests
       only the first line of a comment passes the first of these three and
       fails the second, which is how the second attempt still reported three. */
    const prose = [
      "      .mutation(async ({ ctx, input }) => {",
      "        /* ⚠ THE CANVAS CASTING DOOR — FIRST statement, so the refusal is FREE.",
      "           This handler declares `plannedCredits: CREDIT_COSTS.castingImage`, and a",
      "           door placed after the hold would bill and refund. */",
      "        assertCanvasCastOpen();",
      "      }),",
    ].join("\n");
    expect(ungatedPaidEntrances(prose)).toEqual([]);

    const free = [
      "      .mutation(async ({ ctx, input }) => {",
      "        const gate = await beginDirectOperation({",
      "          plannedCredits: 0,",
      "        });",
      "      }),",
    ].join("\n");
    expect(ungatedPaidEntrances(free)).toEqual([]);
  });
});

/**
 * THE CLIENT HALF — the canvas must not OFFER what the server refuses.
 *
 * The server arms above prove the refusal is free. These prove the customer
 * never reaches it by pressing something, which is the other half of the same
 * act and the half the door's own module names: *"What stops a customer being
 * quoted a price for a road they cannot walk is the canvas not drawing the
 * action, which is this door's client half."*
 *
 * ⚠ **THE WORST OUTCOME HERE IS NOT A CRASH, IT IS A QUOTE.** A sealed road
 * whose button still renders beside *"~560 credits"* tells a customer a price
 * for something they cannot buy, and the disappearing-technology law's clause 6
 * names exactly that: a control the customer must press to discover it does not
 * work is the machinery showing through. So the arm that matters most is the
 * derived one — no canvas surface may quote a cast price without consulting the
 * door.
 *
 * ⚠ **AND THE DERIVED ARM IS DERIVED FROM THE COMMENT-STRIPPED SOURCE, which is
 * not decoration: `CostLabel.tsx` names `estimatedCreditCost` in its header
 * prose and reads it nowhere.** Stripping is what excludes it, rather than a
 * hand-written exception list that would have to be maintained — and the
 * negative control below pins that, because an exclusion list is the shape this
 * repository has been bitten by (working law 4).
 */
const CANVAS_SURFACE_DIR = join(ROOT, "client", "src", "features", "boards", "canvas");

/**
 * The expression a named prop or object property is assigned, inside `slice`.
 *
 * ⚠ **THIS EXISTS BECAUSE THE FIRST DRAFT OF THESE ARMS WAS SATISFIED BY A
 * SIBLING, AND SABOTAGE IS THE ONLY REASON ANYONE KNOWS.** Four of ten cases
 * survived, and all four for ONE reason: the arms asked whether the door was
 * MENTIONED in a file or a slice, never whether the control CONSULTED it. Drop
 * `|| !CANVAS_CAST_OPEN` from the Variations row's `disabled:` and that row's
 * own `label:` three lines above still carries the words — so the slice matched,
 * and the suite stayed green over a pressable button on a sealed road. Reading
 * the governing expression is the repair, and it is the whole difference
 * between a guard and a word-count.
 *
 * Returns `null` when the property is absent, so a caller can tell *"the control
 * is not guarded"* from *"the control is gone"* — those want different repairs.
 */
function expressionFor(slice: string, name: string): string | null {
  const jsx = slice.indexOf(`${name}={`);
  const obj = new RegExp(`\\b${name}:\\s`).exec(slice);
  if (jsx !== -1 && (!obj || jsx < obj.index)) {
    let depth = 0;
    for (let i = jsx + name.length; i < slice.length; i++) {
      if (slice[i] === "{") depth++;
      else if (slice[i] === "}") {
        depth--;
        if (depth === 0) return slice.slice(jsx + name.length + 2, i);
      }
    }
    return null;
  }
  if (!obj) return null;
  let depth = 0;
  const from = obj.index + obj[0].length;
  for (let i = from; i < slice.length; i++) {
    const ch = slice[i];
    if ("{[(".includes(ch)) depth++;
    else if ("}])".includes(ch)) {
      if (depth === 0) return slice.slice(from, i);
      depth--;
    } else if (ch === "," && depth === 0) return slice.slice(from, i);
  }
  return null;
}

/**
 * A real `import … CANVAS_CAST_OPEN … from "@shared/canvasCastDoor"`.
 *
 * ⚠ Not `code.includes("CANVAS_CAST_OPEN")`, which was the first draft: deleting
 * the import line left every USE of the constant in place, so the file still
 * read as door-aware while no longer compiling. A guard that a broken build
 * satisfies is not reading what it claims to read.
 */
function importsTheDoor(code: string): boolean {
  return /import\s*\{[^}]*\bCANVAS_CAST_OPEN\b[^}]*\}\s*from\s*["']@shared\/canvasCastDoor["']/.test(code);
}

/** Canvas surfaces that READ a plan's credit cost without consulting the door. */
function surfacesQuotingAPriceWithoutTheDoor(
  sources: ReadonlyMap<string, string>,
): string[] {
  const offenders: string[] = [];
  for (const [name, raw] of sources) {
    const code = withoutComments(raw);
    if (!/\.estimatedCreditCost\b/.test(code)) continue;
    if (!code.includes("CANVAS_CAST_OPEN")) offenders.push(name);
  }
  return offenders.sort();
}

describe("the canvas does not OFFER what the server refuses", () => {
  const read = (file: string) => {
    const source = readListedSource(join(CANVAS_SURFACE_DIR, file));
    expect(source, `${file} is unreadable — the arm below would pass on nothing`).not.toBeNull();
    return withoutComments(source as string);
  };

  it("⚠ no canvas surface quotes a cast price without consulting the door — derived", () => {
    const sources = new Map(
      ["CostLabel.tsx", "ForkRecastPopover.tsx", "VariationsPopover.tsx"].map((f) => [
        f,
        readListedSource(join(CANVAS_SURFACE_DIR, f)) as string,
      ]),
    );
    for (const [name, source] of sources) {
      expect(source, `${name} is unreadable`).not.toBeNull();
    }
    expect(surfacesQuotingAPriceWithoutTheDoor(sources)).toEqual([]);
  });

  it("⚠ each price-quoting surface IMPORTS the door — a mention is not a wire", () => {
    for (const file of ["ForkRecastPopover.tsx", "VariationsPopover.tsx", join("nodes", "CastNode.tsx")]) {
      expect(importsTheDoor(read(file)), `${file} uses the door's name without importing it`).toBe(true);
    }
  });

  it("⚠ POSITIVE CONTROL — `importsTheDoor` is not satisfied by a bare mention", () => {
    expect(importsTheDoor('const x = CANVAS_CAST_OPEN ? 1 : 2;')).toBe(false);
    expect(importsTheDoor('import { CANVAS_CAST_OPEN } from "@shared/canvasCastDoor";')).toBe(true);
    /* The real shape in two of the three files — a second symbol beside it. */
    expect(
      importsTheDoor('import { CANVAS_CAST_OPEN, CANVAS_CAST_CLOSED } from "@shared/canvasCastDoor";'),
    ).toBe(true);
  });

  it("⚠ the Variations popover neither prices nor offers the road while the door is shut", () => {
    const code = read("VariationsPopover.tsx");

    /* The Generate button's OWN `disabled` expression — not the file's and not
       a neighbour's. Anchored on the button's label, sliced BACK to its own
       `<button`, and the anchor is proven unique first: `expressionFor`'s
       docblock carries why that distinction is the whole arm. */
    const label = code.indexOf("onGenerate(count");
    expect(label, "the Generate button is gone — this arm has no subject").toBeGreaterThan(-1);
    expect(code.indexOf("onGenerate(count", label + 1), "two Generate buttons — the slice is ambiguous").toBe(-1);
    const generate = code.slice(code.lastIndexOf("<button", label), label);
    const disabled = expressionFor(generate, "disabled");
    expect(disabled, "the Generate button has no `disabled` expression at all").not.toBeNull();
    expect(disabled as string, "Generate is pressable without consulting the door").toContain(
      "CANVAS_CAST_OPEN",
    );

    /* And the price itself: the expression that renders the total must consult
       the door, or a sealed road is quoted a cost. */
    const read_ = code.indexOf("estimatedCreditCost");
    expect(read_, "the footer total is gone — this arm has no subject").toBeGreaterThan(-1);
    expect(
      code.indexOf("estimatedCreditCost", read_ + 1),
      "the price is read twice — the slice below is ambiguous",
    ).toBe(-1);
    /* ⚠ The enclosing `<span>`, anchored on the READ rather than on a class
       name: `tabular-nums` sits on the count stepper too, so the first draft
       sliced the wrong element and asserted nothing about the price at all. */
    const price = code.slice(code.lastIndexOf("<span", read_), code.indexOf("</span>", read_));
    expect(price).toContain("estimatedCreditCost");
    expect(price, "the total is rendered without consulting the door").toContain("CANVAS_CAST_OPEN");
  });

  it("⚠ POSITIVE CONTROL — the reader names a surface that quotes a price and ignores the door", () => {
    const planted = new Map([
      ["Planted.tsx", "const cost = plan.estimatedCreditCost;\nreturn <CostLabel credits={cost} />;"],
    ]);
    expect(surfacesQuotingAPriceWithoutTheDoor(planted)).toEqual(["Planted.tsx"]);
  });

  it("⚠ NEGATIVE CONTROLS — a door-consulting surface, and a surface that only NAMES the field in prose", () => {
    const guarded = new Map([
      ["Guarded.tsx", "import { CANVAS_CAST_OPEN } from '@shared/canvasCastDoor';\nconst c = plan.estimatedCreditCost;"],
    ]);
    expect(surfacesQuotingAPriceWithoutTheDoor(guarded)).toEqual([]);

    /* ⚠ `CostLabel.tsx`'s real shape: the field is named in the header comment
       and read nowhere. A reader that did not strip comments would demand a
       door import in a component that cannot quote anything. */
    const proseOnly = new Map([
      ["CostLabelLike.tsx", "/**\n * `credits` always comes from a plan (`estimatedCreditCost`).\n */\nexport function CostLabel() {}"],
    ]);
    expect(surfacesQuotingAPriceWithoutTheDoor(proseOnly)).toEqual([]);
  });

  it("⚠ the node never hands a paid Refresh/Retry to a customer unconditionally", () => {
    const code = read(join("nodes", "CastNode.tsx"));
    const uses = code.split("\n").filter((l) => l.includes("controller.retry"));
    /* The two the card is about: the stale node's Refresh (the status badge's
       primary) and a failed node's Retry. Both fire the same paid
       `runGeneration.execute`. */
    expect(uses.length).toBeGreaterThanOrEqual(2);
    for (const line of uses) {
      expect(line, `a paid retry is offered without the door: ${line.trim()}`).toContain(
        "CANVAS_CAST_OPEN",
      );
    }
  });

  it("⚠ the Variations row is not pressable while the door is shut", () => {
    const code = read(join("nodes", "CastNode.tsx"));
    /* ⚠ SLICED, not matched whole-file: the toolbar declares several actions
       with a `disabled:` line apiece, and a whole-file `toContain` would pass
       on a NEIGHBOURING row's. The slice runs from this row's own id to the
       next action's. */
    const start = code.indexOf('id: "variations" as const');
    expect(start, "the variations toolbar row is gone — this arm no longer has a subject").toBeGreaterThan(-1);
    expect(
      code.indexOf('id: "variations" as const', start + 1),
      "two variations rows — the slice below is ambiguous",
    ).toBe(-1);
    const slice = code.slice(start, code.indexOf('id: "duplicate"', start));
    expect(slice).not.toHaveLength(0);
    /* ⚠ THE `disabled:` EXPRESSION, NOT THE SLICE. The row's own `label:` names
       the door three lines above, so a slice-wide `toContain` passed while the
       button was pressable — the sabotage that survived and the reason
       `expressionFor` exists. */
    const disabled = expressionFor(slice, "disabled");
    expect(disabled, "the Variations row has no `disabled` expression at all").not.toBeNull();
    expect(disabled as string, "the Variations row is pressable on a sealed road").toContain(
      "CANVAS_CAST_OPEN",
    );
  });

  it("⚠ the Recast row is sealed, and the FREE Fork beside it is untouched", () => {
    const code = read("ForkRecastPopover.tsx");
    /* The sealed branch carries no cost and no handler — the D-43 minted row's
       shape. `onFork` must still be wired, or this card has quietly taken a
       free, working road away, which is the one thing the door forbids. */
    expect(code).toContain("CANVAS_CAST_OPEN");
    expect(code).toContain("onClick={onFork}");
    const sealed = code.slice(code.indexOf("!CANVAS_CAST_OPEN"), code.indexOf("onClick={onRecast}"));
    expect(sealed).toContain("disabled");
    expect(sealed).toContain("cost={null}");
    expect(sealed).not.toContain("onClick={onRecast}");
  });

  it("⚠ no closed surface names an engine, a vendor or a model id to a customer", () => {
    /* The disappearing-technology law's one narrow prohibition: no engine name
       on a path somebody must walk. The customer sentence says the thing is
       unavailable; `gemini`, `Google` and the shut-down ids live in
       `shared/vendorModelStatus.ts`, which no customer reads. */
    /* ⚠ EACH PATTERN CARRIES ITS OWN LITERAL BAIT, written out rather than
       computed from `pattern.source`. #1832's finding the same day was five of
       seven patterns sitting inert while their suite ran GREEN, and the first
       draft of this arm reproduced it on the spot: the bait was generated by
       stripping `\b` out of the source, a heredoc ate one backslash of the
       stripping pattern, and the arm reddened on its own control. That red is
       the control working — but a generated control only ever tests the
       generator. A literal one tests the pattern. */
    const forbidden: ReadonlyArray<readonly [RegExp, string]> = [
      [/gemini/i, "rendered on Gemini 3 Pro"],
      [/\bgoogle\b/i, "the model Google shut down"],
      [/nano banana/i, "signed on Nano Banana Pro"],
      [/sunburst/i, "rolled on Sunburst at high"],
      [/\bfal\b/i, "dispatched through fal"],
    ];
    for (const file of ["ForkRecastPopover.tsx", "VariationsPopover.tsx", join("nodes", "CastNode.tsx")]) {
      const code = read(file);
      for (const [pattern] of forbidden) {
        expect(pattern.test(code), `${file} names an engine on a customer path: ${pattern}`).toBe(false);
      }
    }
    /* ⚠ POSITIVE CONTROL PER PATTERN, not per arm — an arm with five readings
       and one control is four unmeasured readings. */
    for (const [pattern, bait] of forbidden) {
      expect(pattern.test(bait), `pattern ${pattern} is inert — it does not match "${bait}"`).toBe(true);
    }
  });
});
