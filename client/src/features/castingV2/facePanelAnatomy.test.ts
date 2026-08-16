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
    /*
      Neither view may keep its own idea of what is SELECTED: a second copy is
      how a row stays lit after its box has closed.

      It was written as a ban on `useState` in the panel at all, which was a
      blunt spelling of the rule and became wrong the day the founder's nesting
      ruling gave the panel one honest piece of local view state (fable-452 —
      which pairs are open). So it now bans what it always meant: a second
      answer to what is selected.
    */
    expect(withoutProse(panel)).not.toMatch(/useState<[^>]*[Ss]elect/);
    expect(withoutProse(panel)).not.toContain("setSelected");
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
  it("draws a rectangle only where one was measured — one per INSTANCE", async () => {
    const regions = withoutProse(await readFile(REGIONS, "utf8"));
    /* Flattened from the rows' own regions, so a pair read on both sides draws
       both: a single rectangle over one eye is the same "only showing one eye"
       the founder read in the tile (fable-382 §2, swept one surface across). */
    expect(regions).toContain(".flatMap((row) => row.regions.map((region, at) => ({ row, region, at })))");
    expect(regions).toContain("if (drawn.length === 0) return null;");
    /*
      AND THE SMALLEST ONE IS PAINTED LAST (fable-384, his second report on this
      rule). The browser resolves overlapping absolute boxes by paint order, so
      the order IS the rule — sorted by the boxes' own area rather than by a
      z-index ladder, which would be a second list of how features nest.

      The half that can actually fail is the browser drive, which hit-tests the
      centre of every contained overlap; this is the structural half.
    */
    expect(regions).toContain("b.region.box.width * b.region.box.height");
    const css = await readFile(CSS, "utf8");
    const tag = css.slice(css.indexOf(".dpc-regions__tag {"));
    /* A tag hangs above its own box, so an eye's label sits on the brow above
       it — hit-testable while invisible until this line. */
    expect(tag.slice(0, tag.indexOf("}"))).toContain("pointer-events: none");
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
    /* To the stage's OWN close, found by its indentation — the picture's column
       inside it closes first now, and slicing to the first `</div>` would end
       the search before the dock it is looking for. */
    expect(stage.slice(0, stage.indexOf("\n      </div>"))).toContain("{beside}");
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
  it("carries the founder's ruled heading, and no longer the one he replaced", async () => {
    /*
      "Refine them" — his own words (fable-398). The heading it replaces named
      the face, and this panel had outgrown that: the same photograph that
      showed the new BODY and SKIN rows showed "On her face" over them.

      ANCHORED ON THE ELEMENT, and asserted against the PROSE-STRIPPED source
      for a reason this very test earned. The old assertion read the raw file
      for the bare phrase, and the change that retired the heading left it
      quoted in the comment above — so it would have gone on passing over a
      heading that no longer existed. A copy assertion that a comment can
      satisfy is not reading the copy.
    */
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    expect(panel).toContain(">Refine them<");
    expect(panel).not.toContain("On {possessive} face");
  });

  /**
   * THE WORKING STATE CANNOT OUTLIVE ITS WORK (founder, fable-397).
   *
   * The founder watched a 5-10 second scan with no sign it was happening. The
   * line that fixes it has one dangerous failure mode — being still on screen
   * after the scan has died — and that is a question about where the flag comes
   * from, which a suite can hold. Derived from the query's own pending state, it
   * is false the moment the scan lands OR errors; kept in a `useState` beside
   * the query, there is exactly one path that forgets to clear it, and that path
   * is the failure.
   */
  it("shows a working line while the scan runs, with the pronoun derived", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    expect(panel).toContain("Reading {possessive} features…");
    /* Gated on the prop, so the line is absent — not merely invisible — the
       rest of the time. */
    expect(panel).toContain("working ?");
    /* fable-397's own example is "Reading her features…", and shipping that
       literal would say "her" over a man's photograph. */
    expect(panel).not.toContain("Reading her features");
  });

  it("DERIVES that state from the scan query, so a dead scan cannot leave it stuck", async () => {
    const sheet = withoutProse(await readFile(SHEET, "utf8"));
    expect(sheet).toContain("faceScan.isPending");
    /* No second copy of the fact: a flag set on start and cleared on success is
       the shape that survives an error. */
    expect(sheet).not.toMatch(/useState[^\n]*[Ww]orking/);
    expect(sheet).not.toMatch(/set[A-Za-z]*Working\(/);
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
    /* Matched where a TEXT NODE begins, so an attribute carrying a count
       (`data-parts`) is not mistaken for copy. What is read out loud is what
       this law is about. */
    const rendered = panel.match(/>\{row\.[a-zA-Z.]+\}/g) ?? [];
    expect(new Set(rendered)).toEqual(new Set([">{row.name}", ">{row.from}"]));
  });

  it("shows NOTHING where there is no crop — his words were 'never as empty squares'", async () => {
    const css = await readFile(CSS, "utf8");
    const none = css.slice(css.indexOf(".dpc-face__thumb--none"));
    const body = none.slice(0, none.indexOf("}"));
    expect(body).toContain("background-color: transparent");
    /* The faint outline was still an empty square beside "a slim gold hoop".
       The space is kept so the names stay on one left edge; the mark is not. */
    expect(body).toContain("box-shadow: none");
  });
});

/**
 * THE MASKED CUTOUT — the founder's own answer, held as a rule.
 *
 * His word in fable-374 was *"masked cutouts"*: a row born of a SCAN and a row
 * minted by an EDIT must read as the same object, so the panel is a description
 * of a face rather than a mix of two rendering languages. A scan writes no
 * picture of its own (ruling 4a), so a scanned row draws the frame already on
 * screen through a stencil — which means arithmetic, and arithmetic is where the
 * cutout can slide off the feature it claims.
 *
 * These are the source-level halves. The half that can actually fail is the
 * browser drive, because a CSS assertion cannot fail on an element that never
 * rendered.
 */
describe("a scanned row and a minted row are the same object", () => {
  it("keeps the tile size a SINGLE fact, since the cutout does arithmetic with it", async () => {
    const css = await readFile(CSS, "utf8");
    const thumb = css.slice(css.indexOf(".dpc-face__thumb {"));
    const body = thumb.slice(0, thumb.indexOf("}"));
    /* A size written here and again in the component would be two answers to
       how big a thumbnail is, and the drift would show as a cutout sliding off
       its own feature. */
    expect(body).toContain("--dpc-thumb-side: 34");
    expect(body).toContain("width: calc(var(--dpc-thumb-side) * 1px)");
    expect(body).toContain("height: calc(var(--dpc-thumb-side) * 1px)");
    /* And a PAIR halves that one fact rather than writing 17 anywhere. */
    const pair = css.slice(css.indexOf('.dpc-face__thumb[data-parts="2"]'));
    expect(pair.slice(0, pair.indexOf("}"))).toContain("var(--dpc-thumb-side) / 2");
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    expect(panel).not.toContain("34");
  });

  it("fits the crop the way the stencil fits itself — one scale, both axes", async () => {
    const css = await readFile(CSS, "utf8");
    const cutout = css.slice(css.indexOf(".dpc-face__cut--cutout {"));
    const body = cutout.slice(0, cutout.lastIndexOf("}"));
    /*
      `--dpc-cut-max` is the crop's LONGER side on both axes, which is what makes
      this a contain rather than a stretch — the same fit `mask-size: contain`
      gives the stencil above. Two different fits would put the shape and the
      picture in different places, and at 34px that reads as a smudge rather
      than as a bug.
    */
    /* The scale is the CONTAIN the stencil beside it already uses — a min() of
       the two ratios rather than "divide by the longer side", because a PAIR's
       half-width box is not square and the shortcut is only the same answer
       while it is. */
    expect(body).toContain("--dpc-cut-scale: min(");
    /* Four uses: both axes of the size, and both axes of the position. A rule
       that dropped one would fit one axis differently from the other, which is
       the stretch this exists to avoid. */
    expect(body.match(/var\(--dpc-cut-scale\)/g)!.length).toBe(4);
    expect(body).toContain("background-size");
    expect(body).toContain("background-position");
    /* The part's own rule still centres the stencil, which is the other half of
       the agreement. */
    const cut = css.slice(css.indexOf(".dpc-face__cut {"));
    expect(cut.slice(0, cut.indexOf("}"))).toContain("mask-size: contain");
  });

  it("publishes the geometry as numbers and lets the stylesheet do the sums", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    for (const property of ["--dpc-cut-x", "--dpc-cut-y", "--dpc-cut-w", "--dpc-cut-h", "--dpc-cut-fw", "--dpc-cut-fh"]) {
      expect(panel).toContain(property);
    }
    /* And the cutout class rides the crop, so a minted thumbnail — which IS its
       own picture — never gets the arithmetic applied to it. */
    expect(panel).toContain('cutout.crop ? " dpc-face__cut--cutout" : ""');
    /* One tile, one picture per instance — the pair count is published as data
       so the stylesheet, not the component, decides how a pair shares 34px. */
    expect(panel).toContain("data-parts={row.cutouts.length}");
  });

  it("prefers the scanned panel over the unscanned one, and merges nothing itself", async () => {
    const sheet = withoutProse(await readFile(SHEET, "utf8"));
    /*
      Same shape from the server, so the swap is one `??`. A merge in the
      browser would be a second answer to how a scanned row differs from a
      minted one, and only the server can be tested against a face.
    */
    expect(sheet).toContain("const facePanelData = scannedFaceData ?? (face.data?.enabled ? face.data : null)");
    /* Fired only where the capability exists, so a user outside the scope pays
       no round trip at all. */
    expect(sheet).toContain("Boolean(face.data?.scanning)");
  });
});

describe("the rectangle names what it covers (fable-378 (c))", () => {
  it("labels a box by its own name where that is narrower than the row's", async () => {
    const regions = withoutProse(await readFile(REGIONS, "utf8"));
    /* Both the visible tag and the accessible label, because a screen reader
       hearing "Her eyes" over one eye is told the same untruth the tag would
       show. */
    expect(regions).toContain("{region.name ?? row.name}");
    expect(regions).toContain("`${region.name ?? row.name}. Edit it here.`");
    /* And the EDIT is still the row's SLOTS — both of them, one ask — with the
       side carried as a SCOPE rather than by dropping a slot. What an edit to
       "her eyes" means never changed; what the render is asked to touch did
       (fable-444, ruling C). */
    expect(regions).toContain("slots: row.slots,");
    expect(regions).toContain("...(scoped ? { scope: region.slot } : {}),");
  });

  /*
    AND A MEASUREMENT GAP IS NOT A SCOPE — fable-378 (c), which fable-444 adds
    to rather than replaces.

    A pair read on ONE side draws one rectangle because the scan missed the
    other, not because her face has one eye. Scoping that click would turn
    "change her eyes" into "change her left eye" on the strength of a failed
    reading — so the narrowing needs BOTH rectangles drawn, or a row that is
    already about one instance (a diverged pair, which is two rows).
  */
  it("scopes only when both of the pair are actually on the picture", async () => {
    const regions = withoutProse(await readFile(REGIONS, "utf8"));

    expect(regions).toContain("region.slot.includes(\"@\")");
    expect(regions).toContain("(row.regions.length > 1 || row.slots.length === 1)");
    /* And an unscoped click still speaks about the ROW, never about the one
       rectangle it happened to land on. */
    expect(regions).toContain("name: scoped ? region.name ?? row.name : row.name,");
  });

  /*
    AND IT REACHES THE WIRE — assert on the outgoing request, not on a constant
    near it (working law 5).

    The scope is worth nothing until the server is told, and the two halves of
    that journey are in two files: the box hands it to the caller, and the
    caller puts it in the mutation. Either one alone is a scope that silently
    does nothing, which is precisely the whole-face render this feature exists
    to stop.
  */
  it("carries the scope from the rectangle all the way onto the request", async () => {
    const [regions, sheet] = await Promise.all([
      readFile(REGIONS, "utf8").then(withoutProse),
      readFile(SHEET, "utf8").then(withoutProse),
    ]);

    expect(regions).toContain("onAsk(said, open.scope);");
    /* The third parameter is the replay marker (fable-733 §2) and it rides the
       same handler, because a fresh take is the same paid edit arriving with
       one more thing known about it — a second closure here is the drift this
       file already exists to prevent. */
    expect(sheet).toContain("function askRefine(instruction: string, scope?: string, replayOf?: string)");
    /* `sent` rather than `scope` since fable-704: the rectangle now has three
       sources — the box she taps, the version being replayed, and the question
       she is answering about one of them — and they resolve to one value before
       the request is built. The assertion follows the value that goes out. */
    expect(sheet).toContain("const sent = scope ?? (answersTheQuestion ? answering?.scope : undefined);");
    expect(sheet).toContain("...(sent ? { scope: sent } : {}),");
  });

  /*
    AND A REPLAY SENDS THE REQUEST, NOT THE CAPTION (fable-704).

    The founder's own bug: Regenerate rebuilt the ask from the words on the chip
    and handed the sentence lane a side named with nothing pointed at, which it
    refused — correctly, and for a question he had not asked. A pointed ask is a
    sentence PLUS a rectangle, and re-reading the caption can only ever recover
    the half that was written on it.

    Asserted across the three files the journey crosses, because each one alone
    is a half that silently does nothing: the row records the rectangle, the
    projection hands it back, and the button sends it.
  */
  it("replays the rectangle a version was pointed at, rather than re-reading its words", async () => {
    const [service, route, panel, sheet] = await Promise.all([
      readFile(new URL("../../../../server/castingV2/refineService.ts", import.meta.url), "utf8"),
      readFile(new URL("../../../../server/routes/castingV2.ts", import.meta.url), "utf8"),
      readFile(new URL("./components/RefinePanel.tsx", import.meta.url), "utf8").then(withoutProse),
      readFile(SHEET, "utf8").then(withoutProse),
    ]);

    /* Written onto the row it belongs to — the record that did not exist. */
    expect(service).toContain("...(input.scope ? { askScope: input.scope } : {}),");
    /* Handed back on the version's own projection, beside its words. */
    expect(route).toContain("requestScope: readAskScope(variant.internalPrompt),");
    /* And sent again by the button, as a request rather than as a sentence. */
    expect(sheet).toContain("scope: shown.requestScope ?? null,");
    expect(panel).toContain("regenerates.scope ?? undefined,");
  });

  /*
    AND THE REPLAY SAYS WHICH VERSION IT IS A REPLAY OF (fable-733 §2).

    Same law as the rectangle above, one field along, and the same failure mode:
    each file alone is a half that silently does nothing. The rectangle taught
    this journey that a replay is the sentence PLUS what it was said at; the
    already-has door taught it that a replay is also the sentence plus WHAT IT
    IS A REPLAY OF. Without this field the server cannot tell the Regenerate
    button from somebody typing the same words, and three doors in a row have
    refused him for the difference.

    The server half is asserted here too, and it is the important one: the
    marker is CHECKED against the row rather than believed. A trusted boolean
    would let a client turn off the doors that stop a charge for a render
    changing nothing.
  */
  it("carries the replay marker onto the request, and proves it at the server", async () => {
    const [service, route, panel, sheet] = await Promise.all([
      readFile(new URL("../../../../server/castingV2/refineService.ts", import.meta.url), "utf8"),
      readFile(new URL("../../../../server/routes/castingV2.ts", import.meta.url), "utf8"),
      readFile(new URL("./components/RefinePanel.tsx", import.meta.url), "utf8").then(withoutProse),
      readFile(SHEET, "utf8").then(withoutProse),
    ]);

    /* The version's own id, handed to the button beside its words. */
    expect(sheet).toContain("variantId: shown.variantId,");
    /* Sent by the button, and only by the button. */
    expect(panel).toContain("regenerates.variantId,");
    /* Onto the outgoing request — working law 5, the wire itself. */
    expect(sheet).toContain("...(replayOf ? { replayOf } : {}),");
    /* Accepted at the door, shaped rather than trusted. */
    expect(route).toContain("replayOf: publicId.optional(),");
    expect(route).toContain("replayOf: input.replayOf,");
    /* And PROVED at the service: the named version must be the one this render
       is built on, AND its own sentence must be the one being sent. */
    expect(service).toContain("predecessorForParse.publicId === replayNames");
    expect(service).toContain("madeThisVersion === input.instruction.trim().toLowerCase()");
  });

  /*
    AND THE PICTURE SAYS THE SAME THING THE ASK DOES.

    A selection is about a row, so both of a pair lit — correct while every ask
    meant both, and a false claim the moment one of them is the ask: the box
    reads "her left eye" while a bright outline sits around the eye this render
    will deliberately not touch. It is fable-444 condition 1's rule (the panel
    may never claim what the rows do not agree on) on the surface she is
    actually looking at, and the unscoped case has to survive it — her lips and
    a pair tapped from the row still light everything they mean.
  */
  it("lights only the rectangle the scoped ask is about", async () => {
    const regions = withoutProse(await readFile(REGIONS, "utf8"));

    expect(regions).toContain("const active = open?.scope !== undefined");
    expect(regions).toContain("? open.scope === region.slot");
    expect(regions).toContain(": row.slots.some((slot) => selection.isSelected(slot));");
  });
});

/**
 * ONE ALIGNMENT AUTHORITY UNDER THE PICTURE (fable-377, on his screenshot).
 *
 * The image is the subject and the furniture aligns to it. `below` was a
 * sibling of the whole stage, so it centred on the viewer while the picture
 * centred on the stage's middle column — measured at 606 / 685 / 720, three
 * centrelines on one surface. The half that can actually fail is the browser
 * drive (`scripts/drive-face-scan-evidence.mts`), which compares the rendered
 * midpoints; this is the structural half.
 */
describe("the ask box hangs off the picture, not off the viewer", () => {
  it("puts `below` inside the picture's own column, not beside the stage", async () => {
    const viewer = await readFile(VIEWER, "utf8");
    const column = viewer.slice(viewer.indexOf('className="dpc-viewer__column"'));
    const untilClose = column.slice(0, column.indexOf('className="dpc-viewer__dock"'));
    expect(untilClose).toContain("<figure");
    expect(untilClose).toContain("{below}");
    /* And nothing hangs off the stage itself any more — a second child there is
       a second centreline. */
    const stage = viewer.slice(viewer.indexOf('className="dpc-viewer__stage"'));
    expect(stage.slice(stage.indexOf("</div>"), stage.indexOf("</div>") + 40)).not.toContain("{below}");
  });

  it("gives that column the frame's own ceiling rather than a second one", async () => {
    const css = await readFile(CSS, "utf8");
    const column = css.slice(css.indexOf(".dpc-viewer__column {"));
    const body = column.slice(0, column.indexOf("}"));
    expect(body).toContain("max-width: min(100%, 760px)");
    /* Shift 27's scar: a column that will not shrink takes the photograph's
       height and renders it at 0×0 while every source assertion passes. */
    expect(body).toContain("min-height: 0");
  });
});

/*
  LABELS ARE BARE; SENTENCES STILL SPEAK — the founder, twice in one morning
  (fable-450: *"the 'their' beside every feature is unnecessary"*; fable-451:
  *"even on hover it's too long — just 'Left eye'"*).

  The boundary is the whole ruling, so both halves are asserted: a label that
  quietly regained a possessive and a sentence that quietly lost one are the
  same defect from opposite ends, and only one of them is visible in a
  screenshot.
*/
describe("the panel labels a thing and speaks a sentence (fable-450/451)", () => {
  it("takes its label and its sentence from two different server fields", async () => {
    const [regions, panel] = await Promise.all([
      readFile(REGIONS, "utf8").then(withoutProse),
      readFile(PANEL, "utf8").then(withoutProse),
    ]);

    /* The tag and the row label are the NAME — bare, straight from the server,
       never assembled here. */
    expect(regions).toContain("<span className=\"dpc-regions__tag\">{region.name ?? row.name}</span>");
    expect(panel).toContain("{row.name}");
    /* And the one label that is a sentence takes `spoken`, which is where the
       possessive lives. Composing it in the browser from the bare name is what
       this split exists to prevent. */
    expect(regions).toContain("`What to change about ${open.spoken}`");
    expect(regions).not.toContain("open.name.toLowerCase()");
    /* Both entrances carry it, or the scoped box speaks about the row while
       the picture speaks about the eye. */
    expect(regions).toContain("spoken: scoped ? region.spoken ?? row.spoken : row.spoken,");
    expect(panel).toContain("spoken: row.spoken,");
  });
});

/*
  A PAIR OPENS INTO ITS TWO SIDES — founder ruling, fable-452, with a reference
  screenshot he called "a little over complicated".

  The shape is small on purpose: one chevron, two children, no per-child
  furniture. What these hold is the part a screenshot cannot show — that the
  child sends the SAME wire the rectangle already sends, and that opening a row
  did not quietly change what tapping it means.
*/
describe("the pair nests, and the child is the scoping gesture again", () => {
  it("gives the chevron its own target, so the row still means the pair", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));

    expect(panel).toContain("className=\"dpc-face__open\"");
    expect(panel).toContain("aria-expanded={isOpen}");
    /* The row's own click is untouched: both slots, no scope — an ask about
       the pair, exactly as before the ruling. */
    expect(panel).toContain("selection.select({ slots: row.slots, name: row.name, spoken: row.spoken, prefill: row.prefill });");
  });

  it("sends the child's ask down the SAME wire the rectangle sends", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));

    /* The row's slots, scoped to this instance — the shape `FaceRegions`
       builds when she clicks that instance's rectangle. Two entrances, one
       mechanism; a second way to say "this eye" is a second thing to get
       wrong. */
    expect(panel).toContain("scope: instance.slot,");
    expect(panel).toContain("slots: row.slots,");
    expect(panel).toContain("prefill: instance.prefill,");
  });

  it("lights per INSTANCE, so the picture and the list agree about which eye", async () => {
    const [panel, regions] = await Promise.all([
      readFile(PANEL, "utf8").then(withoutProse),
      readFile(REGIONS, "utf8").then(withoutProse),
    ]);

    /* A child is active only while the ask is scoped to it, and a rectangle is
       lit for the instance its pixels ARE. Both halves, because either one
       alone lets the list and the photograph disagree about the subject. */
    expect(panel).toContain("const scoped = selection.selected?.scope === instance.slot;");
    expect(panel).toContain("selection.hover([instance.slot])");
    expect(regions).toContain("const lit = selection.isHovered(region.slot);");
    expect(regions).toContain("selection.hover([region.slot])");
  });

  it("CONTROL — a row there is only one of grows no chevron", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    /* Guarded on the instances the server sends, never on a list of which
       features come in twos — that list already exists, in the catalogue. */
    expect(panel).toContain("{row.instances.length > 0 ?");
    expect(panel).not.toMatch(/\["eye", "ear", "brow"\]/);
  });
});

/**
 * A PAIR IS ONE OBJECT PHOTOGRAPHED TWICE (founder, fable-462 §3).
 *
 * His right eye read *"zoomed in too much"* beside his left. Measured in the
 * browser on the dev fixture, where both halves are scan windows: crops of
 * 34×23 and 50×28, each tile scaling its own crop to fill its own half, drawn
 * at 512px and 348px — a **1.47× magnification difference inside one row**,
 * from nothing but the reader returning a tighter box on one side.
 *
 * The derivation is unit-tested here and the RESULT is measured in the browser
 * (`drive-pair-zoom-disposable`), because "the same magnification" is a fact
 * about what the browser drew and not about what we passed it.
 */
describe("both halves of a pair are drawn at one magnification", () => {
  const window = (width: number, height: number) => ({
    contentUrl: "frame.png",
    maskUrl: "mask.png",
    crop: { x: 0, y: 0, width, height, frame: { width: 1024, height: 1536 } },
  });

  it("scales both halves to the larger extent of the two", async () => {
    const { pairScaleExtent } = await import("./components/FacePanel");
    /* Wider on one side, taller on the other: each axis takes its own max, or a
       pair whose halves disagree in different directions would still differ. */
    expect(pairScaleExtent([window(34, 28), window(50, 23)])).toEqual({ width: 50, height: 28 });
  });

  it("leaves a lone cutout exactly as it was", async () => {
    const { pairScaleExtent } = await import("./components/FacePanel");
    expect(pairScaleExtent([window(34, 23)])).toBeUndefined();
  });

  it("declines a MIXED pair rather than half-normalising it", async () => {
    /*
      A minted crop is its own picture and carries no window to scale, so a pair
      of one minted and one scanned cannot be normalised from here — the library
      would have to publish a minted crop's geometry, which it does not. Named
      rather than guessed at: half a normalisation is a second magnification
      rule nobody can see.
    */
    const { pairScaleExtent } = await import("./components/FacePanel");
    const minted = { contentUrl: "crop.png", maskUrl: "mask.png", crop: null };
    expect(pairScaleExtent([window(34, 23), minted])).toBeUndefined();
  });

  it("takes the scale from those extents and the POSITION from its own", async () => {
    /* The two must not be merged: a shared scale with a shared centre would
       point both halves at the same eye. */
    const css = await readFile(CSS, "utf8");
    const rule = css.slice(css.indexOf(".dpc-face__cut--cutout"));
    const block = rule.slice(0, rule.indexOf("}"));
    expect(block).toContain("--dpc-cut-sw");
    expect(block).toContain("var(--dpc-cut-box-w) / var(--dpc-cut-sw)");
    /* Centring still reads its own crop. */
    expect(block).toContain("var(--dpc-cut-x) + var(--dpc-cut-w) / 2");
  });
});
