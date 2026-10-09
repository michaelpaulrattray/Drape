import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/*
  `CardMenu` portals its open panel to `document.body`, which a server render
  has no use for. The portal is replaced by its own children, so the markup
  read here is the panel the browser would be handed — rendered by the real
  component, not inferred from its source.
*/
vi.mock("react-dom", async (original) => ({
  ...(await original<typeof import("react-dom")>()),
  createPortal: (children: unknown) => children,
}));

/* `createPortal(…, document.body)` reads its target as an argument; a server
   render has no document, and the target is discarded above anyway. */
vi.stubGlobal("document", { body: null });

const { CardMenu } = await import("./CardMenu");

/**
 * ONE MENU, ONE LOOK, TWO PLACEMENTS — #2144, rendered.
 *
 * His words, 2026-10-09: "shouldnt all menus be the same ?", then "anywhere
 * that a 3 dot menu is sitting ontop of a card like the cast library could be
 * hover hidden? thoughts". The placement is a class on the menu's own root;
 * the CSS arms in `cardMenuAnatomy.test.ts` hold what each class does.
 */
const noop = () => undefined;
const ITEMS = [
  { label: "Regenerate character sheet", meta: "650 credits", onSelect: noop },
  { label: "Delete this character", danger: true, onSelect: noop },
];

function render(placement: "overlay" | "row", open: boolean): string {
  return renderToStaticMarkup(
    createElement(CardMenu, {
      label: "the character sheet",
      items: ITEMS,
      open,
      onToggle: noop,
      onCancel: noop,
      placement,
    }),
  );
}

describe("CardMenu, rendered", () => {
  it("marks the root with the placement the caller named", () => {
    expect(render("row", false)).toContain('class="dpc-cardmenu dpc-cardmenu--row"');
    expect(render("overlay", false)).toContain('class="dpc-cardmenu dpc-cardmenu--overlay"');
    /* Negative control: a row is never also an overlay. */
    expect(render("row", false)).not.toContain("dpc-cardmenu--overlay");
  });

  it("gives the trigger a name a screen reader can say, and no panel while closed", () => {
    const html = render("row", false);
    expect(html).toContain('aria-label="Actions for the character sheet"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="menu"');
  });

  it("draws the SAME panel for both placements", () => {
    const panel = (html: string) => html.slice(html.indexOf('role="menu"') - 60);
    expect(panel(render("row", true))).toBe(panel(render("overlay", true)));
  });

  it("draws the price on the item's own line, and Delete as a danger item after a rule", () => {
    const html = render("row", true);
    expect(html).toContain('role="menu"');
    expect(html).toContain('aria-label="Actions for the character sheet"');
    expect(html.match(/role="menuitem"/g) ?? []).toHaveLength(2);
    const label = html.indexOf(">Regenerate character sheet<");
    const meta = html.indexOf('class="dpc-cardmenu__meta">650 credits<');
    expect(label).toBeGreaterThan(0);
    expect(meta).toBeGreaterThan(label);
    const rule = html.indexOf("dpc-cardmenu__rule");
    const danger = html.indexOf("dpc-cardmenu__item dpc-cardmenu__item--danger");
    expect(rule).toBeGreaterThan(meta);
    expect(danger).toBeGreaterThan(rule);
    /* Negative control: the free item is not a danger item. */
    expect(html.slice(0, rule)).not.toContain("dpc-cardmenu__item--danger");
  });

  it("draws nothing at all when nothing can happen", () => {
    const html = renderToStaticMarkup(
      createElement(CardMenu, {
        label: "x", items: [], open: false, onToggle: noop, onCancel: noop, placement: "row",
      }),
    );
    expect(html).toBe("");
  });

  it("walks the panel by keyboard, and leaves it on Tab (card 2144: reachable by keyboard)", async () => {
    /* Behaviour that needs a DOM; driven in the running app (PR frames). This
       arm holds the wiring so it cannot be dropped silently. */
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(new URL("./CardMenu.tsx", import.meta.url), "utf8");
    expect(source).toContain('event.key === "ArrowDown"');
    expect(source).toContain('event.key === "ArrowUp"');
    expect(source).toContain('event.key === "Tab"');
    expect(source).toContain("event.detail === 0");
    expect(source).toMatch(/if \(!placed \|\| !openedByKeyboard\.current\) return;/);
  });
});
