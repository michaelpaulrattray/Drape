import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  FacePanel, UNNAMED_PLACE_COUNT,
  type FacePanelGroup, type FacePanelRow,
} from "./components/FacePanel";
import type { FaceSelectionModel } from "./components/faceSelection";

/**
 * THE UNNAMED PLACES — #2566 slice 3, drawn through React's own renderer.
 *
 * His word on the first look at the discovery panel, verbatim: *"loader is
 * still showing the default list"*. On that road the server draws no named
 * placeholder row and says `pendingUnnamed`; the panel keeps the places itself,
 * as shapes with no noun. What is asserted here is what the browser would draw.
 *
 * Every arm that says "no strip" sits beside the arm that draws one with the
 * same props bar one, so a strip that never rendered anywhere could not pass.
 */

const selection: FaceSelectionModel = {
  hovered: [],
  selected: null,
  isHovered: () => false,
  isSelected: () => false,
  hover: () => {},
  select: () => {},
};

const landed = (over: Partial<FacePanelRow> = {}): FacePanelRow => ({
  state: "settled",
  spoken: "their neck tattoo",
  slots: ["discovered:neck-tattoo#1"],
  name: "Neck tattoo",
  words: [],
  absent: null,
  from: null,
  prefill: "their neck tattoo — ",
  cutouts: [{ contentUrl: "https://bucket.example/master.jpg", maskUrl: null, crop: null }],
  regions: [],
  instances: [],
  ...over,
});

const groups = (rows: FacePanelRow[]): FacePanelGroup[] => [
  { group: "open", heading: "Also on this character", rows },
];

const draw = (props: {
  groups?: FacePanelGroup[];
  working: boolean;
  pendingUnnamed?: boolean;
  capped?: boolean;
}) => renderToStaticMarkup(createElement(FacePanel, {
  groups: props.groups ?? [],
  possessive: "their",
  working: props.working,
  ...(props.pendingUnnamed === undefined ? {} : { pendingUnnamed: props.pendingUnnamed }),
  ...(props.capped === undefined ? {} : { capped: props.capped }),
  selection,
  onScope: () => {},
}));

/** The strip's own markup, sliced out by its element so a sibling cannot satisfy an arm. */
const stripOf = (html: string): string | null => {
  const at = html.indexOf('<ul class="dpc-face__unnamed"');
  if (at === -1) return null;
  return html.slice(at, html.indexOf("</ul>", at) + "</ul>".length);
};

describe("the places a reading keeps when it names nothing ahead of time", () => {
  it("⚠ POSITIVE CONTROL — a fresh cast mid-reading draws the line and the unnamed places", () => {
    const html = draw({ working: true, pendingUnnamed: true });
    expect(html).toContain("Reading their features…");
    const strip = stripOf(html);
    expect(strip, "no unnamed strip was drawn").not.toBeNull();
    expect(strip!.match(/class="dpc-face__unnamedRow"/g)).toHaveLength(UNNAMED_PLACE_COUNT);
  });

  it("⚠ the places say NOTHING — no noun, no word, no letter", () => {
    const strip = stripOf(draw({ working: true, pendingUnnamed: true }))!;
    const text = strip.replace(/<[^>]*>/g, "");
    expect(text.trim(), `the unnamed strip carried words: ${JSON.stringify(text)}`).toBe("");
    /* And it is not announced: the working line is the status, and three empty
       shapes read aloud would say less than nothing. */
    expect(strip).toContain('aria-hidden="true"');
  });

  it("is not drawn on the catalogue road — today's named placeholders are the places there", () => {
    /* Same props bar one: `pendingUnnamed` absent, which is every account off
       the discovery flag. */
    expect(stripOf(draw({ working: true }))).toBeNull();
    expect(stripOf(draw({ working: true, pendingUnnamed: false }))).toBeNull();
  });

  it("off the discovery road, the markup is what it was with no such prop at all", () => {
    /* Byte for byte: an account off the flag sees exactly today's panel. */
    const rows = groups([landed(), landed({ slots: ["eye@left", "eye@right"], name: "Eyes", state: "pending" })]);
    expect(draw({ groups: rows, working: true, pendingUnnamed: false }))
      .toBe(draw({ groups: rows, working: true }));
  });

  it("cannot outlive the working line — no reading, no places", () => {
    /*
      WITH A LANDED ROW, and that row is load-bearing: a panel with no rows and
      nothing working returns null before the strip is ever reached, so an arm
      without one passed under a sabotage that dropped the `working` gate
      entirely (S7 of the slice's sabotage run). The row keeps the panel drawn
      so the question is the strip's alone; the first expect is the proof.
    */
    const rows = groups([landed()]);
    expect(stripOf(draw({ groups: rows, working: true, pendingUnnamed: true })), "the control drew no strip").not.toBeNull();
    expect(stripOf(draw({ groups: rows, working: false, pendingUnnamed: true }))).toBeNull();
  });

  it("is not drawn over a shut day — the capped line outranks the working one", () => {
    expect(stripOf(draw({ working: true, pendingUnnamed: true, capped: true }))).toBeNull();
  });

  it("sits at the FOOT of what has landed, so its leaving moves no row", () => {
    /* Rows land above it; when the reading ends it leaves from the bottom, and
       nothing the customer is reaching for shifts under their aim. */
    const html = draw({ groups: groups([landed()]), working: true, pendingUnnamed: true });
    const row = html.indexOf("Neck tattoo");
    const strip = html.indexOf('<ul class="dpc-face__unnamed"');
    expect(row, "the landed row was not drawn").toBeGreaterThan(-1);
    expect(strip, "the strip was not drawn").toBeGreaterThan(-1);
    expect(strip, "the strip sits above a landed row").toBeGreaterThan(row);
  });
});

/*
  THE SHEET'S HALF — read at the source, because the sheet is a page of queries
  no unit renders. The behaviour these lines wire is driven above and in
  `server/faceLoaderUnnamedDriven.test.ts`; these pin that the page passes the
  server's word through and keeps the line up off the scan's own answer.
*/
const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);
const withoutProse = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

describe("the sheet carries the server's word to the panel", () => {
  it("passes `pendingUnnamed` off the answer on screen", async () => {
    const sheet = withoutProse(await readFile(SHEET, "utf8"));
    const panel = sheet.slice(sheet.indexOf("<FacePanel"));
    expect(panel.slice(0, panel.indexOf("/>"))).toContain("pendingUnnamed={Boolean(facePanelData?.pendingUnnamed)}");
  });

  it("keeps the working line up while the reading says it is unfinished — armed, and only while its poll lives", async () => {
    const sheet = withoutProse(await readFile(SHEET, "utf8"));
    const working = sheet.slice(sheet.indexOf("const faceScanWorking ="));
    const expression = working.slice(0, working.indexOf(";"));
    expect(expression).toContain("Boolean(faceScan.data?.pendingUnnamed) && faceScanArmed && !faceScan.isError");
  });
});
