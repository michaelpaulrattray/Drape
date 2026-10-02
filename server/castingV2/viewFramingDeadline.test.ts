/**
 * THE FRAMING MEASUREMENT HAS A DEADLINE — #1776.
 *
 * # The defect, in what a customer waits
 *
 * `measureViewFraming` was started with no bound of any kind. The judge's own
 * call beside it is capped at 75 s; a segmenter that ACCEPTS and never answers
 * was bounded only by the transport — undici's ~300 s headers timeout, measured
 * at 306.6 s in #1177. The view still DELIVERED (a framing failure never
 * refuses, #1612), so nothing was ever lost; what was spent was up to five
 * minutes of a paid Sign or Try again.
 *
 * # Why this drives a reader rather than a model
 *
 * Working law 3: a backstop needs a test the model cannot rescue. The hang this
 * guards is the segmenter NOT answering, so the only honest fixture is a reader
 * that never resolves — a merely slow one makes the arm a race between a timer
 * and the machine it runs on.
 *
 * # ⚠ THE BOUND IS PINNED FROM BOTH SIDES, AND THAT IS THE POINT
 *
 * An arm that only proved *it finishes eventually* would pass a deadline of
 * 300 s, which is the defect. An arm that only proved *it is bounded* would
 * pass a deadline of 1 ms — **which is worse than the defect**: an unchecked
 * view is delivered WITH a free Try again, so a bound that fires on a healthy
 * read gives the check away on every view rather than costing time on a rare
 * one. 20 s, the number first proposed for this card, was measured to fire on
 * his own frames (21.5 / 18.5 / 22.5 s on the widest band there is).
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { CAST_VIEW_ANGLES } from "../../shared/boardTypes";
import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";
import { readListedSource } from "../testing/listedSource";
import { withoutComments } from "../testing/withoutComments";
import { castPackageView } from "./castViewPackage";
import type { Mask } from "./maskedComposite";
import type { TextEngine, TextRequest } from "../providers/types";
import {
  createViewConformanceJudge,
  FRAMING_MEASUREMENT_TIMEOUT_MS,
  viewConformanceRefuses,
} from "./viewConformance";
import type { FramingReader } from "./viewFramingGeometry";

/*
  ⚠ THE LAST ARM WALKS THE SOURCE TREE, so this suite is in #741's class: it
  reads hundreds of files off the real tree and would go red under load on
  somebody's machine rather than in CI. The timeout is declared at file level
  because the guard derives its population from the WALK, not from which arm
  does it.
*/
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/** A mask lit everywhere — `isPresent` holds and every edge is reached. */
const FULL: Mask = { data: Buffer.alloc(40 * 40, 255), width: 40, height: 40 };

/** Answers at once. The positive control: a healthy read must not be cut off. */
const PROMPT_READER: FramingReader = {
  async subject() {
    return FULL;
  },
  async region() {
    return FULL;
  },
};

/**
 * Accepts and never answers — the shape this card is about.
 *
 * NOT a rejection: a reader that THROWS is already turned into `cannotMeasure`
 * per rule by `measureViewFraming`, and that road was never the defect. Silence
 * is what had no bound.
 */
const SILENT_READER: FramingReader = {
  subject() {
    return new Promise<Mask>(() => {});
  },
  region() {
    return new Promise<Mask>(() => {});
  },
};

function judgeWith(framingReader: FramingReader, framingDeadlineMs?: number) {
  const engine: TextEngine = {
    id: "test-judge",
    complete: vi.fn(async (_request: TextRequest) => ({
      text: JSON.stringify({
        identity: { verdict: "matches", note: "same person" },
        angle: { verdict: "matches", note: "as asked" },
        wardrobe: { verdict: "matches", note: "as the reference shows" },
      }),
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "t" },
    })),
  };
  return createViewConformanceJudge({
    engine,
    framingReader,
    ...(framingDeadlineMs === undefined ? {} : { framingDeadlineMs }),
  });
}

const frame = (bytes: string) => ({ bytes: Buffer.from(bytes), contentType: "image/png" as const });
const ask = {
  angle: "closeUp" as const,
  anchor: frame("anchor"),
  candidate: frame("candidate"),
};

/** Short enough for a suite, long enough that the judge's own frame work fits. */
const TEST_BOUND_MS = 150;

describe("the framing measurement cannot hold a paid view open", () => {
  it("⚠ CONTROL — a reader that answers in time is NOT cut off, and the measurement reaches the record", async () => {
    /*
      First, and deliberately: every arm below asserts that something finishes,
      and a judge whose measurement ALWAYS failed would satisfy all of them. The
      positive control is what separates *bounded* from *broken*.
    */
    const verdict = await judgeWith(PROMPT_READER)(ask);

    expect(verdict.method, "the measurement did not reach the record").toContain("geometry:");
    expect(verdict.method, "a healthy read was cut off by its own deadline").not.toContain(
      "deadline",
    );
  });

  it("⚠ a segmenter that accepts and never answers no longer holds the view — it folds at the bound", async () => {
    /*
      Driven through the REAL judge with a short bound rather than against a
      fake clock. The judge downscales both frames before the measurement
      starts; faking timers around that stalls on the frame work instead of on
      the subject — measured while writing this file, and it is a test that
      hangs for a reason unrelated to what it is about.
    */
    const started = Date.now();
    const verdict = await judgeWith(SILENT_READER, TEST_BOUND_MS)(ask);
    const took = Date.now() - started;

    /* It let go, and the record says why rather than going quiet. */
    expect(verdict.method, "the record does not say the measurement was abandoned").toContain(
      "geometry:refused",
    );
    expect(verdict.method).toContain("deadline");
    /*
      The axis lands UNSURE rather than on the reader's word, and that is
      #1612's fold rather than a gap in this change: a band that could not be
      measured may not PASS, so an abandoned measurement delivers the view
      unchecked — charged, with the free Try again — instead of claiming a
      framing it never read.
    */
    expect(verdict.axes.angle.verdict).toBe("unsure");
    expect(verdict.axes.angle.pass, "an unmeasured band passed the axis").toBe(false);
    /*
      ⚠ AND THE VIEW IS NOT REFUSED, which is the product fact and is asserted
      through the function the refusal road actually reads. #1612's ruling is
      that identity alone refuses; a deadline that became a refusal would be
      this change taking a picture the customer has paid for.
    */
    expect(verdict.axes.identity.verdict).toBe("matches");
    expect(viewConformanceRefuses(verdict), "the deadline turned into a refusal").toBe(false);
    /*
      The WAIT is the defect, so the wait is asserted. Generous against the
      bound because a loaded machine is not the subject — what this refuses is
      the unbounded road, which sat on the transport's ~300 s.
    */
    expect(took, `the judge waited ${took}ms on a reader that never answers`).toBeLessThan(5_000);
  });

  it("⚠ the bound does not fire EARLY — a reader slower than a tick but well inside the bound still lands", async () => {
    const slow: FramingReader = {
      async subject() {
        await new Promise((resolve) => setTimeout(resolve, 120));
        return FULL;
      },
      async region() {
        await new Promise((resolve) => setTimeout(resolve, 120));
        return FULL;
      },
    };
    const verdict = await judgeWith(slow, 5_000)(ask);
    expect(verdict.method, "a read well inside its bound was cut off").not.toContain("deadline");
    expect(verdict.method).toContain("geometry:");
  });

  it("⚠ the deadline's timer does not outlive the call it bounded", async () => {
    /*
      A `setTimeout` left pending holds the event loop open, and this runs once
      per view. The HEALTHY road is the one that leaks — its timer is still live
      when the measurement wins the race — so it is the road driven here.
      Counted at the process's own handles rather than read off the `.finally`,
      because the `.finally` is exactly what a regression would delete.
    */
    const timers = () => process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;
    const before = timers();
    await judgeWith(PROMPT_READER)(ask);
    expect(timers(), "the deadline's timer is still pending after the measurement answered").toBe(
      before,
    );
  });

  it("⚠ THE MEASUREMENT THE BOUND RESTS ON STILL COVERS THE WORST CASE — no band reads past two landmarks", () => {
    /*
      45 s is twice the worst of 21.5 / 18.5 / 22.5 s, and every one of those
      was taken on a band naming TWO distinct landmarks — which was the widest
      there is when the number was chosen. A band that grows a third landmark
      makes the measurement longer than anything that was measured, and the
      bound would then be a number carried over from a tree that no longer
      exists. That is the drift this arm exists to catch: it reddens on the
      commit that widens a band, where the fix is to re-measure, rather than
      months later on a customer's view.
    */
    const widest = Math.max(
      ...CAST_VIEW_ANGLES.map(
        (angle) => new Set(castPackageView(angle).band.rules.map((rule) => rule.landmark)).size,
      ),
    );
    expect(
      widest,
      "a band now reads more landmarks than the bound was measured against — re-measure it",
    ).toBeLessThanOrEqual(2);
  });

  it("⚠ the bound a customer gets is the MEASURED one, and nothing in production overrides it", () => {
    /*
      `framingDeadlineMs` exists so the arms above can drive the real judge. Two
      things keep it from quietly becoming a production knob: the default is the
      measured number, and the caller list is DERIVED from the tree rather than
      claimed here — working law 4, a second list shadowing a source of truth
      always drifts from it.
    */
    expect(
      FRAMING_MEASUREMENT_TIMEOUT_MS,
      "the measured bound moved — re-measure it, never retype it",
    ).toBe(45_000);

    const root = path.resolve(__dirname, "..", "..");
    const setters: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
        const full = path.join(dir, entry);
        const stat = fs.statSync(full, { throwIfNoEntry: false });
        if (!stat) continue;
        if (stat.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|mts)$/.test(entry)) continue;
        if (/\.test\.(ts|tsx)$/.test(entry)) continue;
        const source = readListedSource(full);
        if (source === null) continue;
        if (withoutComments(source).includes("framingDeadlineMs")) {
          setters.push(path.relative(root, full).replace(/\\/g, "/"));
        }
      }
    };
    for (const dir of ["server", "client/src", "scripts", "shared"]) {
      const full = path.join(root, dir);
      if (fs.statSync(full, { throwIfNoEntry: false })) walk(full);
    }

    /* Only the declaration itself may name it outside a test. */
    expect(setters, "a production caller sets the framing deadline").toEqual([
      "server/castingV2/viewConformance.ts",
    ]);
  });
});
