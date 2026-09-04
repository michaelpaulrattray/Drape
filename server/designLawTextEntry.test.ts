import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CONTROL_INPUT_TYPES, TEXT_ENTRY_SELECTOR } from "../scripts/lib/designLaws.mts";

/**
 * THE DESIGN-LAW DRIVE AND THE STYLESHEET AGREE ON WHAT A TEXT FIELD IS.
 *
 * Design law 1 says no text field wears a focus ring around its own text. Which
 * controls that covers is decided by `client/src/foundation/tokens.css`, whose
 * carve-out excludes nine CONTROL input types from the blanket ring and treats
 * everything else as text entry. The drive has to look at the same population,
 * and until #512 it did not: it carried its own allow-list
 * (`input[type=text], input:not([type]), textarea, .dp-input`), and every staff
 * search box in the product is `<input type="search">`.
 *
 * Measured against the running app before this guard existed: `/admin/users`
 * — the exact control the founder raised #445 over, verbatim *"whenever i click
 * into a text box for some reason by default it wants to add a red border?"* —
 * reported "no text fields on this surface" and passed. The law was extended to
 * the staff pages and STILL could not see the box it was extended for.
 *
 * A second list shadowing a source of truth always drifts from it (working law
 * 4), so this does not keep one: it parses the rule out of the stylesheet and
 * compares. Add a type to the stylesheet's carve-out and this reddens until the
 * drive follows.
 *
 * Every absence arm here carries a positive control (working law 2) — a fixture
 * in which the assertion MUST fail — because a parser that quietly matches
 * nothing would let both sides agree on the empty set forever.
 */

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const TOKENS = path.resolve(HERE, "..", "client", "src", "foundation", "tokens.css");

/**
 * The control types the stylesheet excludes from its text-entry carve-out.
 *
 * The rule is the one selector that resets `outline` on a `textarea` and an
 * `input` together; its `:not([type="..."])` chain is the definition.
 */
function excludedTypesInStylesheet(css: string): string[] {
  /*
    COMMENTS FIRST, and the positive control below is what found this.

    `tokens.css` documents the carve-out in a long comment that QUOTES the
    selector — "`.dp-root textarea:focus-visible` is (0,2,1) and wins outright".
    A comment contains no `}`, so splitting on braces glues it to the rule that
    follows; the finder then matched the comment's prose and kept "finding" the
    rule after the rule itself had been deleted. A reader that answers from the
    documentation rather than the code is the whole thing law 7c is about.
  */
  const rule = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("}")
    .map((block) => block.split("{")[0])
    .find((selector) => /textarea:focus-visible/.test(selector) && /input:where\(/.test(selector));
  if (!rule) {
    throw new Error(
      "designLawTextEntry: the text-entry focus carve-out was not found in tokens.css. A " +
        "reader that comes up empty reports agreement either way, so this refuses.",
    );
  }
  return [...rule.matchAll(/:not\(\[type="([^"]+)"\]\)/g)].map((m) => m[1]).sort();
}

describe("the design-law drive and tokens.css agree on what text entry is", () => {
  const css = fs.readFileSync(TOKENS, "utf8");

  it("finds the carve-out and its type list is not empty", () => {
    const found = excludedTypesInStylesheet(css);
    expect(found.length).toBeGreaterThan(0);
  });

  it("the stylesheet's excluded types are exactly the drive's control types", () => {
    expect(excludedTypesInStylesheet(css)).toEqual([...CONTROL_INPUT_TYPES].sort());
  });

  it("POSITIVE CONTROL: a stylesheet that excludes one more type disagrees", () => {
    const drifted = css.replace(
      ':not([type="checkbox"])',
      ':not([type="checkbox"]):not([type="search"])',
    );
    expect(drifted).not.toEqual(css);
    expect(excludedTypesInStylesheet(drifted)).not.toEqual([...CONTROL_INPUT_TYPES].sort());
  });

  it("POSITIVE CONTROL: a stylesheet with no carve-out refuses rather than agreeing", () => {
    const removed = css.replace(/\.dp-root textarea:focus-visible,/, ".dp-root .nothing,");
    expect(removed).not.toEqual(css);
    expect(() => excludedTypesInStylesheet(removed)).toThrow(/was not found/);
  });
});

describe("the selector the drive actually queries with", () => {
  /*
    Whether a selector MATCHES is a browser question, and it is answered in a
    browser: `designLawControls.mts` carries a `<input type="search">` offender
    — the staff search box, reproduced — that law 1 must catch, driven by
    `drive-design-laws.mts --controls`. These arms hold the shape of the string
    so a rewrite that quietly narrowed it cannot pass unnoticed here either.
  */
  it("covers textarea and every input that is not a listed control type", () => {
    expect(TEXT_ENTRY_SELECTOR).toContain("textarea");
    for (const type of CONTROL_INPUT_TYPES) {
      expect(TEXT_ENTRY_SELECTOR).toContain(`:not([type="${type}"])`);
    }
  });

  it("is an exclusion, never an allow-list — the shape the search box fell through", () => {
    /*
      The old selector named the types it wanted (`input[type=text]`,
      `input:not([type])`). Any positive `[type=...]` term here would be that
      mistake returning, and `type="search"` would be outside it again.
    */
    const withoutExclusions = TEXT_ENTRY_SELECTOR.replace(/:not\(\[type="[a-z]+"\]\)/g, "");
    expect(withoutExclusions).not.toMatch(/\[type/);
    /* POSITIVE CONTROL: the old allow-list must fail this same assertion, or it
       is a regex that merely compiles. */
    const old = ".dp-input, input[type=text], input:not([type]), textarea";
    expect(old.replace(/:not\(\[type="[a-z]+"\]\)/g, "")).toMatch(/\[type/);
  });
});
