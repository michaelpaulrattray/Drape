/**
 * #2263 — on a phone the customer can still report a bug and reach help.
 *
 * The topbar's bug icon and help menu are hidden below 768px (the phone bar
 * has no room for them — #2260). Before this card nothing replaced them, so a
 * phone customer had no way to tell us anything. Now the account menu carries
 * a HELP group below 768px: Report a bug, Send feedback, Documentation.
 *
 * What this guard holds, driven through React's own renderer rather than read
 * off a constant:
 *
 *  1. the two topbar entrances and the account-menu group, AS RENDERED, are
 *     visible at complementary widths — at every width exactly one of them is
 *     on screen, never both (a doubled menu) and never neither (this bug);
 *  2. the account-menu group really renders its two live rows (Report a bug,
 *     Send feedback) after the menu's own rows;
 *  3. AppChrome, the one consumer, really wraps the account menu in it.
 *
 * The layout itself (that the phone bar still fits at 360/390/420) is the
 * #2260 guard's and the PR's frames; a node test cannot lay out a page.
 */
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { withoutComments } from "../../../../server/testing/withoutComments";
import { HelpInAccountMenu, LobbyUtilityMenu } from "./LobbyUtilityMenu";
import { ReportBugButton } from "./ReportBugButton";

/** Tailwind v4's default breakpoints, the only ones this product uses. */
const BREAKPOINTS: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280 };

/**
 * Whether an element wearing `classes` is displayed at `width`, read the way
 * Tailwind's mobile-first cascade reads it. Only display tokens are judged; a
 * display token this reader does not know THROWS rather than guessing.
 */
function visibleAt(classes: string, width: number): boolean {
  let shown = true;
  let bestMin = -1;
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    const [prefix, utility] = token.includes(":") ? token.split(":") : ["", token];
    if (!["hidden", "block", "flex", "inline-flex", "contents"].includes(utility)) continue;
    const min = prefix === "" ? 0 : BREAKPOINTS[prefix];
    if (min === undefined) throw new Error(`unknown breakpoint in ${token}`);
    if (width >= min && min >= bestMin) {
      bestMin = min;
      shown = utility !== "hidden";
    }
  }
  return shown;
}

/** The class attribute of the rendered root element. */
function rootClass(html: string): string {
  const match = /^<div class="([^"]*)"/.exec(html);
  expect(match, `the root must be a classed div: ${html.slice(0, 80)}`).not.toBeNull();
  return match![1];
}

/**
 * The classes of every element enclosing the "Report a bug" row in the
 * rendered account menu, outermost first. Visibility is decided by ALL of them,
 * so the breakpoint may sit on any ancestor and the reader still finds it.
 */
function groupChain(html: string): string[] {
  const at = html.indexOf("Report a bug");
  expect(at, "the account menu must render a Report a bug row").toBeGreaterThan(-1);
  const open: string[] = [];
  for (const tag of html.slice(0, at).matchAll(/<div[^>]*>|<\/div>/g)) {
    if (tag[0] === "</div>") open.pop();
    else open.push(/class="([^"]*)"/.exec(tag[0])?.[1] ?? "");
  }
  expect(open.length, "the Report a bug row must sit inside the group").toBeGreaterThan(0);
  return open;
}

const chainVisible = (chain: string[], width: number) => chain.every((c) => visibleAt(c, width));

/**
 * THE CASCADE TRAP (found in this card's own frames). foundation.css is not in
 * a cascade layer and Tailwind's utilities are, so an unlayered rule beats every
 * utility whatever its specificity: an element wearing both `md:hidden` and a
 * `dp-` class whose rule declares `display` is never hidden. The reader above
 * would call it hidden; the browser draws it. So any rendered element that
 * carries a display utility must carry no foundation class that sets display.
 */
const FOUNDATION_CSS = fs
  .readFileSync(path.resolve(__dirname, "../../foundation/foundation.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

function displaySetters(css: string): Set<string> {
  const out = new Set<string>();
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/(^|;|\s)display\s*:/.test(rule[2])) continue;
    for (const cls of rule[1].matchAll(/\.(dp-[\w-]+)/g)) out.add(cls[1]);
  }
  return out;
}

function cascadeTraps(html: string, css: string): string[] {
  const setters = displaySetters(css);
  const traps: string[] = [];
  for (const m of html.matchAll(/class="([^"]*)"/g)) {
    const tokens = m[1].split(/\s+/);
    const hasUtility = tokens.some((t) => /^(?:\w+:)?(?:hidden|block|flex|inline-flex|contents)$/.test(t));
    const clash = tokens.filter((t) => setters.has(t));
    if (hasUtility && clash.length) traps.push(`"${m[1]}": ${clash.join(", ")} overrides the display utility`);
  }
  return traps;
}

const WIDTHS = [320, 360, 390, 420, 640, 767, 768, 1024, 1440];

function audit(topbar: string[], menu: string[]): string[] {
  const problems: string[] = [];
  for (const width of WIDTHS) {
    const shownTopbar = topbar.map((c) => visibleAt(c, width));
    if (shownTopbar.some((s) => s !== shownTopbar[0])) problems.push(`${width}px: the two topbar entrances disagree`);
    const shownMenu = chainVisible(menu, width);
    if (shownTopbar[0] && shownMenu) problems.push(`${width}px: both the topbar icons and the account-menu group`);
    if (!shownTopbar[0] && !shownMenu) problems.push(`${width}px: no way to report a bug or reach help`);
  }
  return problems;
}

const marker = createElement("div", { "data-usercard": "" }, "the account menu");
const renderMenu = () => renderToStaticMarkup(createElement(HelpInAccountMenu, null, marker));

describe("card 2263 — a phone can always report a bug and reach help", () => {
  it("the rendered topbar entrances and the account-menu group cover every width exactly once", () => {
    const topbar = [
      rootClass(renderToStaticMarkup(createElement(ReportBugButton))),
      rootClass(renderToStaticMarkup(createElement(LobbyUtilityMenu))),
    ];
    // Positive control on the reader: the topbar icons really are gone on a phone and there on a desktop.
    expect(topbar.map((c) => visibleAt(c, 390))).toEqual([false, false]);
    expect(topbar.map((c) => visibleAt(c, 1440))).toEqual([true, true]);
    expect(audit(topbar, groupChain(renderMenu()))).toEqual([]);
  });

  it("no rendered element pairs a display utility with a foundation class that sets display", () => {
    const html = [renderToStaticMarkup(createElement(ReportBugButton)), renderToStaticMarkup(createElement(LobbyUtilityMenu)), renderMenu()].join("");
    // Positive control on the reader: it knows .dp-menu sets display.
    expect(displaySetters(FOUNDATION_CSS).has("dp-menu")).toBe(true);
    expect(cascadeTraps(html, FOUNDATION_CSS)).toEqual([]);
    // Negative control: the shape this card first shipped, which drew HELP twice on desktop.
    expect(cascadeTraps('<div class="dp-menu md:hidden"></div>', FOUNDATION_CSS)).toEqual([
      '"dp-menu md:hidden": dp-menu overrides the display utility',
    ]);
  });

  it("the audit fails on a gap, an overlap or an unknown breakpoint (negative controls)", () => {
    const topbar = ["hidden md:block", "hidden md:block"];
    // Before this card: nothing in the account menu at all.
    expect(audit(topbar, ["hidden"])).toContain("390px: no way to report a bug or reach help");
    // A group visible on desktop too doubles the menu.
    expect(audit(topbar, ["block"])).toContain("1440px: both the topbar icons and the account-menu group");
    // The two halves drifting onto different breakpoints opens a band of both.
    expect(audit(topbar, ["lg:hidden", "dp-menu"])).toContain("768px: both the topbar icons and the account-menu group");
    expect(audit(topbar, ["sm:hidden"])).toContain("640px: no way to report a bug or reach help");
    expect(() => visibleAt("md2:hidden", 400)).toThrow(/unknown breakpoint/);
  });

  it("the account-menu group renders after the menu's own rows, with both live entrances", () => {
    const html = renderMenu();
    expect(html.indexOf("data-usercard")).toBeGreaterThan(-1);
    expect(html.indexOf("data-usercard")).toBeLessThan(html.indexOf("HELP"));
    const buttons = [...html.matchAll(/<button[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0].replace(/<[^>]+>/g, ""));
    expect(buttons).toEqual(["Report a bug", "Send feedback"]);
    // Documentation is the same inert stub the desktop help menu draws — not a button.
    expect(html).toMatch(/<span class="dp-menuitem dp-menuitem--stub" aria-disabled="true"[^>]*>[\s\S]*Documentation/);
  });

  it("AppChrome wraps the account menu in it", () => {
    const source = withoutComments(
      fs.readFileSync(path.resolve(__dirname, "../../components/AppChrome.tsx"), "utf8"),
    );
    expect(source).toMatch(/menu:\s*\(\s*<HelpInAccountMenu>\s*<UserCard\b/);
    // Negative control on the matcher: the menu without the wrapper does not match.
    const bare = source.replace(/<HelpInAccountMenu>\s*/, "");
    expect(bare).not.toBe(source);
    expect(bare).not.toMatch(/menu:\s*\(\s*<HelpInAccountMenu>\s*<UserCard\b/);
  });
});
