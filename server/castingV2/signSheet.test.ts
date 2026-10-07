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
import { pronounsForSex } from "./castPronouns";
import { CAST_PACKAGE_VIEWS } from "./castViewPackage";
import {
  composeSignSheetPrompt,
  cutSignSheet,
  DIVIDER_SEARCH_FRACTION,
  findSheetPanelGeometry,
  renderSignSheet,
  sheetColumnMeans,
  sheetReferenceFromMaster,
  SIGN_SHEET_PANEL_LINES,
  SIGN_SHEET_PANEL_ORDER,
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
      expect(owned + dividers).toBe(sheet.width);
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
    expect(brief).toContain("HER OUTFIT, as cast: A white, body-conscious dress");
    /* His sentence continues mid-paragraph, so the brief's own full stop must
       not double up. */
    expect(brief).not.toContain("straps.. Above");
    expect(brief).toContain("straps. Above the frame of reference 1");

    const neither = composeSignSheetPrompt({ pronouns: SIFR.pronouns });
    expect(neither).toContain("HER OUTFIT is the one reference 1 shows.");
    expect(neither).not.toContain("as cast:");
  });

  it("never calls a male cast 'her', and reads a group as plural", () => {
    const male = composeSignSheetPrompt({ description: "a navy flight suit", pronouns: pronounsForSex("male") });
    expect(male).toContain("HIS OUTFIT");
    expect(male).toContain("His back and arms");
    expect(male).toContain("that is the outfit he wears");
    expect(male).not.toMatch(/\bher\b/);

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
          return { bytes, contentType: "image/png", latencyMs: 61_000, estimatedCostUsd: null };
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
