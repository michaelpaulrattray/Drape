import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * ONE INTERACTION GRAMMAR FOR IMAGES, enforced rather than remembered.
 *
 * Founder ruling, 2026-08-02: **click opens the viewer · ← → walk the set ·
 * Esc closes · download lives in the viewer chrome.** Product-wide, no
 * exceptions — hero and thumbnail alike, sheet candidates included.
 *
 * A ruling like this decays one component at a time. Somebody adds an image
 * next month, gives it a hover-revealed download because that is what the
 * neighbouring code used to do, and nothing objects. So the rule is a lint: the
 * wrong shape fails CI even where it compiles and renders perfectly.
 */

const FEATURE = new URL("./", import.meta.url);
const COMPONENTS = new URL("./components/", import.meta.url);
const VIEWER = new URL("./components/CandidateViewer.tsx", import.meta.url);
const TILE = new URL("./components/CandidateTile.tsx", import.meta.url);
const TRAY = new URL("./components/KeptTray.tsx", import.meta.url);
const CSS = new URL("./castingV2.css", import.meta.url);
const ROOM = new URL("../../pages/CastingRoom.tsx", import.meta.url);
const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);

/** Every casting source file, so a new one is covered the day it lands. */
async function castingSources(): Promise<Array<{ name: string; source: string }>> {
  const out: Array<{ name: string; source: string }> = [];
  for (const dir of [FEATURE, COMPONENTS]) {
    for (const entry of await readdir(dir)) {
      if (!entry.endsWith(".tsx")) continue;
      out.push({ name: entry, source: await readFile(new URL(entry, dir), "utf8") });
    }
  }
  out.push({ name: "CastingRoom.tsx", source: await readFile(ROOM, "utf8") });
  out.push({ name: "CastingSheet.tsx", source: await readFile(SHEET, "utf8") });
  return out;
}

describe("the one image grammar", () => {
  it("puts download in the viewer and nowhere else", async () => {
    /*
      The defect this replaces: a hover-revealed download icon on every room
      image. Two things wrong with it — a control most people never find,
      because you have to hover to learn it exists, and a permanent row of file
      chrome over someone's face, which turns a room into a file manager.
    */
    const offenders: string[] = [];
    for (const { name, source } of await castingSources()) {
      if (name === "CandidateViewer.tsx") continue;
      /*
        The room's explicit bulk control builds its anchor inside a named
        helper. That is a real button with a real label, not hover chrome, and
        it is the one sanctioned exception — carved out by NAME so a second one
        cannot appear quietly beside it.
      */
      const stripped = name === "CastingRoom.tsx"
        ? source.slice(0, source.indexOf("function downloadPackage"))
          + source.slice(source.indexOf("export default function CastingRoom"))
        : source;
      if (stripped.includes("download=")) offenders.push(name);
    }
    expect(
      offenders,
      "Download belongs in the viewer chrome, and for bulk in the room's explicit "
      + "Download package control. A download attribute anywhere else is the "
      + "hover-chrome grammar coming back.",
    ).toEqual([]);
  });

  it("keeps expand icons out of the product — clicking IS expanding", async () => {
    const offenders: string[] = [];
    for (const { name, source } of await castingSources()) {
      if (/\bMaximize2?\b/.test(source)) offenders.push(name);
    }
    expect(
      offenders,
      "An icon whose only job is to do what clicking the picture already does is "
      + "furniture. Remove it and let the image be the affordance.",
    ).toEqual([]);
  });

  it("binds all four gestures in one place", async () => {
    const viewer = await readFile(VIEWER, "utf8");
    expect(viewer).toContain('event.key === "Escape"');
    expect(viewer).toContain('event.key === "ArrowRight"');
    expect(viewer).toContain('event.key === "ArrowLeft"');
    expect(viewer).toContain("frame.downloadName");
    // The walk is written ONCE. Three call sites had grown three near-identical
    // modulo walks, which is the drift this shape exists to end.
    expect(viewer).toContain("(index + direction + frames.length) % frames.length");
  });

  it("takes the SET, so a caller cannot ship a viewer whose arrows do nothing", async () => {
    const viewer = await readFile(VIEWER, "utf8");
    expect(viewer).toContain("frames: readonly ViewerFrame[];");
    expect(viewer).toContain("index: number;");
    // And the old single-frame door is gone, not merely unused.
    expect(viewer).not.toContain("imageUrl: string;");
    expect(viewer).not.toContain("onStep?:");
  });

  it("makes a tile unable to opt out", async () => {
    /*
      `onOpenViewer` is REQUIRED on the tile, and the viewer itself lives on the
      sheet — a tile cannot own arrows that walk to the next tile. The
      requirement is the device: a new caller that forgets it fails to compile
      rather than shipping a dead picture.
    */
    const tile = await readFile(TILE, "utf8");
    expect(tile).toContain("onOpenViewer: () => void;");
    expect(tile).not.toContain("onOpenViewer?:");
    expect(tile).not.toContain("CandidateViewer");
  });

  it("gives every room image a real affordance, not a div with a handler", async () => {
    const room = await readFile(ROOM, "utf8");
    // Buttons, so each is a tab stop with a name — the expand icon used to be
    // the only thing announcing that a picture could be opened at all.
    expect(room).toContain('className="dpc-master__main dpc-media"');
    expect(room).toContain('className="dpc-strip__frame dpc-media"');
    expect(room).not.toContain("onDoubleClick");
    expect(room).toContain("View ${data.name");
  });

  it("offers the package in bulk as a real control", async () => {
    const room = await readFile(ROOM, "utf8");
    expect(room).toContain("Download package");
    expect(room).toContain("function downloadPackage");
    // Not hover chrome: it sits in the package head, beside the count.
    expect(room).toContain("dpc-takes__actions");
  });
});

describe("a sibling tile goes where she is", () => {
  it("routes by server-derived state, never by a client guess", async () => {
    const room = await readFile(ROOM, "utf8");
    expect(room).toContain('sibling.destination === "cast"');
    expect(room).toContain('sibling.destination === "sheet"');
    expect(room).toContain("?focus=${sibling.candidateId}");
    /*
      The third case is the one a client could not compute: her sheet may have
      expired while she herself survives under the §G.6 exemption. The viewer is
      the destination when there is genuinely nowhere else to go.
    */
    expect(room).toContain("setViewingSibling(sibling)");
  });

  it("never offers a link to a sheet that is gone", async () => {
    const room = await readFile(ROOM, "utf8");
    // lastIndexOf: the phrase also appears in the comment explaining why the
    // room's top-right link was removed, and that mention is not the control.
    const index = room.lastIndexOf("Open the sheet she came from");
    expect(index).toBeGreaterThan(0);
    expect(room.slice(index - 500, index)).toContain("data.sheetOpen");
  });

  it("lands the focus on the tray, and expands it first", async () => {
    const tray = await readFile(TRAY, "utf8");
    expect(tray).toContain("focusCandidateId");
    // Expand before scrolling: she may be past the resting six, and scrolling
    // to a chip that is not rendered yet scrolls to nothing.
    expect(tray).toContain("setExpanded(true)");
    expect(tray).toContain("scrollIntoView");
  });
});

describe("the rename field focuses like a text field", () => {
  it("draws no ring on the input, and reserves red for invalid", async () => {
    const css = await readFile(CSS, "utf8");
    /*
      The bug: a bare `:focus` rule loses to the blanket
      `.dp-root :focus-visible { outline: 2px }` on specificity, so the accent
      rectangle drew around the text anyway — the inner-element outline the
      foundation law forbids, in the product's alarm colour.
    */
    expect(css).toContain(".dp-root .dpc-room__nameinput:focus-visible");
    const block = css.slice(
      css.indexOf(".dp-root .dpc-room__nameinput:focus"),
      css.indexOf(".dp-root .dpc-room__nameinput[aria-invalid"),
    );
    expect(block).toContain("outline: none");
    expect(block).toContain("var(--ink)");
    expect(block).not.toContain("--accentSolid");
    // Red exists, for the one state that IS invalid.
    expect(css).toContain('.dp-root .dpc-room__nameinput[aria-invalid="true"]');

    const room = await readFile(ROOM, "utf8");
    expect(room).toContain("aria-invalid={draftName.trim().length === 0}");
  });
});
