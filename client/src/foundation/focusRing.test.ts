import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * TEXT ENTRY NEVER WEARS THE ACCENT RING — the root rule, held (founder,
 * 2026-09-02, at the staff Users search box: *"whenever i click into a text
 * box for some reason by default it wants to add a red border? … its really
 * annoying and wrong"*).
 *
 * The law was already written (`foundation.css`, "TEXT FIELDS FOCUS ON THE
 * WRAPPER") and already enforced for `.dp-input`; every other text box in the
 * product fell through — the casting room's rename, the word-picker (#304),
 * then the staff search, the modal rename and the crew reply box. Three
 * appearances is a class, so the exclusion now lives in `tokens.css` beside the
 * blanket ring, and these arms hold THAT rule: that it exists, that it covers
 * textarea and text-typed inputs, that it leaves the control-typed inputs to
 * the ring, and that it out-specifies the blanket. `anchoredPanel.test.ts`'s
 * derived sweep covers the weight of every outline reset; this file covers the
 * coverage of this one.
 *
 * ⚠ **Every absence arm carries a positive control** (working law 2): the
 * stylesheet as it stood BEFORE the rule — the blanket alone — must fail the
 * same matcher, or the arm proves only that a regex compiles.
 *
 * **Stated limit.** Source guards cannot see a render. Whether a focused staff
 * search box shows an ink border and no red ring was driven at the running app
 * in both themes and recorded on the PR; the drive that asserts the same law
 * on casting surfaces (`scripts/drive-casting-design-laws.mts`, law 1) does not
 * yet visit the staff pages, and that is a gap named here rather than closed.
 */

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const read = (relative: string) =>
  fs.readFileSync(path.join(HERE, relative), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** The rule that excludes text entry: selector list → body, or null. */
function textEntryExclusion(css: string): { selectors: string[]; body: string } | null {
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(",").map((s) => s.trim());
    if (!selectors.some((s) => /^\.dp-root textarea:focus-visible$/.test(s))) continue;
    return { selectors, body: match[2] };
  }
  return null;
}

/** The blanket as it stood before the exclusion — the positive control's fixture. */
const BEFORE = `
.dp-root :focus-visible {
  outline: 2px solid var(--accentSolid);
  outline-offset: 2px;
}
`;

describe("text entry never wears the blanket accent ring", () => {
  const tokens = read("tokens.css");

  it("the blanket ring itself still exists — quieter on text, never absent elsewhere", () => {
    expect(tokens).toMatch(/\.dp-root :focus-visible\s*\{[^}]*outline:\s*2px solid var\(--accentSolid\)/);
  });

  it("the exclusion exists, resets the outline, and moves the mark onto the box", () => {
    const rule = textEntryExclusion(tokens);
    expect(rule, "the text-entry exclusion is gone from tokens.css").not.toBeNull();
    expect(rule!.body).toMatch(/outline:\s*none/);
    expect(rule!.body, "a text field with its own border shows focus in the ink").toMatch(
      /border-color:\s*var\(--ink\)/,
    );
  });

  it("covers textarea and every text-typed input, under .dp-root", () => {
    const { selectors } = textEntryExclusion(tokens)!;
    expect(selectors).toContain(".dp-root textarea:focus-visible");
    const input = selectors.find((s) => /^\.dp-root input:where\(/.test(s) && s.endsWith(":focus-visible"));
    expect(input, "the input half of the exclusion is missing or not rooted").toBeDefined();
    /* The carve-out is a :not() of CONTROL types, so an input with no type,
       or any text-like type, is covered by default. A rule that listed the
       text types instead would miss the next one (`type="email"` on a form
       nobody thought of) — the same drift this file exists to stop. */
    expect(input).toMatch(/:where\(:not\(/);
    for (const control of ["checkbox", "radio", "range", "file", "submit", "button"]) {
      expect(input, `${control} inputs must keep the ring — they are controls`).toContain(`[type="${control}"]`);
    }
    for (const text of ["text", "search", "email", "password"]) {
      expect(input, `${text} is a text type and must not be carved OUT`).not.toContain(`[type="${text}"]`);
    }
  });

  it("out-specifies the blanket, so it wins on weight and not on stylesheet order", () => {
    /* The blanket is (0,2,0). Each exclusion selector carries .dp-root, an
       element and :focus-visible — (0,2,1) — with :where() contributing
       nothing, which is why it is :where() and not :is() or a bare :not(). */
    for (const selector of textEntryExclusion(tokens)!.selectors) {
      expect(selector, "every exclusion selector is rooted").toMatch(/^\.dp-root /);
      expect(selector, "every exclusion selector names an element").toMatch(/^\.dp-root (textarea|input)\b/);
      expect(selector, "no :is() — it would add the weight of its heaviest argument").not.toContain(":is(");
      /* Strip the one :where(...) group; what remains must be exactly the
         rooted element plus :focus-visible, so nothing else adds weight. */
      const stripped = selector.replace(/:where\((?:[^()]|\([^()]*\))*\)/, "");
      expect(stripped).toMatch(/^\.dp-root (textarea|input):focus-visible$/);
      expect(selector, "a comma inside a selector reads as two weak selectors to the sweeps").not.toContain(",");
    }
  });

  it("an invalid text field keeps its error border while focused — focus never hides an error", () => {
    /* Reviewer on #446: the ink border beat a shadcn input's aria-invalid
       border for as long as it held focus. The override sits one attribute
       heavier than the exclusion, so it wins on weight. */
    const rule = [...tokens.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) =>
      m[1].split(",").some((sel) => sel.trim() === '.dp-root input[aria-invalid="true"]:focus-visible'),
    );
    expect(rule, "the invalid-while-focused override is gone").toBeDefined();
    expect(rule![1].split(",").map((s) => s.trim())).toContain('.dp-root textarea[aria-invalid="true"]:focus-visible');
    expect(rule![2]).toMatch(/border-color:\s*var\(--error\)/);
    expect(rule![2], "it must not reintroduce a ring").not.toMatch(/outline/);
  });

  it("the matcher can fail — the blanket alone, driven through it, has no exclusion", () => {
    expect(textEntryExclusion(BEFORE)).toBeNull();
    expect(BEFORE).toMatch(/\.dp-root :focus-visible\s*\{[^}]*outline:\s*2px solid var\(--accentSolid\)/);
    const listedTypes = ".dp-root input:where([type=\"text\"], [type=\"search\"]):focus-visible";
    expect(listedTypes, "a text-type allowlist is the drift, and the arm above would refuse it").toContain(
      '[type="text"]',
    );
  });
});
