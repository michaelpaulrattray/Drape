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

const HERE = join(process.cwd(), "client", "src", "features", "billing");
const read = (name: string) => readFileSync(join(HERE, name), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

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
    expect(source).toContain("const quoteReady = !hasSubscription || (!!preview && !previewFailed);");
    expect(source).toMatch(/disabled=\{!selected \|\| working \|\| !quoteReady\}/);
    expect(source).toMatch(/if \(!selected \|\| !quoteReady\) return;/);
  });
});
