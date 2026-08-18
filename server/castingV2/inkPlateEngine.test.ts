import { afterEach, describe, expect, it } from "vitest";

import { INK_PLATE_ENGINE } from "./inkPlateEngines";
import { inkPlateEngine, inkPlateQueue, resetInkPlateEngineForTests } from "./inkPlateEngine";

const KEY = process.env.FAL_KEY;

afterEach(() => {
  if (KEY === undefined) delete process.env.FAL_KEY;
  else process.env.FAL_KEY = KEY;
  delete process.env.INK_PLATE_CONCURRENCY;
  resetInkPlateEngineForTests();
});

describe("the transport the plate mint runs on", () => {
  it("answers NULL where there is no transport, rather than throwing into an upload", () => {
    /*
      The mint turns this absence into the transport door's own sentence before
      a database is touched. A throw here would take down an upload that has
      already stored a customer's picture — and nobody has been charged, which
      is the difference from the Sign path's deliberate throw.
    */
    delete process.env.FAL_KEY;
    resetInkPlateEngineForTests();
    expect(inkPlateEngine()).toBeNull();
  });

  it("builds the engine the RULING names, and reports that model as its own id", () => {
    /*
      His word on the court's own sheet was "NBP wins" (fable-963 §2). The
      builder is keyed by `INK_PLATE_ENGINE`, so ruling a different engine is a
      change to that constant and the compiler then demands a builder for it —
      the ruling is load-bearing rather than quoted.

      The id is the string that lands in the plate row's `engine` column, which
      is why it is asserted here: a court verdict and an invoice line have to be
      about the same model.
    */
    process.env.FAL_KEY = "test-key-not-used-without-a-call";
    resetInkPlateEngineForTests();
    expect(INK_PLATE_ENGINE).toBe("nanoBananaPro");
    expect(inkPlateEngine()?.id).toBe("fal:fal-ai/nano-banana-pro");
  });

  it("takes its concurrency from the declared allowance, never from a literal", () => {
    /*
      The fifth path on an account whose twenty were already spent exactly. A
      queue built from a number typed here is exactly the unlisted caller
      `FAL_ALLOWANCES` exists to make impossible.
    */
    process.env.INK_PLATE_CONCURRENCY = "2";
    resetInkPlateEngineForTests();
    expect(inkPlateQueue().stats().concurrency).toBe(2);
  });
});
