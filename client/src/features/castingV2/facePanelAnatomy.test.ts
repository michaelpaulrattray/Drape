import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * PANEL v2's ANATOMY — the mechanizable half of the UI contract.
 *
 * The founder's laws about this surface are things a suite can hold: one
 * selection rather than two, no box over pixels nobody measured, a click on the
 * picture that spends exactly what the ask box spends and nothing when it is
 * dismissed, and a price that stays off the button. Kept here rather than in
 * review memory, because a design law nobody can run is a design law that lasts
 * one refactor.
 */

const PANEL = new URL("./components/FacePanel.tsx", import.meta.url);
const REGIONS = new URL("./components/FaceRegions.tsx", import.meta.url);
const SELECTION = new URL("./components/faceSelection.ts", import.meta.url);
const VIEWER = new URL("./components/CandidateViewer.tsx", import.meta.url);
const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);
const CSS = new URL("./castingV2.css", import.meta.url);

/** The code with its prose removed — a doc comment explaining a rule must not
 *  be mistaken for a breach of it (the kept panel's own lesson). */
const withoutProse = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

describe("one selection, two views of it", () => {
  it("holds the selection in ONE place and hands it to both surfaces", async () => {
    const [panel, regions] = await Promise.all([
      readFile(PANEL, "utf8"),
      readFile(REGIONS, "utf8"),
    ]);
    /* Neither view may keep its own idea of what is selected: a second copy is
       how a row stays lit after its box has closed. */
    expect(withoutProse(panel)).not.toContain("useState");
    expect(withoutProse(regions)).not.toMatch(/useState<[^>]*[Ss]elect/);
    expect(panel).toContain("selection.isSelected");
    expect(regions).toContain("selection.isSelected");
  });

  it("passes the SAME model object to the panel and to the picture", async () => {
    const sheet = withoutProse(await readFile(SHEET, "utf8"));
    expect(sheet).toContain("const faceSelection = useFaceSelection()");
    /*
      Once, and given to both — not two calls returning two models. Both take it
      as the same prop now that the panel stands beside the picture rather than
      inside the refine panel; two occurrences of one binding is the shape that
      proves it, and a third `useFaceSelection()` is the thing to catch.
    */
    expect(sheet.match(/useFaceSelection\(\)/g)).toHaveLength(1);
    expect(sheet.match(/selection=\{faceSelection\}/g)).toHaveLength(2);
  });

  it("lights a matched pair on both sides, because the row is about both slots", async () => {
    const selection = await readFile(SELECTION, "utf8");
    expect(selection).toContain("slots.includes(slot)");
  });
});

describe("the picture promises only what was measured", () => {
  it("draws a region only for a row that has a box", async () => {
    const regions = withoutProse(await readFile(REGIONS, "utf8"));
    expect(regions).toContain("rows.filter((row) => row.box !== null)");
  });

  it("DRAWS NOTHING WHILE A REFINEMENT IS IN FLIGHT (fable-365)", async () => {
    /*
      The founder: *"when the image is generating a refinement/loading i can
      still see and click the bounding boxes through it."* Disabling the field
      was never enough — the boxes themselves sat above the loading state, lit
      and hit-testable, so a click landed on a frame about to be superseded.
    */
    const regions = withoutProse(await readFile(REGIONS, "utf8"));
    expect(regions).toContain("if (busy) return null;");
    /*
      And it must come BEFORE anything is drawn, not as a class on a box that
      still exists — an inert layer is one that is not there. Proven by
      position, since a `busy` check living below the boxes' own render would
      satisfy a plain `toContain` while changing nothing.
    */
    expect(regions.indexOf("if (busy) return null;")).toBeLessThan(regions.indexOf("dpc-regions__box"));
    /* Anything open closes as the work starts, so the layer re-arms clean
       rather than restoring a box over a picture that has since changed. */
    expect(regions).toContain("if (busy && open) selection.select(null);");
  });

  it("places every box as a fraction of ITS OWN frame, never in screen pixels", async () => {
    const regions = withoutProse(await readFile(REGIONS, "utf8"));
    expect(regions).toContain("box.frame.width) * 100}%");
    expect(regions).toContain("box.frame.height) * 100}%");
    /* A box in px would sit somewhere else at every window size — the same
       wrong-space defect a frame-mismatched mask is. */
    expect(regions).not.toMatch(/left: `\$\{box\.x\}px`/);
  });

  it("lays the regions inside the PLATE, which is the box the picture is in", async () => {
    const viewer = await readFile(VIEWER, "utf8");
    const plate = viewer.slice(viewer.indexOf('className="dpc-viewer__plate"'));
    expect(plate.slice(0, plate.indexOf("</span>"))).toContain("{overlay}");
  });
});

/**
 * THE PANEL DOES NOT COME OUT OF THE PHOTOGRAPH.
 *
 * Shift 27's render check, mechanized. The viewer's own rule was *"the panel is
 * short and fixed, the image is the elastic one"*, and panel v2 is the whole
 * catalogue — sixteen rows, ~1200px. Handed to `below`, it took every pixel and
 * the picture rendered at 0×0 while every test in this file passed.
 *
 * These are the source-level halves. The half that can actually fail is in
 * `scripts/drive-face-panel-evidence.mts`, which measures the plate in a real
 * browser with the panel on — a CSS assertion cannot fail on a collapsed
 * element, and that is exactly what it did.
 */
describe("the panel stands beside the picture, never on top of its height", () => {
  it("is handed to the viewer as `beside`, not as part of `below`", async () => {
    const sheet = withoutProse(await readFile(SHEET, "utf8"));
    const beside = sheet.slice(sheet.indexOf("beside={"));
    expect(beside.slice(0, beside.indexOf("/>"))).toContain("<FacePanel");
    /* And the refine panel below no longer carries it — one panel, one place. */
    const below = sheet.slice(sheet.indexOf("<RefinePanel"));
    expect(below.slice(0, below.indexOf("/>"))).not.toContain("face={");
  });

  it("puts the stage on a row, so the panel's length is never the picture's", async () => {
    const [viewer, css] = await Promise.all([readFile(VIEWER, "utf8"), readFile(CSS, "utf8")]);
    const stage = viewer.slice(viewer.indexOf('className="dpc-viewer__stage"'));
    expect(stage.slice(0, stage.indexOf("</div>"))).toContain("{beside}");
    const rule = css.slice(css.indexOf(".dpc-viewer__stage {"));
    expect(rule.slice(0, rule.indexOf("}"))).toContain("flex-direction: row");
  });

  it("counts the dock as part of the surface, so a row tap is not a scrim tap", async () => {
    const viewer = await readFile(VIEWER, "utf8");
    const close = viewer.slice(viewer.indexOf("const target = event.target as HTMLElement"));
    /* Missing from this list, every tap on a panel row closed the viewer — the
       row prefilled the ask box of a panel that was being unmounted. */
    expect(close.slice(0, close.indexOf("onClose()"))).toContain(".dpc-viewer__dock");
  });

  it("puts the versions on the left and draws them exactly once", async () => {
    const [sheet, viewer, panel] = await Promise.all([
      readFile(SHEET, "utf8"),
      readFile(VIEWER, "utf8"),
      readFile(new URL("./components/RefinePanel.tsx", import.meta.url), "utf8"),
    ]);
    /* The founder's sentence has two halves and they are one ruling: thumbnails
       left, segments right, only the chatbox at the bottom. */
    const before = withoutProse(sheet).slice(withoutProse(sheet).indexOf("before={"));
    expect(before.slice(0, before.indexOf("/>"))).toContain("<VersionRail");
    const stage = viewer.slice(viewer.indexOf('className="dpc-viewer__stage"'));
    expect(stage.slice(0, stage.indexOf("</div>"))).toContain("{before}");
    /* And the stack under the picture stands down when it does, so a version is
       never drawn twice in one viewer. */
    expect(withoutProse(sheet)).toContain("stackHoisted={Boolean(facePanelData)}");
    expect(withoutProse(panel)).toContain("{stackHoisted ? null : (");
  });

  it("gives the dock its own scroll rather than the viewport's", async () => {
    const css = await readFile(CSS, "utf8");
    const dock = css.slice(css.indexOf(".dpc-viewer__dock {"));
    const body = dock.slice(0, dock.indexOf("}"));
    expect(body).toContain("overflow-y: auto");
    expect(body).toContain("min-height: 0");
  });
});

describe("the box on the picture is the ask box, at the feature", () => {
  it("submits through the SAME paid handler the ask box submits through", async () => {
    const sheet = withoutProse(await readFile(SHEET, "utf8"));
    expect(sheet).toContain("onAsk={askRefine}");
    expect(sheet).toContain("onRefine={askRefine}");
  });

  it("owns Escape while it is open, instead of closing the viewer under itself", async () => {
    const [regions, viewer] = await Promise.all([readFile(REGIONS, "utf8"), readFile(VIEWER, "utf8")]);
    /* The claim, and the one place that reads it. Without the second half the
       first is decoration: the viewer's listener is capture-phase, so a child's
       stopPropagation never reaches it and the whole viewer closed instead. */
    expect(regions).toContain('data-owns-escape="true"');
    const escape = viewer.slice(viewer.indexOf('event.key === "Escape"'));
    expect(escape.slice(0, escape.indexOf("onClose()"))).toContain("[data-owns-escape]");
  });

  it("spends nothing when it is dismissed", async () => {
    const regions = withoutProse(await readFile(REGIONS, "utf8"));
    const escape = regions.slice(regions.indexOf('event.key !== "Escape"'));
    const untilClose = escape.slice(0, escape.indexOf("}"));
    expect(untilClose).not.toContain("onAsk");
    /* Click-away is the other half of the same promise. */
    expect(regions).toContain('className="dpc-regions__away"');
  });

  it("opens with their sentence already begun, scoped to the one instance", async () => {
    const regions = await readFile(REGIONS, "utf8");
    expect(regions).toContain("setDraft(open.prefill)");
    expect(regions).toContain("setSelectionRange(field.value.length, field.value.length)");
  });

  it("keeps the price OFF the button and says it quietly beside it (D-15/D-109)", async () => {
    const regions = await readFile(REGIONS, "utf8");
    const button = regions.slice(regions.indexOf('className="dpc-regions__submit"'));
    expect(button.slice(0, button.indexOf("</button>"))).not.toContain("priceCredits");
    expect(regions).toContain('className="dpc-regions__price"');
  });

  it("draws no ring inside the field — the container carries focus", async () => {
    const css = await readFile(CSS, "utf8");
    expect(css).toContain(".dpc-regions__field:focus { outline: none; }");
    expect(css).toContain(".dpc-regions__ask:focus-within");
  });

  it("DRAWS ITS BOXES THIN AND WHITE — founder ruling, product-wide (fable-230)", async () => {
    /*
      *"Bounding-box overlays are THIN WHITE, not red — everywhere."* A standing
      design rule for any on-image geometry: the palette is monochrome and a red
      box is an alarm the picture is not sounding. These boxes say *here*, not
      *wrong*.

      Mechanised rather than remembered, because it is exactly the kind of rule a
      later hand breaks by reaching for a "highlight" colour. It is asserted on
      the CSS text: 1px borders, and no hue anywhere in the region rules — the
      pack's own exhibit builder took the same correction in
      `scripts/build-library-demo-pack.mts`.
    */
    const css = await readFile(CSS, "utf8");
    const rules = css.slice(css.indexOf(".dpc-regions__box"), css.indexOf(".dpc-regions__tag"));
    expect(rules).toContain("border: 1px solid transparent");
    expect(rules).toContain("border-color: #FFFFFF");
    /* Every colour in the block is black, white or a mix of them. A hex that is
       not grey — #ff2d55, the red the pack used to draw — fails here. */
    for (const hex of rules.match(/#[0-9a-fA-F]{6}/g) ?? []) {
      expect(hex.slice(1, 3).toLowerCase(), hex).toBe(hex.slice(3, 5).toLowerCase());
      expect(hex.slice(3, 5).toLowerCase(), hex).toBe(hex.slice(5, 7).toLowerCase());
    }
  });
});

describe("the panel's copy, classified", () => {
  it("keeps the founder's heading verbatim with the pronoun derived", async () => {
    const panel = await readFile(PANEL, "utf8");
    expect(panel).toContain("On {possessive} face");
  });

  it("says what is true of a list that includes what has never been touched", async () => {
    const panel = await readFile(PANEL, "utf8");
    expect(panel).toContain("Everything here can be changed. Tap one to talk about it.");
    /* v1's sub is false here — this list is not only what the version keeps. */
    expect(panel).not.toContain("Things this version is keeping");
  });

  it("shows no facet id and no version tag — the row's words are the server's", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    expect(panel).not.toContain("statedAccessories");
    expect(panel).not.toContain("facet");
    /* Ruled out by the founder in fable-122: "ugly and not required". */
    expect(panel).not.toMatch(/>\s*v\d/);
    /*
      Every visible string is either the founder's own copy or a field of the
      row — a name composed in the client is a name the server's tests cannot
      hold. `slots` appears only as a key and as the selection's subject.
    */
    const rendered = panel.match(/\{row\.[a-zA-Z.]+\}/g) ?? [];
    expect(new Set(rendered)).toEqual(new Set(["{row.name}", "{row.from}"]));
  });

  it("shows a faint outline where there is no crop, never a filled grey tile", async () => {
    const css = await readFile(CSS, "utf8");
    const none = css.slice(css.indexOf(".dpc-face__thumb--none"));
    expect(none.slice(0, none.indexOf("}"))).toContain("background-color: transparent");
  });
});
