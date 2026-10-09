/**
 * THE SIGN SHEET — its prompt, its cut, and the control that makes the cut mean
 * something.
 *
 * # What this suite is driven on, and why it is not a fixture
 *
 * ⚠ **The geometry arms read the REAL measured signal of the three GPT Image
 * 2.5 Sunburst sheets whose cut views his eye passed** (#1690, 2026-10-07), not
 * a drawn picture. `__fixtures__/signSheet.courtColumnMeans.json` holds their
 * per-column brightness and the widths of the relay's own cut panels, with its
 * provenance in the file. The sheets themselves are 30 MB of PNG under a
 * gitignored `output/`, so committing the SIGNAL rather than the pictures is
 * what lets this run in CI at all — and the signal is the whole of what
 * {@link findSheetPanelGeometry} reads, so nothing is approximated by doing it.
 *
 * # The arm that matters is the CONTROL
 *
 * His card: *"Build it as a function with an arm that a blind-fifths cut
 * fails."* So the same assertion is made twice on the same data — once against
 * the detector and once against equal fifths — and the second one must fail.
 * Measured here: the detector lands within **13 px** of the relay's judged
 * panels across all fifteen, and fifths misses by up to **144 px**. A single
 * tolerance of 20 px separates them on every sheet, which is why the number is
 * 20 and not a round 50: a loose tolerance would let a blind cut pass and the
 * arm would prove nothing (law 2 — an instrument that cannot fail is not an
 * instrument).
 *
 * # Why a wrong cut is not caught anywhere else
 *
 * #1903 left the view judge three axes — identity, intact, people — and **none
 * of them is framing.** A panel cut 144 px inside a figure is the same person,
 * an unbroken file and one person, so it passes every axis and is charged.
 * These arms are the only thing between that and a customer.
 */
import { readFileSync } from "node:fs";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import type { ReferenceImage } from "../providers/types";
import type { SheetBoundary } from "./signSheet";
import { pronounsForSex } from "./castPronouns";
import { CAST_PACKAGE_VIEWS } from "./castViewPackage";
import {
  composeSignSheetPrompt,
  cutSignSheet,
  DIVIDER_MIN_CONTRAST,
  DIVIDER_SEARCH_FRACTION,
  findSheetPanelGeometry,
  renderSignSheet,
  sheetColumnMeans,
  seamColumnsAtEdge,
  sheetReferenceFromMaster,
  SIGN_SHEET_PANEL_LINES,
  SIGN_SHEET_PANEL_ORDER,
  signSheetPlan,
} from "./signSheet";

type CourtSheet = {
  sheet: number;
  width: number;
  height: number;
  judgedPanelWidths: number[];
  columnMeans: number[];
};

const COURT = JSON.parse(
  readFileSync("server/castingV2/__fixtures__/signSheet.courtColumnMeans.json", "utf8"),
) as { provenance: Record<string, string>; sheets: CourtSheet[] };

/**
 * The widest a found panel may sit from the panel his eye judged.
 *
 * Measured both ways on the same three sheets, which is the only reason one
 * number can do this job: the detector's worst is 13 px and equal fifths' BEST
 * failure is 23 px, so 20 passes the detector on all fifteen panels and fails
 * fifths on all three sheets.
 */
const PANEL_TOLERANCE_PX = 20;

/** Equal fifths — the control, written out rather than imported, because it is the thing being refuted. */
function blindEqualPanels(width: number, count: number): number[] {
  const widths: number[] = [];
  for (let k = 0; k < count; k += 1) {
    const left = Math.round((width * k) / count);
    const right = k === count - 1 ? width : Math.round((width * (k + 1)) / count);
    widths.push(right - left);
  }
  return widths;
}

/** A flat profile with bright bands at the given spans — the shape a real divider has. */
function profileWith(input: {
  width: number;
  background: number;
  bands: readonly { start: number; end: number; level: number }[];
}): Float64Array {
  const means = new Float64Array(input.width).fill(input.background);
  for (const band of input.bands) {
    for (let x = band.start; x <= band.end; x += 1) means[x] = band.level;
  }
  return means;
}

describe("the Sign sheet's panel geometry, on the sheets his eye passed", () => {
  it("the fixture is the real court and says so", () => {
    expect(COURT.sheets).toHaveLength(3);
    expect(COURT.provenance.court).toContain("#1690");
    for (const sheet of COURT.sheets) {
      // The ask, unclamped — read at the returned bytes of each real sheet.
      expect({ width: sheet.width, height: sheet.height }).toEqual({ width: 3840, height: 1648 });
      expect(sheet.columnMeans).toHaveLength(sheet.width);
      expect(sheet.judgedPanelWidths).toHaveLength(CAST_PACKAGE_VIEWS.length);
    }
  });

  it("finds a real divider at every one of the twelve boundaries", () => {
    for (const sheet of COURT.sheets) {
      const geometry = findSheetPanelGeometry(sheet.columnMeans, sheet.width, 5);
      expect(geometry.boundaries).toHaveLength(4);
      for (const boundary of geometry.boundaries) {
        expect(boundary.source).toBe("divider");
        // Not a nearly-flat patch of backdrop: the measured floor is 53.
        expect(boundary.band!.contrast).toBeGreaterThan(40);
        // A line, not a region: the measured bands are 2–9 px.
        expect(boundary.band!.end - boundary.band!.start + 1).toBeLessThanOrEqual(12);
      }
    }
  });

  it("cuts the panels his eye judged, and a blind-fifths cut does not", () => {
    const detector: number[] = [];
    const fifths: number[] = [];
    for (const sheet of COURT.sheets) {
      const found = findSheetPanelGeometry(sheet.columnMeans, sheet.width, 5)
        .panels.map((panel) => panel.width);
      const blind = blindEqualPanels(sheet.width, 5);
      sheet.judgedPanelWidths.forEach((judged, index) => {
        detector.push(Math.abs(found[index] - judged));
        fifths.push(Math.abs(blind[index] - judged));
      });
    }

    // THE DETECTOR PASSES — every panel, every sheet.
    expect(Math.max(...detector)).toBeLessThanOrEqual(PANEL_TOLERANCE_PX);

    /*
      THE CONTROL FAILS — and it fails on every sheet, not just on average,
      which is the stronger statement. A per-sheet assertion is what stops a
      future tolerance change from being "mostly fine": one well-behaved sheet
      cannot carry the other two.
    */
    const perSheetFifthWorst = [0, 1, 2].map((sheetIndex) =>
      Math.max(...fifths.slice(sheetIndex * 5, sheetIndex * 5 + 5)));
    for (const worst of perSheetFifthWorst) {
      expect(worst).toBeGreaterThan(PANEL_TOLERANCE_PX);
    }
    /* And the worst blind miss is a figure's width, not a rounding error — the
       number his card predicted (panels 624–868 against a 768 fifth). */
    expect(Math.max(...fifths)).toBeGreaterThan(100);
  });

  it("every panel is whole: the found panels tile the sheet with no gap and no overlap", () => {
    for (const sheet of COURT.sheets) {
      const { panels, boundaries } = findSheetPanelGeometry(sheet.columnMeans, sheet.width, 5);
      expect(panels[0].left).toBe(0);
      expect(panels[4].left + panels[4].width).toBe(sheet.width);
      panels.forEach((panel, index) => {
        if (index === 0) return;
        /* Each panel starts exactly where its boundary says, and the only
           columns nobody owns are the divider bands themselves. */
        expect(panel.left).toBe(boundaries[index - 1].rightStart);
        expect(boundaries[index - 1].leftEnd).toBe(panels[index - 1].left + panels[index - 1].width - 1);
      });
      const owned = panels.reduce((sum, panel) => sum + panel.width, 0);
      const dividers = boundaries.reduce((sum, b) => sum + (b.band!.end - b.band!.start + 1), 0);
      /*
        ⚠ **AND THE TRIM IS IN THE SUM — #1971.** The unowned columns used to be
        exactly the divider bands; since the trim they are the bands PLUS the
        shoulder columns either side of each one, which is what stops a panel
        keeping the line that marks its edge. Leaving the trim out of this
        accounting would make the arm red for the fix; adding it as a free
        remainder would make the arm unable to notice a lost column. So it is
        read off the receipt each boundary carries.
      */
      const trimmed = boundaries.reduce((sum, b) => sum + b.trimmed.left + b.trimmed.right, 0);
      expect(trimmed).toBeGreaterThan(0);
      expect(owned + dividers + trimmed).toBe(sheet.width);
    }
  });
});

describe("the detector's thresholds are live, not decoration", () => {
  const WIDTH = 500;
  const FIFTH = 100;

  it("a weak band falls back to the fifth and a strong one does not — the same profile, one level apart", () => {
    const bandsAt = (level: number) => [
      { start: 118, end: 121, level },
      { start: 218, end: 221, level },
      { start: 318, end: 321, level },
      { start: 418, end: 421, level },
    ];
    /* 20 above background: under the measured floor of 25, so no divider. */
    const weak = findSheetPanelGeometry(
      profileWith({ width: WIDTH, background: 128, bands: bandsAt(148) }), WIDTH, 5);
    expect(weak.boundaries.map((b) => b.source)).toEqual(["fifth", "fifth", "fifth", "fifth"]);
    expect(weak.panels.map((p) => p.width)).toEqual([FIFTH, FIFTH, FIFTH, FIFTH, FIFTH]);

    /* 40 above background: over it, so the same four bands are now dividers. */
    const strong = findSheetPanelGeometry(
      profileWith({ width: WIDTH, background: 128, bands: bandsAt(168) }), WIDTH, 5);
    expect(strong.boundaries.map((b) => b.source)).toEqual(["divider", "divider", "divider", "divider"]);
    expect(strong.panels.map((p) => p.width)).toEqual([118, 96, 96, 96, 78]);
  });

  it("a flat sheet with no dividers at all reports fifths rather than inventing four", () => {
    const geometry = findSheetPanelGeometry(
      profileWith({ width: WIDTH, background: 200, bands: [] }), WIDTH, 5);
    expect(geometry.boundaries.every((b) => b.source === "fifth" && b.band === null)).toBe(true);
  });

  it("looks no further than his ±6% of the WIDTH, so a divider in the next panel is not stolen", () => {
    const window = Math.round(WIDTH * DIVIDER_SEARCH_FRACTION);
    expect(window).toBe(30);
    /* A bright band 40 px from the first fifth — outside the window — must not
       be taken, however bright it is. */
    const geometry = findSheetPanelGeometry(
      profileWith({ width: WIDTH, background: 100, bands: [{ start: 140, end: 143, level: 255 }] }),
      WIDTH,
      5,
    );
    expect(geometry.boundaries[0].source).toBe("fifth");
  });

  it("refuses a cut that would hand a customer a sliver instead of a view", () => {
    /*
      Two dividers pushed to the far edges of their own windows squeeze the
      middle panel to 39 px against a 100 px equal panel — under the 0.4 floor.
      The sheet is refused rather than delivered, because the judge's three
      surviving axes cannot see a sliver and the caller's arrival budget is the
      right road for "this sheet did not arrive usable".
    */
    expect(() =>
      findSheetPanelGeometry(
        profileWith({
          width: WIDTH,
          background: 100,
          bands: [
            { start: 118, end: 121, level: 255 },
            { start: 227, end: 230, level: 255 },
            { start: 270, end: 273, level: 255 },
            { start: 418, end: 421, level: 255 },
          ],
        }),
        WIDTH,
        5,
      ),
    ).toThrow(/did not cut into 5 usable panels/);
  });
});

/** A synthetic sheet: five panels of DIFFERENT widths, separated by white bands. */
async function drawSyntheticSheet(): Promise<{ bytes: Buffer; widths: number[] }> {
  const width = 500;
  const height = 40;
  const widths = [120, 80, 104, 90, 90];
  const raw = Buffer.alloc(width * height, 0);
  let x = 0;
  widths.forEach((panelWidth, index) => {
    const level = 40 + index * 20;
    for (let y = 0; y < height; y += 1) raw.fill(level, y * width + x, y * width + x + panelWidth);
    x += panelWidth;
    if (index < widths.length - 1) {
      for (let y = 0; y < height; y += 1) raw.fill(255, y * width + x, y * width + x + 4);
      x += 4;
    }
  });
  const bytes = await sharp(raw, { raw: { width, height, channels: 1 } }).png().toBuffer();
  return { bytes, widths };
}

/**
 * ⚠ **THE TWO SHAPES HIS RULING ACTUALLY SHIPS — and the detector had never
 * met either of them.**
 *
 * Every constant above was measured on FIVE-panel 21:9 sheets. #1926 renders a
 * **2-panel 3504x2336** body sheet and a **3-panel 3840x1648** head sheet: wider
 * figures, fewer boundaries, a different search window. A detector tuned on one
 * population and trusted on another is working law 2 exactly, and the cost of
 * being wrong here is the one defect nothing downstream can see.
 *
 * The population is the relay's own tested renders — the sheets his eye judged
 * when he ruled option 1 — carried as their column profiles in
 * `__fixtures__/signSheet.twoSheetColumnMeans.json` for the court fixture's
 * reason (the PNGs are 31 MB under a gitignored `output/`).
 *
 * ⚠ **WHAT THESE ARMS FOUND, AND IT CHANGES THE ROAD RATHER THAN CONFIRMING
 * IT: the body sheet carries a real divider and the PARALLEL HEAD SHEET DOES
 * NOT.** On the head sheet the brightest column anywhere in either search
 * window lifts only ~16 greylevels above its local median, against a floor of
 * {@link DIVIDER_MIN_CONTRAST} = 25 — so the detector correctly reports *no
 * divider* and falls back to equal thirds, on every head sheet, forever.
 *
 * That fallback is **right here, and it is right for a readable reason rather
 * than by luck**: the serial head sheet below is an independent sample of the
 * same prompt and camera set whose seams ARE bright, and they sit at 1280.5 and
 * 2560.5 — within **2 px** of the equal thirds the fallback chose. Sunburst is
 * being asked for *"panels of exactly equal width"* and is delivering them, so
 * on this shape the equal cut and the true cut are the same cut.
 *
 * ⚠ **The consequence was a log one, filed rather than fixed in this suite —
 * and it IS FIXED NOW (#1967, his *"3) go with your rec"* on #1904).**
 * `renderSignSheet` used to warn whenever any boundary came from a fallback,
 * calling it *"the only alarm there is"*, so on the head sheet it fired on
 * every single Sign and an alarm that always cries cannot report the one case
 * it exists for.
 *
 * ⚠ **AND THE FIX FOUND THAT THE PREMISE OF THE PARAGRAPH ABOVE IS INCOMPLETE,
 * WHICH IS WORTH MORE THAN THE FIX.** *"No divider bright enough to read"* is
 * true and reads as *no seam*; the head sheet HAS a seam and it is **dark** —
 * a hairline trough sitting at exactly 1280 and 2560, 1 and 2 px wide, 89.0
 * and 58.5 greylevels below its neighbourhood. So the fallback is right for a
 * reason about THIS picture, where the argument above borrowed one from the
 * serial render, which is a different picture. The arms are in
 * `signSheetCutWarning.test.ts`, which also carries what #1967 deliberately did
 * NOT fix and #1976 then did: a figure across a boundary made the bright search
 * claim a false divider at the figure's own edge, because the band's contrast
 * was the AVERAGE of its two sides. It is the weaker side now, so the figure
 * falls back and the alarm hears it, and every real boundary here is pinned
 * where it was.
 */
describe("⚠ the two sheet shapes his #1926 ruling ships", () => {
  type TwoSheet = {
    kind: "head" | "body";
    render: "parallel" | "serial";
    panels: number;
    width: number;
    height: number;
    columnMeans: number[];
  };

  const TWO = JSON.parse(
    readFileSync("server/castingV2/__fixtures__/signSheet.twoSheetColumnMeans.json", "utf8"),
  ) as { provenance: Record<string, string>; sheets: TwoSheet[] };

  const sheetFor = (kind: "head" | "body", render: "parallel" | "serial"): TwoSheet => {
    const found = TWO.sheets.find((s) => s.kind === kind && s.render === render);
    if (!found) throw new Error(`no ${render} ${kind} sheet in the fixture`);
    return found;
  };

  const geometryOf = (sheet: TwoSheet) =>
    findSheetPanelGeometry(Float64Array.from(sheet.columnMeans), sheet.width, sheet.panels);

  it("the fixture is the relay's own tested renders and says which one ships", () => {
    expect(TWO.provenance.ruling).toContain("#1926");
    expect(TWO.provenance.render).toContain("parallel` is the shape that ships");
    expect(TWO.sheets.map((s) => `${s.kind}/${s.render}`).sort()).toEqual([
      "body/parallel",
      "head/parallel",
      "head/serial",
    ]);
  });

  it("the plan derives both sheets from the package's own list, in its order", () => {
    const plan = signSheetPlan();
    expect(plan.map((sheet) => sheet.kind)).toEqual(["head", "body"]);
    /*
      ⚠ **HIS TWO LISTS, PINNED LITERALLY — and the union arm below cannot do
      this job.** Moving a view from one sheet to the other leaves the union
      exactly equal to the package, so every derived check still passes while a
      full-length figure is rendered at head pixels. The split is a quotation
      from his #1926 ruling, so it is asserted as one.
    */
    expect(plan.find((s) => s.kind === "head")?.panelOrder).toEqual([
      "closeUp",
      "threeQuarter",
      "sideClose",
    ]);
    expect(plan.find((s) => s.kind === "body")?.panelOrder).toEqual(["frontFull", "backFull"]);
    /* ⚠ The union is the guarantee, not the two lists: every view the package
       promises is painted exactly once, so a sixth view cannot be silently
       dropped off both sheets or quietly painted on both. */
    const painted = plan.flatMap((sheet) => sheet.panelOrder);
    expect([...painted].sort()).toEqual([...CAST_PACKAGE_VIEWS].sort());
    expect(painted).toHaveLength(CAST_PACKAGE_VIEWS.length);
    /* Each sheet keeps the package's own order, which is what lets the prompt
       and the cut read one list (working law 4). */
    for (const sheet of plan) {
      expect(sheet.panelOrder).toEqual(
        CAST_PACKAGE_VIEWS.filter((angle) => sheet.panelOrder.includes(angle)),
      );
    }
    expect(plan.find((s) => s.kind === "head")?.size).toEqual({ width: 3840, height: 1648 });
    expect(plan.find((s) => s.kind === "body")?.size).toEqual({ width: 3504, height: 2336 });
  });

  it("the BODY sheet's divider is real and the detector reads it", () => {
    const sheet = sheetFor("body", "parallel");
    const geometry = geometryOf(sheet);

    expect(geometry.boundaries).toHaveLength(1);
    const [boundary] = geometry.boundaries;
    expect(boundary!.source).toBe("divider");
    /* Measured 52.4 on its weaker side (53.6 averaged) — twice the floor, so
       this is not a marginal read. */
    expect(boundary!.band!.contrast).toBeGreaterThan(DIVIDER_MIN_CONTRAST);
    /* And it lands where the engine was asked to put it. */
    const centre = (boundary!.leftEnd + boundary!.rightStart) / 2;
    expect(Math.abs(centre - sheet.width / 2)).toBeLessThanOrEqual(PANEL_TOLERANCE_PX);
    /* 1748 and not the 1749 either side of the band: #1971 trims the one
       shoulder column each panel was keeping off the divider. */
    expect(geometry.panels.map((p) => p.width)).toEqual([1748, 1748]);
    expect(boundary!.trimmed).toEqual({ left: 1, right: 1 });
  });

  it("⚠ the PARALLEL HEAD sheet has NO divider bright enough to read — measured, not assumed", () => {
    const sheet = sheetFor("head", "parallel");
    const geometry = geometryOf(sheet);

    expect(geometry.boundaries).toHaveLength(2);
    /* Both fall back. This is the finding, pinned so it cannot change unnoticed. */
    expect(geometry.boundaries.map((b) => b.source)).toEqual(["fifth", "fifth"]);
    expect(geometry.boundaries.every((b) => b.band === null)).toBe(true);

    /* WHY it falls back, read off the profile rather than inferred from the
       verdict: the brightest column in each window is barely above its
       neighbours, where a real divider stands 50+ clear. */
    const means = Float64Array.from(sheet.columnMeans);
    const half = Math.round(sheet.width * DIVIDER_SEARCH_FRACTION);
    for (const nominal of [sheet.width / 3, (sheet.width * 2) / 3]) {
      const from = Math.max(0, Math.round(nominal) - half);
      const to = Math.min(sheet.width - 1, Math.round(nominal) + half);
      const window = Array.from(means.slice(from, to + 1));
      const peak = Math.max(...window);
      const median = [...window].sort((a, b) => a - b)[Math.floor(window.length / 2)]!;
      expect(peak - median).toBeLessThan(DIVIDER_MIN_CONTRAST);
    }
  });

  it("⚠ and the fallback is nevertheless the RIGHT cut — proven against an independent sample", () => {
    /*
      The control that makes the arm above safe rather than alarming. The serial
      head sheet is the same prompt and the same five cameras with seams that
      ARE bright, so its DETECTED boundaries say where a head sheet's true seams
      lie. If equal thirds agreed with them, equal thirds is the true cut on
      this shape — and it does, to 2 px.
    */
    const serial = sheetFor("head", "serial");
    const serialGeometry = geometryOf(serial);
    expect(serialGeometry.boundaries.map((b) => b.source)).toEqual(["divider", "divider"]);

    const parallel = sheetFor("head", "parallel");
    const parallelGeometry = geometryOf(parallel);
    expect(parallel.width).toBe(serial.width);

    serialGeometry.boundaries.forEach((trueSeam, index) => {
      const trueCentre = (trueSeam.leftEnd + trueSeam.rightStart) / 2;
      const fellBack = parallelGeometry.boundaries[index]!;
      const fallbackCentre = (fellBack.leftEnd + fellBack.rightStart) / 2;
      expect(Math.abs(fallbackCentre - trueCentre)).toBeLessThanOrEqual(2);
    });
  });

  it("⚠ every panel of both shipped shapes shows in the strip, which is the whole reason there are two", () => {
    /*
      The arithmetic #1926 was decided on, recomputed from the CSS rather than
      quoted: `.dpc-sheetcard__frame` is `aspect-ratio: 4 / 5` with
      `object-fit: cover`, so a tile shows (panelAspect / 0.8) of a panel's
      height. One five-panel sheet gave 0.466 and therefore 58% — the close-up
      lost its mouth. Today's Nano Banana Pro view is 1696x2528 and shows 84%.
      Both shipped shapes beat it.
    */
    const TILE_ASPECT = 4 / 5;
    const TODAYS_NBP_VIEW = 1696 / 2528;
    const todayShows = TODAYS_NBP_VIEW / TILE_ASPECT;

    for (const render of ["body", "head"] as const) {
      const sheet = sheetFor(render, "parallel");
      const geometry = geometryOf(sheet);
      for (const panel of geometry.panels) {
        const shows = panel.width / sheet.height / TILE_ASPECT;
        expect(shows).toBeLessThanOrEqual(1);
        expect(shows).toBeGreaterThan(todayShows);
        expect(shows).toBeGreaterThan(0.92);
      }
    }

    /* The control: the single five-panel sheet this ruling replaced does NOT
       clear that bar — without it the arm above would pass on the shape his
       ruling threw out. */
    const oneSheetPanel = (3840 / 5) / 1648;
    expect(oneSheetPanel / TILE_ASPECT).toBeLessThan(0.6);
  });
});

describe("cutting the bytes that arrived", () => {
  it("reads a column mean over the whole height, which is what makes a 4px line beat a face", async () => {
    const { bytes } = await drawSyntheticSheet();
    const { means, width, height } = await sheetColumnMeans(bytes);
    expect({ width, height }).toEqual({ width: 500, height: 40 });
    expect(means[0]).toBeCloseTo(40, 1);
    expect(means[121]).toBeCloseTo(255, 1);
    expect(means[499]).toBeCloseTo(120, 1);
  });

  it("hands each view the panel that is its own, keyed in the package's order", async () => {
    const { bytes, widths } = await drawSyntheticSheet();
    const cut = await cutSignSheet(bytes);

    expect(Object.keys(cut.panels)).toEqual([...SIGN_SHEET_PANEL_ORDER]);
    expect(cut.geometry.panels.map((panel) => panel.width)).toEqual(widths);
    expect(cut.source).toEqual({ width: 500, height: 40 });

    /*
      ⚠ THE ARM THAT PROVES THE MAPPING, not just the widths. Each synthetic
      panel carries its own grey level, so a cut that shifted the panels by one
      slot would keep every width correct and hand the close-up the
      three-quarter's picture — the quietest defect this road has, and one that
      no width assertion can see.
     */
    for (const [index, angle] of SIGN_SHEET_PANEL_ORDER.entries()) {
      const stats = await sharp(cut.panels[angle].bytes).stats();
      expect(cut.panels[angle].contentType).toBe("image/png");
      expect(stats.channels[0].mean).toBeCloseTo(40 + index * 20, 1);
      expect((await sharp(cut.panels[angle].bytes).metadata()).width).toBe(widths[index]);
    }
  });

  it("refuses an image it cannot read rather than cutting five empty panels", async () => {
    await expect(cutSignSheet(Buffer.from("not an image"))).rejects.toThrow();
  });
});

describe("her master, on the way to the door", () => {
  it("goes as a JPEG at the same pixels, and much smaller", async () => {
    /* A gradient rather than flat colour: a flat PNG compresses to nothing and
       would make the size claim vacuous. */
    const raw = Buffer.alloc(256 * 256);
    for (let y = 0; y < 256; y += 1) for (let x = 0; x < 256; x += 1) raw[y * 256 + x] = (x * y) % 256;
    const png = await sharp(raw, { raw: { width: 256, height: 256, channels: 1 } }).png().toBuffer();

    const reference = await sheetReferenceFromMaster({ bytes: png, contentType: "image/png" });
    expect(reference.contentType).toBe("image/jpeg");
    const meta = await sharp(reference.bytes).metadata();
    expect({ width: meta.width, height: meta.height }).toEqual({ width: 256, height: 256 });
    expect(meta.format).toBe("jpeg");
    expect(reference.bytes.length).toBeLessThan(png.length);
  });
});

describe("the sheet's prompt", () => {
  const SIFR = {
    description: "A white, body-conscious dress that mixes qipao structure with industrial straps.",
    pronouns: pronounsForSex("female"),
  };

  it("has a panel line for every view the package promises, and refuses one it has not got", () => {
    for (const angle of CAST_PACKAGE_VIEWS) {
      expect(SIGN_SHEET_PANEL_LINES[angle], `no panel line for ${angle}`).toBeTypeOf("function");
    }
    expect(SIGN_SHEET_PANEL_ORDER).toEqual(CAST_PACKAGE_VIEWS);
    /* The two angles outside the package deliberately have none — authoring
       prompt text his eye never saw, for views no Sign renders, is the thing
       the Partial keying exists to avoid. */
    expect(SIGN_SHEET_PANEL_LINES.frontClose).toBeUndefined();
    expect(SIGN_SHEET_PANEL_LINES.sideFull).toBeUndefined();
    expect(() => composeSignSheetPrompt({ panelOrder: ["sideFull"] }))
      .toThrow(/no panel line for the sideFull view/);
  });

  it("numbers the panels in the package's own order, so the cut and the prompt agree", () => {
    const prompt = composeSignSheetPrompt(SIFR);
    const panelLines = prompt.split("\n").filter((line) => line.startsWith("PANEL "));
    expect(panelLines).toHaveLength(5);
    expect(panelLines[0]).toContain("PANEL 1 — THE CLOSE-UP");
    expect(panelLines[1]).toContain("PANEL 2 — THE THREE-QUARTER");
    expect(panelLines[2]).toContain("PANEL 3 — THE FULL FRONT");
    expect(panelLines[3]).toContain("PANEL 4 — THE PROFILE");
    expect(panelLines[4]).toContain("PANEL 5 — THE FULL BACK");
  });

  it("says no do-NOT anywhere — the whole point of the rewrite he judged", () => {
    /*
      His card: *"the positive-style rewrite judged on #1690 … with no 'do NOT'
      clauses"*. The earlier sheet prompt had nine of them and he could not judge
      its result; this is the property that distinguishes the two.
    */
    const prompt = composeSignSheetPrompt(SIFR);
    expect(prompt).not.toMatch(/\bdo not\b/i);
    expect(prompt).not.toMatch(/\bnever\b/i);
    expect(prompt).not.toMatch(/\bno gutters\b/i);
  });

  it("takes the outfit from the stored line first, the brief second, and invents nothing third", () => {
    const line = composeSignSheetPrompt({ wardrobeLine: "a navy flight suit", ...SIFR });
    expect(line).toContain("HER OUTFIT, as cast: a navy flight suit.");
    /* The stored line wins over the brief where both exist — the order
       `wardrobeSpecFor` reads them in. */
    expect(line).not.toContain("qipao");

    const brief = composeSignSheetPrompt(SIFR);
    expect(brief).toContain("HER BRIEF, as cast: A white, body-conscious dress");
    /* His sentence continues mid-paragraph, so the brief's own full stop must
       not double up. */
    expect(brief).not.toContain("straps..");
    expect(brief).toContain("straps. The brief describes the whole person:");

    const neither = composeSignSheetPrompt({ pronouns: SIFR.pronouns });
    expect(neither).toContain("HER OUTFIT is the one reference 1 shows.");
    expect(neither).not.toContain("as cast:");
  });

  it("files the brief under its own name, never under the outfit heading (#2131)", () => {
    /*
      The production shape that fired the mislabel: a stored line is null
      exactly when the brief names no clothing, so the fallback carried briefs
      like this one — every word of it the cast's body, none of it costume.
    */
    const creature = "Alien creature type, humanoid build, with porous bleached hide and fused natural plating.";
    const prompt = composeSignSheetPrompt({ description: creature, pronouns: pronounsForSex(null) });
    expect(prompt).toContain(`THEIR BRIEF, as cast: ${creature.replace(/\.$/, "")}. The brief describes`);
    expect(prompt).toContain("the clothing the brief names is their outfit.");
    expect(prompt).not.toMatch(/OUTFIT, as cast:[^\n]*hide/);
    expect(prompt).not.toContain("OUTFIT, as cast:");

    /* POSITIVE CONTROL — a stored line is still the outfit, under the outfit
       heading, and the brief's label appears nowhere. */
    const lined = composeSignSheetPrompt({
      wardrobeLine: "a navy flight suit",
      description: creature,
      pronouns: pronounsForSex(null),
    });
    expect(lined).toContain("THEIR OUTFIT, as cast: a navy flight suit.");
    expect(lined).not.toContain("BRIEF, as cast:");

    /* A whitespace line is no line: it falls to the brief, labelled as one. */
    const blank = composeSignSheetPrompt({ wardrobeLine: "   ", description: creature });
    expect(blank).toContain("BRIEF, as cast:");
    expect(blank).not.toContain("OUTFIT, as cast:");
  });

  it("never calls a male cast 'her', and reads a group as plural", () => {
    const male = composeSignSheetPrompt({ wardrobeLine: "a navy flight suit", pronouns: pronounsForSex("male") });
    expect(male).toContain("HIS OUTFIT");
    expect(male).toContain("His back and arms");
    expect(male).toContain("that is the outfit he wears");
    expect(male).not.toMatch(/\bher\b/);
    /* The brief road (#2131) composes with the same pronouns. */
    const maleBrief = composeSignSheetPrompt({ description: "a skincare founder", pronouns: pronounsForSex("male") });
    expect(maleBrief).toContain("HIS BRIEF, as cast:");
    expect(maleBrief).toContain("the clothing the brief names is his outfit.");
    expect(maleBrief).not.toMatch(/\bher\b/);

    const group = composeSignSheetPrompt({ pronouns: pronounsForSex(null) });
    expect(group).toContain("THEIR OUTFIT");
    expect(group).toContain("that is the outfit they wear");
    expect(group).not.toContain("they wears");
  });

  it("corrects the one stale clause rather than carrying it: his panel 5 named two references", () => {
    /*
      His judged text ends panel 5 *"exactly what the two references
      establish"* — a leftover from the plate-road sheet, where reference 2 was
      the wardrobe plate. This road sends ONE reference, and a paid panel told
      to read a picture the request does not hold is the defect every other
      clause in this product derives its ordinals to avoid.
    */
    const prompt = composeSignSheetPrompt(SIFR);
    expect(prompt).toContain("carry exactly what reference 1 establishes");
    expect(prompt).not.toContain("two references");
  });
});

describe("rendering the sheet", () => {
  type Sent = { prompt: string; referenceTypes: string[]; resolution: string };

  async function anchorPng(): Promise<ReferenceImage> {
    const bytes = await sharp({
      create: { width: 64, height: 96, channels: 3, background: "#808080" },
    }).png().toBuffer();
    return { bytes, contentType: "image/png" };
  }

  it("sends one JPEG reference at the signed-view tier and comes back with five keyed panels", async () => {
    const { bytes } = await drawSyntheticSheet();
    const sent: Sent[] = [];
    const sheet = await renderSignSheet({
      engine: {
        async editWithReferences(request) {
          sent.push({
            prompt: request.prompt,
            referenceTypes: request.references.map((reference) => reference.contentType),
            resolution: request.resolution,
          });
          return {
            bytes,
            contentType: "image/png",
            latencyMs: 61_000,
            estimatedCostUsd: null,
            provenance: { provider: "fal", model: "openai/gpt-image-2.5/sunburst/edit" },
          };
        },
      },
      anchor: await anchorPng(),
      description: "a navy flight suit",
      operationId: 1904,
    });

    expect(sent).toHaveLength(1);
    // His card: *"One reference: her signed master, sent as a JPEG"*.
    expect(sent[0].referenceTypes).toEqual(["image/jpeg"]);
    expect(sent[0].resolution).toBe("2K");
    expect(sent[0].prompt).toContain("A CHARACTER SHEET");
    expect(Object.keys(sheet.panels)).toEqual([...SIGN_SHEET_PANEL_ORDER]);
    expect(sheet.latencyMs).toBe(61_000);
    /* The stamp every panel's asset row carries — the only honest record of a
       delivered view's real size, since `resolution` says `2K` either way. */
    expect(sheet.provenance.model).toBe("openai/gpt-image-2.5/sunburst/edit");
  });

  it("REFUSES a sheet with no provenance rather than guessing which engine painted", async () => {
    /*
      ⚠ Five permanent asset rows are about to record an engine. A fallback
      would write a plausible wrong one onto all five, and nothing downstream
      could ever disagree — `resolution` says `2K` for a 1696x2528 Nano Banana
      Pro view and for a ~768x1648 Sunburst panel alike, by design.
    */
    const { bytes } = await drawSyntheticSheet();
    await expect(
      renderSignSheet({
        engine: { async editWithReferences() { return { bytes, contentType: "image/png" }; } },
        anchor: await anchorPng(),
      }),
    ).rejects.toThrow(/no provenance to stamp/);
  });

  it("PROPAGATES a fault instead of swallowing it — the opposite of the outfit plate", async () => {
    /*
      ⚠ The arm that keeps the two roads apart. `renderOutfitPlate` answers
      `null` for every fault because a missing plate costs a customer nothing.
      A missing SHEET is the package: there is no softer road behind it, and a
      `null` here would hand the orchestrator five empty slots to charge for.
    */
    await expect(
      renderSignSheet({
        engine: {
          async editWithReferences() {
            throw new Error("the door said 500");
          },
        },
        anchor: await anchorPng(),
      }),
    ).rejects.toThrow(/the door said 500/);
  });

  it("an uncuttable sheet is a fault too, not four good panels and a sliver", async () => {
    /* One flat grey frame: no dividers, so the fifths fallback applies and the
       panels are equal — which is fine. A frame NARROWER than the panel count
       is the shape that cannot be cut at all, and it must reach the caller. */
    const tiny = await sharp({
      create: { width: 3, height: 4, channels: 3, background: "#404040" },
    }).png().toBuffer();
    await expect(
      renderSignSheet({
        engine: {
          async editWithReferences() {
            return { bytes: tiny, contentType: "image/png" };
          },
        },
        anchor: await anchorPng(),
      }),
    ).rejects.toThrow(/cannot hold 5 panels/);
  });
});

/**
 * ⚠ **THE SEAM A CUT EDGE USED TO KEEP — #1971, his own Sign on production.**
 *
 * His words: *"one of the views got cropped badly i can see on the left side of
 * the image where the gap line was between the image and the border on the
 * sheet making the crop look dirty"*. The three-quarter view is the MIDDLE
 * panel of the head sheet, so its left edge is interior boundary 1 — and on the
 * shipping head sheet that boundary's equal share lands at **1280**, which is
 * the sheet's own hairline seam: one column, **89 greylevels below** its
 * neighbourhood. `rightStart = 1280` handed that whole column to his
 * three-quarter view as its first column of pixels.
 *
 * # The control is the rule `main` shipped, written out here
 *
 * Working law 2: these arms would be worth nothing if they could not fail. So
 * every assertion about a clean edge is made twice on the same real signal —
 * once against the detector and once against `edgeTheOldRuleCut`, which
 * reproduces the cut this card replaces (`equal - 1 / equal` for a fallback,
 * `band.start - 1 / band.end + 1` for a divider) — and the second must fail.
 *
 * # What the sweep found, which is why this is not a dark-seam special case
 *
 * Working law 7, the class rather than the instance: the same defect sits on
 * the BRIGHT boundaries, in the other direction. `DIVIDER_BAND_TOLERANCE` grows
 * a band 12 greylevels down from its peak, so the shoulder columns below that
 * stayed at the panel edge — **+15 to +58 over their panel's backdrop**, on
 * sheets whose cut his eye had already passed. Measured across the six real
 * sheets: **26 of 34 cut edges were dirty, and 1 is now**, the worst falling
 * from 95.0 to 10.2 greylevels off backdrop.
 *
 * # And the sweep's negative, which is NOT fixed because there is nothing to fix
 *
 * The card asks after the top, bottom and outer edges. Read on the real bytes
 * of all three sheets (`output/1926-two-sheets/`, 31 MB and gitignored): the
 * first and last ten ROWS and the first and last ten COLUMNS are **flat within
 * ±1 greylevel** — 169/169/169 down the top, 178/178/179 down the left, and so
 * on for all three. There is no frame around a sheet; the panels run to its
 * edge, so the only seam on it is the interior one. A trim for three edges that
 * carry nothing would be machinery with no measurement behind it, and it would
 * risk eating a figure that touches the frame.
 */
describe("⚠ no panel keeps the seam that marks its edge (#1971)", () => {
  /** The cut `main` shipped, for the control. */
  const edgeTheOldRuleCut = (
    boundary: SheetBoundary,
    index: number,
    width: number,
    panelCount: number,
  ): { leftEnd: number; rightStart: number } => {
    if (boundary.band) {
      return { leftEnd: boundary.band.start - 1, rightStart: boundary.band.end + 1 };
    }
    const equal = Math.round((width * (index + 1)) / panelCount);
    return { leftEnd: equal - 1, rightStart: equal };
  };

  /**
   * How far a column sits off its own panel's backdrop — the same question the
   * repair asks, asked independently here rather than through the repair's own
   * helper, because an arm reading its subject's reader cannot refute it.
   */
  const offBackdrop = (
    means: ArrayLike<number>,
    width: number,
    column: number,
    inward: -1 | 1,
  ): number => {
    const samples: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const x = column + inward * (3 + i);
      if (x >= 0 && x <= width - 1) samples.push(means[x]);
    }
    samples.sort((a, b) => a - b);
    return Math.abs(means[column] - samples[Math.floor(samples.length / 2)]!);
  };

  /** Every real sheet in the repository, as one population. */
  const REAL: { label: string; width: number; panels: number; means: number[] }[] = [
    ...COURT.sheets.map((sheet) => ({
      label: `court-${sheet.sheet}`,
      width: sheet.width,
      panels: 5,
      means: sheet.columnMeans,
    })),
    ...(
      JSON.parse(
        readFileSync("server/castingV2/__fixtures__/signSheet.twoSheetColumnMeans.json", "utf8"),
      ) as {
        sheets: {
          kind: string; render: string; panels: number; width: number; columnMeans: number[];
        }[];
      }
    ).sheets.map((sheet) => ({
      label: `${sheet.kind}/${sheet.render}`,
      width: sheet.width,
      panels: sheet.panels,
      means: sheet.columnMeans,
    })),
  ];

  /** The widest a cut edge may sit from its own panel's backdrop. */
  const CLEAN_EDGE_TOLERANCE = 8;

  it("the fixture population is every real sheet, both shapes", () => {
    expect(REAL.map((sheet) => sheet.label)).toEqual([
      "court-1", "court-2", "court-3", "body/parallel", "head/parallel", "head/serial",
    ]);
  });

  it("his three-quarter view no longer starts on the seam — and the old rule did", () => {
    const sheet = REAL.find((entry) => entry.label === "head/parallel")!;
    const means = Float64Array.from(sheet.means);
    const geometry = findSheetPanelGeometry(means, sheet.width, sheet.panels);
    const first = geometry.boundaries[0]!;

    /* The seam itself, so the arm names what it avoids rather than a bare number. */
    expect(first.source).toBe("fifth");
    expect(first.darkSeam!.start).toBe(1280);
    expect(first.darkSeam!.end).toBe(1280);
    expect(first.darkSeam!.contrast).toBeGreaterThan(80);

    /* AFTER: the three-quarter panel begins past the whole of it. */
    expect(first.rightStart).toBe(1281);
    expect(geometry.panels[1]!.left).toBe(1281);
    expect(offBackdrop(means, sheet.width, first.rightStart, 1))
      .toBeLessThanOrEqual(CLEAN_EDGE_TOLERANCE);

    /*
      ⚠ **TWO MECHANISMS STAND BEHIND THAT 1281 AND THIS ARM CANNOT TELL THEM
      APART — said here rather than left to be discovered.** The seam sits
      exactly on the equal share, so the cut moving outside its run and the trim
      walking it off the edge both land on the same column; sabotage proved it
      by leaving this arm green with the shift removed. The arm that isolates
      the shift is the off-centre seam above.
    */
    /* THE CONTROL: the rule main shipped put the seam column itself first. */
    const old = edgeTheOldRuleCut(first, 0, sheet.width, sheet.panels);
    expect(old.rightStart).toBe(1280);
    expect(
      offBackdrop(means, sheet.width, old.rightStart, 1),
      "the old cut's first column was already clean — then this arm proves nothing",
    ).toBeGreaterThan(CLEAN_EDGE_TOLERANCE);
  });

it("⚠ a seam a few columns OFF the equal share — the case the trim cannot reach", () => {
    /*
      ⚠ **THIS ARM EXISTS BECAUSE SABOTAGE SAID THE OTHER ONE WAS NOT ENOUGH.**
      Cutting back through the seam's centre left the three-quarter arm above
      GREEN: on that sheet the seam sits exactly on the equal share, so it lands
      at the cut EDGE and the trim walks it off without the shift's help. The
      two mechanisms cover the same ground there, and an arm that cannot tell
      them apart cannot report one of them dying.

      What only the shift can reach is a seam sitting a few columns INSIDE a
      panel — reachable, because `SEAM_SEARCH_PX` looks 4 columns either way.
      There the cut edge is clean backdrop, so the trim correctly sees nothing,
      and the line is a dark hairline two pixels into the delivered view.
    */
    const width = 900;
    const means = new Float64Array(width).fill(200);
    means[302] = 100; /* 1 px seam, two columns right of the equal third at 300 */

    /* The trim's own answer at the old edge, so the claim is driven not argued. */
    expect(seamColumnsAtEdge(means, width, 300, 1)).toBe(0);

    const geometry = findSheetPanelGeometry(means, width, 3);
    const first = geometry.boundaries[0]!;
    expect(first.source).toBe("fifth");
    expect(first.darkSeam).toEqual({ start: 302, end: 302, contrast: 100 });

    /* AFTER: the seam belongs to neither panel. */
    expect({ leftEnd: first.leftEnd, rightStart: first.rightStart })
      .toEqual({ leftEnd: 301, rightStart: 303 });
    expect(first.trimmed).toEqual({ left: 0, right: 0 });
    for (let i = 0; i < 5; i += 1) expect(means[first.rightStart + i]).toBe(200);

    /* THE CONTROL: the old rule's panel carried the hairline two columns in. */
    const old = edgeTheOldRuleCut(first, 0, width, 3);
    expect(old.rightStart).toBe(300);
    expect(means[old.rightStart + 2]).toBe(100);
  });

  it("every cut edge on every real sheet is backdrop — and 26 of 34 were not", () => {
    let dirtyNow = 0;
    let dirtyBefore = 0;
    let edges = 0;
    const offenders: string[] = [];

    for (const sheet of REAL) {
      const means = Float64Array.from(sheet.means);
      const geometry = findSheetPanelGeometry(means, sheet.width, sheet.panels);
      geometry.boundaries.forEach((boundary, index) => {
        const old = edgeTheOldRuleCut(boundary, index, sheet.width, sheet.panels);
        const pairs: [number, number, -1 | 1][] = [
          [boundary.leftEnd, old.leftEnd, -1],
          [boundary.rightStart, old.rightStart, 1],
        ];
        for (const [now, before, inward] of pairs) {
          edges += 1;
          if (offBackdrop(means, sheet.width, now, inward) > CLEAN_EDGE_TOLERANCE) {
            dirtyNow += 1;
            offenders.push(`${sheet.label} b${index + 1} col ${now}`);
          }
          if (offBackdrop(means, sheet.width, before, inward) > CLEAN_EDGE_TOLERANCE) {
            dirtyBefore += 1;
          }
        }
      });
    }

    expect(edges).toBe(34);
    /*
      ⚠ **ONE SURVIVOR, AND IT IS NAMED RATHER THAN TUNED AWAY.** Court sheet
      2's second panel starts at column 802, which reads 10.2 off its backdrop —
      and the profile from there runs 207, 207, 203, 201, 199, 198, 196, 194 …
      171 over the next twenty-five columns. That is the panel's own lighting
      falloff away from a bright divider, not a line, and no trim reaches a flat
      reading inside it. Lowering the floor until this read zero would start
      eating backdrop off every sheet to flatter a number.
    */
    expect(offenders).toEqual(["court-2 b1 col 802"]);
    expect(dirtyNow).toBe(1);
    expect(
      dirtyBefore,
      "the old rule cut clean edges — then there was no defect to fix",
    ).toBe(26);
  });

  it("the bright boundaries had it too, which is why the trim is not a dark-seam patch", () => {
    /* Court sheet 3's second panel used to begin at column 779: 219 against a
       161 backdrop — the same visible line he reported, in the other direction,
       on a sheet whose cut his eye passed. */
    const sheet = REAL.find((entry) => entry.label === "court-3")!;
    const means = Float64Array.from(sheet.means);
    const geometry = findSheetPanelGeometry(means, sheet.width, sheet.panels);
    const first = geometry.boundaries[0]!;

    expect(first.source).toBe("divider");
    expect(first.darkSeam).toBeNull();
    expect(first.trimmed).toEqual({ left: 2, right: 1 });

    const old = edgeTheOldRuleCut(first, 0, sheet.width, sheet.panels);
    expect(offBackdrop(means, sheet.width, old.rightStart, 1)).toBeGreaterThan(40);
    expect(offBackdrop(means, sheet.width, first.rightStart, 1))
      .toBeLessThanOrEqual(CLEAN_EDGE_TOLERANCE);
  });

  it("⚠ a figure pressed against the divider is not cut into — and no cap is what stops it", () => {
    /*
      ⚠ **THIS ARM WAS WRITTEN TO DRIVE A CAP, AND SABOTAGE SHOWED THERE WAS NO
      CAP TO DRIVE.** The first shape of the repair carried a cap that claimed to
      REFUSE past 8 columns so a figure could never be eaten, and this arm said
      so in its title. Sabotaging that refusal into taking its cap instead left
      the arm GREEN on every input — because the refusal is unreachable: the
      backdrop is the MEDIAN of columns `edge+3 … edge+8`, a median of integer
      samples is one of its own members, so the walk always meets a column
      reading 0 off the backdrop at or before offset 8.

      What the fixture DOES prove is better than what it was built for, and it
      is the thing that actually protects a picture: a figure wide enough to
      matter FILLS the backdrop window, so it reads as this panel's own backdrop
      and the walk stops on its first step. The cap was never load-bearing; this
      is.
    */
    const width = 900;
    const means = new Float64Array(width).fill(200);
    for (let x = 299; x <= 301; x += 1) means[x] = 254;
    for (let x = 302; x <= 601; x += 1) means[x] = 90;

    const geometry = findSheetPanelGeometry(means, width, 3);
    const first = geometry.boundaries[0]!;
    expect(first.source).toBe("divider");
    expect(first.band!.start).toBe(299);
    expect(first.band!.end).toBe(301);
    /* Not one column of the body is taken, and the cut stays where the band put it. */
    expect(first.trimmed.right).toBe(0);
    expect(first.rightStart).toBe(302);
    expect(seamColumnsAtEdge(means, width, 302, 1)).toBe(0);

    /* THE CONTROL: a hairline in the same place IS trimmed, so the zero above is
       the figure being spared and not a reader that never fires. */
    const hairline = new Float64Array(width).fill(200);
    for (let x = 299; x <= 301; x += 1) hairline[x] = 254;
    hairline[302] = 150;
    expect(seamColumnsAtEdge(hairline, width, 302, 1)).toBe(1);
  });

  it("⚠ the walk always stops ON backdrop, never by exhaustion — driven, not argued", () => {
    /*
      The bound's docblock claims the loop can never run out, and that claim is
      the only reason this function needs no cap. A claim like that is worth
      nothing unread, so it is driven over randomised profiles rather than
      reasoned about: for every one, the column the walk stopped at must itself
      be within tolerance of the backdrop it was measured against — which is
      exactly *it stopped because it found backdrop* rather than *it ran out*.

      ⚠ **Ramps are in the population on purpose.** A ramp is the shape most
      likely to outrun a backdrop sampled once, and this population's deepest
      walk is **6 of a possible 8** — read by printing it, not estimated, which
      is what makes the floor below a real floor rather than decoration.
    */
    const width = 400;
    let seed = 20261008;
    const next = (): number => {
      /* A fixed generator, so a red is reproducible rather than a once-off. */
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    let deepest = 0;
    for (let trial = 0; trial < 400; trial += 1) {
      const means = new Float64Array(width);
      /*
        ⚠ **PIECEWISE RAMPS, BECAUSE THE FIRST POPULATION WAS TOO FLAT TO ASK
        THE QUESTION.** It used one gentle slope over the whole profile, every
        walk came back 1 column, and the floor below caught it — a sweep whose
        deepest walk is 1 cannot tell a bound that holds from a bound that is
        never approached. Segments of 20–60 columns at up to 4 greylevels a
        column are a figure's soft edge, which is the real shape most
        likely to outrun a backdrop sampled once.
      */
      let level = 40 + next() * 180;
      let x = 0;
      while (x < width) {
        const run = 20 + Math.floor(next() * 40);
        const slope = (next() - 0.5) * 8;
        for (let i = 0; i < run && x < width; i += 1, x += 1) {
          level = Math.max(0, Math.min(255, level + slope));
          means[x] = Math.max(0, Math.min(255, level + (next() - 0.5) * 4));
        }
      }
      const spikes = Math.floor(next() * 4);
      for (let s = 0; s < spikes; s += 1) {
        means[Math.floor(next() * width)] = next() < 0.5 ? 0 : 255;
      }

      for (const edge of [50, 120, 200, 310]) {
        for (const inward of [-1, 1] as const) {
          const walked = seamColumnsAtEdge(means, width, edge, inward);
          deepest = Math.max(deepest, walked);
          expect(walked).toBeLessThanOrEqual(8);
          if (walked === 0) continue;
          /* The stopping column, judged against the backdrop the walk used. */
          const samples: number[] = [];
          for (let i = 0; i < 6; i += 1) samples.push(means[edge + inward * (3 + i)]!);
          samples.sort((a, b) => a - b);
          const backdrop = samples[Math.floor(samples.length / 2)]!;
          const stoppedAt = means[edge + inward * walked]!;
          expect(
            Math.abs(stoppedAt - backdrop),
            `trial ${trial} edge ${edge} dir ${inward}: the walk ran out instead of finding backdrop`,
          ).toBeLessThanOrEqual(CLEAN_EDGE_TOLERANCE);
        }
      }
    }
    /* And the population did walk deep enough to be worth driving. */
    expect(deepest).toBeGreaterThanOrEqual(3);
  });

  it("a trim of nothing is only ever an edge that was already backdrop", () => {
    /*
      ⚠ The refusal returns 0, which is indistinguishable from *already clean*
      on the receipt alone. So the two are told apart here: a trim of 0 is only
      honest where the edge is already backdrop, and that is asserted of every
      zero on every real sheet. The one exception is the named survivor above.
    */
    for (const sheet of REAL) {
      const means = Float64Array.from(sheet.means);
      const geometry = findSheetPanelGeometry(means, sheet.width, sheet.panels);
      geometry.boundaries.forEach((boundary, index) => {
        if (boundary.trimmed.left === 0) {
          expect(
            offBackdrop(means, sheet.width, boundary.leftEnd, -1),
            `${sheet.label} b${index + 1}: left trimmed nothing while still on a line`,
          ).toBeLessThanOrEqual(CLEAN_EDGE_TOLERANCE);
        }
        const named = sheet.label === "court-2" && index === 0;
        if (boundary.trimmed.right === 0 && !named) {
          expect(
            offBackdrop(means, sheet.width, boundary.rightStart, 1),
            `${sheet.label} b${index + 1}: right trimmed nothing while still on a line`,
          ).toBeLessThanOrEqual(CLEAN_EDGE_TOLERANCE);
        }
      });
    }
  });

  it("a boundary with no seam at all is left exactly where it was", () => {
    /* The negative control: a flat profile has nothing to trim, and a trim that
       fired here would be shaving every panel of every sheet for no reason. */
    const width = 600;
    const means = new Float64Array(width).fill(180);
    const geometry = findSheetPanelGeometry(means, width, 2);
    const only = geometry.boundaries[0]!;
    expect(only.source).toBe("fifth");
    expect(only.darkSeam).toBeNull();
    expect(only.trimmed).toEqual({ left: 0, right: 0 });
    expect({ leftEnd: only.leftEnd, rightStart: only.rightStart })
      .toEqual({ leftEnd: 299, rightStart: 300 });
    expect(geometry.panels.map((panel) => panel.width)).toEqual([300, 300]);
  });

  it("every column is accounted for: a panel, a seam, or a trim — nothing to arithmetic", () => {
    for (const sheet of REAL) {
      const means = Float64Array.from(sheet.means);
      const geometry = findSheetPanelGeometry(means, sheet.width, sheet.panels);

      /*
        ⚠ **WHAT THE TRIM COSTS, AND NOT WHAT THE PANELS WEIGH.** The first
        shape of this arm compared each panel to an equal share and was wrong by
        148 px on court sheet 3 — because the real dividers put that sheet's
        panels at 620 and 868, which is the finding the detector exists for and
        has nothing to do with the trim. What is being claimed here is that the
        TRIM is cheap, so the trim is what is measured.
      */
      for (const boundary of geometry.boundaries) {
        expect(boundary.trimmed.left).toBeLessThanOrEqual(8);
        expect(boundary.trimmed.right).toBeLessThanOrEqual(8);
      }
      const shaved = geometry.boundaries.reduce(
        (sum, boundary) => sum + boundary.trimmed.left + boundary.trimmed.right,
        0,
      );
      /* Measured: 3 to 9 columns off a 3504–3840 px sheet — under 0.25%. */
      expect(shaved).toBeLessThan(sheet.width * 0.005);

      const lost = sheet.width - geometry.panels.reduce((sum, panel) => sum + panel.width, 0);
      const bands = geometry.boundaries.reduce(
        (sum, boundary) => sum + (boundary.band ? boundary.band.end - boundary.band.start + 1 : 0),
        0,
      );
      const seams = geometry.boundaries.reduce(
        (sum, boundary) => sum
          + (boundary.darkSeam ? boundary.darkSeam.end - boundary.darkSeam.start + 1 : 0),
        0,
      );
      const trims = geometry.boundaries.reduce(
        (sum, boundary) => sum + boundary.trimmed.left + boundary.trimmed.right,
        0,
      );
      expect(lost).toBe(bands + seams + trims);
    }
  });
});
