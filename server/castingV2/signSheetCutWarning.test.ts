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
 *      head-sheet profile and loud on a blind one;
 *   5. the FIGURE ACROSS THE LINE (#1976) — it falls back and warns rather
 *      than being cut as a divider at its own edge, and every real boundary in
 *      both fixtures is pinned where it was cut before that change.
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

import type { CastViewAngle } from "../../shared/boardTypes";
import type { ReferenceImage } from "../providers/types";
import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";
import {
  DARK_SEAM_MIN_DEPTH,
  DIVIDER_MIN_CONTRAST,
  findDarkSeamAt,
  findSheetPanelGeometry,
  renderSignSheet,
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

/* The render road's helpers, shared by the alarm arms and the #1976 figure arm. */
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

describe("the alarm, end to end through renderSignSheet (#1967)", () => {
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


/* ------------------------------------------- a figure across the line (#1976) */

/**
 * ⚠ **A FIGURE ACROSS A BOUNDARY FALLS BACK NOW, AND THE ALARM HEARS IT — #1976.**
 *
 * This block replaces the one that pinned the defect (*"a finding, not a
 * fix"*). Driven on the real head-sheet profile with a dark body patched across
 * its second boundary, the bright search used to find a 55–62 contrast step at
 * the FIGURE'S OWN EDGE, call it a divider, and cut there — 57 to 155 px off
 * the seam, `source: "divider"`, and no warning on either road:
 *
 * | figure width | was cut at | was read as |
 * |---|---|---|
 * | 20 px | 2617 (+57) | divider, 62.4 |
 * | 60 px | 2617 (+57) | divider, 62.4 |
 * | 160 px | 2667 (+107) | divider, 62.0 |
 * | 320 px | 2405 (−155) | divider, 55.3 |
 *
 * The cause was one line: the band's contrast was the AVERAGE of the two
 * neighbours 20 px out, so the sample landing inside the body carried the
 * backdrop sample that sat only 19–21 below the band. A divider has backdrop on
 * both sides; a figure's edge has it on one. So each side must clear the floor
 * on its own, and these arms hold both halves of that: the figure falls back,
 * and every real boundary in both fixtures is cut exactly where it was.
 */
describe("⚠ a figure across a boundary is a fallback, not a divider (#1976)", () => {
  const headMeans = (): number[] => [...headSheet("parallel").columnMeans];

  /** A dark body patched across a line, the same shape #1976's table was measured on. */
  function withFigure(means: number[], centre: number, span: number, level = 95): number[] {
    const half = Math.floor(span / 2);
    for (let x = centre - half; x <= centre + half; x += 1) means[x] = level;
    return means;
  }

  it("⚠ the four measured figures fall back to the equal share, where the seam is", () => {
    for (const span of [20, 60, 160, 320]) {
      const means = withFigure(headMeans(), 2560, span);
      const geometry = findSheetPanelGeometry(Float64Array.from(means), 3840, 3);
      const second = geometry.boundaries[1]!;

      expect(
        second.source,
        `span ${span}: a figure's edge was read as a divider — the cut moves off the seam`,
      ).toBe("fifth");
      expect(second.band).toBeNull();
      /* On the equal share, which is where the sheet's own seam sits. The body
         covers the seam, so no dark hairline is credited and the line is the
         plain third. */
      expect(second.darkSeam, `span ${span}: the figure read as a hairline`).toBeNull();
      expect({ leftEnd: second.leftEnd, rightStart: second.rightStart }).toEqual({
        leftEnd: 2559,
        rightStart: 2560,
      });
    }
  });

  it("⚠ the whole driven population: no figure across either head boundary reads as a divider", () => {
    /*
      Not four hand-picked spans: every figure that covers the seam, at widths
      12–400 px, three darknesses and eleven offsets, across BOTH boundaries of
      the shipping head sheet. The AVERAGED reading calls 290 of the 306 a
      divider — counted here too, so this arm is proven able to see the defect
      rather than assumed to.
    */
    const sheet = headSheet("parallel");
    let driven = 0;
    let falseDividers = 0;
    let averagedWouldHave = 0;
    for (const [index, line] of [1280, 2560].entries()) {
      for (const span of [12, 20, 40, 60, 100, 160, 240, 320, 400]) {
        for (const offset of [-150, -100, -60, -30, -10, 0, 10, 30, 60, 100, 150]) {
          for (const level of [40, 95, 140]) {
            const lo = line + offset - Math.floor(span / 2);
            const hi = lo + span - 1;
            /* It must cover the seam, or it is a figure BESIDE the line. */
            if (lo > line - 4 || hi < line + 4) continue;
            const means = [...sheet.columnMeans];
            for (let x = lo; x <= hi; x += 1) means[x] = level;
            const boundary = findSheetPanelGeometry(Float64Array.from(means), 3840, 3)
              .boundaries[index]!;
            driven += 1;
            if (boundary.source === "divider") falseDividers += 1;
            if (averagedContrastAt(means, 3840, line) >= DIVIDER_MIN_CONTRAST) averagedWouldHave += 1;
          }
        }
      }
    }
    expect(driven, "the population was not driven").toBe(306);
    expect(averagedWouldHave, "the control cannot see the defect — this arm proves nothing")
      .toBe(290);
    expect(falseDividers, "a figure across a head-sheet boundary was cut as a divider").toBe(0);
  });

  it("⚠ end to end: the alarm fires on a figure across the line, and the receipt says why", async () => {
    /* #1967 asked for exactly this arm and it could not exist then — the false
       divider meant no fallback, so nothing warned. */
    const lines = await render(await sheetFromMeans(withFigure(headMeans(), 2560, 160), 64));

    expect(lines).toHaveLength(1);
    expect(lines[0]!.level, "a figure across a boundary went unreported").toBe("warn");
    const receipt = logged.find((entry) => entry.message.includes("[signSheet] some panel boundaries"))
      ?.fields;
    expect(receipt?.dividersFound).toBe(0);
    expect(receipt?.fifthsOnADarkSeam).toBe(1);
    expect(receipt?.fifthsOnNothing).toBe(1);
  });

  it("the first boundary is untouched by it — the change is local to the one window", () => {
    const means = withFigure(headMeans(), 2560, 60);
    const geometry = findSheetPanelGeometry(Float64Array.from(means), 3840, 3);
    expect(geometry.boundaries[0]!.source).toBe("fifth");
    expect(geometry.boundaries[0]!.darkSeam).not.toBeNull();
  });

  it("⚠ a band clear of ONE side only is refused; clear of both is a divider — the rule itself", () => {
    /*
      The rule driven directly, with nothing else in the frame. A 3 px band at
      200 with 150 on its left: 50 clear. With 190 on its right it stands only
      10 clear there — the averaged reading says 30, over the floor, which is
      the defect's own shape, and the two-sided one must refuse it. With 170 on
      its right both sides clear the floor and it is a divider.
    */
    const width = 600;
    const profile = (leftLevel: number, rightLevel: number): Float64Array => {
      const means = new Float64Array(width);
      for (let x = 0; x < width; x += 1) means[x] = x < 300 ? leftLevel : rightLevel;
      for (let x = 299; x <= 301; x += 1) means[x] = 200;
      return means;
    };

    const oneSided = profile(150, 190);
    expect(averagedContrastAt(Array.from(oneSided), width, 300)).toBeGreaterThanOrEqual(
      DIVIDER_MIN_CONTRAST,
    );
    expect(findSheetPanelGeometry(oneSided, width, 2).boundaries[0]!.source).toBe("fifth");

    const bothSides = profile(150, 170);
    const found = findSheetPanelGeometry(bothSides, width, 2).boundaries[0]!;
    expect(found.source).toBe("divider");
    /* The receipt carries the WEAKER side — the number the decision was made on. */
    expect(found.band!.contrast).toBe(30);
  });
});

/**
 * ⚠ **EVERY REAL BOUNDARY IS CUT EXACTLY WHERE IT WAS — #1976 changed no
 * measured sheet.** Fifteen dividers and two fallbacks across both fixtures,
 * with #1971's edge trim folded in, pinned column for column. The values are
 * the cut as it stood before the two-sided floor, read off the same function
 * at the parent commit; they are written out rather than recomputed, because a
 * pin that derives its answer from the code under test cannot notice it move.
 */
describe("⚠ every real sheet is cut where it was before #1976", () => {
  const BEFORE: Record<string, { widths: number[]; cuts: Array<[number, number, string]> }> = {
    "body/parallel": { widths: [1748, 1748], cuts: [[1747, 1756, "divider"]] },
    "head/parallel": { widths: [1279, 1278, 1278], cuts: [[1278, 1281, "fifth"], [2558, 2562, "fifth"]] },
    "head/serial": { widths: [1279, 1275, 1277], cuts: [[1278, 1283, "divider"], [2557, 2563, "divider"]] },
    "court/sheet1": {
      widths: [830, 760, 620, 837, 752],
      cuts: [[829, 841, "divider"], [1600, 1611, "divider"], [2230, 2241, "divider"], [3077, 3088, "divider"]],
    },
    "court/sheet2": {
      widths: [797, 779, 683, 869, 695],
      cuts: [[796, 802, "divider"], [1580, 1585, "divider"], [2267, 2272, "divider"], [3140, 3145, "divider"]],
    },
    "court/sheet3": {
      widths: [770, 760, 747, 761, 766],
      cuts: [[769, 780, "divider"], [1539, 1548, "divider"], [2294, 2304, "divider"], [3064, 3074, "divider"]],
    },
  };

  const sheets = [...TWO_SHEET, ...COURT].map((sheet) => ({
    name: `${sheet.kind ?? "court"}/${sheet.render ?? `sheet${sheet.sheet}`}`,
    sheet,
  }));

  it("the population is every fixture sheet, derived, and the table covers it", () => {
    expect(sheets.map((entry) => entry.name).sort()).toEqual(Object.keys(BEFORE).sort());
  });

  for (const name of Object.keys(BEFORE)) {
    it(`${name}: same panels, same cuts, same sources`, () => {
      const { sheet } = sheets.find((entry) => entry.name === name)!;
      const geometry = findSheetPanelGeometry(
        Float64Array.from(sheet.columnMeans),
        sheet.width,
        sheet.panels ?? 5,
      );
      expect(geometry.panels.map((panel) => panel.width)).toEqual(BEFORE[name]!.widths);
      expect(geometry.boundaries.map((b) => [b.leftEnd, b.rightStart, b.source]))
        .toEqual(BEFORE[name]!.cuts);
    });
  }

  it("⚠ and every real divider clears its WEAKER side by about twice the floor", () => {
    /* The margin the two-sided rule spends: 49.9 at the weakest of fifteen. */
    const contrasts = sheets.flatMap(({ sheet }) =>
      findSheetPanelGeometry(Float64Array.from(sheet.columnMeans), sheet.width, sheet.panels ?? 5)
        .boundaries.filter((b) => b.source === "divider").map((b) => b.band!.contrast));
    expect(contrasts).toHaveLength(15);
    expect(Math.min(...contrasts)).toBeCloseTo(49.9, 0);
  });
});

/**
 * THE AVERAGED READING #1976 RETIRED, kept here as the CONTROL and nowhere
 * else: the arms above count what it would have called a divider, so they are
 * proven able to see the defect rather than assumed to. Same window, same peak,
 * same band growth as the detector; only the last line differs.
 */
function averagedContrastAt(means: ArrayLike<number>, width: number, line: number): number {
  const window = Math.round(width * 0.06);
  const lo = Math.max(0, line - window);
  const hi = Math.min(width - 1, line + window);
  let peak = lo;
  for (let x = lo; x <= hi; x += 1) if (means[x]! > means[peak]!) peak = x;
  let start = peak;
  let end = peak;
  while (start - 1 >= lo && means[start - 1]! >= means[peak]! - 12) start -= 1;
  while (end + 1 <= hi && means[end + 1]! >= means[peak]! - 12) end += 1;
  const left = means[Math.max(0, start - 20)]!;
  const right = means[Math.min(width - 1, end + 20)]!;
  return means[peak]! - (left + right) / 2;
}
