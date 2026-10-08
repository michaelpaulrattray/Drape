/**
 * THE CUT WARNING FIRES ON A CUT THAT IS ACTUALLY BLIND — #1967.
 *
 * # What was wrong
 *
 * `renderSignSheet` warned *"a panel may be cut inside the figure"* whenever
 * ANY boundary came from an equal share, and called that line *"the only alarm
 * there is"* — correctly, because the conformance judge's surviving axes would
 * all pass a beheaded panel. `signSheet.test.ts` then measured the shipping
 * head sheet and found it falls back on BOTH boundaries, forever. So the alarm
 * fired on every single Sign, which is the same as not having it, and that
 * suite filed the consequence rather than fixing it (see its own ⚠ on the
 * two-sheet block).
 *
 * # ⚠ WHAT THE FIXTURES ACTUALLY SAY, AND IT IS NOT WHAT THE CARD SAYS
 *
 * The card's premise is *"the head sheet has no visible seam"*. **Read at the
 * bytes, it has one — it is DARK, and the detector only ever looked for a
 * bright divider.** On the shipping head sheet there is a hairline trough at
 * exactly column 1280 and column 2560:
 *
 * | boundary | offset from the equal share | span | depth below its neighbourhood |
 * |---|---|---|---|
 * | k=1 | 0 px | 1 px | 89.0 |
 * | k=2 | 0 px | 2 px | 58.5 |
 *
 * That is why the fallback is right, and it is a better reason than the one on
 * the record: `signSheet.test.ts` argued it from the SERIAL head sheet, a
 * different render whose seams are bright and sit within 2 px of the thirds.
 * That argument is sound but it is about another picture; this one is about the
 * picture being cut.
 *
 * So the criterion is *did the line I chose land on a seam, bright or dark*,
 * and the arms below are what make it decision-grade rather than a guess:
 *
 *   1. the SEAM — both real fallback boundaries are found, with their measured
 *      depths, on the shape his #1926 ruling ships;
 *   2. the SEPARATION — over EVERY boundary of EVERY fixture sheet, derived
 *      rather than listed, nothing else is called a seam;
 *   3. the FIGURE — a boundary with a body across it is not a seam, driven on a
 *      profile built for it, because no fixture carries that case;
 *   4. the ALARM — end to end through `renderSignSheet`, silent on the real
 *      head-sheet profile and loud on a blind one.
 *
 * # Why a profile rebuilt into pixels is the real sheet, for this question
 *
 * The cut reads exactly one signal: `sheetColumnMeans`, the mean brightness of
 * each column over the full height. An image whose every column is a flat grey
 * of the fixture's own measured mean therefore presents the detector with the
 * identical input to the 10.9 MB PNG it was measured from — and those PNGs are
 * gitignored, which is why the fixture is means in the first place.
 */
import { readFileSync } from "node:fs";

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import type { CastViewAngle } from "../../shared/castPackage";
import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";
import {
  DARK_SEAM_MIN_DEPTH,
  findDarkSeamAt,
  findSheetPanelGeometry,
  renderSignSheet,
  type ReferenceImage,
} from "./signSheet";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/** What the purge-free render said it found, so the alarm can be read. */
const logged: Array<{ fields: Record<string, unknown>; message: string }> = [];
vi.mock("../logging/logger", () => {
  const record = () => (fields: unknown, message: string) => {
    logged.push({ fields: (fields ?? {}) as Record<string, unknown>, message });
  };
  const shape = { error: record(), warn: record(), info: record(), debug: record() };
  return { logger: shape, createModuleLogger: () => shape };
});

type FixtureSheet = {
  kind?: string;
  render?: string;
  sheet?: number;
  panels?: number;
  width: number;
  height: number;
  columnMeans: number[];
};

function load(name: string): FixtureSheet[] {
  const path = `server/castingV2/__fixtures__/${name}`;
  return (JSON.parse(readFileSync(path, "utf8")) as { sheets: FixtureSheet[] }).sheets;
}

const TWO_SHEET = load("signSheet.twoSheetColumnMeans.json");
/** The court sheets are five-panel and carry no `panels` field of their own. */
const COURT = load("signSheet.courtColumnMeans.json").map((sheet) => ({ ...sheet, panels: 5 }));

const headSheet = (render: "parallel" | "serial"): FixtureSheet => {
  const found = TWO_SHEET.find((sheet) => sheet.kind === "head" && sheet.render === render);
  if (!found) throw new Error(`no ${render} head sheet in the fixture`);
  return found;
};

/* ------------------------------------------------------------------ the seam */

describe("the shipping head sheet's seam is DARK, and it is there (#1967)", () => {
  it("⚠ both fallback boundaries land on a hairline, at the measured depths", () => {
    const sheet = headSheet("parallel");
    const means = Float64Array.from(sheet.columnMeans);
    const geometry = findSheetPanelGeometry(means, sheet.width, sheet.panels);

    /* The premise: this shape falls back on both boundaries, forever. */
    expect(geometry.boundaries.map((boundary) => boundary.source)).toEqual(["fifth", "fifth"]);

    const seams = geometry.boundaries.map((boundary) => boundary.darkSeam);
    expect(seams.every((seam) => seam !== null), "a fallback landed on nothing readable")
      .toBe(true);
    /* The numbers this card was decided on, pinned so a re-measure is visible. */
    expect(seams[0]!.contrast).toBeCloseTo(89.0, 0);
    expect(seams[1]!.contrast).toBeCloseTo(58.5, 0);
    /* A hairline, which is the clause that tells a seam from a body. */
    expect(seams[0]!.end - seams[0]!.start + 1).toBe(1);
    expect(seams[1]!.end - seams[1]!.start + 1).toBe(2);
    /* And on the line itself: the equal third IS the seam, not near it. The
       second seam's run is 2559..2560, so the claim is that the line falls
       INSIDE the run rather than at its first column. */
    for (const [index, line] of [1280, 2560].entries()) {
      const seam = seams[index]!;
      expect(seam.start, `seam ${index + 1} starts after the line`).toBeLessThanOrEqual(line);
      expect(seam.end, `seam ${index + 1} ends before the line`).toBeGreaterThanOrEqual(line);
    }
  });

  it("a divider boundary carries no dark seam — it needed no second opinion", () => {
    const body = TWO_SHEET.find((sheet) => sheet.kind === "body");
    const geometry = findSheetPanelGeometry(
      Float64Array.from(body!.columnMeans),
      body!.width,
      body!.panels,
    );
    expect(geometry.boundaries.map((boundary) => boundary.source)).toEqual(["divider"]);
    expect(geometry.boundaries[0]!.darkSeam).toBeNull();
  });
});

/* ----------------------------------------------------------- the separation */

describe("⚠ nothing else in either fixture is called a seam", () => {
  /**
   * Every boundary of every real sheet in the tree, derived from the fixtures
   * rather than listed — so a sheet added to either fixture is covered by this
   * control on the day it lands, instead of quietly sitting outside it.
   */
  const population = [...TWO_SHEET, ...COURT].flatMap((sheet) => {
    const panels = sheet.panels ?? 5;
    return Array.from({ length: panels - 1 }, (_unused, index) => ({
      name: `${sheet.kind ?? "court"}/${sheet.render ?? `sheet${sheet.sheet}`} k=${index + 1}`,
      line: Math.round((sheet.width * (index + 1)) / panels),
      width: sheet.width,
      means: sheet.columnMeans,
      shipping: sheet.kind === "head" && sheet.render === "parallel",
    }));
  });

  it("the population is the real one and is not obviously short", () => {
    expect(population.length, "the fixtures were not read").toBe(1 + 2 + 2 + 4 + 4 + 4);
    expect(population.filter((row) => row.shipping).length, "the shipping shape is absent").toBe(2);
  });

  it("only the shipping head sheet's two boundaries read as seams", () => {
    const called = population.filter((row) =>
      findDarkSeamAt(row.means, row.width, row.line) !== null);
    expect(
      called.map((row) => row.name).sort(),
      "a boundary that is not a seam reads as one — the alarm would go quiet on a blind cut",
    ).toEqual(["head/parallel k=1", "head/parallel k=2"]);
  });

  it("⚠ the span cap and the depth floor each exclude the near miss on their own", () => {
    /*
      Court sheet 3's first boundary carries a 24.1-deep dark run — close enough
      to {@link DARK_SEAM_MIN_DEPTH} that a re-measured floor could swallow it —
      and it is 7 px wide, which the span cap refuses. Two independent clauses
      is what stops one constant moving from opening a hole, so both are read.
    */
    const third = COURT[2]!;
    const line = Math.round(third.width / 5);
    expect(findDarkSeamAt(third.columnMeans, third.width, line)).toBeNull();

    /* The depth reading, taken without the span cap in the way, so the claim
       about WHY it is excluded is measured rather than asserted. */
    let dip = line - 4;
    for (let x = line - 4; x <= line + 4; x += 1) {
      if (third.columnMeans[x]! < third.columnMeans[dip]!) dip = x;
    }
    const depth = (third.columnMeans[dip - 20]! + third.columnMeans[dip + 20]!) / 2
      - third.columnMeans[dip]!;
    expect(depth, "the near miss stopped being near — re-read the constants").toBeLessThan(
      DARK_SEAM_MIN_DEPTH + 1,
    );
    expect(depth, "the near miss stopped being a miss").toBeGreaterThan(15);
  });
});

/* --------------------------------------------------------------- the figure */

describe("a body across the line is not a seam (#1967)", () => {
  /**
   * A profile no fixture carries: flush panels with a FIGURE crossing the
   * boundary. Both halves matter — a wide dark region is what a body looks like
   * averaged down a column, and the depth alone would call it a seam.
   */
  function profileWithFigureAcross(width: number, line: number, span: number): number[] {
    const means = new Array<number>(width).fill(190);
    for (let x = line - Math.floor(span / 2); x < line - Math.floor(span / 2) + span; x += 1) {
      means[x] = 95;
    }
    return means;
  }

  it("⚠ a 60px dark run at the line reads as NO seam, though it is deeper than a real one", () => {
    const means = profileWithFigureAcross(3840, 1280, 60);
    /* Deeper than either real seam, so depth cannot be what refuses it. */
    expect(190 - 95).toBeGreaterThan(89);
    expect(
      findDarkSeamAt(means, 3840, 1280),
      "a figure across the boundary was mistaken for a hairline and the alarm went quiet",
    ).toBeNull();
  });

  it("a flat line with nothing at it reads as no seam", () => {
    expect(findDarkSeamAt(new Array<number>(3840).fill(190), 3840, 1280)).toBeNull();
  });

  it("a hairline of the real width and depth IS a seam — the positive control", () => {
    const means = profileWithFigureAcross(3840, 1280, 1);
    expect(findDarkSeamAt(means, 3840, 1280)).not.toBeNull();
  });

  it("⚠ a real hairline 20px AWAY is not THIS line's seam — the window is load-bearing", () => {
    /*
      The question is *did the line I chose land on a seam*, never *is there a
      seam somewhere near*. A sheet whose true seam sits 20 px off means the
      fallback cut 20 px into a panel, which is exactly the case the card
      describes as *"far from where a seam would plausibly be"* — so it must
      still warn.

      ⚠ **THIS ARM EXISTS BECAUSE A SABOTAGE SURVIVED WITHOUT IT.** Widening
      `SEAM_SEARCH_PX` from 4 to 40 left all the other arms green: the real
      seams sit at offset 0 and every impostor in the fixtures is refused on
      span or depth, so no fixture could ask this question. A constant nothing
      can see move is a constant that will move.
    */
    const means = profileWithFigureAcross(3840, 1300, 1);
    expect(findDarkSeamAt(means, 3840, 1300), "the positive control at its own line").not.toBeNull();
    expect(
      findDarkSeamAt(means, 3840, 1280),
      "a seam 20px off the chosen line was credited to it — a cut 20px into the panel"
        + " now reads as a clean read and the alarm goes quiet",
    ).toBeNull();
  });
});

/* ---------------------------------------------------------------- the alarm */

describe("the alarm, end to end through renderSignSheet (#1967)", () => {
  const HEAD_ORDER = ["closeUp", "threeQuarter", "sideClose"] as const;

  /** A picture whose column means ARE the fixture's — see the header. */
  async function sheetFromMeans(means: readonly number[], height: number): Promise<Buffer> {
    const width = means.length;
    const raw = Buffer.alloc(width * height);
    for (let y = 0; y < height; y += 1) {
      const row = y * width;
      for (let x = 0; x < width; x += 1) raw[row + x] = Math.round(means[x]!);
    }
    return sharp(raw, { raw: { width, height, channels: 1 } }).png().toBuffer();
  }

  async function anchor(): Promise<ReferenceImage> {
    const bytes = await sharp({
      create: { width: 64, height: 96, channels: 3, background: "#808080" },
    }).png().toBuffer();
    return { bytes, contentType: "image/png" };
  }

  async function render(bytes: Buffer): Promise<Array<{ level: "warn" | "info"; message: string }>> {
    logged.length = 0;
    await renderSignSheet({
      engine: {
        async editWithReferences() {
          return {
            bytes,
            contentType: "image/png",
            latencyMs: 61_000,
            estimatedCostUsd: null,
            provenance: { provider: "fal", model: "openai/gpt-image-2.5/sunburst/edit" },
          };
        },
      },
      anchor: await anchor(),
      panelOrder: HEAD_ORDER as unknown as readonly CastViewAngle[],
      operationId: 1967,
    });
    return logged
      .filter((entry) => entry.message.includes("[signSheet] the Sign sheet")
        || entry.message.includes("[signSheet] some panel boundaries"))
      .map((entry) => ({
        level: entry.message.includes("some panel boundaries") ? "warn" as const : "info" as const,
        message: entry.message,
      }));
  }

  it("⚠ SILENT on the real head-sheet profile — the whole point of the card", async () => {
    /* 64 rows rather than 1648: the detector averages down a column, and a
       column of identical greys has the same mean at any height. */
    const bytes = await sheetFromMeans(headSheet("parallel").columnMeans, 64);

    const lines = await render(bytes);

    expect(lines, "the render logged nothing — this arm is reading nothing").toHaveLength(1);
    expect(
      lines[0]!.level,
      "the alarm still fires on the shape that ships, so it still cries on every Sign",
    ).toBe("info");
    expect(lines[0]!.message).toContain("landed on the sheet's own hairline seam");
  });

  it("⚠ LOUD when a boundary lands on nothing — the alarm still works", async () => {
    /* Flush panels, no seam of either colour anywhere: exactly the case the
       warning exists for, and the case no fixture carries. */
    const bytes = await sheetFromMeans(new Array<number>(3840).fill(170), 64);

    const lines = await render(bytes);

    expect(lines).toHaveLength(1);
    expect(
      lines[0]!.level,
      "a cut with no seam at any boundary went unreported — the alarm is now dead",
    ).toBe("warn");
    expect(lines[0]!.message).toContain("no seam");
    expect(lines[0]!.message).toContain("may be cut inside the figure");
  });

  it("the receipt counts both kinds, so the log can be read without the picture", async () => {
    logged.length = 0;
    await render(await sheetFromMeans(headSheet("parallel").columnMeans, 64));
    const receipt = logged.find((entry) =>
      entry.message.includes("[signSheet] the Sign sheet"))?.fields;
    expect(receipt?.boundariesFromFifths).toBe(2);
    expect(receipt?.fifthsOnADarkSeam).toBe(2);
    expect(receipt?.fifthsOnNothing).toBe(0);
    expect(receipt?.dividersFound).toBe(0);
  });

  it("one blind boundary beside one good one is enough to warn — the mixed case", async () => {
    /*
      A per-sheet *all or nothing* rule would go quiet whenever any boundary
      read well, and the mixed case is the realistic one. First boundary on a
      real hairline, second on a flat nothing.
    */
    const means = new Array<number>(3840).fill(190);
    means[1280] = 100;

    const lines = await render(await sheetFromMeans(means, 64));

    expect(lines).toHaveLength(1);
    expect(lines[0]!.level, "one blind boundary beside one good one went unreported").toBe("warn");
  });
});

/* ------------------------------------------------- what this card does NOT fix */

/**
 * ⚠ **A FIGURE ACROSS A BOUNDARY NEVER REACHES THE FALLBACK AT ALL, SO NOTHING
 * WARNS ABOUT IT — MEASURED HERE, FIXED NOWHERE, AND FILED.**
 *
 * #1967 asked for *"an arm with a figure crossing the boundary shows one
 * [warning]"*. Driven on the real head-sheet profile with a dark body patched
 * across its second boundary, that arm **cannot exist on the fallback road**:
 * the bright search finds a 55–62 contrast step at the FIGURE'S OWN EDGE, calls
 * it a divider, and cuts there. `source` is `divider`, no fallback happens, and
 * neither the old warning nor the new one fires.
 *
 * So the case the alarm's sentence describes — *a panel may be cut inside the
 * figure* — actually arrives by a road the alarm has never watched, and the
 * panels come out visibly unequal while the receipt reads as a clean read.
 * `findDarkSeamAt` is right about the figure (it refuses it, arm above); the
 * bright search is what hands it a false divider first.
 *
 * **Not fixed here on purpose.** Teaching the divider search to reject a step
 * that is a figure edge changes WHERE paid panels are cut, which is #1904's
 * question and his eye's to close; this card is explicitly *"logging only; no
 * customer surface"*. Pinned so the finding lives in the tree and not only on a
 * card — **if this arm goes red because a later change makes the figure case
 * fall back, that is the fix landing: delete the arm and close #1976**, which
 * carries the table below and a possible shape for the repair.
 */
describe("⚠ the false divider at a figure's edge — a finding, not a fix (#1976)", () => {
  const headMeans = (): number[] => {
    const sheet = TWO_SHEET.find((s) => s.kind === "head" && s.render === "parallel");
    return [...sheet!.columnMeans];
  };

  it("a body across the second boundary is read as a divider, not as a fallback", () => {
    for (const span of [20, 60, 160, 320]) {
      const means = headMeans();
      const half = Math.floor(span / 2);
      for (let x = 2560 - half; x <= 2560 + half; x += 1) means[x] = 95;

      const geometry = findSheetPanelGeometry(Float64Array.from(means), 3840, 3);
      const second = geometry.boundaries[1]!;

      expect(
        second.source,
        `span ${span}: the figure case now falls back — the repair has landed, so delete this`
          + " arm and close #1976",
      ).toBe("divider");
      expect(second.band!.contrast, `span ${span}: the false band`).toBeGreaterThan(
        DARK_SEAM_MIN_DEPTH,
      );
      /* The cut moves off the true seam, which is the cost of the finding. */
      expect(Math.abs(second.rightStart - 2560), `span ${span}: the cut stayed on the seam`)
        .toBeGreaterThan(40);
      /* And the criterion this card DID build is right about it either way. */
      expect(findDarkSeamAt(means, 3840, 2560), `span ${span}: the figure read as a hairline`)
        .toBeNull();
    }
  });

  it("the first boundary is untouched by it — the damage is local to the one window", () => {
    const means = headMeans();
    for (let x = 2530; x <= 2590; x += 1) means[x] = 95;
    const geometry = findSheetPanelGeometry(Float64Array.from(means), 3840, 3);
    expect(geometry.boundaries[0]!.source).toBe("fifth");
    expect(geometry.boundaries[0]!.darkSeam).not.toBeNull();
  });

});
