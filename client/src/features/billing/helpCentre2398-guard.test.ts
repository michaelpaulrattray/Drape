/**
 * #2398 — THE CHANGE PLAN PANE PROMISED A HELP CENTRE THIS PRODUCT DOES NOT
 * HAVE, IN PLAIN TEXT NOBODY COULD CLICK.
 *
 * The footer of the one surface a billing problem is most likely to be read
 * from said *"Having a problem? Go to the help centre."* — a `<span>`, not a
 * link — and the compare table repeated it as a plan feature (*"The help
 * centre, on every plan."*). `git grep -i "help cent"` over `client/src` found
 * those two strings and a CSS comment: no route, no link, no help centre.
 *
 * ## The two halves these arms hold, and why the second one is a tree walk
 *
 * The **instance** is the footer and the compare row, held at the bytes below.
 * The **class** is copy that sends a customer somewhere this product has not
 * built, and it is the class that earns a derived population: the string came
 * from an approved design brief whose own closing line is *"No string in this
 * brief claims a capability that is not in the tree"* — so the next copy pass
 * over any surface can reintroduce it in good faith, and a guard pinned to one
 * file would not see it. The walk is `clientSources` (#2289's reader of
 * record: one race tolerance, deterministic order), stripped of comments.
 *
 * ⚠ **THE STRIP IS LOAD-BEARING AND IT IS CONTROLLED, because the arms above
 * it would otherwise be green for the wrong reason.** This card's own
 * explanatory comments QUOTE the retired sentence, in this file and in
 * `ChangePlanModal.tsx` — a correction that cannot name what it corrected is
 * not a correction — so a reader that failed to strip comments would redden,
 * and a matcher that could never match anything would pass. Both directions
 * are driven: the raw source of the module this card changed still carries the
 * phrase in prose, and the pattern is proven to fire on a line shaped like the
 * one that shipped.
 *
 * ⚠ **ONE DELIBERATE SURVIVOR, NAMED SO IT IS NOT READ AS A MISS**:
 * `settings.css`'s footer-wrap comment keeps the old sentence beside the new
 * one, because it records a MEASUREMENT taken at 390px against that exact
 * string. A stylesheet comment is not customer copy, and the walk below reads
 * `.ts`/`.tsx` only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "../../../../server/testing/contendedTestTimeout";
import { sourceBand } from "../../../../server/testing/sourceBand";
import { clientSources } from "../../../../server/testing/sourceTree";
import { withoutComments } from "../../../../server/testing/withoutComments";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const MODAL = join(process.cwd(), "client", "src", "features", "billing", "ChangePlanModal.tsx");
const rawModal = readFileSync(MODAL, "utf8");
const changePlanModal = withoutComments(rawModal);

/**
 * A HELP CENTRE, SPELLED BOTH WAYS AND NOT ONLY AS TWO WORDS.
 *
 * `help cent` catches `help centre` and `help center`; the second half of the
 * alternation catches the shapes a rewrite reaches for when the first is
 * banned, which is the whole point of guarding a class rather than a sentence.
 */
const HELP_CENTRE = /help\s*cent(?:re|er)|support\s*cent(?:re|er)|knowledge\s*base/i;

const footer = sourceBand(
  changePlanModal,
  '<footer className="dp-plan__foot">',
  "</footer>",
  "the Change plan footer",
);

const helpCompareGroup = sourceBand(
  changePlanModal,
  'title: "Help"',
  "}",
  "the compare table's Help group",
);

describe("#2398 — the footer points at a road that exists", () => {
  it("names the support address as a real mailto, not a place to go", () => {
    expect(footer).toMatch(/Having a problem\? Email/);
    expect(footer).toMatch(/<a className="dp-plan__helplink" href=\{`mailto:\$\{SUPPORT_EMAIL\}`\}>/);
    expect(footer).toContain("{SUPPORT_EMAIL}");
  });

  it("⚠ the address is ONE declaration on this surface, not a second literal", () => {
    const literals = changePlanModal.match(/support@klieglabs\.com/g) ?? [];
    expect(literals).toHaveLength(1);
    expect(changePlanModal).toMatch(/const SUPPORT_EMAIL = "support@klieglabs\.com";/);
  });

  it("the footer is not a dead end — no plain-text instruction survives beside it", () => {
    expect(footer).not.toMatch(HELP_CENTRE);
    expect(footer).not.toMatch(/Go to the/);
  });
});

describe("#2398 — the compare table's Help row says what is true", () => {
  it("promises support on every plan and names no centre", () => {
    expect(helpCompareGroup).toContain("Email support, on every plan.");
    expect(helpCompareGroup).not.toMatch(HELP_CENTRE);
  });

  it("⚠ still claims no SLA and no priority tier (#1607's avoid-list)", () => {
    expect(helpCompareGroup).not.toMatch(/priority|SLA|response time|faster/i);
  });
});

describe("#2398 — the class: no customer-facing client file promises one", () => {
  /*
    The population is DERIVED and its floor is asserted, because a walk that
    silently read nothing is indistinguishable from a tree with no defect in it
    (working law 2). The floor names the module this card changed and a second
    file that was never part of it, so a walk scoped to one directory by
    accident reddens here rather than passing.
  */
  const sources = clientSources({ tests: "exclude" });

  it("found a real client population to read", () => {
    expect(sources.length).toBeGreaterThan(400);
    const relatives = sources.map((file) => file.relative);
    expect(relatives).toContain("features/billing/ChangePlanModal.tsx");
    expect(relatives).toContain("pages/Login.tsx");
  });

  it("⚠ no client source outside its comments names a help centre", () => {
    const offenders = sources
      .filter((file) => HELP_CENTRE.test(withoutComments(file.source)))
      .map((file) => file.relative);
    expect(offenders).toEqual([]);
  });

  it("the reader is proven able to see and to fail", () => {
    // POSITIVE CONTROL on the matcher: the line that actually shipped.
    expect(HELP_CENTRE.test('<span>Having a problem? Go to the help centre.</span>')).toBe(true);
    expect(HELP_CENTRE.test('note: "The help centre, on every plan."')).toBe(true);
    // POSITIVE CONTROL on the strip: this card's prose still quotes the phrase,
    // so the arms above are green BECAUSE the comments were removed.
    expect(rawModal).toMatch(HELP_CENTRE);
    expect(changePlanModal).not.toMatch(HELP_CENTRE);
    // NEGATIVE CONTROL: the sentence that replaced it is not a false positive.
    expect(HELP_CENTRE.test("Having a problem? Email support@klieglabs.com.")).toBe(false);
  });
});
