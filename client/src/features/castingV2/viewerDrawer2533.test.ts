import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/*
  THE EDIT PANEL IS A DRAWER, AND LOOKING IS JUST THE PICTURE — card 2533.

  His approval of the design, 2026-10-15: *"the mockup is pretty good, im happy
  with it for now."* What the approved mock says, and what this file holds:

  - the panel slides out on intent, beside the picture, and is not in the row
    the picture is centred in (so the picture never moves when it opens);
  - the count is one quiet line above the picture, "2 of 8", with "Hold ·
    Compare" beside it only when there is a previous version;
  - the only chip is Undo, after an edit, reading "Undo · free";
  - no hint lines under the box;
  - in light mode the viewer's corner controls and the drawer's close wear the
    field's glass with no nested blur, and dark mode is untouched.

  The two components are driven through React's own renderer, so a label moved
  into a constant or a ternary is read the way the browser reads it. The viewer
  portals to `document.body`, which the server renderer has no use for, so the
  portal is replaced with its children — nothing else about the component is.

  What a static render cannot show — that arrowing past faces asks for no read,
  and that reaching for the ask box asks for exactly that face's — is a browser
  drive at the wire, and it is on the pull request with its counts.
*/
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, createPortal: (children: unknown) => children };
});

/* The download link is built against the page's origin; the server renderer
   has no window, so it is given the one fact the link reads. */
vi.stubGlobal("window", { location: { origin: "https://klieg.test" } });
/* And the portal's target, which the replaced `createPortal` never uses. */
vi.stubGlobal("document", { body: {} });

const { CandidateViewer } = await import("./components/CandidateViewer");
const { RefinePanel } = await import("./components/RefinePanel");

const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);
const VIEWER = new URL("./components/CandidateViewer.tsx", import.meta.url);
const CSS = new URL("./castingV2.css", import.meta.url);

const FRAMES = Array.from({ length: 8 }, (_, at) => ({
  url: `https://example.test/${at}.png`,
  label: `0${at + 1}`,
  downloadName: `candidate-0${at + 1}`,
  candidateId: `c${at}`,
}));

function viewer(props: Record<string, unknown>): string {
  return renderToStaticMarkup(createElement(CandidateViewer, {
    frames: FRAMES,
    index: 1,
    onIndexChange: () => undefined,
    onClose: () => undefined,
    beside: createElement("div", { "data-panel": "face" }, "panel"),
    ...props,
  }));
}

function panel(props: Record<string, unknown>): string {
  return renderToStaticMarkup(createElement(RefinePanel, {
    variants: [],
    pending: [],
    selectedVariantId: null,
    originalImageUrl: null,
    originalThumbUrl: null,
    regenerates: null,
    priceCredits: 100,
    busy: false,
    outcome: null,
    draft: "",
    onDraft: () => undefined,
    onEditIntent: () => undefined,
    onDismissOutcome: () => undefined,
    onRefine: () => undefined,
    onSelect: () => undefined,
    ...props,
  } as never));
}

describe("the viewer draws the panel as a drawer when the caller asks for one", () => {
  it("CONTROL — without a drawer the panel is the docked column it always was", () => {
    /* The room and the package pass no drawer and must keep today's shape. */
    const html = viewer({});
    expect(html).toContain('class="dpc-viewer__dock"');
    expect(html).not.toContain("dpc-viewer__drawer");
    expect(html).toContain("2 / 8");
  });

  it("puts a shut drawer out of the row, inert and hidden — looking is just the picture", () => {
    const html = viewer({ drawer: { open: false, onClose: () => undefined } });
    expect(html).not.toContain('class="dpc-viewer__dock"');
    const drawer = html.slice(html.indexOf('<aside class="dpc-viewer__drawer"'));
    expect(drawer.slice(0, 300)).toContain('data-open="false"');
    expect(drawer.slice(0, 300)).toContain("inert");
    expect(drawer.slice(0, 300)).toContain('aria-hidden="true"');
    /* The panel is still mounted inside it, so reopening is instant and full. */
    expect(drawer).toContain('data-panel="face"');
  });

  it("opens it when the caller says so, with its own close control", () => {
    const html = viewer({ drawer: { open: true, onClose: () => undefined } });
    const drawer = html.slice(html.indexOf('<aside class="dpc-viewer__drawer"'));
    expect(drawer.slice(0, 300)).toContain('data-open="true"');
    expect(drawer.slice(0, 300)).not.toContain("inert");
    expect(drawer).toContain('aria-label="Close the panel"');
  });

  it("counts quietly above the picture — \"2 of 8\", in words, not the chrome's \"2 / 8\"", () => {
    const html = viewer({ drawer: { open: false, onClose: () => undefined } });
    expect(html).toContain('data-counter="above"');
    expect(html).toContain(">2 of 8<");
    expect(html).not.toContain("2 / 8");
  });

  it("names the hold only where there is a previous version to hold against", () => {
    const without = viewer({ drawer: { open: false, onClose: () => undefined } });
    expect(without).not.toContain("Hold · Compare");
    const withPrevious = viewer({
      drawer: { open: false, onClose: () => undefined },
      compare: { url: "https://example.test/before.png", label: "Original" },
    });
    expect(withPrevious).toContain("Hold · Compare");
    /* One family: the cue is NOT the mono chrome class the old caption used. */
    const cue = withPrevious.slice(withPrevious.indexOf("dpc-viewer__compareCue"));
    expect(cue.slice(0, 200)).not.toContain("dp-chrome");
  });

  it("lets Escape shut an open drawer before it closes the viewer", async () => {
    const source = await readFile(VIEWER, "utf8");
    const escape = source.slice(source.indexOf('if (event.key === "Escape")'));
    /* Up to the VIEWER's own close — the drawer's call is `drawer?.onClose()`. */
    const handled = escape.slice(0, escape.indexOf("\n        onClose();"));
    expect(handled).toContain("if (drawerOpen) {");
    expect(handled).toContain("drawer?.onClose();");
  });
});

describe("the composer under the picture", () => {
  it("draws no hint lines", () => {
    const html = panel({});
    expect(html).toContain('placeholder="Change something about them…"');
    expect(html).not.toContain("not their clothes or the room");
    expect(html).not.toContain("take something back");
    expect(html).not.toContain("dpc-refine__note");
  });

  it("puts the + and the priced button INSIDE the one box", () => {
    const html = panel({ attachPicture: async () => ({ referenceId: "r" }) });
    const box = html.slice(html.indexOf('class="dpc-refine__box"'));
    expect(box).toContain("dpc-refine__field");
    expect(box).toContain('class="dpc-refine__attach"');
    expect(box).toMatch(/Refine · [\d,]+ credits/);
  });

  it("CONTROL — offers no Undo on the original, where there is nothing to take back", () => {
    expect(panel({ selectedVariantId: null })).not.toContain("Undo");
  });

  it("offers ONE chip after an edit, and it reads \"Undo · free\"", () => {
    const html = panel({ selectedVariantId: "v1" });
    expect(html.match(/class="dpc-refine__chip"/g)?.length).toBe(1);
    expect(html).toContain("Undo · free");
  });

  it("sends the bare word through the SAME paid handler the box sends through", async () => {
    /* Free on the server because the word is bare — never a second road. */
    const source = await readFile(new URL("./components/RefinePanel.tsx", import.meta.url), "utf8");
    expect(source).toContain('const UNDO_WORD = "undo";');
    expect(source).toContain("onClick={() => onRefine(UNDO_WORD)}");
  });
});

describe("the sheet opens the drawer on intent, and only for the face in front of it", () => {
  it("keys the open drawer on the CANDIDATE, so walking the set shuts it", async () => {
    const sheet = await readFile(SHEET, "utf8");
    expect(sheet).toContain("const [drawerOpenFor, setDrawerOpenFor] = useState<string | null>(null);");
    expect(sheet).toContain("drawerOpenFor === viewerCandidateId");
  });

  it("opens it from the ask box, and the opening arms that face's read", async () => {
    const sheet = await readFile(SHEET, "utf8");
    expect(sheet).toContain("onEditIntent={openDrawer}");
    const opener = sheet.slice(sheet.indexOf("const openDrawer = useCallback("));
    const body = opener.slice(0, opener.indexOf("}, ["));
    expect(body).toContain("setScanArmedFor(viewerCandidateId)");
    expect(body).toContain("setDrawerOpenFor(viewerCandidateId)");
  });

  it("shutting it never disarms — a read already started is not bought twice", async () => {
    const sheet = await readFile(SHEET, "utf8");
    const prop = sheet.slice(sheet.indexOf("drawer={{ open: drawerOpen"));
    const line = prop.slice(0, prop.indexOf("}}"));
    expect(line).toContain("onClose: () => setDrawerOpenFor(null)");
    expect(line).not.toContain("setScanArmedFor");
  });
});

describe("the feature boxes over the picture belong to the drawer — card 2547", () => {
  /* His report, 2026-10-15: "when i open a cast imaghe even if i havent
     clicked into the refine box or anything the box's are appearing around the
     casts features". A face scanned before answers with its kept rows on first
     paint, so the overlay's condition is the only thing standing between those
     rows and looking mode. */
  async function overlayCondition(): Promise<string> {
    const sheet = await readFile(SHEET, "utf8");
    /* The anchor must be unique, or the slice could read a neighbour. */
    expect(sheet.split("overlay={").length - 1).toBe(1);
    const prop = sheet.slice(sheet.indexOf("overlay={"));
    return prop.slice(0, prop.indexOf("<FaceRegions"));
  }

  it("draws the regions only while the drawer is open for this face", async () => {
    const condition = await overlayCondition();
    expect(condition).toMatch(/&&\s*drawerOpen\s*\?/);
  });

  it("CONTROL — the condition still needs a refinable face with data, so an open drawer alone draws nothing", async () => {
    const condition = await overlayCondition();
    expect(condition).toContain("facePanelData");
    expect(condition).toContain("viewerRefinable");
    /* And `drawerOpen` is the candidate-keyed one, not a bare flag that would
       survive arrowing to the next face. */
    const sheet = await readFile(SHEET, "utf8");
    expect(sheet).toContain("const drawerOpen = viewerCandidateId !== null && drawerOpenFor === viewerCandidateId;");
  });
});

describe("light mode's corner controls wear the field's glass; dark is untouched", () => {
  it("gives download, close and the drawer's close the field material with no blur, in light only", async () => {
    const css = await readFile(CSS, "utf8");
    const start = css.indexOf(':root:not([data-theme="dark"]) .dpc-viewer__download,');
    expect(start).toBeGreaterThan(0);
    const rule = css.slice(start, css.indexOf("}", start));
    expect(rule).toContain(':root:not([data-theme="dark"]) .dpc-viewer__close');
    expect(rule).toContain(':root:not([data-theme="dark"]) .dpc-viewer__drawerClose');
    expect(rule).toContain("background: color-mix(in srgb, var(--onScrim) 8%, transparent)");
    expect(rule).toContain("backdrop-filter: none");
  });

  it("CONTROL — writes nothing for these controls under the dark theme", async () => {
    const css = await readFile(CSS, "utf8");
    /* `:root:not([data-theme="dark"])` is the light rule above, so a dark
       selector is one NOT preceded by `not(`. */
    expect(css).not.toMatch(/(?<!not\()\[data-theme="dark"\][^{,]*\.dpc-viewer__(?:close|download|drawerClose)/);
  });
});
