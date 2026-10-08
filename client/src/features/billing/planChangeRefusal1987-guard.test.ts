/**
 * #1987 finding 2 — THE CONFIRM STEP SAYS "NO" BEFORE THE PRESS, IN THE
 * SERVER'S OWN WORDS.
 *
 * `previewPlanChange` now serves `refusal` — the exact sentence `changePlan`
 * would refuse with (driven in
 * `server/routes/planChangeSpentShareAndStates.test.ts`). These arms pin the
 * client half at the source, in this directory's house style
 * (`deferredChange1936-guard.test.ts`): the composer is not exported, so it is
 * sliced out with `sourceBand` and comments are stripped first.
 *
 * The frames in both themes are the eye's half of this — working law 6.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sourceBand } from "../../../../server/testing/sourceBand";
import { withoutComments } from "../../../../server/testing/withoutComments";
import { spentShareSentence, yearlySwitchOffsetSentence } from "./spentShareSentence";
import { displayBalance, formatCredits } from "@shared/creditDisplay";

const BILLING = join(process.cwd(), "client", "src", "features", "billing");
const changePlanModal = withoutComments(readFileSync(join(BILLING, "ChangePlanModal.tsx"), "utf8"));

const describeChange = sourceBand(changePlanModal, "function describeChange(", "\n}", "describeChange");

describe("the refusal is the confirm step's sentence when there is one", () => {
  it("⚠ returns the server's refusal verbatim, BEFORE the deferred branch", () => {
    const refusalAt = describeChange.indexOf("if (quote.refusal)");
    const deferredAt = describeChange.indexOf("if (quote.deferred");
    expect(refusalAt).toBeGreaterThan(-1);
    expect(deferredAt).toBeGreaterThan(-1);
    /* Order is the point: a plan set to end used to read "starts on …" from
       the deferred branch while the press was refused. */
    expect(refusalAt).toBeLessThan(deferredAt);
    expect(describeChange).toMatch(/if \(quote\.refusal\) \{\s*return quote\.refusal;\s*\}/);
  });

  it("composes no refusal copy of its own — the sentence is the server's, so they cannot differ", () => {
    expect(describeChange).not.toMatch(/set to end|didn't go through|is paused/);
  });
});

describe("a refused change offers no Confirm", () => {
  /* The dialog's own call site, from its opening tag to the next dialog. */
  const confirmDialog = sourceBand(
    changePlanModal,
    "<ConfirmDialog\n          title={\n            interval === \"annual\"",
    "onCancel={() => setConfirming(null)}",
    "the plan-change ConfirmDialog",
  );

  it("⚠ ONE button when refused — the cancel is dropped, not duplicated", () => {
    expect(confirmDialog).toMatch(/cancelLabel=\{changeQuote\.data\.refusal \? null : "Not now"\}/);
    const dialog = withoutComments(
      readFileSync(join(process.cwd(), "client", "src", "foundation", "ConfirmDialog.tsx"), "utf8"),
    );
    /* The foundation renders no cancel button for `null`, and focus then has
       somewhere to land. */
    expect(dialog).toMatch(/\{cancelLabel !== null && \(/);
    expect(dialog).toMatch(/else goRef\.current\?\.focus\(\)/);
  });

  it("labels the button 'Got it' when the quote carries a refusal", () => {
    expect(confirmDialog).toMatch(/changeQuote\.data\.refusal\s*\?\s*"Got it"/);
  });

  it("⚠ and the press CLOSES the dialog instead of calling changePlan", () => {
    const guardAt = confirmDialog.indexOf("if (changeQuote.data?.refusal)");
    const mutateAt = confirmDialog.indexOf("changePlan.mutate(");
    expect(guardAt).toBeGreaterThan(-1);
    expect(mutateAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(mutateAt);
    expect(confirmDialog).toMatch(
      /if \(changeQuote\.data\?\.refusal\) \{\s*setConfirming\(null\);\s*return;\s*\}/,
    );
  });
});

/* ─────────── #1965 repair — the higher price says why ─────────── */

describe("the spent-share line appears if and only if the charge is non-zero", () => {
  const credits = 2_174_665; // ledger credits — any whole display figure
  it("⚠ non-zero charge: one line, the quote's own credits in display units", () => {
    const line = spentShareSentence({ spentShareCharge: 78_680, spentShareCredits: credits, currentInterval: "monthly" });
    expect(line).toBe(` Includes ${formatCredits(displayBalance(credits))} credits you've already used this month.`);
    expect(spentShareSentence({ spentShareCharge: 1, spentShareCredits: credits, currentInterval: "annual" })).toMatch(
      /already used this year\.$/,
    );
  });

  it("NEGATIVE CONTROL — zero, absent or negative charge: no line at all", () => {
    expect(spentShareSentence({ spentShareCharge: 0, spentShareCredits: credits })).toBe("");
    expect(spentShareSentence({ spentShareCredits: credits })).toBe("");
    expect(spentShareSentence({ spentShareCharge: -5, spentShareCredits: credits })).toBe("");
    expect(spentShareSentence({})).toBe("");
  });

  it("the monthly switch carries it right after the due-today figure; the yearly one says it inside its own clause (#2023)", () => {
    const switchBand = sourceBand(describeChange, 'if (quote.kind === "interval-switch")', "if (quote.isUpgrade)", "switch branch");
    const calls = switchBand.match(/is due today\.(` \+\s*)?(\$\{)?spentShareSentence\(quote\)/g) ?? [];
    expect(calls).toHaveLength(1);
    const yearly = sourceBand(switchBand, 'if (quote.targetInterval === "annual")', "\n    }", "yearly branch");
    expect(yearly).toContain("yearlySwitchOffsetSentence(quote, formatDollars(quote.immediateCharge))");
    /* The old clause composed here was false in the spent case; the only
       place it may be written now is the helper that chooses it. */
    expect(yearly).not.toMatch(/comes off that|spentShareSentence\(/);
  });
});

describe("#2023 — the yearly confirm says what really comes off, in every case", () => {
  const due = "$269.00";
  const share = 434_935; // ledger credits — any whole display figure
  it("NEGATIVE CONTROL — nothing spent: the sentence exactly as it always read", () => {
    const plain = `The unused part of your current cycle comes off that, so about ${due} is due today.`;
    expect(yearlySwitchOffsetSentence({ spentShareCharge: 0, spentShareCredits: 0, creditUnwind: share }, due)).toBe(plain);
    expect(yearlySwitchOffsetSentence({}, due)).toBe(plain);
  });

  it("⚠ all spent: it no longer says anything comes off — the unused time is paid for", () => {
    const line = yearlySwitchOffsetSentence({ spentShareCharge: 2_700, spentShareCredits: share, creditUnwind: 0 }, due);
    expect(line).toBe(
      `You've already used this cycle's credits, so nothing comes off for the time left. About ${due} is due today.`,
    );
    expect(line).not.toMatch(/comes off that/);
  });

  it("⚠ part spent: the rest comes off, except the quote's own spent credits, in display units", () => {
    const line = yearlySwitchOffsetSentence({ spentShareCharge: 1_200, spentShareCredits: share, creditUnwind: 100_000 }, due);
    expect(line).toBe(
      `The unused part of your current cycle comes off that, except for ${formatCredits(displayBalance(share))} credits you've already used, which are paid for instead. About ${due} is due today.`,
    );
  });
});
