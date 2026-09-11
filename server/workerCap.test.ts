/**
 * THE WORKER CEILING — driven, and its wire proven at the config's own bytes (#743).
 *
 * Two arms matter and they answer different questions. The formula arms say
 * what the ceiling DOES on the three boxes that exist (this one, the gate's
 * runner, a laptop); the wire arm says the config actually CALLS it, because
 * a ceiling declared in `server/testing/` and never read by `vitest.config.ts`
 * is invariant 7 exactly — a control that is not invoked does not exist — and
 * it is the shape this repository has shipped four times on one feature.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { WORKER_CEILING, workerCap } from "./testing/workerCap";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("workerCap — vitest's default rule, ceilinged (#743)", () => {
  it("this box: 20 cores would run 19 workers by default and runs the ceiling instead", () => {
    expect(workerCap(20)).toBe(WORKER_CEILING);
    expect(WORKER_CEILING).toBe(8);
  });

  it("the gate's runner is UNTOUCHED — 4 cores ran 3 workers before and run 3 now", () => {
    /* The reason it is a ceiling and not a number: vitest takes `maxWorkers`
       as given, so a flat 8 would oversubscribe the 4-core runner that is
       green 38 of the last 40 runs. */
    expect(workerCap(4)).toBe(3);
  });

  it("below the ceiling the default is exactly vitest's own — cores minus one, never below one", () => {
    expect(workerCap(9)).toBe(8); // the last box the ceiling does not touch
    expect(workerCap(2)).toBe(1);
    expect(workerCap(1)).toBe(1);
  });

  it("NEGATIVE CONTROL — a percentage would have cut the gate to two, which this never does", () => {
    for (const cores of [2, 3, 4, 8, 16, 20, 64]) {
      expect(workerCap(cores)).toBeGreaterThanOrEqual(Math.min(cores - 1, WORKER_CEILING));
    }
  });
});

describe("the wire — vitest.config.ts reads the ceiling, at its bytes", () => {
  const config = readFileSync(path.join(repoRoot, "vitest.config.ts"), "utf8");

  it("imports the cap from the module that carries the measurement", () => {
    expect(config).toMatch(/import \{ workerCap \} from "\.\/server\/testing\/workerCap"/);
  });

  it("and hands vitest the cap of the REAL core count — not a literal", () => {
    expect(config).toMatch(/maxWorkers:\s*workerCap\(availableParallelism\(\)\)/);
    expect(config).not.toMatch(/maxWorkers:\s*\d/);
    expect(config).not.toMatch(/maxWorkers:\s*"\d+%"/);
  });
});
