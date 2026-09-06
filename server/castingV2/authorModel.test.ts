/**
 * THE PROMPT AUTHOR'S OWN MODEL, AND THE ONE ALLOWANCE IT SHARES (#466).
 *
 * His card asks for the author model to become its own constant *"so a verdict
 * either way is one line and reversible"* — the same split the reader half got
 * under #231, and this file is `conceptReaderModel.test.ts`'s shape pointed at
 * the author. The thing worth guarding is identical: `createOpenRouterTextEngine`
 * builds its OWN `ProviderQueue` when handed none, so pinning the author to a
 * different slug must not quietly buy four more concurrent OpenRouter calls on
 * top of the four the product declares.
 *
 * The arms are aimed at the claims a reader of the code would otherwise take on
 * trust:
 *
 *   1. the author's factory is pinned to {@link AUTHOR_MODEL}, not to whatever
 *      the brief interpreter happens to be pinned to;
 *   2. both engines run through the SAME queue object;
 *   3. the COMPILE SITE reaches for the author's engine — driven through the
 *      real `castingBriefCompiler` with no injected engine, under a doubled
 *      transport factory, because the reversion that would kill the split is
 *      `briefCompiler.ts` going back to `interpreterEngine()`, and the
 *      interpreter's factory passes no `model` at all. An undefined model on
 *      the author's wire IS that reversion.
 *
 * Asserted at the CONFIG THE FACTORY IS HANDED rather than at a constant near
 * it (working law 5: assert at the wire).
 *
 * ⚠ ONE LIMIT IS DECLARED RATHER THAN PAPERED OVER, the reader test's own:
 * today {@link AUTHOR_MODEL} and the interpreter's default are THE SAME STRING
 * on purpose, so no arm here can tell "the author reads its own constant" from
 * "the author reads the interpreter's" by VALUE. The separation becomes
 * provable by value the day a bench verdict moves the constant, and not
 * before; until then the compile-site arm (a DEFINED model on the author's
 * factory call) is the one that can see the reversion.
 *
 * On `BriefCompilerInput.engine`'s docblock ("unit tests must always set it"):
 * that rule exists so a suite never quietly calls a paid API. The compile-site
 * arm deliberately omits the engine BECAUSE the transport factory is doubled
 * at the module boundary — no real transport exists in this file, and omitting
 * the seam is the entire point of the arm.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const built: Array<{ model?: string; queue?: unknown }> = [];

vi.mock("../providers/openrouterText", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../providers/openrouterText")>();
  return {
    ...actual,
    createOpenRouterTextEngine: (config: { model?: string; queue?: unknown }) => {
      built.push(config);
      return {
        id: `fake:${config.model ?? "default"}`,
        complete: async (request: { json?: boolean; about?: string }) => ({
          /*
            One fake answers both calls the compile makes: the interpreter asks
            for JSON and gets a readable intent; the author asks for prose and
            gets a single clean paragraph that keeps the seed's stated facts
            (sex + age), so the guard neither re-asks nor falls back and the
            compile exercises the authored road end to end.
          */
          text: request.json
            ? JSON.stringify({ cohort: "photoreal_human", role: "a woman with a cyber-goth aesthetic", ageBand: "20s" })
            : "A woman in her twenties with an intense cyber-goth aesthetic, platinum-silver asymmetric hair and pale porcelain skin, styled with severity and a cold, deliberate mood.",
          latencyMs: 7,
          truncated: false,
          provenance: { provider: "openrouter" as const, model: config.model ?? "unpinned", servedModel: "fake" },
        }),
      };
    },
  };
});

/* Statically imported, not `await import`ed: `vi.mock` is hoisted above these
   by the transform, so the double is in place either way — and the uncalled-
   export sweep only counts a STATIC import, so a dynamic one would leave
   `resetAuthorEngineForTests` reading as an export nothing uses. */
import {
  AUTHOR_MODEL,
  authorTextEngine,
  resetAuthorEngineForTests,
} from "./promptAuthor";
import { castingBriefCompiler } from "./briefCompiler";
import { interpreterEngine, interpreterTextQueue, resetInterpreterForTests } from "./interpreter";
import { DEFAULT_INTERPRETER_MODEL } from "../providers/openrouterText";

let previousKey: string | undefined;

beforeEach(() => {
  built.length = 0;
  previousKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
  resetInterpreterForTests();
  resetAuthorEngineForTests();
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = previousKey;
  resetInterpreterForTests();
  resetAuthorEngineForTests();
});

describe("the prompt author's model", () => {
  it("is pinned to the author's OWN constant at the wire", () => {
    authorTextEngine();
    expect(built).toHaveLength(1);
    expect(built[0]!.model).toBe(AUTHOR_MODEL);
  });

  /*
    Today's value, stated as its own claim so that the day it changes, it
    changes ON PURPOSE and with a bench behind it — the pairs are already in
    front of his eye (the author bench, CONCEPT_READER_COURT_2026-08-30.md),
    and nothing swaps on a bench's own reading (law 9).
  */
  it("today holds the interpreter's slug, so the author did not move when it became swappable", () => {
    expect(AUTHOR_MODEL).toBe(DEFAULT_INTERPRETER_MODEL);
  });

  it("is not simply the interpreter's engine wearing a new name — two engines, ONE queue", () => {
    const interpreter = interpreterEngine();
    const author = authorTextEngine();
    expect(interpreter).not.toBe(author);
    expect(built).toHaveLength(2);
    /* The load-bearing half: a second engine must not be a second allowance. */
    expect(built[0]!.queue).toBe(built[1]!.queue);
    expect(built[0]!.queue).toBe(interpreterTextQueue());
  });

  /*
    The reader suite's own reset arm, mirrored (the review's note): a suite
    that resets the interpreter alone would leave a memoized author engine
    holding the DEAD queue while a fresh interpreter builds a new one — two
    allowances inside one process, the exact state this file exists to
    prevent. The paired reset must yield ONE new queue shared by both.
  */
  it("survives a reset as a NEW single allowance rather than two", () => {
    interpreterEngine();
    resetInterpreterForTests();
    resetAuthorEngineForTests();
    interpreterEngine();
    authorTextEngine();
    expect(built).toHaveLength(3);
    expect(built[2]!.queue).toBe(built[1]!.queue);
    expect(built[1]!.queue).not.toBe(built[0]!.queue);
  });

  /*
    THE COMPILE-SITE ARM — the only one that can see the reversion today. The
    interpreter's factory call carries NO model; the author's must carry its
    constant. If `briefCompiler.ts:` goes back to `interpreterEngine()`, the
    author's call disappears and the one engine built has `model: undefined`.
  */
  it("is NOT reached by the compile any more — the roll road makes no author call (#535)", async () => {
    const compiled = await castingBriefCompiler({
      briefText:
        "a young woman with an intense cyber-goth aesthetic, platinum-silver asymmetric hair, pale porcelain skin",
      candidateCount: 8,
      rollSeed: "author-model-arm",
      creativeRegister: true,
    });
    /* The road ran and composed by code: seed + block, no text call. */
    const register = (compiled.compiledBrief as { register?: { kind?: string; mode?: string } }).register;
    expect(register?.kind).toBe("author");
    expect(register?.mode).toBe("seed");
    const models = built.map((b) => b.model);
    /* Only the interpreter's unpinned engine is built; the author's pinned one is never touched at a roll. */
    expect(models).toContain(undefined);
    expect(models).not.toContain(AUTHOR_MODEL);
  });

  /*
    THE PIN'S ONE CALLER IS THE RE-IMAGINE DOOR NOW (#535). A render test
    cannot drive it without a paid call, so the wiring is pinned at the
    source: the procedure must reach `authorTextEngine()` — the factory whose
    engine carries `AUTHOR_MODEL` (proven live by the arms above) — rather
    than `interpreterEngine()`, which passes no model at all.
  */
  it("is what the RE-IMAGINE DOOR reaches for", async () => {
    const { readFile } = await import("node:fs/promises");
    const route = await readFile(new URL("../routes/castingV2.ts", import.meta.url), "utf8");
    const procedure = route.slice(route.indexOf("reimagine: protectedProcedure"));
    expect(procedure.length).toBeGreaterThan(0);
    const body = procedure.slice(0, procedure.indexOf("getRoll:"));
    expect(body).toContain("authorTextEngine()");
    expect(body).not.toContain("interpreterEngine()");
  });
});

describe("no transport", () => {
  it("answers null rather than building an engine with no key", () => {
    delete process.env.OPENROUTER_API_KEY;
    resetAuthorEngineForTests();
    expect(authorTextEngine()).toBeNull();
    expect(built).toHaveLength(0);
  });
});
