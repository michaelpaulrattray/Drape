import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

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
const MENU = new URL("./components/CardMenu.tsx", import.meta.url);
const ROOM = new URL("../../pages/CastingRoom.tsx", import.meta.url);
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

  it("is used by the sheet card, the roster card and the room", async () => {
    const lobby = await readFile(LOBBY, "utf8");
    const room = await readFile(ROOM, "utf8");
    // Two on the lobby — sheets and roster — and one in the room.
    expect(lobby.match(/<CardMenu/g) ?? []).toHaveLength(2);
    expect(room).toContain("<CardMenu");
  });
});

describe("the reveal ladder", () => {
  it("climbs three rungs, not one", async () => {
    const css = await readFile(CSS, "utf8");
    const trigger = css.slice(
      css.indexOf(".dpc-cardmenu__trigger {"),
      css.indexOf(".dpc-cardmenu__panel"),
    );

    // Rung one: absent at rest.
    expect(trigger).toContain("opacity: 0");
    // Rung two: the CARD is hovered, so its actions show themselves.
    expect(trigger).toContain(".dpc-menuhost:hover .dpc-cardmenu__trigger");
    expect(trigger).toContain("var(--fillStrong)");
    // Rung three: solid, and a hairline so it reads as raised rather than as a
    // hole on a card of the same colour.
    expect(trigger).toContain(".dpc-cardmenu__trigger:hover");
    expect(trigger).toContain("background: var(--surface)");
    expect(trigger).toContain("border-color: var(--borderCard)");
  });

  it("reveals for the keyboard too", async () => {
    // Otherwise the menu is reachable by tab and invisible while focused.
    const css = await readFile(CSS, "utf8");
    expect(css).toContain(".dpc-menuhost:focus-within .dpc-cardmenu__trigger");
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
      ships a menu that never appears. Asserted at all three sites rather than
      left to review.
    */
    const lobby = await readFile(LOBBY, "utf8");
    const room = await readFile(ROOM, "utf8");
    expect(lobby).toContain("dpc-sheetcard dpc-menuhost");
    expect(lobby).toContain("dpc-castcard__wrap dpc-menuhost");
    expect(room).toContain("dpc-room__nameline dpc-menuhost");
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
    const code = menu.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
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

  it("shares one item list between the roster card and the room", async () => {
    // They are the same decision about the same Cast, so they read the same.
    const lobby = await readFile(LOBBY, "utf8");
    expect(lobby).toContain("const castMenuItems =");
    const room = await readFile(ROOM, "utf8");
    for (const label of ["Rename", "Delete"]) {
      expect(room).toContain(`label: "${label}"`);
    }
  });
});
