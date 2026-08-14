/**
 * THE KIT IS AN INSTRUMENT, so it gets the treatment every instrument gets
 * (working law 2): a positive control and a negative one for each piece.
 *
 * These are not tests of a product surface. They are the reason a bench's
 * verdict can be believed at all — and every one of them is a real incident
 * from this program's record, not a hypothetical:
 *
 *  - a ledger check that PRINTED that it had spent money and exited 0;
 *  - a contact sheet that skipped absent arms, so "no frame" and "a dark
 *    frame" looked identical to the eye reading it;
 *  - a bar acquired after its own numbers were in;
 *  - a margin that was true in the printed figure and false in the third digit;
 *  - an interpreter probe reported as a pipeline reading.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  FREE_LANE,
  buildContactSheet,
  openLedgerWatch,
  preRegisterBars,
  recordingInterpreter,
} from "../scripts/lib/benchKit.mts";

/** A ledger that answers whatever the test puts in front of it. */
function ledger(readings: Array<{ rowCount: number; net: number }>) {
  let at = 0;
  return async () => [readings[Math.min(at++, readings.length - 1)]!];
}

describe("the ledger, read at both ends", () => {
  it("passes a bench that spent nothing, and says so in a quotable line", async () => {
    const watch = await openLedgerWatch({ query: ledger([{ rowCount: 12, net: -400 }]), userId: 1 });
    const closed = await watch.close();
    expect(closed.moved).toBe(false);
    expect(closed.line).toBe("LEDGER: 12 rows → 12 rows · net -400 → -400");
  });

  it("THROWS when the ledger moved — the control the printed warning was not", async () => {
    /* The hand-rolled version wrote "*** THIS BENCH SPENT MONEY ***" to stdout
       and exited 0, so a bench that charged a user could still be reported as
       clean by anyone reading the exit code. */
    const watch = await openLedgerWatch({
      query: ledger([{ rowCount: 12, net: -400 }, { rowCount: 13, net: -440 }]),
      userId: 1,
    });
    await expect(watch.close()).rejects.toThrow(/SPENT MONEY/);
  });

  it("catches a spend that added no row — the net alone moving", async () => {
    /* A correction or an adjustment can move money without changing the count,
       and a count-only check reads that as unmoved. */
    const watch = await openLedgerWatch({
      query: ledger([{ rowCount: 12, net: -400 }, { rowCount: 12, net: -560 }]),
      userId: 1,
    });
    await expect(watch.close()).rejects.toThrow(/SPENT MONEY/);
  });

  it("reports rather than throws when the bench is a PAID walk", async () => {
    const watch = await openLedgerWatch({
      query: ledger([{ rowCount: 12, net: -400 }, { rowCount: 13, net: -440 }]),
      userId: 1,
      spendingIsExpected: true,
    });
    const closed = await watch.close();
    expect(closed.moved).toBe(true);
    expect(closed.line).toContain("12 rows → 13 rows");
  });
});

describe("the contact sheet", () => {
  /** A flat frame of a colour no refusal box uses. */
  const frame = async (shade: number) => sharp({
    create: { width: 40, height: 60, channels: 3, background: { r: shade, g: shade, b: shade } },
  }).png().toBuffer();

  it("draws every cell it was given, at the size it was asked for", async () => {
    const sheet = await buildContactSheet({
      columns: ["master", "v1"],
      rows: [{ label: "face-a", cells: [{ bytes: await frame(200) }, { bytes: await frame(90) }] }],
      tile: { width: 60, height: 80 },
    });
    expect(sheet.missing).toEqual([]);
    expect(sheet.width).toBe(120);
    expect(sheet.height).toBe(80 + 22 + 22);
    const meta = await sharp(sheet.bytes).metadata();
    expect(meta.width).toBe(120);
  });

  it("DRAWS an absent cell and names it — a hole is not a dark photograph", async () => {
    const sheet = await buildContactSheet({
      columns: ["master", "v1"],
      rows: [{ label: "face-a", cells: [{ bytes: await frame(200) }, { bytes: null }] }],
      tile: { width: 60, height: 80 },
    });
    expect(sheet.missing).toEqual(["face-a × v1"]);

    /*
      And the pixels say it too. The mark has to be monochrome (founder ruling,
      fable-230 — this file composites onto photographs), so what distinguishes
      it is not a hue but an ALTERNATION: hatching at a fixed pitch puts near-
      black and near-white inside every small window. A drawn frame in this
      test is one flat tone, so the same reading tells them apart.
    */
    const window = async (left: number) => {
      const { data } = await sharp(sheet.bytes).greyscale()
        .extract({ left, top: 40, width: 30, height: 30 }).raw().toBuffer({ resolveWithObject: true });
      let low = 255, high = 0;
      for (const value of data) { if (value < low) low = value; if (value > high) high = value; }
      return high - low;
    };
    expect(await window(70)).toBeGreaterThan(100);
    /* The negative control beside it: the cell that DID have a frame is flat. */
    expect(await window(10)).toBeLessThan(10);
  });
});

describe("the bars, written before the first call", () => {
  const bars = [
    { name: "delivers", claim: "the ask lands", floor: 0.95 },
    { name: "never-false-passes", claim: "no affirmative without a reading" },
  ] as const;

  it("passes a reading that clears its floor, carrying what it saw", () => {
    const court = preRegisterBars(bars);
    court.file("delivers", 0.97, "23 of 24 frames");
    court.file("never-false-passes", 0, "no unsupported affirmative in 24");
    const judged = court.judge();
    expect(judged.map((entry) => entry.verdict)).toEqual(["PASS", "PASS"]);
    expect(judged[0]!.saw).toBe("23 of 24 frames");
  });

  it("REFUSES a reading against a bar nobody declared", () => {
    /* How a bench acquires its bar after seeing its numbers. */
    const court = preRegisterBars(bars);
    expect(() => court.file("looks-good", 1, "it looked good")).toThrow(/pre-registered/);
  });

  it("says NO READING rather than passing a bar nothing was filed against", () => {
    const court = preRegisterBars(bars);
    court.file("delivers", 0.99, "24 of 24");
    const judged = court.judge();
    expect(judged[1]).toMatchObject({ verdict: "NO READING", reading: null });
    /* And it is not a failure either — nothing was measured, which is a third
       thing and the report has to say which. */
    expect(judged[1]!.verdict).not.toBe("FAIL");
  });

  it("judges a floor against the BOTTOM of the rounding interval", () => {
    /* 95.0% printed to one decimal is anything from 94.95% up. Against a 95%
       floor that is not a pass, and the printed figure says it is. */
    const court = preRegisterBars([{ name: "delivers", claim: "the ask lands", floor: 95 }]);
    court.file("delivers", 95.0, "printed to one decimal");
    expect(court.judge({ printedTo: 1 })[0]!.verdict).toBe("FAIL");
    expect(court.judge()[0]!.verdict).toBe("PASS");
  });

  it("refuses two bars sharing a name", () => {
    expect(() => preRegisterBars([
      { name: "delivers", claim: "one" },
      { name: "delivers", claim: "another" },
    ])).toThrow(/share a name/);
  });
});

describe("the free lane", () => {
  it("is a refusal at the door, and its value is not a habit", () => {
    expect(FREE_LANE.admit()).toBe(false);
  });

  it("records EVERY call the service made, in order", async () => {
    /* An interpreter probe is not a pipeline reading: the shipped service asks
       more than once, and a bench that calls the interpreter directly measures
       the first step and reports it as the route. */
    const answers = [
      { ok: true, intent: "edit", delta: { free: { expression: "a soft smile" } } },
      { ok: false, refusal: { reason: "wall_unfileable" } },
    ];
    let at = 0;
    const { interpret, calls } = recordingInterpreter(async (_request: any) => answers[at++]!);
    await interpret({ mode: "echo" });
    await interpret({});
    expect(calls).toEqual([
      { mode: "echo", ok: true, intent: "edit", delta: { free: { expression: "a soft smile" } }, refusal: undefined },
      { mode: "(default)", ok: false, intent: undefined, delta: undefined, refusal: { reason: "wall_unfileable" } },
    ]);
  });
});
