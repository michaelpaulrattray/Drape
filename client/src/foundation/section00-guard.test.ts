import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { severityLook } from "./severity";

/**
 * Section 00's rules, as assertions rather than as comments
 * (`docs/specs/Casting-ui-ux-design/drape-redesign/00-foundation-topup.md`).
 *
 * Four of the nine components exist because a specific bug happened, and each
 * of those bugs is a one-line CSS edit away from returning. The founder's own
 * standing rule for this program is that mechanizable design laws live as
 * assertions in the suite rather than as review memory, so they live here.
 *
 * These are SOURCE guards, in the shape of `token-guard.test.ts`: they read the
 * stylesheet rather than a browser. That is a deliberate limit — a source guard
 * cannot see a cascade — and it is the right level for these four, because each
 * one is a property of a single declaration block that someone would delete
 * while tidying. The browser measurements that a source read genuinely cannot
 * make (the marquee's stride against its own track width, the surface bar at
 * 924px, the speaker column against the real string) were driven at the running
 * app and recorded in `docs/specs/FOUNDATION_SECTION_00_EVIDENCE.md`.
 *
 * Every arm below is paired with a POSITIVE CONTROL — a synthetic block that
 * the same matcher must reject — because an arm that only ever asserts absence
 * is green when its subject is gone (working law 2).
 */

const FOUNDATION_CSS = fs.readFileSync(
  path.resolve(__dirname, "foundation.css"),
  "utf8",
);
const TOKENS_CSS = fs.readFileSync(path.resolve(__dirname, "tokens.css"), "utf8");

/** The declaration block for one selector, as written. */
function block(css: string, selector: string): string {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, `selector ${selector} is gone — the guard below guards nothing`).toBeGreaterThan(-1);
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("the marquee track carries no gap and no padding", () => {
  /**
   * `translateX(-50%)` must equal exactly one copy's stride. `gap` applies
   * BETWEEN items only, so a gapped track is one gap short of two full copies
   * and jumps visibly on every loop. Items space themselves with
   * `margin-right`, which every item gets — including the last.
   *
   * Measured at the running app: track 2232px, one copy's stride 2232/2 =
   * 1116.00px. The two are equal to two decimal places, which is the property
   * this arm protects.
   */
  const track = block(FOUNDATION_CSS, ".dp-marquee__track");

  it("declares gap and padding as zero rather than omitting them", () => {
    // Stated rather than absent: an omitted property is indistinguishable from
    // one nobody thought about, and the next author adds `gap: 14px` to tidy.
    /* Anchored on the SEMICOLON rather than on a word boundary: `padding: 0 18px`
       begins with a zero, and `\b` cheerfully read that as "no padding". Caught
       by this arm's own positive control below, which is why it is there. */
    expect(track).toMatch(/gap:\s*0\s*;/);
    expect(track).toMatch(/padding:\s*0\s*;/);
  });

  it("rejects a track that reintroduces either", () => {
    const sabotaged = "  display: flex;\n  gap: 14px;\n  padding: 0 18px;\n";
    expect(/gap:\s*0\s*;/.test(sabotaged), "a non-zero gap must not read as zero").toBe(false);
    expect(/padding:\s*0\s*;/.test(sabotaged), "an inset must not read as zero").toBe(false);
  });

  it("animates the keyframe that shifts by exactly half the track", () => {
    expect(track).toContain("dp-marquee");
    /* Matched on one line: `[^}]*` cannot cross the nested `from { … }` block. */
    expect(TOKENS_CSS).toMatch(/@keyframes dp-marquee.*translateX\(-50%\)/);
  });
});

/*
  ⚠ **THE TRANSCRIPT ARMS WERE HERE AND THEIR SUBJECT IS DELETED (#399, brief 09
  §9).** `Transcript` was one of three section-00 components that reached the end
  of the staff lane with ZERO consumers — its own docblock said *"Crew today"*,
  Crew shipped without it, and #410 measured that a two-speaker record does not
  fit a one-speaker page. His standing agreement: *"Anything still at zero after
  five staff briefs and Settings should be deleted rather than carried."*

  The arms are removed rather than left pointing at nothing, and the way they
  died is worth keeping: `block()` REFUSED — *"selector .dp-transcript__who is
  gone — the guard below guards nothing"* — instead of matching an empty string
  and passing. A guard that reports its own subject's disappearance is the
  difference between a deletion being noticed and a suite going quietly green
  over four fewer rules.

  The 80px measurement itself is recorded in `PROMOTION_PASS_SECTION_09.md`, so
  a future transcript does not have to rediscover that "night shift" needs
  69.3px at the 10.5px mono floor.
*/

describe("the surface bar wraps and never scrolls sideways", () => {
  /**
   * Four overflow bugs in the prototype came from this row; the last put the
   * primary action fully off-screen at 924px. Driven at 924px and 700px: no
   * clipped child, `scrollWidth === clientWidth`, primary action fully on
   * screen, and the bar wraps to two rows at 700px.
   */
  const bar = block(FOUNDATION_CSS, ".dp-surfacebar");

  it("wraps, and the spacer gives way rather than the title", () => {
    expect(bar).toMatch(/flex-wrap:\s*wrap/);
    expect(bar).not.toMatch(/overflow-x/);
    expect(block(FOUNDATION_CSS, ".dp-surfacebar__spacer")).toMatch(/flex:\s*1 1 0/);
    expect(block(FOUNDATION_CSS, ".dp-surfacebar__title")).toMatch(/min-width:\s*0/);
  });

  it("rejects the horizontal scroll that hides a header's controls", () => {
    const sabotaged = "  display: flex;\n  flex-wrap: nowrap;\n  overflow-x: auto;\n";
    expect(/flex-wrap:\s*wrap/.test(sabotaged)).toBe(false);
    expect(/overflow-x/.test(sabotaged)).toBe(true);
  });
});

describe("the hover reveal is driven by the card, not by the action row", () => {
  /**
   * The prototype put `:hover` on the row itself, so the buttons appeared only
   * once the cursor was already inside the strip they live in. `HoverActions`
   * is inert without this rule, so its absence is a silent failure — the
   * buttons simply never appear.
   */
  it("keys the reveal on the host's hover", () => {
    expect(FOUNDATION_CSS).toMatch(/\[data-hoverhost\]:hover \[data-hoverfade\]/);
    expect(FOUNDATION_CSS).toMatch(/\[data-hoverhost\] \[data-hoverfade\][^}]*opacity:\s*0/);
  });

  it("rejects the row-hover shape the component exists to prevent", () => {
    const sabotaged = "[data-hoverfade]:hover { opacity: 1; }";
    expect(/\[data-hoverhost\]:hover \[data-hoverfade\]/.test(sabotaged)).toBe(false);
  });
});

describe("severity is greyscale plus the one red", () => {
  /**
   * Seven Tailwind tints across the two staff surfaces — blue, amber, red,
   * emerald, purple, orange, red — collapse to three looks. `--error` is the
   * only colour beside the accent, and only for genuinely urgent state.
   */
  it("returns tokens, never a tint class", () => {
    for (const severity of ["info", "warning", "critical"] as const) {
      const look = severityLook(severity);
      for (const value of Object.values(look)) {
        if (typeof value !== "string" || value === "transparent") continue;
        expect(value, `${severity}: every colour resolves through a token`).toMatch(/var\(--/);
        expect(value, `${severity}: no Tailwind tint`).not.toMatch(/\b(bg|text|border)-[a-z]+-\d{2,3}\b/);
      }
    }
  });

  it("spends the one red on `critical` and on nothing else", () => {
    expect(JSON.stringify(severityLook("critical"))).toMatch(/--error/);
    expect(JSON.stringify(severityLook("warning"))).not.toMatch(/--error/);
    expect(JSON.stringify(severityLook("info"))).not.toMatch(/--error/);
  });

  it("rejects a tint class, which is what this replaces", () => {
    const sabotaged = "bg-amber-50 text-amber-700 border-amber-200";
    expect(/var\(--/.test(sabotaged)).toBe(false);
    expect(/\b(bg|text|border)-[a-z]+-\d{2,3}\b/.test(sabotaged)).toBe(true);
  });
});

describe("the media card's label row sits below the media", () => {
  /**
   * A filled slot's caption centres in the card, which on a short 4:3 is
   * exactly where a bottom overlay's text lands. They collided in the
   * prototype, so the rule is absolute: the row is a sibling AFTER the well,
   * in normal flow, never positioned over it.
   */
  const row = block(FOUNDATION_CSS, ".dp-mediacard__row");

  it("is in normal flow", () => {
    expect(row).not.toMatch(/position:\s*absolute/);
    expect(row).not.toMatch(/position:\s*fixed/);
  });

  it("rejects a row lifted onto the media", () => {
    const sabotaged = "  position: absolute;\n  bottom: 8px;\n";
    expect(/position:\s*absolute/.test(sabotaged)).toBe(true);
  });
});

/*
  THE FOUNDER'S THREE CORRECTIONS AT THE SECTION 00 FRAMES (2026-08-30, Crew
  reply #45). All three are the same rule underneath, in his words: "accent
  means state, and one state gets one signal." Pinned here because every one of
  them is the kind of thing a later tidy-up puts back while making a page look
  more "consistent".
*/
describe("one state, one signal — his three corrections", () => {
  const SPECIMEN = fs.readFileSync(
    path.resolve(__dirname, "../pages/AdminFoundation.tsx"),
    "utf8",
  );
  const PRIMITIVES = fs.readFileSync(path.resolve(__dirname, "primitives.tsx"), "utf8");

  /** Comments quote the rule; matching on them would pass on the promise. */
  const code = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  it("§04's media example wears two signals, not four", () => {
    const specimen = code(SPECIMEN);
    const four = specimen.slice(specimen.indexOf("04 · Cards"), specimen.indexOf("05 · Media cards"));

    expect(four, "the arm is reading nothing").toContain("MediaFrame");
    expect(four, "no coral border: `selected` was the fourth signal").not.toMatch(/^\s*selected\s*$/m);
    expect(four, "no check badge beside a SIGNED pill and a kept bar").not.toContain("<Check");

    /* POSITIVE CONTROL — both matchers fire on the shape that shipped. */
    expect(/^\s*selected\s*$/m.test("            <MediaFrame\n              selected\n")).toBe(true);
    expect("<Check size={10} />").toContain("<Check");
  });

  it("a TYPE is never accent; a STATE still is", () => {
    const specimen = code(SPECIMEN);
    const pills = specimen.slice(specimen.indexOf("03 · Chips"), specimen.indexOf("04 · Cards"));

    expect(pills, "the arm is reading nothing").toContain("Mascot");
    expect(
      pills.slice(pills.indexOf("Mascot") - 60, pills.indexOf("Performer")),
      "MASCOT is what a cast member IS, not a state — colour may not encode a category",
    ).not.toContain('tone="accent"');
    expect(
      pills.slice(pills.indexOf("Identity locked") - 200),
      "IDENTITY LOCKED keeps the accent — locked is exactly what accent is for",
    ).toContain('tone="accent"');
  });

  it("the create tile says the action; only a gap says NEEDED", () => {
    const primitives = code(PRIMITIVES);

    expect(primitives).toContain('"default" | "kept" | "pending" | "gap" | "create"');
    /* The word is rendered under a `state === "gap"` test rather than for the
       whole dashed shape — his correction of his own brief. */
    expect(primitives).toMatch(/state === "gap" \? <span className="dp-mediacard__needed">NEEDED<\/span> : null/);

    /* POSITIVE CONTROL — the unconditional shape that shipped would not match. */
    expect(
      /state === "gap" \? <span className="dp-mediacard__needed">NEEDED<\/span> : null/.test(
        '<span className="dp-mediacard__needed">NEEDED</span>',
      ),
    ).toBe(false);
  });
});
