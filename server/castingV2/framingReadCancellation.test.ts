/**
 * AN ABANDONED FRAMING READ GIVES ITS PROVIDER SLOT BACK — #1781.
 *
 * # The defect, in what it costs
 *
 * #1776 put a 45 s deadline on the framing measurement, and said in its own
 * docblock what it did NOT do: *"it stops the WAITING, not the REQUEST."* The
 * abandoned segmenter call kept running and kept one of the five
 * `FAL_CONCURRENCY` slots until undici gave up at ~300 s. Nothing a customer
 * sees goes wrong — an unmeasured band delivers the view unchecked (#1612) —
 * but **every region read in the product queues behind that same pool**: the
 * face scan, the carried-feature reads, the other four views of the same Sign.
 * A Sign that hangs twice is two of five slots held by work nobody is waiting
 * for.
 *
 * # ⚠ WHY EVERY ARM HERE ASSERTS AT `falGateStats()` AND NOT AT AN `await`
 *
 * The card's own words: *"asserted at the gate's own occupancy, not at the
 * caller's `await`, since the caller already returns"*. #1776 is what makes the
 * caller return, and it is already shipped — so an arm that measured how long
 * the judge waits would have passed **before this change and after it**, which
 * is a test that cannot fail for the reason it exists. The slot is the subject,
 * so the slot is what is read.
 *
 * `falGateStats().inFlight` is the gate's own counter, exported for exactly
 * this (*"for the report and the tests — never a decision"*).
 *
 * # What is driven, and what is not
 *
 * The real `createFalRegionReader` over a stubbed `fetch` that hangs until the
 * signal says otherwise — which is precisely how a segmenter that ACCEPTS and
 * never answers behaves, and the shape #1776's own suite settled on. The
 * provider is the only thing faked; the gate, the reader, the measurement and
 * the deadline are all the product's own.
 */
import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { readListedSource } from "../testing/listedSource";
import { withoutComments } from "../testing/withoutComments";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";
import { falGateStats } from "./falConcurrency";
import { createFalRegionReader } from "./falRegionReader";
import { measureViewFraming } from "./viewFramingGeometry";
import { castPackageView } from "./castViewPackage";

/* This suite holds a provider slot open on purpose and then waits for the gate
   to drain; under a parallel run that is exactly the contended shape #741
   measured. File level, never per arm. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/** A real 1×1 PNG — the reader refuses bytes that are not a picture. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * A provider that accepts and never answers — until the request is aborted.
 *
 * ⚠ **IT HONOURS THE SIGNAL THE WAY `fetch` DOES, which is the one thing this
 * fixture must get right.** A stub that ignored the signal would make every arm
 * below fail whatever the production code does, and a stub that resolved on its
 * own would make them pass whatever it does. So it rejects with an `AbortError`
 * exactly when the signal fires, and otherwise waits forever.
 */
function stubHangingProvider(): void {
  const abandon = (reject: (reason: unknown) => void) => {
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";
    reject(error);
  };
  closed = false;
  vi.stubGlobal("fetch", (_url: unknown, init: any) => new Promise<Response>((_, reject) => {
    /* Once the arm is over, a late call answers at once rather than taking a
       slot behind the cleanup's back — `measureViewFraming` walks to its NEXT
       landmark when one read fails, so abandoning the first one STARTS the
       second. Found by the restore arm below going red, which is the arm
       earning its place. */
    if (closed) { abandon(reject); return; }
    /*
      ⚠ EVERY PENDING CALL IS REMEMBERED so `afterEach` can end it. `inFlight`
      is a MODULE-LEVEL counter in `falConcurrency.ts` — one per worker, shared
      with every other suite that runs in it — and two arms here hold a slot on
      purpose. A suite that left them held would hand the next file a gate that
      is permanently two short, which is a failure somewhere else with nothing
      pointing back here.
    */
    pending.push(() => abandon(reject));
    const signal: AbortSignal | undefined = init?.signal;
    if (signal === undefined) return;            // hangs forever, as it did
    if (signal.aborted) { abandon(reject); return; }
    signal.addEventListener("abort", () => abandon(reject), { once: true });
  }));
}

/** Every request the stub has accepted and not answered. */
const pending: Array<() => void> = [];
/** Set by the cleanup, so a read started by an abandoned one cannot outlive it. */
let closed = false;

/** Wait for the gate to agree, rather than for a duration. */
async function gateDrains(within = 2_000): Promise<void> {
  const until = Date.now() + within;
  while (falGateStats().inFlight > 0 && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Let the gate's `acquire` run before reading its counter. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

afterEach(async () => {
  closed = true;
  /* Loop rather than drain once: ending one read can start the next, and a
     single pass would leave that one holding a slot. Bounded, because an
     unbounded loop in a cleanup is a suite that hangs instead of failing. */
  for (let pass = 0; pass < 10 && (pending.length > 0 || falGateStats().inFlight > 0); pass += 1) {
    for (const end of pending.splice(0)) end();
    await gateDrains();
  }
  vi.unstubAllGlobals();
  expect(
    falGateStats().inFlight,
    "this suite left the gate occupied for whatever runs next in this worker",
  ).toBe(0);
});

describe("a framing read abandoned at its deadline releases its provider slot", () => {
  it("⚠ CONTROL — without a signal the slot is HELD, which is the defect this card is about", async () => {
    /*
      The negative control, and it is the first arm deliberately: every
      assertion in this file is about a counter returning to zero, and a gate
      that never took a slot in the first place would satisfy all of them. This
      proves the gate is occupied by the hung read — and it proves the fixture
      really does hang.
    */
    stubHangingProvider();
    const reader = createFalRegionReader({ apiKey: "k" });
    const before = falGateStats().inFlight;

    /* Deliberately floating: this is the road that never finishes. `.catch`
       only so the abandoned promise is not an unhandled rejection when the
       process tears the stub down. */
    void reader.region({ image: PNG, name: "face" }).catch(() => undefined);
    await settle();

    expect(
      falGateStats().inFlight,
      "the hung read never took a slot — the fixture is not driving the gate",
    ).toBe(before + 1);
  });

  it("aborting the caller's signal gives the slot back", async () => {
    stubHangingProvider();
    const reader = createFalRegionReader({ apiKey: "k" });
    const giveUp = new AbortController();
    const before = falGateStats().inFlight;

    /* Floating on purpose, and this is the card's own instruction rather than
       a shortcut: *"asserted at the gate's own occupancy, not at the caller's
       `await`"*. Awaiting the caller would also make a REGRESSION fail by
       timeout 30 s later instead of on this assertion two seconds later —
       measured, by sabotaging the fix and watching both shapes. */
    void reader.region({ image: PNG, name: "face", signal: giveUp.signal })
      .catch(() => undefined);
    await settle();
    expect(falGateStats().inFlight, "the read did not occupy a slot").toBe(before + 1);

    giveUp.abort();
    await gateDrains();

    expect(
      falGateStats().inFlight,
      "the abandoned read is still holding a FAL_CONCURRENCY slot",
    ).toBe(before);
  });

  it("the whole-subject read takes the signal too — the close-up band reads both", async () => {
    /*
      `subject` is not an afterthought on this road: `closeUp`'s band names
      `face` AND `subject`, so a cancellation that reached only `region` would
      leave half of the widest band's reads holding slots. Read off the band
      rather than asserted, so a band that stops naming it stops asking this.
    */
    const landmarks = new Set(castPackageView("closeUp").band.rules.map((rule) => rule.landmark));
    expect(landmarks, "the closeUp band no longer reads the whole subject").toContain("subject");

    stubHangingProvider();
    const reader = createFalRegionReader({ apiKey: "k" });
    const giveUp = new AbortController();
    const before = falGateStats().inFlight;

    void reader.subject({ image: PNG, signal: giveUp.signal }).catch(() => undefined);
    await settle();
    expect(falGateStats().inFlight).toBe(before + 1);

    giveUp.abort();
    await gateDrains();

    expect(falGateStats().inFlight).toBe(before);
  });

  it("the measurement carries the signal to every landmark its band names", async () => {
    /*
      The arm between the two halves: the reader honours a signal (above) and
      the deadline creates one (below), and this is what proves the measurement
      in the middle actually hands it over. Driven through the REAL
      `measureViewFraming` with the real band.
    */
    stubHangingProvider();
    const reader = createFalRegionReader({ apiKey: "k" });
    const giveUp = new AbortController();
    const before = falGateStats().inFlight;

    void measureViewFraming({
      band: castPackageView("closeUp").band,
      image: PNG,
      reader,
      signal: giveUp.signal,
    }).catch(() => undefined);
    await settle();
    expect(falGateStats().inFlight, "the measurement started no read").toBeGreaterThan(before);

    giveUp.abort();
    await gateDrains();

    expect(
      falGateStats().inFlight,
      "the measurement did not pass its signal through to the reader",
    ).toBe(before);
  });

  it("⚠ a measurement with NO signal still reads — cancellation is not a new requirement", async () => {
    /*
      `signal` is optional, and this proves the optional case is the OLD
      behaviour rather than a silently broken one: a caller without a deadline
      — which is every other `RegionReader` consumer in the product — must still
      get its reads made. It hangs, so the assertion is that it OCCUPIED the
      gate, not that it finished.
    */
    stubHangingProvider();
    const reader = createFalRegionReader({ apiKey: "k" });
    const before = falGateStats().inFlight;

    void measureViewFraming({
      band: castPackageView("closeUp").band,
      image: PNG,
      reader,
    }).catch(() => undefined);
    await settle();

    expect(falGateStats().inFlight, "a measurement with no signal made no call").toBeGreaterThan(before);
  });
});

/**
 * EVERY `RegionReader` CONSUMER HAS ANSWERED THE QUESTION — the card's own
 * second done-when: *"Every other `RegionReader` consumer either passes one or
 * says in its own code why it does not."*
 *
 * ⚠ **IT IS A DERIVED POPULATION RATHER THAN NINE COPIES OF ONE SENTENCE.** The
 * reason is the same for every consumer below — none of them has a deadline, so
 * none of them has anything to cancel — and nine comments saying one thing is
 * working law 4's exact shape: they drift the first time one of them stops
 * being true, and nothing notices. One list, read off the tree, with the reason
 * beside each entry, cannot.
 *
 * **What it buys is the FUTURE consumer, not today's.** A new caller, or an
 * existing one that grows a deadline, reddens here with the question spelled
 * out, instead of quietly joining the class this card exists to close.
 */
describe("every RegionReader consumer has answered whether it cancels", () => {
  /**
   * The consumers that take no signal, and WHY — one line each, and the line is
   * the point.
   *
   * ⚠ The common reason is not "it is fine": it is that **a signal nobody can
   * fire is a control that is not invoked** (invariant 7). These paths run
   * inside a refine or a scan whose own road has no bound to hand down; giving
   * them a parameter to pass `undefined` to would read as coverage.
   */
  const NO_DEADLINE_TO_CANCEL: Record<string, string> = {
    "eyeShapeRouting.ts": "routes one refine's eye shape — inside the refine, which has no bound of its own",
    "faceScan.ts": "the panel's courtesy scan; a failed read costs nothing and shows nothing, so nothing abandons it",
    "hairReferenceCutter.ts": "cuts an attached picture at upload time — the customer is waiting on this, not racing it",
    "inkDeliveryMint.ts": "mints a delivered tattoo inside a Sign's own road; the Sign is the deadline",
    "inkReferenceCutter.ts": "cuts an uploaded design; same upload road as the hair cutter",
    "invisibleRemoval.ts": "reads anatomy for one removal, inside the refine",
    "maskedRefine.ts": "the refine itself — the road every one of these sits inside, and it has no deadline",
    "referenceMint.ts": "mints a reference the customer asked for and is waiting on",
    "refineService.ts": "the refine's own service; its `Promise.race` is over DISPATCH, not over a region read",
  };

  /** The consumers that DO hand a signal down. */
  const CANCELS: Record<string, string> = {
    "viewFramingGeometry.ts": "the framing measurement — #1776 gave it a deadline and this card gives it the cancellation",
    "bornWornDetector.ts": "declared a `signal` from the day it was written and dropped it; wired by this card",
  };

  /** `.region({ … })` / `.subject({ … })`, with the braces balanced. */
  function callsIn(source: string): Array<{ method: string; literal: string }> {
    const calls: Array<{ method: string; literal: string }> = [];
    const opener = /\.(region|subject)\(\{/g;
    let match: RegExpExecArray | null;
    while ((match = opener.exec(source)) !== null) {
      let depth = 0;
      let index = match.index + match[0].length - 1;
      const from = index;
      for (; index < source.length; index += 1) {
        if (source[index] === "{") depth += 1;
        else if (source[index] === "}") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      calls.push({ method: match[1]!, literal: source.slice(from, index + 1) });
    }
    return calls;
  }

  it("the population is exactly the two lists, and nothing has joined it unanswered", () => {
    const dir = __dirname;
    const found = new Map<string, { passes: boolean; omits: boolean }>();
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith(".ts") || entry.includes(".test.")) continue;
      const source = readListedSource(path.join(dir, entry));
      if (source === null) continue;               // vanished between list and read (#223)
      const calls = callsIn(withoutComments(source));
      if (calls.length === 0) continue;
      found.set(entry, {
        passes: calls.some((call) => /\bsignal\b/.test(call.literal)),
        omits: calls.some((call) => !/\bsignal\b/.test(call.literal)),
      });
    }

    /* The reader must be able to SEE calls at all — an empty population would
       make every assertion below pass by finding nothing (working law 2). */
    expect(found.size, "no RegionReader consumer was found — the reader is broken").toBeGreaterThan(5);

    const unanswered = [...found.keys()].filter(
      (file) => !(file in NO_DEADLINE_TO_CANCEL) && !(file in CANCELS),
    );
    expect(
      unanswered,
      "a RegionReader consumer is on neither list — pass its caller's signal to "
      + "`region`/`subject`, or add it to NO_DEADLINE_TO_CANCEL with the reason it has none",
    ).toEqual([]);

    const listedButGone = [...Object.keys(NO_DEADLINE_TO_CANCEL), ...Object.keys(CANCELS)]
      .filter((file) => !found.has(file));
    expect(
      listedButGone,
      "a file on one of the lists no longer reads a region — delete its line",
    ).toEqual([]);

    for (const file of Object.keys(CANCELS)) {
      expect(found.get(file)?.passes, `${file} is listed as cancelling and passes no signal`).toBe(true);
    }
  });

  it("⚠ the reader can tell a call that passes a signal from one that does not", () => {
    /*
      The negative control. Every assertion above turns on `callsIn` finding a
      `signal` key inside the right braces, and a reader that found NOTHING
      would report the whole tree as not-cancelling — which happens to be the
      answer for nine of eleven files, so it would look right.
    */
    const withSignal = callsIn('a.region({ image: x, name: "face", signal: s });');
    const without = callsIn('a.region({ image: x, name: "face" });');
    const nested = callsIn('a.subject({ image: x, opts: { deep: 1 }, signal: s });');

    expect(withSignal).toHaveLength(1);
    expect(/\bsignal\b/.test(withSignal[0]!.literal)).toBe(true);
    expect(without).toHaveLength(1);
    expect(/\bsignal\b/.test(without[0]!.literal)).toBe(false);
    /* Balanced braces, not the first `}` — a nested literal used to end the
       slice early and take the `signal` key with it. */
    expect(nested).toHaveLength(1);
    expect(/\bsignal\b/.test(nested[0]!.literal)).toBe(true);
  });
});
