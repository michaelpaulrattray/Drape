/**
 * THE CONCEPT READER'S OWN MODEL, AND THE ONE ALLOWANCE IT SHARES (#231).
 *
 * His card asks for the reader model to become its own constant *"so the swap
 * is one line and reversible"*. Making it one is easy; the thing worth guarding
 * is what a second engine costs, and it is invisible at the call site:
 * `createOpenRouterTextEngine` builds its OWN `ProviderQueue` when it is handed
 * none, so pinning this reader to a different slug would quietly buy four more
 * concurrent OpenRouter calls on top of the four the product declares. Nothing
 * anywhere sums text concurrency — this is the fal-allowance class
 * (`assertFalBudget`) arriving on the side of the house that has no such sum.
 *
 * So the arms below are aimed at the two claims a reader of the code would
 * otherwise have to take on trust:
 *
 *   1. the reader is pinned to {@link CONCEPT_READER_MODEL}, not to whatever
 *      the brief interpreter happens to be pinned to;
 *   2. both engines run through the SAME queue object.
 *
 * They are asserted at the CONFIG THE FACTORY IS HANDED rather than at a
 * constant near it (working law 5: assert at the wire). The factory is doubled
 * for that, which is the only way to see an argument that the engine keeps to
 * itself.
 *
 * ⚠ AND ONE LIMIT IS DECLARED RATHER THAN PAPERED OVER, because the sabotage
 * sweep found it: today {@link CONCEPT_READER_MODEL} and the interpreter's
 * default are THE SAME STRING on purpose, so **no arm here can tell "the reader
 * reads its own constant" from "the reader reads the interpreter's"** —
 * swapping one for the other at the wire changes nothing observable. That
 * separation becomes provable the day the values differ, and not before.
 *
 * What IS provable, and is the arm that actually protects the pin, is one step
 * further out: that `describeConcept` builds ITS engine and not the
 * interpreter's. The interpreter passes no `model` at all, so a reversion to
 * `interpreterEngine()` shows up as an undefined model on the wire — which is
 * a difference a test can see today, and it is the reversion that would kill
 * the feature.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const built: Array<{ model?: string; queue?: unknown }> = [];

vi.mock("../providers/openrouterText", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../providers/openrouterText")>();
  return {
    ...actual,
    createOpenRouterTextEngine: (config: { model?: string; queue?: unknown }) => {
      built.push(config);
      return { id: `fake:${config.model ?? "default"}`, complete: async () => ({ text: "" }) };
    },
  };
});

/* Statically imported, not `await import`ed: `vi.mock` is hoisted above these
   by the transform, so the double is in place either way — and the uncalled-
   export sweep inside `pnpm check` only counts a STATIC import, so a dynamic
   one leaves `resetConceptReaderForTests` reading as an export nothing uses. */
import {
  CONCEPT_READER_MODEL,
  conceptReaderEngine,
  describeConcept,
  resetConceptReaderForTests,
} from "./conceptDescribe";
import { interpreterEngine, interpreterTextQueue, resetInterpreterForTests } from "./interpreter";
import { DEFAULT_INTERPRETER_MODEL } from "../providers/openrouterText";

let previousKey: string | undefined;

beforeEach(() => {
  built.length = 0;
  previousKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
  resetInterpreterForTests();
  resetConceptReaderForTests();
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = previousKey;
  resetInterpreterForTests();
  resetConceptReaderForTests();
});

describe("the concept reader's model", () => {
  it("is pinned to the reader's OWN constant at the wire", () => {
    conceptReaderEngine();
    expect(built).toHaveLength(1);
    expect(built[0]!.model).toBe(CONCEPT_READER_MODEL);
  });

  /*
    Today's value, stated as its own claim so that the day it changes, it
    changes ON PURPOSE and with a court behind it. This is not the same
    assertion as the one above: that one says the reader reads its own
    constant, this one says what the constant currently is.
  */
  it("today holds the interpreter's slug, so the reader did not move when it became swappable", () => {
    expect(CONCEPT_READER_MODEL).toBe(DEFAULT_INTERPRETER_MODEL);
  });

  /*
    THE END-TO-END PIN, and the only arm here that can see a reversion today.
    `describeConcept` used to take `interpreterEngine()` whole; if it goes back
    to it, the constant above still exists and still says the right thing while
    nothing reads it. The interpreter names no model, so an undefined model on
    the wire IS that reversion.
  */
  it("is what the DESCRIBER itself reaches for — an undefined model is the reversion", async () => {
    await describeConcept({ bytes: Buffer.from("a-picture"), contentType: "image/png" });
    expect(built).toHaveLength(1);
    expect(built[0]!.model, "the interpreter passes no model; the reader must pass its own")
      .toBeDefined();
    expect(built[0]!.model).toBe(CONCEPT_READER_MODEL);
  });

  it("is not simply the interpreter's engine wearing a new name", () => {
    const interpreter = interpreterEngine();
    const reader = conceptReaderEngine();
    expect(interpreter).not.toBe(reader);
    expect(built).toHaveLength(2);
  });
});

describe("the one OpenRouter text allowance", () => {
  it("hands BOTH engines the same queue object", () => {
    interpreterEngine();
    conceptReaderEngine();
    expect(built).toHaveLength(2);
    expect(built[0]!.queue).toBeDefined();
    expect(built[1]!.queue).toBe(built[0]!.queue);
  });

  /*
    The queue is the product's, not the engine's — an engine handed none builds
    one, which is the failure this file exists to prevent. Asserted here as the
    positive statement of it: the object both engines get is the one this
    module can name.
  */
  it("is the interpreter's queue, and it is a single memoized object", () => {
    conceptReaderEngine();
    expect(built[0]!.queue).toBe(interpreterTextQueue());
    expect(interpreterTextQueue()).toBe(interpreterTextQueue());
  });

  it("survives a reset as a NEW single allowance rather than two", () => {
    interpreterEngine();
    resetInterpreterForTests();
    resetConceptReaderForTests();
    interpreterEngine();
    conceptReaderEngine();
    expect(built).toHaveLength(3);
    expect(built[2]!.queue).toBe(built[1]!.queue);
    expect(built[1]!.queue).not.toBe(built[0]!.queue);
  });
});

describe("no transport", () => {
  it("answers null rather than building an engine with no key", () => {
    delete process.env.OPENROUTER_API_KEY;
    resetConceptReaderForTests();
    expect(conceptReaderEngine()).toBeNull();
    expect(built).toHaveLength(0);
  });
});
