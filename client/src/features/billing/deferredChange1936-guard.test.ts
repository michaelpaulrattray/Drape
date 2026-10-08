/**
 * #1936 — THE CUSTOMER-FACING HALF: NO SURVIVING SENTENCE PROMISES MONEY BACK
 * ON A DECREASE, AND A SCHEDULED CHANGE IS VISIBLE WITH A WAY OUT.
 *
 * His option 1 removed the refund. Six sentences in this product described it
 * — three on the server, three on these two modals — and every one of them
 * became false the moment the deferral landed. The server's three are driven
 * in `server/routes/deferredPlanChangeRoute.test.ts`; these are the client's,
 * pinned at the source in the house style (`annualPath664-guard.test.ts`'s),
 * because the composers are not exported.
 *
 * ⚠ **EVERY COPY ARM SLICES THE FUNCTION IT IS ABOUT OUT OF THE FILE FIRST.**
 * A whole-file `not.toMatch` for *"comes back"* would pass or fail on any of
 * the dozens of other sentences in a 2,400-line modal, and a whole-file
 * `toMatch` is satisfied by an identical line in a neighbouring function —
 * which this repository has already been bitten by. Comments are stripped
 * before matching, so a docblock telling this card's story cannot satisfy an
 * arm about the code.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sourceBand } from "../../../../server/testing/sourceBand";
import { withoutComments } from "../../../../server/testing/withoutComments";

const BILLING = join(process.cwd(), "client", "src", "features", "billing");
const SETTINGS = join(process.cwd(), "client", "src", "features", "settings");

const changePlanModal = withoutComments(readFileSync(join(BILLING, "ChangePlanModal.tsx"), "utf8"));
const addCreditsModal = withoutComments(readFileSync(join(BILLING, "AddCreditsModal.tsx"), "utf8"));
const billingSection = withoutComments(
  readFileSync(join(SETTINGS, "sections", "BillingSection.tsx"), "utf8"),
);

/**
 * The confirm step's sentence composer, sliced out of a 2,400-line module.
 *
 * ⚠ **`sourceBand` IS THE READER OF RECORD AND THE FIRST DRAFT OF THIS SUITE
 * HAND-ROLLED A SIXTH PRIVATE SLICER.** Five private copies of this idea
 * already existed under this very directory and #1845/#1848 spent a pass
 * resolving them to one — writing another was working law 4 in the shape this
 * repository has paid most for, in the directory it paid it in. It also
 * REFUSES on a missing anchor rather than answering `""`, which is the
 * property every negative arm below depends on: a subject that has left the
 * file would otherwise satisfy `not.toMatch` for the wrong reason.
 */
const describeChange = sourceBand(
  changePlanModal,
  "function describeChange(",
  "\n}",
  "describeChange",
);

describe("the confirm step answers a decrease with a date and nothing else", () => {
  it("has a deferred branch, and it returns the DATE", () => {
    expect(describeChange).toMatch(/quote\.deferred/);
    expect(describeChange).toMatch(/formatShortDate\(new Date\(quote\.effectiveAtSec \* 1000\)\)/);
  });

  it("⚠ the deferred branch comes BEFORE the dial branch, or a dial-down reads the dial's sentence", () => {
    /* Order is the whole of it: `dialMoved` is true for a dial-DOWN as well as
       a dial-up, so a deferred check placed after it would never be reached by
       the commonest decrease this card was filed about.

       ⚠ **BOTH ANCHORS ARE THE `if` STATEMENTS, NOT THE BARE TOKENS, AND THAT
       IS A REPAIR TO THIS ARM'S OWN FIRST DRAFT.** It compared
       `indexOf("quote.deferred")` with `indexOf("dialMoved")`, and a sabotage
       round walked straight through it: adding `dialMoved` INTO the deferred
       condition moves the first occurrence of that token onto the deferred
       line itself, so the comparison stayed true while the branch had been
       changed. A bare token's first occurrence is not the branch. */
    const deferredAt = describeChange.indexOf("if (quote.deferred");
    const dialAt = describeChange.indexOf("if (dialMoved");
    expect(deferredAt).toBeGreaterThan(-1);
    expect(dialAt).toBeGreaterThan(-1);
    expect(deferredAt).toBeLessThan(dialAt);
  });

  it("⚠ the deferred condition is those TWO terms and nothing else — what a text guard can say about reachability", () => {
    /* **Said plainly because the limit matters: this suite reads SOURCE, so it
       cannot prove the branch is reached.** A sabotage round confirmed the
       hole — `if (false && quote.deferred && …)` leaves every other arm here
       green, because the words are all still present.

       Pinning the condition exactly is the strongest thing a text guard can
       do about it, and it is worth having: the realistic way this branch dies
       is a well-meant extra term (a flag, a `!isUpgrade`, a null check on a
       field that is sometimes absent), not a literal `false`. The behaviour
       this copy describes is driven on the SERVER, where the money is, in
       `server/routes/deferredPlanChangeRoute.test.ts`. */
    expect(describeChange).toMatch(/if \(quote\.deferred && quote\.effectiveAtSec\) \{/);
  });

  it("⚠ promises no refund anywhere in the function — all three sentences, not just the one", () => {
    /* The three arms that carried it: the dial-down, the switch to monthly and
       the plain downgrade. Each is reachable only at the knife-edge instant now
       (a decrease asked for in the second the period ends), where nothing is
       owed either way — so the promise is false in every case that can reach
       them. */
    expect(describeChange).not.toMatch(/billing credit/i);
    expect(describeChange).not.toMatch(/comes back/i);
    expect(describeChange).not.toMatch(/go back with|goes back with/i);
    expect(describeChange).not.toMatch(/that refund/i);
  });

  it("⚠ POSITIVE CONTROL — the upgrade sentences still quote a charge, so the arm above is not passing by emptiness", () => {
    /* Four `not.toMatch` arms would all pass against a function that had been
       gutted, renamed past the slicer, or reduced to a single return. */
    expect(describeChange).toMatch(/is due today/);
    expect(describeChange).toMatch(/credits land on your balance/);
  });

  it("the quote the server serves is what the sentence is composed from", () => {
    /* #664's own arm, re-stated because `deferred` is only honest if it arrives
       from the same quote the charge is computed from. */
    expect(changePlanModal).toMatch(/describeChange\(\s*confirming,\s*changeQuote\.data\b/);
  });
});

describe("Add credits says when a deferred switch actually happens", () => {
  it("names the date from the preview rather than claiming today", () => {
    expect(addCreditsModal).toMatch(/preview\?\.deferred/);
    expect(addCreditsModal).toMatch(
      /formatShortDate\(new Date\(preview\.effectiveAtSec \* 1000\)\)/,
    );
  });

  it("⚠ no longer tells a customer her unused year comes off future bills", () => {
    /* That sentence was true of the instant road and is true of nothing today:
       annual → monthly hands money back, so it is deferred. */
    expect(addCreditsModal).not.toMatch(/comes off future bills/i);
  });

  it("⚠ POSITIVE CONTROL — the renewal line still exists and still speaks for the other roads", () => {
    expect(addCreditsModal).toMatch(/dp-topup__renewal/);
    expect(addCreditsModal).toMatch(/Billed for the whole year today/);
  });
});

describe("Billing & plan shows the pending change and offers the way out", () => {
  it("reads it from `getSubscriptionDetails` — the procedure that answers it", () => {
    expect(billingSection).toMatch(/billing\.getSubscriptionDetails\.useQuery\(\)/);
    expect(billingSection).toMatch(/pendingChange/);
  });

  it("⚠ the pending change REPLACES the renewal segment rather than sitting beside it", () => {
    /* Both facts land on the same date, so printing both says one date twice
       and makes her work out that they are one event. The `??` IS the
       contract: `renews …` is the fallback for having nothing pending. */
    expect(billingSection).toMatch(
      /pendingSentence \?\? \(renewsAt \? `renews \$\{formatShortDate\(renewsAt\)\}` : null\)/,
    );
  });

  it("names whichever thing is changing — plan, cycle, or the dial's credits", () => {
    /* A dial move keeps the plan's own name, so "Pro Plus from 7 Nov" on a Pro
       Plus account would read as nothing happening at all.

       Sliced to the composer, so these three claims cannot be answered by the
       plan card's own markup further down the file. */
    const sentence = sourceBand(
      billingSection,
      "const pendingSentence = (() => {",
      "\n  })();",
      "pendingSentence",
    );
    expect(sentence).toMatch(/pending\.planName/);
    expect(sentence).toMatch(/billed \$\{pending\.interval === "annual" \? "yearly" : "monthly"\}/);
    expect(sentence).toMatch(/pending\.monthlyCredits/);
    /* ⚠ And the INTERVAL is read off a narrowed value, never through an
       optional chain — #1741's guard caught exactly that in the first draft of
       this surface, because an optional chain there answers "monthly" about a
       customer nobody has read.

       The assertion names `billingInterval` rather than banning `?.` from the
       whole block: the block's own early return is `if
       (!subscriptionDetails?.pendingChange)`, which is the correct use of one,
       and a blanket ban would have made this arm about punctuation instead of
       about the unread status. */
    expect(sentence).not.toMatch(/subscriptionDetails\?\.billingInterval/);
    expect(sentence).toMatch(/subscriptionDetails\.billingInterval === "year"/);
  });

  it("⚠ carries an undo, and it is wired to the procedure rather than drawn", () => {
    /* Invariant 7: a control that is not invoked does not exist. Without this
       she can only escape a pending downgrade by buying an increase she does
       not want. */
    expect(billingSection).toMatch(/billing\.cancelScheduledChange\.useMutation/);
    expect(billingSection).toMatch(/cancelScheduledChange\.mutate\(\)/);
    expect(billingSection).toMatch(/Keep my plan/);
  });

  it("⚠ POSITIVE CONTROL — `Change plan` is still reachable when nothing is pending", () => {
    /* The undo stands IN PLACE of `Change plan` while something is pending, so
       an arm that only looked for the undo would pass against a card that had
       lost its main road entirely. */
    expect(billingSection).toMatch(/onClick=\{onChangePlan\}/);
    expect(billingSection).toMatch(/Change plan/);
  });
});
