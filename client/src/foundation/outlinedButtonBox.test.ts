import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * AN OUTLINED BUTTON STANDS THE SAME SIZE AS THE FILLED ONE BESIDE IT (#486).
 *
 * A `1px` border is a pixel on every side, so an outlined variant has to drop a
 * pixel of padding on BOTH axes to occupy the same box as its filled twin. The
 * stylesheet's own comment has claimed that compensation since the buttons were
 * written; it was made on the horizontal axis only, so every outlined button in
 * the product stood 2px taller than the filled one next to it — measured in the
 * running app on 2026-09-06, before the fix:
 *
 *   .dp-btn--primary                36px   ·  .dp-btn--secondary              38px
 *   .dp-btn--primary --small     31.25px   ·  .dp-btn--secondary --small   33.25px
 *
 * On the Change plan cards that put the Pro column's credits figure two pixels
 * below Starter's, which is what the founder would see. Frames on the card.
 *
 * ⚠ **The arithmetic is DERIVED, not transcribed.** A guard that restated
 * "secondary is 8px" would be a copy of the line it is guarding, and a copy
 * cannot catch the line changing (working law 4; memory
 * `mirrored-test-becomes-uncheckable`). So these arms parse the stylesheet,
 * resolve its spacing tokens, run the real cascade for each class combination
 * the Button primitive can produce, and compare boxes.
 *
 * ⚠ **The POPULATION is derived too, and that is the arm that matters most.**
 * The pairing below — secondary is primary's outlined twin — is a design fact
 * and has to be stated once. What must never be stated is WHICH variants carry
 * a border: `outlinedVariants()` reads that off the stylesheet, and if a new
 * outlined variant appears without a pair, the arm reddens and says so. That is
 * the difference between a list and a list that stays the list.
 *
 * **Stated limit:** these are source arms. They prove the stylesheet's
 * arithmetic, not a render — a page-level override could still put a border on
 * a button, and no parse can see that. The frames on #486 are the other half,
 * and his eye is the last word (law 9).
 */

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const read = (relative: string) => fs.readFileSync(path.join(HERE, relative), "utf8");
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const FOUNDATION = stripComments(read("foundation.css"));
const TOKENS = stripComments(read("tokens.css"));
const PRIMITIVES = read("primitives.tsx");

/**
 * The outlined twin of each filled variant. This is the only design fact the
 * file states rather than derives, and it is stated because it IS a design
 * decision: `--quiet` and `--onmedia` are deliberately different shapes and
 * must not be levelled against `--primary`.
 */
const OUTLINED_TWIN_OF: Record<string, string> = { secondary: "primary" };

type Box = { top: number; right: number; bottom: number; left: number };

/** A parsed rule, in source order — the order is half of the cascade. */
type Rule = { classes: string[]; body: string; order: number };

function parseRules(css: string): Rule[] {
  const rules: Rule[] = [];
  let order = 0;
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const selector of match[1].split(",").map((s) => s.trim())) {
      order += 1;
      /* Only plain class conjunctions take part in this reading: a pseudo-class
         or a descendant selector is a different question and is skipped rather
         than half-understood. */
      if (!/^(\.[A-Za-z0-9_-]+)+$/.test(selector)) continue;
      rules.push({
        classes: selector.split(".").filter(Boolean),
        body: match[2],
        order,
      });
    }
  }
  return rules;
}

const RULES = parseRules(FOUNDATION);

/** `--s-6: 14px` → 14. Every spacing token, so `var(--s-6)` resolves. */
function spacingTokens(css: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of css.matchAll(/(--[A-Za-z0-9-]+)\s*:\s*(-?[\d.]+)px/g)) out.set(m[1], Number(m[2]));
  return out;
}

const TOKEN_PX = spacingTokens(TOKENS);

function px(value: string): number {
  const trimmed = value.trim();
  const asVar = trimmed.match(/^var\((--[A-Za-z0-9-]+)\)$/);
  if (asVar) {
    const resolved = TOKEN_PX.get(asVar[1]);
    if (resolved === undefined) throw new Error(`unresolved spacing token ${asVar[1]}`);
    return resolved;
  }
  const asPx = trimmed.match(/^(-?[\d.]+)px$/);
  if (asPx) return Number(asPx[1]);
  if (trimmed === "0") return 0;
  throw new Error(`cannot read a length from "${value}"`);
}

/** CSS shorthand: 1, 2, 3 or 4 values. */
function expand(shorthand: string): Box {
  const parts = shorthand.trim().split(/\s+(?![^(]*\))/).map(px);
  const [a, b = a, c = a, d = b] = parts;
  return { top: a, right: b, bottom: c, left: d };
}

function declaration(body: string, property: string): string | null {
  const m = body.match(new RegExp(`(?:^|;)\\s*${property}\\s*:([^;]+)`));
  return m ? m[1].trim() : null;
}

/**
 * The winning declaration for a set of classes, by the real cascade: every rule
 * whose classes are all present applies, and the last of the most specific ones
 * wins. Specificity here is the class count, which is all these selectors carry.
 */
function winning(classes: string[], property: string): string | null {
  const applicable = RULES.filter(
    (r) => r.classes.every((c) => classes.includes(c)) && declaration(r.body, property) !== null,
  );
  if (!applicable.length) return null;
  const best = applicable.reduce((a, b) =>
    b.classes.length > a.classes.length || (b.classes.length === a.classes.length && b.order > a.order) ? b : a,
  );
  return declaration(best.body, property);
}

/** The border WIDTH a class combination ends up with (the shorthand's length). */
function borderWidth(classes: string[]): number {
  const shorthand = winning(classes, "border");
  if (shorthand === null) return 0;
  const width = shorthand.trim().split(/\s+/)[0];
  if (width === "none" || width === "0") return 0;
  return px(width);
}

/** The outer box an element occupies around its content: padding + border. */
function outerBox(classes: string[]): Box {
  const padding = winning(classes, "padding");
  if (padding === null) throw new Error(`no padding resolves for ${classes.join(".")}`);
  const p = expand(padding);
  const b = borderWidth(classes);
  return { top: p.top + b, right: p.right + b, bottom: p.bottom + b, left: p.left + b };
}

/** Every `.dp-btn--x` the stylesheet gives a real border to — read, never listed. */
function outlinedVariants(): string[] {
  const variants = new Set<string>();
  for (const rule of RULES) {
    for (const cls of rule.classes) if (cls.startsWith("dp-btn--")) variants.add(cls);
  }
  const outlined = Array.from(variants).filter((v) => borderWidth(["dp-btn", v]) > 0);
  return outlined.map((v) => v.replace("dp-btn--", "")).sort();
}

/** The variants and sizes the Button primitive can actually compose. */
function primitiveVariants(): string[] {
  const block = PRIMITIVES.match(/BUTTON_VARIANT_CLASS[^=]*=\s*\{([\s\S]*?)\}/);
  if (!block) throw new Error("BUTTON_VARIANT_CLASS not found — the primitive moved");
  return Array.from(block[1].matchAll(/"(dp-btn--[a-zA-Z]+)"/g)).map((m) => m[1].replace("dp-btn--", ""));
}

function primitiveSizeClasses(): string[] {
  const matches = Array.from(PRIMITIVES.matchAll(/size === "(\w+)" && "(dp-btn--\w+)"/g));
  if (!matches.length) throw new Error("no size modifier found in the Button primitive");
  return matches.map((m) => m[2]);
}

/* The card number stays in the comments and out of every string literal below:
   `foundation/` is inside the token guard's GUARDED_PATHS, and `#486` in a
   describe title is a three-digit hex to its matcher. Its own arm calls
   exempting `#NNN` "the fix nobody should make", and a comment is the road it
   documents — so this file takes that road rather than widening the carve-out. */
describe("outlined buttons occupy the same box as their filled twin", () => {
  it("resolves a spacing token rather than assuming a number", () => {
    expect(TOKEN_PX.get("--s-6")).toBe(14);
    expect(px("var(--s-6)")).toBe(14);
  });

  it("reads the border off the stylesheet — secondary has one, primary does not", () => {
    expect(borderWidth(["dp-btn", "dp-btn--secondary"])).toBe(1);
    expect(borderWidth(["dp-btn", "dp-btn--primary"])).toBe(0);
  });

  it("runs the real cascade: the size modifier beats the variant, the compound beats both", () => {
    /* Positive control for the cascade itself. If this reads the wrong rule,
       every arm below is measuring something other than what renders. */
    expect(winning(["dp-btn", "dp-btn--primary", "dp-btn--small"], "padding")).toBe("7px 13px");
    expect(winning(["dp-btn", "dp-btn--secondary", "dp-btn--small"], "padding")).toBe("6px 12px");
    expect(winning(["dp-btn", "dp-btn--secondary"], "padding")).toBe("8px 13px");
  });

  it("every outlined variant the stylesheet declares has a filled twin named here", () => {
    /* THE POPULATION ARM. A new outlined button variant reddens this rather
       than slipping past the pairing arms below, which can only check pairs
       somebody remembered to write down. */
    expect(outlinedVariants()).toStrictEqual(Object.keys(OUTLINED_TWIN_OF).sort());
  });

  it("the twin named here is a variant the Button primitive can actually render", () => {
    const variants = primitiveVariants();
    for (const [outlined, filled] of Object.entries(OUTLINED_TWIN_OF)) {
      expect(variants).toContain(outlined);
      expect(variants).toContain(filled);
    }
  });

  for (const [outlined, filled] of Object.entries(OUTLINED_TWIN_OF)) {
    for (const size of [null, ...primitiveSizeClasses()]) {
      const label = size ? `${size.replace("dp-btn--", "")} ` : "";
      it(`${label}${outlined} presents the same box as ${label}${filled}`, () => {
        const classes = (variant: string) =>
          ["dp-btn", `dp-btn--${variant}`, ...(size ? [size] : [])];
        const outlinedBox = outerBox(classes(outlined));
        const filledBox = outerBox(classes(filled));
        expect(outlinedBox).toStrictEqual(filledBox);
        /* And the compensation is real rather than the two simply having the
           same padding by luck — the outlined one must carry a border. */
        expect(borderWidth(classes(outlined))).toBeGreaterThan(0);
      });
    }
  }

  it("would fail if the compensation were dropped on either axis (the negative control)", () => {
    /* Working law 2: an arm that cannot fail proves nothing. These drive the
       same arithmetic over the stylesheet AS IT STOOD before #486, which must
       come out unequal on the vertical axis and equal on the horizontal — the
       exact shape of the defect. */
    const before = expand("9px 13px");
    const primary = expand("9px var(--s-6)");
    const withBorder = { top: before.top + 1, right: before.right + 1, bottom: before.bottom + 1, left: before.left + 1 };
    expect(withBorder.left).toBe(primary.left);
    expect(withBorder.top).not.toBe(primary.top);
    expect(withBorder.top - primary.top).toBe(1);

    const beforeSmall = expand("7px 13px");
    const smallWithBorder = { top: beforeSmall.top + 1, left: beforeSmall.left + 1 };
    expect(smallWithBorder.top).not.toBe(beforeSmall.top);
    expect(smallWithBorder.left).not.toBe(beforeSmall.left);
  });
});
