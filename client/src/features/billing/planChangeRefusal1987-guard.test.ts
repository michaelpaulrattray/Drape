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
