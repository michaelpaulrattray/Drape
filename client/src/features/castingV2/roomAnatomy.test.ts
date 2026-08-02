import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The casting room's ANATOMY — that the drawn elements exist at all.
 *
 * This test is the fourth entry gate of the UI-drift prevention law (founder
 * ruling, 2026-08-02), and it exists because of a specific failure: the room
 * was built from prose descriptions of the prototype's markup with the styles
 * stripped out. Every part was named in that prose, so the parts list came out
 * right — and the design was invented. The refine bar became a paragraph, the
 * Takes section vanished entirely, the right-hand cards collapsed to sentences.
 *
 * A screenshot review catches that; nothing in the suite did. So the reconciled
 * surface now carries a structure assertion beside the law checks: each element
 * the reconciliation table binds us to must be present in the source.
 *
 * It deliberately asserts EXISTENCE, not geometry. Geometry lives in the
 * measured table and is verified by the prototype-left/build-right renders;
 * pinning pixel values here would make every honest refinement a test failure.
 * What must never happen again is a whole drawn module quietly not being built.
 */

const ROOM = new URL("../../pages/CastingRoom.tsx", import.meta.url);
const CSS = new URL("./castingV2.css", import.meta.url);
const TABLE = new URL(
  "../../../../docs/specs/CASTING_V2_ROOM_RECONCILIATION.md",
  import.meta.url,
);

/** Every module the drawing has, and the class that proves it was built. */
const DRAWN_ELEMENTS: Array<{ element: string; marker: string }> = [
  { element: "header with name and kind pill", marker: "dpc-room__kind" },
  { element: "the one-line read", marker: "dpc-room__read" },
  { element: "two header actions, outline then filled", marker: "dpc-room__cta--primary" },
  { element: "two-column frame", marker: "dpc-room__columns" },
  { element: "master block", marker: "dpc-master__media" },
  { element: "master pane", marker: "dpc-master__main" },
  { element: "two companion cells", marker: "dpc-master__cell" },
  { element: "MASTER chip", marker: "dpc-master__tag" },
  { element: "attached footer bar", marker: "dpc-master__foot" },
  { element: "IDENTITY LOCKED", marker: "dpc-master__locked" },
  { element: "refine card", marker: "dpc-refine__shell" },
  { element: "refine input", marker: "dpc-refine__input" },
  { element: "refine button", marker: "dpc-refine__go" },
  { element: "refine chips", marker: "dpc-refine__chip" },
  { element: "takes section", marker: "dpc-takes__grid" },
  { element: "takes add tile", marker: "dpc-takes__tile--add" },
  { element: "voice player skeleton", marker: "dpc-voice__wave" },
  { element: "campaigns add row", marker: "dpc-camp__add" },
  { element: "sibling tiles", marker: "dpc-sib__tile" },
  { element: "the package strip", marker: "dpc-strip__frame" },
];

describe("the casting room is built to the drawing", () => {
  it("renders every drawn module", async () => {
    const source = await readFile(ROOM, "utf8");
    const missing = DRAWN_ELEMENTS.filter(({ marker }) => !source.includes(marker));
    expect(
      missing.map((entry) => entry.element),
      "drawn modules missing from the room",
    ).toEqual([]);
  });

  it("styles every drawn module", async () => {
    // A class the markup uses and the stylesheet has never heard of is a module
    // that renders as unstyled debris — which is its own kind of not-built.
    const css = await readFile(CSS, "utf8");
    const missing = DRAWN_ELEMENTS.filter(({ marker }) => !css.includes(`.${marker}`));
    expect(
      missing.map((entry) => entry.element),
      "drawn modules with no styles",
    ).toEqual([]);
  });

  it("keeps the reconciliation table beside the build", async () => {
    /*
      The table is the binding record: what was measured off the render, and
      which ratified ruling licenses each deviation. If it is gone, nobody can
      tell an intentional deviation from a drift.
    */
    const table = await readFile(TABLE, "utf8");
    expect(table).toContain("Deviation summary");
    expect(table).toContain("Geometry deviations: none");
    for (const heading of ["Master block", "Refine card", "Takes", "Voice card", "Siblings card"]) {
      expect(table, `the table must reconcile ${heading}`).toContain(heading);
    }
  });

  it("states an honest capability rather than offering a control that refuses", async () => {
    const source = await readFile(ROOM, "utf8");
    // Every drawn action that has no capability behind it is disabled. The
    // drawing's weights survive; the promise does not.
    for (const inert of ["dpc-room__cta", "dpc-refine__go", "dpc-refine__input", "dpc-camp__add"]) {
      const index = source.indexOf(inert);
      expect(index, `${inert} must exist`).toBeGreaterThan(-1);
      expect(
        source.slice(index, index + 400),
        `${inert} must render disabled while its capability is unbuilt`,
      ).toContain("disabled");
    }
  });

  it("leads the package strip with the Master, and the Master is not generated", async () => {
    /*
      Founder ruling: the strip presents SIX things and the first costs nothing.
      The Master is the signed sheet image itself — presentation-only, never
      re-rendered — followed by the five views the package actually bought.

      Pinned because it is exactly the kind of rule that decays into a sixth
      generated slot the next time someone tidies the loop, and that would both
      charge for a view nobody ordered and re-render the face she chose.
    */
    const room = await readFile(ROOM, "utf8");
    const strip = room.slice(room.indexOf("THE PACKAGE"));
    expect(strip).toContain("Master");
    // The Master tile is drawn from the ANCHOR, never from a slot — that is
    // what makes it free, and what stops it being re-rendered.
    expect(strip).toContain("data.anchorUrl");
    /*
      And the "N of N views" count reads `data.slots`, which the server fills
      with the five paid views only. Counting the Master would sell six.
    */
    const count = strip.slice(strip.indexOf("dpc-rcard__hint"), strip.indexOf("dpc-strip"));
    expect(count).toContain("data.slots.length");
    expect(count).not.toContain("anchorUrl");
  });

  it("names the package v3 slots, and no retired one", async () => {
    const pkg = await readFile(
      new URL("../../../../server/castingV2/castViewPackage.ts", import.meta.url),
      "utf8",
    );
    const list = pkg.slice(pkg.indexOf("CAST_PACKAGE_VIEWS"), pkg.indexOf("CAST_PACKAGE_VIEW_PRICE"));
    for (const angle of ["closeUp", "frontClose", "frontFull", "sideClose", "backFull"]) {
      expect(list).toContain(angle);
    }
    // The walk retired in v2 and the three-quarter in v3. A profile that quietly
    // regained one would change the price without changing the price constant.
    expect(list).not.toContain("sideFull");
    expect(list).not.toContain("threeQuarter");
  });

  it("says the package never arrived, at the room level, not per slot", async () => {
    // D-103's confession. Server-authored so the room and the ledger cannot
    // drift; rendered above the strip, never repeated inside it.
    const room = await readFile(ROOM, "utf8");
    expect(room).toContain("data.notice");
    expect(room).toContain("dpc-room__notice");
    // Composed on the server, never assembled here out of parts.
    expect(room).not.toContain("including the Sign itself");
  });

  it("carries no invented numbers from the prototype", async () => {
    /*
      Checked against the RENDERABLE source with comments stripped: the
      deviation comments quote the drawing's fictions on purpose, because
      naming what was removed is how the next reader knows it was a decision
      rather than an oversight. What must never return is the fiction reaching
      a screen.
    */
    const source = (await readFile(ROOM, "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(String.fromCharCode(10))
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join(String.fromCharCode(10));
    for (const fiction of ["99.4%", "18 frames", "identity retention"]) {
      expect(source, `"${fiction}" is prototype fiction`).not.toContain(fiction);
    }
  });
});
