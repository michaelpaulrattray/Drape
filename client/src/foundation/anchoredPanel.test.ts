import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * #304 — THE POPOVER COLLAPSE, as arms rather than as a promise.
 *
 * His ruling, Crew reply #55 (2026-08-30), verbatim and entire: **"Option
 * one"** — one owner of the behaviour, two shapes on it, and his earlier
 * condition on the same work: *"don't leave a second option alive."*
 *
 * That is exactly the kind of ruling that decays quietly. Nothing goes red the
 * day somebody writes a fourth `document.addEventListener("pointerdown")` into
 * a new dropdown; it just works, and a year later there are three again. So the
 * population these arms read is DERIVED from the directory rather than
 * transcribed into a list — a list of the files that may own a dismissal
 * listener would have to be edited by the very change it exists to catch.
 *
 * ⚠ **Every absence arm carries a positive control** — a synthetic string the
 * same matcher must REJECT. An arm that only asserts absence is green when its
 * subject is deleted and green when its own regex is wrong, and both have
 * happened in this repo (working law 2).
 *
 * **Stated limit.** These are SOURCE guards. They cannot see a render, so they
 * cannot tell you where a panel lands or whether two can be open at once. Those
 * two questions were answered by driving the running app before and after the
 * change and comparing each panel's offset from its own trigger —
 * `output/304/placement-before.json` / `-after.json`, and the verdict in the
 * PR. Four menus landed byte-identically; the sentence popover moved the one
 * stated 3.44px; two panels open together became one.
 */

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const CLIENT_SRC = path.resolve(HERE, "..");

function read(relative: string): string {
  return fs.readFileSync(path.join(CLIENT_SRC, relative), "utf8");
}

/** Every source file under a directory, recursively, excluding tests. */
function sourcesUnder(relative: string): string[] {
  const root = path.join(CLIENT_SRC, relative);
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      if (/\.test\.tsx?$/.test(entry.name)) continue;
      found.push(path.relative(root, full).replace(/\\/g, "/"));
    }
  };
  walk(root);
  return found.sort();
}

/** Source with block and line comments removed — a guard must not read prose. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const OWNER = "foundation/useAnchoredPanel.ts";
const CARD_MENU = "foundation/CardMenu.tsx";
const POPOVER = "foundation/Popover.tsx";

/**
 * The one file in `foundation/` allowed its own dismissal listener, and the
 * reason is written into the file itself: the account chip is a FOURTH
 * hand-rolled owner that #304's ruling did not name, so it was put to the
 * founder as #356 rather than decided.
 *
 * ⚠ **He answered — Crew reply #69, 2026-08-31, verbatim and entire: "Leave
 * it."** The exception is therefore PERMANENT rather than pending, and this
 * arm changed with it: it used to prove the question was still open (the file
 * saying `FILED rather than decided`), which would have gone on passing for
 * months after he settled it — a guard asserting a stale state is the #278
 * shape, and it is the reason the assertion below now reads for the ruling.
 */
const ACCOUNT_CHIP = "Topbar.tsx";

describe("one owner of the panel behaviour", () => {
  it("is the only module in foundation/ that dismisses on a document event", () => {
    const DISMISSAL = /document\.addEventListener\(\s*["'](?:pointerdown|mousedown)["']/;
    const owners = sourcesUnder("foundation").filter((file) =>
      DISMISSAL.test(code(read(path.join("foundation", file)))),
    );
    expect(owners.sort()).toEqual(["Topbar.tsx", "useAnchoredPanel.ts"]);
    // The matcher can find one — or this arm passes on a typo'd regex.
    expect(DISMISSAL.test('document.addEventListener("pointerdown", onDown, true);')).toBe(true);
  });

  it("keeps the account chip's exception NAMED, carrying his ruling and not the open question", () => {
    const chip = read(path.join("foundation", ACCOUNT_CHIP));
    /* The card numbers are spliced rather than written out: `#304` and `#356`
       are both valid hex colours, and `token-guard.test.ts` rightly refuses one
       in code. Its own message says to move such a reference into a comment —
       but these are the assertion, so they are split instead. */
    expect(chip).toContain("#" + "304");
    expect(chip).toContain("#" + "356");
    // His words, verbatim, in the file where the question was asked.
    expect(chip).toMatch(/Crew reply #69/);
    expect(chip).toMatch(/"Leave it\."/);
    // And the superseded state must be gone, or both readings sit in one file.
    expect(chip).not.toMatch(/FILED rather than decided/);
    // The matcher can find one — or the negative arm above passes on a typo.
    expect(/FILED rather than decided/.test("so it is FILED rather than decided, and")).toBe(true);
  });

  it("has no `usePopover` left to reach for", () => {
    expect(fs.existsSync(path.join(CLIENT_SRC, "foundation/usePopover.ts"))).toBe(false);
    const declared = sourcesUnder(".").filter((file) =>
      /\b(export\s+function\s+usePopover|from\s+["'][^"']*usePopover["'])/.test(read(file)),
    );
    expect(declared).toEqual([]);
    expect(/\b(export\s+function\s+usePopover)/.test("export function usePopover() {}")).toBe(true);
  });
});

describe("the two shapes sit ON the owner", () => {
  it("both import it and neither measures a trigger itself", () => {
    for (const shape of [CARD_MENU, POPOVER]) {
      const source = read(shape);
      expect(source, `${shape} must use the owner`).toMatch(/useAnchoredPanel/);
      expect(
        code(source).includes("getBoundingClientRect"),
        `${shape} must not do its own placement`,
      ).toBe(false);
    }
    expect(code("const r = node.getBoundingClientRect();").includes("getBoundingClientRect")).toBe(true);
  });

  it("keeps CardMenu's public API — the callers were not asked to change", () => {
    const source = read(CARD_MENU);
    for (const prop of ["label", "items", "open", "onToggle", "onCancel", "align"]) {
      expect(source, `CardMenu lost \`${prop}\``).toMatch(new RegExp(`\\b${prop}[,:?]`));
    }
    /* The alignment names are the OWNER's type, not a second copy of the same
       union — two unions describing one thing drift (working law 4). */
    expect(source).toMatch(/align\?: PanelAlign/);
  });

  it("keeps the sentence a LISTBOX and the menu a MENU", () => {
    expect(read(POPOVER)).toMatch(/role="listbox"/);
    expect(read(CARD_MENU)).toMatch(/role="menu"/);
  });

  it("keeps the listbox's keyboard completeness, which is the founder's condition", () => {
    const source = read(POPOVER);
    expect(source).toMatch(/ArrowDown/);
    expect(source).toMatch(/ArrowUp/);
    expect(source).toMatch(/data-popover-option/);
  });
});

describe("what the owner folded in, and must not quietly lose", () => {
  const owner = read(OWNER);

  it("measures the containing block rather than enumerating the properties that make one", () => {
    expect(owner).toMatch(/function containingBlockOffset/);
    expect(code(owner)).toMatch(/position:fixed;top:0;left:0/);
    expect(code(owner)).toMatch(/offset\.x/);
    expect(code(owner)).toMatch(/offset\.y/);
  });

  it("dismisses on the CAPTURE phase, through a portal", () => {
    expect(code(owner)).toMatch(/composedPath\(\)/);
    expect(code(owner)).toMatch(/addEventListener\("pointerdown", onPointerDown, true\)/);
    expect(code(owner)).toMatch(/POPOVER_MARKER/);
  });

  it("returns focus to the trigger on Escape — the thing casting's menu lacked", () => {
    const escape = code(owner).slice(code(owner).indexOf('event.key !== "Escape"'));
    expect(escape).toMatch(/triggerRef\.current\?\.focus\(\)/);
  });

  it("RE-PLACES on scroll rather than closing, and says which rule it supersedes", () => {
    expect(code(owner)).toMatch(/addEventListener\("scroll", place, true\)/);
    expect(code(owner)).toMatch(/addEventListener\("resize", place\)/);
    expect(owner).toMatch(/supersedes/);
  });

  it("clamps BOTH viewport edges", () => {
    const placement = code(owner);
    expect(placement).toMatch(/Math\.max\(EDGE, window\.innerWidth - EDGE - width\)/);
    expect(placement).toMatch(/Math\.min\(Math\.max\(wanted, EDGE\), rightmost\)/);
  });

  it("holds one panel open at a time — the claim Popover.tsx made for months", () => {
    expect(code(owner)).toMatch(/let openPanel/);
    expect(code(owner)).toMatch(/previous\.close\(\)/);
  });

  it("hides the panel until it has been measured", () => {
    expect(code(owner)).toMatch(/visibility: coords \? "visible" : "hidden"/);
  });

  /**
   * The hidden frame above is what makes `placed` necessary, and the two must
   * arrive together: a shape that focuses into its panel on `open` alone runs
   * during the hidden commit, and `focus()` on a `visibility: hidden` element
   * does nothing and says nothing. That is a real regression this change made
   * and driving caught — no source arm existed that could have.
   */
  it("publishes `placed`, and the listbox waits for it before moving focus", () => {
    expect(code(owner)).toMatch(/placed: coords !== null/);
    const focusEffect = code(read(POPOVER));
    expect(focusEffect).toMatch(/if \(!open \|\| !placed\) return;/);
    expect(focusEffect).toMatch(/\[open, placed, panelRef\]/);
  });
});

describe("the four consumers", () => {
  /**
   * DERIVED: whoever imports the owner is a consumer, so a fifth surface
   * adopting it needs no edit here, and a surface QUIETLY LEAVING it shows up
   * as a shrinking list rather than as nothing at all.
   */
  it("are exactly the two shapes and the two lobby panels", () => {
    /* The barrel re-exports the owner and consumes nothing; counting it would
       make this arm say "five" while meaning four. */
    const NOT_A_CONSUMER = ["foundation/useAnchoredPanel.ts", "foundation/index.ts"];
    const consumers = sourcesUnder(".").filter(
      (file) => !NOT_A_CONSUMER.includes(file) && /useAnchoredPanel/.test(code(read(file))),
    );
    expect(consumers.sort()).toEqual([
      "features/lobby/LobbyUtilityMenu.tsx",
      "features/lobby/ReportBugButton.tsx",
      "foundation/CardMenu.tsx",
      "foundation/Popover.tsx",
    ]);
  });

  it("the sentence panel's placement left the stylesheet with the owner", () => {
    const css = read("foundation/foundation.css");
    const rule = css.slice(css.indexOf(".dp-pop__panel {"), css.indexOf(".dp-pop__heading"));
    expect(rule).not.toMatch(/position:\s*absolute/);
    expect(rule).not.toMatch(/top:\s*calc\(100% \+ 9px\)/);
    // The width and the stacking are still the shape's business.
    expect(rule).toMatch(/z-index: 40/);
    expect(rule).toMatch(/width: 216px/);
    expect(/position:\s*absolute/.test("  position: absolute;")).toBe(true);
  });

  it("the two numbers that rule carried are in the shape, not invented anew", () => {
    const source = read(POPOVER);
    expect(source).toMatch(/const GAP = 9;/);
    expect(source).toMatch(/const NUDGE_X = -12;/);
  });
});

/**
 * THE QUIETER FOCUS MARK — his ruling, Crew reply #73 (2026-09-01): **"The
 * quieter mark"**, on his own earlier note: *"Listbox shape is correct just
 * not the accent outline color, check casting studio v2 for how it works,
 * thats how it should work. also menu shape is correct."*
 *
 * The measurement that shaped the answer is worth keeping, because the obvious
 * fix was the wrong one: there is no second COLOUR in casting V2 to copy
 * across. `tokens.css` paints ONE accent ring on every focusable thing in the
 * product, and casting V2's word-picker IS this component. What casting V2 has
 * is a RULE for this shape — *"the border carries focus — no inner ring on a
 * row"* — and these arms hold that rule where it could not previously be seen.
 *
 * ⚠ **AND WHEN IT WAS DRIVEN, CASTING V2 WAS NOT DOING WHAT ITS OWN COMMENT
 * SAID.** Three of its rows reset the outline at (0,2,0) — the same weight as
 * the blanket `.dp-root :focus-visible` — and lost the tie on order, so the
 * accent ring AND the quiet ring both painted. The rows he pointed at as the
 * reference had never rendered the thing they describe. Measured two
 * independent ways before it was believed (computed style with a bare probe as
 * the negative control; the order of the injected stylesheets), and fixed in
 * the same commit — which is why the arms below are about SPECIFICITY and not
 * about colour. A colour arm would have passed on the broken tree.
 *
 * ⚠ **The card menu is the exception and it runs the OTHER way.** `CardMenu`
 * portals its panel to `document.body`, so the blanket rule has never reached
 * it and the `.dp-root ` prefix the others NEED would make its rule match
 * nothing — written that way first, it fell back to the browser's default
 * ring. So the arm holds it BARE, deliberately, and says why.
 *
 * ⚠ **STATED LIMIT, not a defect found and hidden.** `outline: none` plus a
 * `box-shadow` is invisible in forced-colors / high-contrast mode, where an
 * `outline` would survive. That is true of casting V2's rows as well — this
 * change makes the foundation match his existing convention, it does not make
 * that convention better. Widening it is a decision about the whole app's
 * focus grammar, so it is his, and it is not smuggled in here.
 */
describe("a panel row wears the quieter focus mark, not the accent ring", () => {
  /** `--ink` on a surface, `--onScrim` on a scrim; the 1px and the 52% are the rule. */
  const CONVENTION =
    /outline:\s*none;[^}]*box-shadow:\s*0 0 0 1px color-mix\(in srgb, var\(--(?:ink|onScrim)\) 52%, transparent\);/;

  /** Every stylesheet a `.dp-root` descendant can be styled by. */
  const STYLESHEETS = [
    "foundation/foundation.css",
    "foundation/modals.css",
    "foundation/tokens.css",
    "features/castingV2/castingV2.css",
  ];

  /** Comments are stripped: a guard must never read the prose describing the bug. */
  const css = (relative: string) => read(relative).replace(/\/\*[\s\S]*?\*\//g, "");

  const ruleBody = (text: string, selector: string): string => {
    const at = text.indexOf(`${selector} {`);
    return at === -1 ? "" : text.slice(at, text.indexOf("}", at) + 1);
  };

  /**
   * DERIVED, and this is the arm that matters. The population is every rule in
   * the app's stylesheets that RESETS the focus outline — found by reading, not
   * by listing — so a row written next month is judged the day it lands.
   */
  const outlineResets = () => {
    const found: Array<{ file: string; selector: string }> = [];
    for (const file of STYLESHEETS) {
      for (const match of css(file).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!/outline:\s*none/.test(match[2])) continue;
        for (const selector of match[1].split(",").map((s) => s.trim())) {
          if (selector.includes(":focus-visible")) found.push({ file, selector });
        }
      }
    }
    return found;
  };

  it("reads a real population — the sweep cannot pass by finding nothing", () => {
    expect(outlineResets().length).toBeGreaterThanOrEqual(8);
  });

  it("every focus reset inside .dp-root out-specifies the blanket accent ring", () => {
    /*
      The blanket is `.dp-root :focus-visible` — one class, one pseudo-class,
      (0,2,0). A reset that only ties with it wins or loses on stylesheet order,
      which is not a thing anybody can see while writing CSS: the outline comes
      from one rule and the box-shadow from the other, and BOTH marks draw.

      `.dpc-cardmenu__` is carved out because its panel is portalled OUT of
      `.dp-root` — the blanket cannot reach it, and the prefix would break it.
      The carve-out is proven honest by the arm below rather than trusted.
    */
    const weak = outlineResets().filter(({ selector }) => {
      if (selector.includes(".dpc-cardmenu__")) return false;
      const classes = (selector.match(/\.[\w-]+/g) ?? []).length;
      const pseudo = (selector.match(/:(?!:)[\w-]+/g) ?? []).length;
      const elements = (selector.match(/(?:^|[\s>+~])([a-z][\w-]*)/g) ?? []).length;
      return classes + pseudo + elements <= 2;
    });
    expect(weak.map((w) => `${w.file} → ${w.selector}`), "these tie with the blanket and lose").toEqual([]);
  });

  it("the portalled menu row stays BARE, because the prefix would match nothing", () => {
    /*
      `CardMenu` renders its panel through `createPortal` to `document.body`.
      Adding `.dp-root ` here is the tempting "consistency" fix and it silently
      turns the rule off — driven, not reasoned: the row fell back to the
      browser's own default ring.
    */
    expect(code(read(CARD_MENU))).toMatch(/createPortal\(/);
    const body = ruleBody(css("foundation/modals.css"), ".dpc-cardmenu__item:focus-visible");
    expect(body, "the bare rule is gone from modals.css").not.toBe("");
    expect(body.replace(/\s+/g, " ")).toMatch(CONVENTION);
    expect(css("foundation/modals.css")).not.toMatch(/\.dp-root \.dpc-cardmenu__item:focus-visible/);
  });

  it("the listbox row and casting V2's own rows all carry the one convention", () => {
    const rows: Array<[string, string]> = [
      ["foundation/foundation.css", ".dp-root .dp-pop__option:focus-visible"],
      ["features/castingV2/castingV2.css", ".dp-root .dpc-kept__row:focus-visible"],
      ["features/castingV2/castingV2.css", ".dp-root .dpc-face__row:focus-visible"],
    ];
    for (const [file, selector] of rows) {
      const body = ruleBody(css(file), selector);
      expect(body, `${selector} is gone from ${file}`).not.toBe("");
      expect(body.replace(/\s+/g, " "), selector).toMatch(CONVENTION);
    }
  });

  it("keeps a focus mark in the product — quieter, never absent", () => {
    /*
      The negative control on the whole change. "The quieter mark" was one of
      three answers he was given and the other two both end with no ring at all,
      so deleting the blanket would look like this change succeeding.
    */
    expect(css("foundation/tokens.css")).toMatch(
      /\.dp-root :focus-visible\s*\{[^}]*outline:\s*2px solid var\(--accentSolid\)/,
    );
  });
});
