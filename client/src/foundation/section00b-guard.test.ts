import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { showsMenuCount } from "./menuCount";

/**
 * Section 00b's rules, as assertions rather than as review memory
 * (`docs/specs/Casting-ui-ux-design/drape-redesign/00b-chrome-and-menus.md`).
 *
 * The founder's standing rule for this program is that mechanizable design laws
 * live in the suite, not in a reviewer's head. 00b is almost entirely such laws
 * — a banned font weight, a fixed panel width, a stub that must not be
 * focusable — and every one of them is a one-line edit away from returning,
 * because each of them looks like tidying.
 *
 * These are SOURCE guards, in the shape of `token-guard.test.ts` and
 * `section00-guard.test.ts`, plus one arm that is DRIVEN. The limit is stated
 * rather than implied: a source guard cannot see a cascade and cannot see a
 * render. The things a source read genuinely cannot answer — does the panel
 * actually hold one width when the form opens, is the stub actually skipped by
 * Tab, does either menu look right in both themes — were driven at the running
 * app and recorded in `docs/specs/CHROME_SECTION_00B_EVIDENCE.md`.
 *
 * ⚠ **EVERY ABSENCE ARM BELOW IS PAIRED WITH A POSITIVE CONTROL** — a synthetic
 * string the same matcher must reject. An arm that only asserts absence is
 * green when its subject is deleted, and green when its own regex is wrong;
 * both have happened in this repo inside the last week (working law 2).
 */

const HERE = __dirname;
const CLIENT_SRC = path.resolve(HERE, "..");

const read = (relative: string) => fs.readFileSync(path.resolve(CLIENT_SRC, relative), "utf8");

const USER_CARD = read("components/UserCard.tsx");
const UTILITY_MENU = read("features/lobby/LobbyUtilityMenu.tsx");
const CHROME_STUBS = read("foundation/ChromeStubs.tsx");
const FOUNDATION_CSS = read("foundation/foundation.css");

const CHROME = [
  ["UserCard", USER_CARD],
  ["LobbyUtilityMenu", UTILITY_MENU],
  ["ChromeStubs", CHROME_STUBS],
] as const;

/** The declaration block for one selector, as written. */
function block(css: string, selector: string): string {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, `selector ${selector} is gone — the guard below guards nothing`).toBeGreaterThan(-1);
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

/*
  Comments describe the rules; only the code has to obey them. Stripping block
  and line comments is what keeps a docblock that SAYS "fontWeight: 600 is gone"
  from failing the arm that checks 600 is gone — which it did, first run.
*/
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const WEIGHT_600 = /font-?[wW]eight:\s*600|font-weight:\s*600|font-semibold|font:\s*600\s/;

describe("the banned weight", () => {
  /**
   * The foundation states it about itself in `index.ts`: *"Weights 400 and 500
   * only. 600 exists in both webfonts and is never used — a 600 heading next to
   * a 500 heading reads as a mistake."* The chrome this section replaces held
   * five of them, which was the largest concentration in the app.
   */
  it.each(CHROME)("%s sets no weight above 500", (_name, source) => {
    expect(code(source)).not.toMatch(WEIGHT_600);
  });

  it("rejects each spelling of the violation", () => {
    // Positive control: the four ways this comes back, all of which have
    // appeared in this codebase.
    for (const sabotage of [
      "style={{ fontSize: 13, fontWeight: 600 }}",
      "font-weight: 600;",
      'className="font-semibold"',
      "font: 600 12px var(--font-sans)",
    ]) {
      expect(WEIGHT_600.test(sabotage), `${sabotage} must read as a violation`).toBe(true);
    }
    expect(WEIGHT_600.test("style={{ fontWeight: 500 }}")).toBe(false);
  });
});

describe("the hover lives in one place", () => {
  /**
   * Both components shipped a `<style>` block for the same hover. That is how
   * they drifted: one of the two grew `--errorInk` on its danger row and the
   * other never did, and neither author could see the other's copy. The hover
   * is `.dp-menuitem` in `foundation.css` now, once.
   */
  const INLINE_STYLE_BLOCK = /<style>/;

  it.each([
    ["UserCard", USER_CARD],
    ["LobbyUtilityMenu", UTILITY_MENU],
  ] as const)("%s ships no stylesheet of its own", (_name, source) => {
    expect(code(source)).not.toMatch(INLINE_STYLE_BLOCK);
  });

  it("the shared row declares the hover, and rejects a component that takes it back", () => {
    expect(FOUNDATION_CSS).toMatch(/\.dp-menuitem:hover\s*\{[^}]*background:\s*var\(--well\)/);
    expect(INLINE_STYLE_BLOCK.test("<style>{`.x:hover{background:var(--well)}`}</style>")).toBe(true);
  });
});

describe("a stub names a place and can never be reached", () => {
  /**
   * The founder's own words on #228: *"a stub names a place, never a
   * capability, and never carries an unread dot."* Three properties make that
   * true, and all three are one careless edit from gone.
   *
   * The tag matters more than it looks: a `<span>` is out of the tab order by
   * construction. Make it a `<button disabled>` and it is still announced as a
   * control; make it a `<button>` with an `aria-disabled` and nothing at all
   * stops a keyboard user landing on it and pressing Enter.
   */
  const STUB_MARKUP = /<span[^>]*className="dp-menuitem dp-menuitem--stub"[^>]*aria-disabled="true"/;

  it("the utility menu's inert rows are spans, aria-disabled, and named as unbuilt", () => {
    expect(UTILITY_MENU).toMatch(STUB_MARKUP);
    expect(UTILITY_MENU).toMatch(/title=\{`\$\{label\} — not built yet`\}/);
  });

  it("rejects a stub that became a button", () => {
    const sabotaged = '<button className="dp-menuitem dp-menuitem--stub" aria-disabled="true">';
    expect(STUB_MARKUP.test(sabotaged), "a button stub must not pass as inert").toBe(false);
  });

  /*
    ⚠ **IT WAS TWO AND IT IS THREE — section 02 §1c added the centred search**,
    which is a stub of exactly this family and passes exactly these rules.

    THE COUNT IS DERIVED RATHER THAN TYPED. It used to read `.toBe(2)`, and a
    literal count is a fixture pin: the next stub makes a correct file fail, and
    the tempting repair is to bump the number, which is a repair to the arm
    rather than a reading of the file. What the rule actually says is that EVERY
    inert thing here is `aria-disabled` and EVERY one says why — so the arm is
    that the two populations are the SAME SIZE, and that each named stub is
    present. A stub added without its tooltip, or a tooltip without its
    `aria-disabled`, breaks the equality whatever the total is.
  */
  it("every topbar stub is a span, aria-disabled, and carries the tooltip", () => {
    for (const stub of [
      "Projects — not built yet",
      "What's new — not built yet",
      "Search — not built yet",
    ]) {
      expect(CHROME_STUBS).toContain(stub);
    }
    expect(CHROME_STUBS).not.toMatch(/<button/);
    const inert = CHROME_STUBS.match(/aria-disabled="true"/g)?.length ?? 0;
    const explained = CHROME_STUBS.match(/title="[^"]* — not built yet"/g)?.length ?? 0;
    expect(inert, "a file with no stubs would pass this vacuously").toBeGreaterThan(0);
    expect(inert, "an inert element with no tooltip, or a tooltip with no aria-disabled").toBe(
      explained,
    );
  });

  it("the stub look is muted and has no hover, in the CSS as well as the markup", () => {
    // A stub that lights up under the cursor is a promise. `Rail.tsx` already
    // gets this right; these two selectors are the same rule for menus.
    expect(block(FOUNDATION_CSS, ".dp-menuitem--stub:hover")).toMatch(/background:\s*transparent/);
    expect(block(FOUNDATION_CSS, ".dp-iconbtn--stub:hover")).toMatch(/background:\s*transparent/);
    expect(FOUNDATION_CSS).toMatch(/\.dp-menuitem--stub,\s*\n\.dp-menuitem--stub svg \{\s*color:\s*var\(--muted\)/);
  });
});

describe("no unread dot on anything inert", () => {
  /**
   * The refreshed prototype puts `dot: true` on What's new. We do not: a dot is
   * a claim that there is something to read, and there is nothing there. This
   * is the one place 00b deliberately departs from the design source, so it
   * gets an arm rather than a comment.
   */
  const DOT = /borderRadius:\s*['"]?50%|rounded-full|border-radius:\s*50%/;

  it("the inert chrome draws no dot", () => {
    expect(code(CHROME_STUBS)).not.toMatch(DOT);
  });

  it("rejects a dot added back", () => {
    expect(DOT.test('<span style={{ width: 5, height: 5, borderRadius: "50%" }} />')).toBe(true);
  });
});

describe("the utility panel holds one width", () => {
  /**
   * It was `width: mode ? 300 : 200`, so the panel grew by 100px when you
   * clicked a row inside it. A panel that resizes under your own click reads as
   * a glitch rather than as a transition.
   */
  it("declares a single constant and uses it", () => {
    expect(UTILITY_MENU).toMatch(/const PANEL_WIDTH = 264;/);
    expect(UTILITY_MENU).toMatch(/width: PANEL_WIDTH,/);
  });

  it("carries no width ternary", () => {
    const TERNARY_WIDTH = /width:\s*[a-zA-Z]+\s*\?/;
    expect(TERNARY_WIDTH.test(UTILITY_MENU)).toBe(false);
    expect(TERNARY_WIDTH.test("width: mode ? 300 : 200,"), "the original must read as a violation").toBe(true);
  });
});

describe("the popover is measured, never guessed", () => {
  /**
   * `absolute right-0 top-10` is correct only while no ancestor establishes a
   * containing block. The topbar is a `backdrop-filter` glass bar, which is
   * exactly such an ancestor — see `useAnchoredPanel`'s header for the
   * measurement it makes instead.
   *
   * ⚠ The hook it names changed with #304 and the RULE did not: the three
   * popover implementations collapsed onto one owner, and this menu is one of
   * its consumers. An arm pinned to the old name would have gone red for a
   * rename while a hand-rolled `absolute right-0 top-10` walked past it, which
   * is the wrong way round — so the offset half below is the half that matters.
   */
  it("the utility menu uses the shared panel owner and no magic offset", () => {
    expect(UTILITY_MENU).toMatch(/useAnchoredPanel\(\{ align: 'fromTheRight' \}\)/);
    const MAGIC = /top-10|right-0|absolute top-4|right-5/;
    /* `code()` because this file's own header QUOTES the offsets it replaced —
       an arm that reads its subject's prose is measuring the prose. */
    expect(MAGIC.test(code(UTILITY_MENU))).toBe(false);
    expect(MAGIC.test('className="absolute right-0 top-10 z-50"')).toBe(true);
  });

  it("keeps #73's fix — an ordinary icon button in the row, never a fixed corner", () => {
    // It used to sit in the same 30px square as the shell's theme toggle and
    // made it unclickable. Undoing this while obeying the rest of 00b is the
    // mistake sitting there waiting for the next author.
    expect(UTILITY_MENU).toMatch(/className="dp-iconbtn"/);
    expect(UTILITY_MENU).not.toMatch(/position:\s*['"]absolute|className="[^"]*\bfixed\b/);
  });
});

describe("the count pill omits at zero", () => {
  /**
   * DRIVEN, not read. The two wrong spellings — `count != null` and
   * `count !== undefined` — both render `0`, and a source guard looking for the
   * right spelling is a guard on a spelling. `showsMenuCount` exists so this
   * arm can call it.
   */
  it("shows a real count and omits everything else", () => {
    expect(showsMenuCount(3)).toBe(true);
    expect(showsMenuCount(1)).toBe(true);
    expect(showsMenuCount(0)).toBe(false);
    expect(showsMenuCount(undefined)).toBe(false);
  });

  it("rejects the two spellings that would render (0)", () => {
    // Positive control on the RULE rather than on the code: these model what
    // the tempting one-liners would answer, and both disagree with the rule at
    // zero — which is the only input that matters.
    const nullish = (count?: number) => count != null;
    const defined = (count?: number) => count !== undefined;
    expect(nullish(0)).toBe(true);
    expect(defined(0)).toBe(true);
    expect(showsMenuCount(0)).toBe(false);
  });

  it("is what the account menu actually calls", () => {
    expect(USER_CARD).toMatch(/showsMenuCount\(count\) \? <span className="dp-menucount">/);
  });
});

describe("the staff group is a section rather than an accident", () => {
  it("carries the STAFF label and the mono eyebrow grammar", () => {
    expect(USER_CARD).toMatch(/<span className="dp-menugroup__label">STAFF<\/span>/);
    const label = block(FOUNDATION_CSS, ".dp-menugroup__label");
    expect(label).toMatch(/font:\s*500 8\.5px var\(--font-mono\)/);
    expect(label).toMatch(/letter-spacing:\s*0?\.13em/);
    expect(label).toMatch(/color:\s*var\(--faint\)/);
  });

  it("names a place on both rows", () => {
    // `Moderator` names a person; `Admin` names a place. Both name places now.
    expect(USER_CARD).toMatch(/label="Moderation"/);
    expect(USER_CARD).not.toMatch(/label="Moderator"/);
  });

  it("sets the credit balance in mono", () => {
    // It is a measured number. Measured numbers are mono everywhere else.
    expect(block(FOUNDATION_CSS, ".dp-menu__meta")).toMatch(/font:\s*400 10\.5px var\(--font-mono\)/);
  });
});

describe("spacing and radii come off the scale", () => {
  const TAILWIND_SPACING = /\b(px|py|pt|pb|pl|pr|mt|mb|ml|mr|space-y|space-x)-[0-9]/;
  const TAILWIND_RADIUS = /\brounded-(lg|xl|2xl)\b/;

  it.each([
    ["UserCard", USER_CARD],
    ["LobbyUtilityMenu", UTILITY_MENU],
  ] as const)("%s uses no Tailwind spacing or radius scale", (_name, source) => {
    expect(code(source)).not.toMatch(TAILWIND_SPACING);
    expect(code(source)).not.toMatch(TAILWIND_RADIUS);
  });

  it("rejects the shapes that were there", () => {
    expect(TAILWIND_SPACING.test('className="px-3 py-1.5"')).toBe(true);
    expect(TAILWIND_SPACING.test('className="space-y-1"')).toBe(true);
    expect(TAILWIND_RADIUS.test('className="rounded-xl"')).toBe(true);
    // `rounded-full` on a real avatar is not this rule's business.
    expect(TAILWIND_RADIUS.test('className="rounded-full"')).toBe(false);
  });
});

describe("two icon sizes in the chrome, not four", () => {
  /**
   * It was 3.5, 4, 13 and 15 across the two files — `w-3.5 h-3.5`, `w-4 h-4`,
   * and two numeric sizes. 13px inside a menu row, 15px in a topbar button.
   */
  const SIZES = (source: string) =>
    [...source.matchAll(/size=\{(\d+(?:\.\d+)?)\}/g)].map((m) => Number(m[1]));

  it.each(CHROME)("%s draws glyphs at 13 or 15 only", (_name, source) => {
    const sizes = new Set(SIZES(source));
    expect(sizes.size, "a file with no sized glyph would pass this vacuously").toBeGreaterThan(0);
    for (const size of sizes) {
      // The chevron beside "All projects" is 11px — it is a chevron rather than
      // an icon, and the prototype sets it at 9. Named rather than silently
      // admitted by a looser matcher.
      expect([11, 13, 15], `size ${size} is a third icon size`).toContain(size);
    }
  });

  it("no Tailwind icon sizing survives", () => {
    const TAILWIND_ICON = /\bw-(3\.5|4)\s+h-(3\.5|4)\b/;
    expect(TAILWIND_ICON.test(USER_CARD)).toBe(false);
    expect(TAILWIND_ICON.test(UTILITY_MENU)).toBe(false);
    expect(TAILWIND_ICON.test('<X className="w-3.5 h-3.5" />')).toBe(true);
  });
});

describe("the switcher names a place and the data layer knows nothing about it", () => {
  /**
   * 00b §4's line, stated once: the switcher names a place, so it is a
   * legitimate stub. Per-project filtering is a capability, and a capability is
   * not faked in the UI, in a query signature, or in a count.
   *
   * This arm walks the whole client tree rather than the three files this
   * section touched, because the failure it guards against is somebody
   * threading `projectId` through a query "ready for later" — which by
   * definition happens somewhere else.
   */
  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  it("no client file mentions projectId", () => {
    const files = walk(CLIENT_SRC);
    expect(files.length, "the walk found no files — it would pass vacuously").toBeGreaterThan(200);
    const offenders = files.filter(
      /* Comments may NAME the thing they forbid — `AppLobby` and `ChromeStubs`
         both say in prose that no projectId reaches a query, and an arm that
         reads the prose fails on the promise rather than on the breach. */
      (file) => file !== __filename && /projectId/.test(code(fs.readFileSync(file, "utf8"))),
    );
    expect(offenders.map((f) => path.relative(CLIENT_SRC, f))).toEqual([]);
  });

  it("the switcher's own label is true rather than a placeholder", () => {
    // "All projects" is what the workspace actually holds today. That is the
    // difference between this stub and a promise.
    expect(CHROME_STUBS).toContain("All projects");
  });
});

describe("the queue pill is not faked", () => {
  /**
   * 00b §5 leaves the slot for it and forbids shipping one: it needs a real
   * jobs feed (section 04), and a pill reading "2 running · 40s" over no feed
   * is a lie about what the product is doing right now.
   */
  it("no chrome file draws one", () => {
    for (const [, source] of CHROME) {
      expect(source).not.toMatch(/running ·|queuePill|QueuePill/);
    }
  });
});
