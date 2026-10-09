import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { withoutComments } from "../../../../server/testing/withoutComments";

/**
 * ONE overflow menu, one behaviour, everywhere.
 *
 * There were two — the sheet card's and the roster card's — grown apart in the
 * usual way: same placement logic, same outside-click handling, same panel,
 * different reveal rules and different treatments. The room wanted a third.
 * Three copies of a hover rule is three chances for two of them to be wrong.
 *
 * The founder's ruling (2026-08-03) is a three-rung ladder, and the middle rung
 * is the one that was missing: the dots were invisible until pointed at
 * directly, which is a control you can only find by already knowing it is there.
 */

const FEATURE = new URL("./", import.meta.url);
const COMPONENTS = new URL("./components/", import.meta.url);
const CSS = new URL("./castingV2.css", import.meta.url);
const MENU = new URL("../../foundation/CardMenu.tsx", import.meta.url);
const ROOM = new URL("../../pages/CastingRoom.tsx", import.meta.url);
const MODALS = new URL("../../foundation/modals.css", import.meta.url);

/** modals.css with its line endings normalised, so a CRLF checkout reads the same. */
async function readModals(): Promise<string> {
  return (await readFile(MODALS, "utf8")).replace(/\r\n/g, "\n");
}

/** The declarations of the first rule that starts a line with `head`. */
function ruleBody(css: string, head: string): string {
  const at = css.indexOf(`\n${head}`);
  if (at < 0) return "";
  const open = css.indexOf("{", at);
  return css.slice(open + 1, css.indexOf("}", open));
}
const LOBBY = new URL("../../pages/CastingV2.tsx", import.meta.url);

describe("there is exactly one overflow menu", () => {
  it("has no second implementation anywhere in casting", async () => {
    const offenders: string[] = [];
    for (const dir of [FEATURE, COMPONENTS]) {
      for (const entry of await readdir(dir)) {
        if (!entry.endsWith(".tsx") || entry === "CardMenu.tsx") continue;
        const source = await readFile(new URL(entry, dir), "utf8");
        // The tells of a hand-rolled menu: its own trigger, its own panel.
        if (source.includes("aria-haspopup=\"menu\"")) offenders.push(entry);
      }
    }
    expect(
      offenders,
      "A second menu is a second hover rule, a second outside-click handler and "
      + "a second set of placement bugs. Use `CardMenu`.\n  " + offenders.join("\n  "),
    ).toEqual([]);
  });

  it("is used by the two card surfaces as overlays, and by the room's row (card 2144)", async () => {
    /*
      The room had one beside the name for a day (2026-08-03) and deleting was
      made a sentence instead. That ruling is RETIRED by him, 2026-10-09,
      verbatim: "on the old ruling casting library already has delete in a menu
      i think this must be an old ruling on menu styling shouldnt all menus be
      the same ?" — the character sheet row now carries the same one menu, in
      its `row` placement, and the delete sentence is gone.
    */
    const lobby = await readFile(LOBBY, "utf8");
    const room = await readFile(ROOM, "utf8");
    expect(lobby.match(/<CardMenu\s+placement="overlay"/g) ?? []).toHaveLength(2);
    expect(lobby.match(/<CardMenu/g) ?? []).toHaveLength(2);
    expect(room.match(/<CardMenu\s+placement="row"/g) ?? []).toHaveLength(1);
    expect(room.match(/<CardMenu/g) ?? []).toHaveLength(1);
    expect(room).not.toContain("dpc-room__delete");
  });

  it("makes every caller say where its dots sit", async () => {
    /* Required, not optional: a caller cannot forget, and there is no third
       style. */
    const menu = withoutComments(await readFile(MENU, "utf8"));
    expect(menu).toContain('placement: "overlay" | "row";');
    expect(menu).not.toContain("placement?:");
    expect(menu).toContain("dpc-cardmenu--${placement}");
  });
});

describe("the reveal ladder", () => {
  it("shows the dots at rest, and hides an OVERLAY's only where a pointer can hover (card 2144)", async () => {
    /*
      His words, 2026-10-09: "shouldnt all menus be the same ?", then "anywhere
      that a 3 dot menu is sitting ontop of a card like the cast library could
      be hover hidden? thoughts". So: the rest look is VISIBLE (a `row` menu
      keeps it always), and an `overlay` hides it until its card is hovered —
      inside `(hover: hover)` only, because a touch screen cannot hover and a
      hover-revealed control there would not exist.
    */
    const css = await readModals();
    const rest = ruleBody(css, ".dpc-cardmenu__trigger {");
    expect(rest).toContain("opacity: 1");
    expect(rest).toContain("var(--fillStrong)");
    expect(rest).not.toContain("opacity: 0");

    const media = css.slice(css.indexOf("@media (hover: hover) {"));
    expect(media.length, "the pointer-only block is gone").toBeLessThan(css.length);
    const block = media.slice(0, media.indexOf("\n}\n") + 3);
    const hide = '.dpc-cardmenu--overlay .dpc-cardmenu__trigger:not([aria-expanded="true"]):not(:focus-visible)';
    const reveal = ".dpc-menuhost:hover .dpc-cardmenu--overlay .dpc-cardmenu__trigger";
    expect(block).toContain(hide);
    expect(block.slice(block.indexOf(hide))).toContain("opacity: 0");
    expect(block).toContain(reveal);
    /* Same specificity, so the REVEAL must come after the hide to win. */
    expect(block.indexOf(reveal)).toBeGreaterThan(block.indexOf(hide));
    /* And the hide is nowhere outside that block — or touch loses the dots. */
    expect(css.replace(block, "")).not.toContain("cardmenu--overlay");
  });

  it("reveals an overlay for the keyboard too", async () => {
    // Otherwise the menu is reachable by tab and invisible while focused.
    const css = await readModals();
    expect(css).toContain(".dpc-menuhost:focus-within .dpc-cardmenu--overlay .dpc-cardmenu__trigger");
  });

  it("paints a danger item red AT REST, on every menu (card 2144)", async () => {
    const css = await readModals();
    expect(ruleBody(css, ".dpc-cardmenu__item--danger {")).toContain("color: var(--errorInk)");
  });

  it("pins the trigger to the corner it is supposed to be in", async () => {
    /*
      The founder found it sitting at the BOTTOM of the sheet card. The
      positioning rule lived in the block that was deleted when the two old
      menus were merged, so the trigger fell into normal flow — a layout rule
      lost to a refactor of something else.
    */
    const css = await readFile(CSS, "utf8");
    const placement = css.slice(
      css.indexOf(".dpc-sheetmenu,"),
      css.indexOf(".dpc-cardmenu__trigger {"),
    );
    expect(placement).toContain("position: absolute");
    expect(placement).toContain("top: 8px");
    expect(placement).toContain("right: 8px");
  });

  it("lets rung three out-specify rung two", async () => {
    /*
      THE SPECIFICITY TRAP, and the second one in this stylesheet in a day.

      `.dpc-menuhost:hover .dpc-cardmenu__trigger` is (0,3,0); a bare
      `.dpc-cardmenu__trigger:hover` is (0,2,0). The card is ALWAYS hovered
      while the dots are, so rung two won every time and the solid state was
      unreachable — the founder reported the dots having no hover effect at all,
      and he was right.

      A hover state nested inside another hover state has to be written as the
      nested thing it is.
    */
    const css = await readFile(CSS, "utf8");
    expect(css).toContain(".dpc-menuhost:hover .dpc-cardmenu__trigger:hover");
  });

  it("keeps the card hovered while the pointer is on its dots", async () => {
    /*
      The highlight hung off the card BUTTON, and the menu is its sibling — so
      reaching for the actions dropped the card's own hover, which reads as the
      card losing interest in you at the moment you reach for it.
    */
    const css = await readFile(CSS, "utf8");
    expect(css).toContain(".dpc-castcard__wrap:hover .dpc-castcard__frame");
  });

  it("gives every caller a hover host", async () => {
    /*
      The first rung hangs off `.dpc-menuhost`, so a caller that forgets it
      ships a menu that never appears. Asserted at both sites rather than left
      to review.
    */
    const lobby = await readFile(LOBBY, "utf8");
    expect(lobby).toContain("dpc-sheetcard dpc-menuhost");
    expect(lobby).toContain("dpc-castcard__wrap dpc-menuhost");
  });
});

describe("what the menu may offer", () => {
  it("omits an impossible item rather than disabling it", async () => {
    /*
      Delete is ABSENT while a Cast builds and while the server's door is shut —
      the deletion authority excludes `provisioning` by design, so the item
      could only ever refuse. A menu item that always refuses is a dead control
      (D-107), and the law takes no exception for politeness.
    */
    const menu = await readFile(MENU, "utf8");
    // Comments stripped: the prose explaining this rule necessarily contains
    // the word it forbids.
    const code = withoutComments(menu);
    expect(code).not.toContain("disabled");

    const lobby = await readFile(LOBBY, "utf8");
    const room = await readFile(ROOM, "utf8");
    for (const [name, source] of [["lobby", lobby], ["room", room]] as const) {
      expect(source, `${name} gates Delete on both conditions`)
        .toContain('deleteDoorOpen && ');
      expect(source, `${name} hides Delete while building`)
        .toMatch(/status !== "building"/);
    }
  });

  it("keeps the roster card's item list in one place", async () => {
    const lobby = await readFile(LOBBY, "utf8");
    expect(lobby).toContain("const castMenuItems =");
  });

  it("gates the room's Delete item exactly as the sentence was gated", async () => {
    /*
      The affordance changed shape again (#2144: a sentence became a menu
      item); the rules did not. Absent while the cast builds, absent while the
      server's door is shut.
    */
    const room = await readFile(ROOM, "utf8");
    const index = room.indexOf("characterSheetMenuItems({");
    expect(index).toBeGreaterThan(0);
    const call = room.slice(index, room.indexOf("})}", index));
    expect(call).toContain('deleteOffered: deleteDoorOpen && data.status !== "building"');
  });
});
