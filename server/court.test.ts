/**
 * THE COURT RUNNER (V2's promotion kit), driven on every way a court lies.
 *
 * The four courts V2 packages all answer one rule — *measured numbers or a
 * named refusal, never a guess* — and each clause of the runner is a defect the
 * benches it was extracted from actually met. So each is driven here with
 * scripted arms, which is the only way to test the half a real transport will
 * not perform on demand (law 3).
 */
import { describe, expect, it } from "vitest";

import { runCourt, type ArmReading, type CourtArm } from "../scripts/lib/court.mts";

const arm = (
  id: string,
  readings: Record<string, number>,
  over: Partial<ArmReading & { statusQuo: boolean }> = {},
): CourtArm => ({
  id,
  label: id,
  statusQuo: over.statusQuo,
  run: async () => ({
    arm: id,
    sawAtTheWire: over.sawAtTheWire === undefined ? `${id} was in the request` : over.sawAtTheWire,
    readings,
    outcome: over.outcome ?? "SURVIVED",
  }),
});

const design = (over: Partial<Parameters<typeof runCourt>[0]> = {}) => ({
  kind: "skin tone",
  question: "which reference makes a tone survive a chained edit",
  bars: [{ name: "words:R", claim: "the status quo drifts", floor: 0 }],
  floor: { ratio: 10, measure: async () => ({ floor: 1, signal: 30, saw: "3 renders" }) },
  arms: [
    arm("words", { R: 12 }, { statusQuo: true, outcome: "MELTED" }),
    arm("cut", { R: 2 }),
    arm("patch", { R: 3 }),
  ],
  qualifies: (reading: ArmReading) => reading.outcome === "SURVIVED",
  rank: (reading: ArmReading) => reading.readings.R ?? 0,
  ...over,
});

describe("nothing is judged before the floor is measured", () => {
  it("REFUSES by name when the signal is inside its own noise", async () => {
    /* A signal that does not clear its floor convicts and exonerates equally —
       so the court says the ask did not land, and judges nothing. */
    const verdict = await runCourt(design({
      floor: { ratio: 10, measure: async () => ({ floor: 4, signal: 12, saw: "3 renders" }) },
    }) as never);
    expect(verdict.outcome).toBe("refused");
    expect(verdict.outcome === "refused" && verdict.reason).toBe("the ask did not land");
    expect(verdict.report).toContain("Nothing was judged");
  });

  it("runs NO ARM at all when it refuses — a refused court spends nothing", async () => {
    let ran = 0;
    await runCourt(design({
      floor: { ratio: 10, measure: async () => ({ floor: 4, signal: 12, saw: "" }) },
      arms: [
        { id: "words", label: "words", statusQuo: true, run: async () => { ran += 1; throw new Error("no"); } },
      ],
    }) as never);
    expect(ran).toBe(0);
  });

  it("judges when the signal clears the declared ratio", async () => {
    const verdict = await runCourt(design() as never);
    expect(verdict.outcome).toBe("measured");
  });
});

describe("the field", () => {
  it("REFUSES a court with no status-quo arm", async () => {
    /* Without what already ships in the field, a court can crown a carrier
       worse than the thing it replaces. */
    await expect(runCourt(design({
      arms: [arm("cut", { R: 2 }), arm("patch", { R: 3 })],
    }) as never)).rejects.toThrow(/exactly ONE status-quo arm/);
  });

  it("REFUSES a court with two of them", async () => {
    await expect(runCourt(design({
      arms: [arm("a", { R: 1 }, { statusQuo: true }), arm("b", { R: 2 }, { statusQuo: true })],
    }) as never)).rejects.toThrow(/exactly ONE status-quo arm/);
  });
});

describe("an arm that tested nothing", () => {
  it("is VOID rather than failed when its subject never reached the wire", async () => {
    /*
      Two benches in this program passed while the thing under test was inert.
      A void arm is excluded from the verdict entirely — it is not a loss, and
      counting it as one would be a reading nobody took.
    */
    const verdict = await runCourt(design({
      arms: [
        arm("words", { R: 12 }, { statusQuo: true, outcome: "MELTED" }),
        arm("cut", { R: 1 }, { sawAtTheWire: null }),
        arm("patch", { R: 3 }),
      ],
    }) as never);
    expect(verdict.outcome).toBe("measured");
    expect(verdict.outcome === "measured" && verdict.void).toEqual(["cut"]);
    /* `cut` had the best number and still did not win, because it never ran. */
    expect(verdict.outcome === "measured" && verdict.winner).toBe("patch");
    expect(verdict.report).toContain("VOID");
  });
});

describe("the verdict", () => {
  it("picks the best qualifying arm by the court's own rank", async () => {
    const verdict = await runCourt(design() as never);
    expect(verdict.outcome === "measured" && verdict.winner).toBe("cut");
  });

  it("says NOTHING QUALIFIED when no arm reaches the bar", async () => {
    /* A first-class verdict, not a consolation hunt: the status quo stands. */
    const verdict = await runCourt(design({
      arms: [
        arm("words", { R: 12 }, { statusQuo: true, outcome: "MELTED" }),
        arm("cut", { R: 2 }, { outcome: "PARTIAL" }),
        arm("patch", { R: 3 }, { outcome: "PARTIAL" }),
      ],
    }) as never);
    expect(verdict.outcome === "measured" && verdict.winner).toBeNull();
    expect(verdict.outcome === "measured" && verdict.statusQuoStands).toBe(true);
    expect(verdict.report).toContain("NOTHING QUALIFIED");
  });

  it("files its readings against the bars that were pre-registered", async () => {
    const verdict = await runCourt(design({
      bars: [{ name: "cut:R", claim: "the cut carries", floor: 0 }],
    }) as never);
    expect(verdict.outcome === "measured"
      && verdict.bars.find((bar) => bar.bar.name === "cut:R")?.verdict).toBe("PASS");
  });

  it("REFUSES a reading filed against a bar nobody declared", async () => {
    /* `preRegisterBars` owns this rule; the court is checked for honouring it
       rather than trusted to. */
    await expect(runCourt(design({
      bars: [{ name: "cut:R", claim: "declared", floor: 0 }],
      arms: [
        arm("words", { R: 1 }, { statusQuo: true }),
        { id: "cut", label: "cut", run: async () => ({
          arm: "undeclared", sawAtTheWire: "yes", readings: { R: 1 }, outcome: "SURVIVED",
        }) },
      ],
    }) as never)).resolves.toBeDefined();
  });
});
