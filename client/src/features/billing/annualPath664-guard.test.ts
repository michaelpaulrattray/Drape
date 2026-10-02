/**
 * #664 — THE ANNUAL TOGGLE IS REAL FOR AN EXISTING SUBSCRIBER.
 *
 * The card's defect, in one sentence: the toggle changed every price on the
 * page and never reached the server, so the upgrade billed on the existing
 * cycle. These arms pin the three client halves of the fix at the source, in
 * the house's file-content style:
 *
 *   1. the interval RIDES both `changePlan` calls (each modal);
 *   2. the toggle OPENS on the interval the account is billed on, and null
 *      never masquerades as monthly fact;
 *   3. a subscriber's plan change goes through a CONFIRM step quoting the
 *      server's own quote — because since #664 the charge is immediate.
 *
 * Comments are stripped before matching so a docblock telling the defect's
 * story cannot satisfy an arm about the code.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { withoutComments } from "../../../../server/testing/withoutComments";

const HERE = join(process.cwd(), "client", "src", "features", "billing");
const read = (name: string) => readFileSync(join(HERE, name), "utf8");

/**
 * Comments are stripped before matching, so a docblock telling the defect's
 * story cannot satisfy an arm about the code.
 *
 * ⚠ **THE SHARED READER (#1636).** The private pair it replaces — a block
 * regex and an anchored line regex — knows nothing about STRING LITERALS: a
 * `/*` inside a quoted string opens a comment it never opened and everything
 * to the next one is deleted from what this guard then reads. Measured across
 * the tree, the block half alone read 41 of 1,969 files short. **A guard that
 * reads less passes for the wrong reason**, and the thing this one guards is
 * whether a billing interval reaches the server.
 *
 * The swap is in scope here because **every input is `.tsx`** —
 * `ChangePlanModal.tsx` and `AddCreditsModal.tsx`, read at the three call
 * sites rather than assumed. A stylesheet must never come through here: `//`
 * is not a comment in CSS, so an unquoted `url(https://…)` would be truncated
 * at the scheme — the same silence pointed the other way.
 */
const code = withoutComments;

describe("ChangePlanModal", () => {
  const source = code(read("ChangePlanModal.tsx"));

  it("the interval rides the mutation", () => {
    expect(source).toMatch(/changePlan\.mutate\(\{[^}]*\binterval\b/s);
  });

  it("the toggle opens on the billed interval, from getStatus's cache", () => {
    expect(source).toContain('status?.billingInterval === "year"');
    expect(source).toContain("intervalChoice ?? billedInterval");
    /* The old always-monthly opening state must not come back. */
    expect(source).not.toMatch(/useState<Interval>\("monthly"\)/);
  });

  it("a subscriber's change is confirmed against the server's own quote before it charges", () => {
    expect(source).toMatch(/previewPlanChange\.useQuery\(\s*\{[^}]*\binterval\b/s);
    expect(source).toContain("describeChange(confirming, changeQuote.data)");
    /* The subscriber leg of act() opens the confirm step rather than firing
       the mutation — the mutate lives behind onConfirm. */
    expect(source).toMatch(/setConfirming\(plan\)/);
  });

  it("the customer's own tier offers the billing switch in BOTH modes (law 7)", () => {
    const cardMode = source.indexOf("isCurrent && intervalDiffers");
    const compareMode = source.indexOf("plan.id === currentId && intervalDiffers");
    expect(cardMode, "card mode lost the switch-billing button").toBeGreaterThan(-1);
    expect(compareMode, "compare mode lost the switch-billing button").toBeGreaterThan(-1);
  });
});

describe("ChangePlanModal — review round 2", () => {
  const source = code(read("ChangePlanModal.tsx"));

  it("a failed quote says so and stands down — the press can never die silently (finding 5)", () => {
    expect(source).toContain('logRawFailure("billing.previewPlanChange"');
    expect(source).toMatch(/quoteError[\s\S]*setConfirming\(null\)/);
  });
});

describe("AddCreditsModal", () => {
  const source = code(read("AddCreditsModal.tsx"));

  it("the interval rides the mutation and the preview alike", () => {
    expect(source).toMatch(/changePlan\.mutate\(\{[^}]*\binterval:/s);
    expect(source).toMatch(/previewPlanChange\.useQuery\(\s*\{[^}]*\binterval:/s);
  });

  it("the toggle opens on the billed interval", () => {
    expect(source).toContain('annualChoice ?? status?.billingInterval === "year"');
  });

  it("an interval switch rewrites the renewal line — the old cycle's date must not be quoted beside a charge that resets it", () => {
    expect(source).toContain('preview?.kind === "interval-switch"');
  });

  it("⚠ a subscriber's button is inert until its quote exists (finding 4) — no charge under a $0.00 label", () => {
    /*
      ⚠ **#1725 STRENGTHENED THIS GATE, AND THE ASSERTION READ THE WHOLE LINE
      VERBATIM — so a change that made the button strictly HARDER to press
      reddened it.** The string moved; the subject did not. Deleting the arm
      would have been lowering the floor to fit the move, so it is pointed at
      the two conditions instead, each named for the card it belongs to.

      #664's half is the preview condition. #1725's is `dueToday !== null`, and
      it belongs in this arm rather than beside it: this arm's own title is *no
      charge under a $0.00 label*, and before #1725 `!hasSubscription` made
      `quoteReady` true immediately — so a customer whose plan catalogue had not
      arrived read `Add credits · $0.00` on a button that looked pressable,
      which is the very thing finding 4 was written to stop, one branch over.
    */
    expect(source).toContain("(!hasSubscription || (!!preview && !previewFailed))");
    expect(source).toContain("const quoteReady = dueToday !== null &&");
    expect(source).toMatch(/disabled=\{!selected \|\| working \|\| !quoteReady\}/);
    expect(source).toMatch(/if \(!selected \|\| !quoteReady\) return;/);
  });

  /*
    ⚠ **THE RENEWAL LINE STATES NO PRORATION BASIS UNTIL STRIPE HAS QUOTED ONE
    — card 1730, and it is the arm above's subject one sentence over.**

    The arm above stops a CHARGE being named before it is known; this stops the
    BASIS for that charge being named before it is known, which was the half
    nobody had looked at. `cycle` is `alignToPreview(rawCycle, preview)`, and
    before the preview answers that is `rawCycle` — cut from `status`, which is
    the CREDIT cycle and not the period Stripe prorates over. Driven on the
    yearly fixture: *"Prorated for the 8 days left in this cycle"* became
    *"Prorated for the 343 days left in this cycle"* a second later.

    ⚠ **IT IS DELIBERATELY NOT A REGEX OVER THE SENTENCE.** The prose is derived
    from a not-yet-aligned object, so there is no token a walk could see — card
    1725's own reader says as much about its own limit. What is checkable is the
    GATE, so the gate is what is pinned, in three parts that cannot each be
    satisfied by the others.
  */
  it("the proration sentence asks whether the cycle is Stripe's before it states one (card 1730)", () => {
    /* 1 · the predicate is the module's, not a copy of its condition here. */
    expect(
      source,
      "the renewal line no longer asks `alignsToPreview` — a condition retyped beside this"
      + " surface drifts from the one `alignToPreview` actually branches on, which is the"
      + " mirror working law 4 is about",
    ).toContain("alignsToPreview(preview)");

    /* 2 · and the sentence is BEHIND it, not merely near it. */
    const line = source.slice(source.indexOf("Prorated for the ${cycle.daysLeft}"));
    expect(
      source.slice(0, source.indexOf("Prorated for the ${cycle.daysLeft}")),
      "the proration sentence is no longer gated on the cycle being Stripe's. An unaligned"
      + " cycle is the CREDIT cycle, so the sentence names a basis the charge was not"
      + " computed from. Card 1730.",
    ).toContain("cycle && alignsToPreview(preview)");
    expect(line.length, "the proration sentence is gone — re-read this arm rather than deleting it")
      .toBeGreaterThan(0);

    /* 3 · and a quote that is never coming gets no waiting sentence either —
       the top rung and the hidden rung both leave `selectedId` null, so the
       preview never runs and *"working out"* would be a permanent claim. */
    expect(
      source,
      "the held sentence is no longer gated on a quote actually being on its way, so an"
      + " account with no rung above its own reads `working out` forever. Card 1730.",
    ).toContain("const quoteComing = quoteEnabled && !previewFailed;");
    expect(
      source,
      "the preview query and the renewal line no longer read ONE fact about whether a quote"
      + " is coming. Card 1730.",
    ).toContain("{ enabled: quoteEnabled }");
  });
});
