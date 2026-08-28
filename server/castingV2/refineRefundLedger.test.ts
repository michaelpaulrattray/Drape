/**
 * THE REFUND VOCABULARY, PINNED AT THE BYTES AND INVERTIBLE (#111).
 *
 * Two jobs, and the first one is the one that could cost money if it were
 * skipped:
 *
 * 1. **Byte identity.** Every sentence is asserted against the literal that
 *    stood inline in `refineService.ts` / `refineRecovery.ts` before the move,
 *    written out here in full rather than referenced. A refund description
 *    lands on `point_transactions` — a receipt a customer and support both
 *    read, and one that production already holds 32 of. A "harmless" reword
 *    during a refactor would fork the record silently.
 *
 * 2. **The inverse is honest.** The classifier is what makes the ledger
 *    readable, and the two ways it could lie are opposite: claiming precision
 *    it does not have (folding the seven-class fallback into `unknown`), and
 *    quietly bucketing a sentence it does not recognise. Both have their own
 *    arm, and the second one is asserted with a real production sentence.
 */
import { describe, expect, it } from "vitest";

import {
  REFINE_REFUND_COPY,
  REFINE_REFUND_GENERIC_FAMILY,
  classifyRefineRefundDescription,
  refineRefundDescription,
  refineRefundReadingLabel,
  type RefineRefundReason,
} from "./refineRefundLedger";

/**
 * THE BYTES, as they stood before the move. Deliberately literal: a test that
 * built these from the same table it is checking would pass on any reword.
 */
const PINNED: ReadonlyArray<[RefineRefundReason, string | undefined, string]> = [
  ["render_fault", undefined, "Refine refunded — the image came back damaged"],
  ["composite_fault", undefined, "Refine refunded — we could not assemble the picture cleanly"],
  [
    "segment_store",
    undefined,
    "Refine refunded — we could not read this face's kept edits, so nothing was rendered",
  ],
  ["facts_missing", "without fox eyes", "Refine refunded — the render came back without fox eyes"],
  [
    "facts_missing",
    "with glasses still in the picture",
    "Refine refunded — the render came back with glasses still in the picture",
  ],
  ["facts_missing", undefined, "Refine refunded — the render came back without what you asked for"],
  ["facts_missing", "   ", "Refine refunded — the render came back without what you asked for"],
  ["removal_not_delivered", "glasses", "Refine refunded — the render still showed the glasses"],
  [
    "removal_not_delivered",
    undefined,
    "Refine refunded — the render still showed what you asked to remove",
  ],
  [
    "cannot_say",
    undefined,
    "Refine refunded — we cannot yet place what this asked for, so nothing was rendered",
  ],
  ["recovered", undefined, "Refine refunded — the generation was interrupted"],
  ["transport", undefined, "Refine refunded — the generation failed"],
  ["rate_limit", undefined, "Refine refunded — the generation failed"],
  ["timeout", undefined, "Refine refunded — the generation failed"],
  ["content_policy", undefined, "Refine refunded — the generation failed"],
  ["capability", undefined, "Refine refunded — the generation failed"],
  ["provider_account", undefined, "Refine refunded — the generation failed"],
  ["unknown", undefined, "Refine refunded — the generation failed"],
];

/**
 * REAL SENTENCES OFF REAL LEDGER ROWS, both databases, read all-time on
 * 2026-08-29 (`scripts/_shift86-all-refine-refunds-disposable.mts`: nine
 * distinct on production, nine on dev). The classifier's population is the
 * rows, not the vocabulary — which is the whole reason the historical wording
 * below is in it.
 */
const PRODUCTION_ROWS: ReadonlyArray<[string, string]> = [
  ["Refine refunded — the generation was interrupted", "recovered"],
  [
    "Refine refunded — we cannot yet place what this asked for, so nothing was rendered",
    "cannot_say",
  ],
  ["Refine refunded — the render came back without glasses", "facts_missing"],
  ["Refine refunded — the render came back without fox eyes", "facts_missing"],
  ["Refine refunded — we could not assemble the picture cleanly", "composite_fault"],
  ["Refine refunded — the render came back with glasses still in the picture", "facts_missing"],
  /* The pre-'came back' wording. Nothing writes it any more and production
     still holds three rows of it — the one entry in HISTORICAL_SENTENCES, and
     the reason that list exists. */
  [
    "Refine refunded — the render was missing no glasses — they have been taken off and are not in the picture",
    "facts_missing",
  ],
  ["Refine refunded — the render was missing fox eyes", "facts_missing"],
  /* Dev's extra three, which production has not produced yet. */
  ["Refine refunded — the render still showed the glasses", "removal_not_delivered"],
  ["Refine refunded — the image came back damaged", "render_fault"],
  [
    "Refine refunded — the render came back without gold hoop earrings, dangly cross earrings, one on each ear, a matching pair",
    "facts_missing",
  ],
];

describe("the refund sentence a refine writes", () => {
  it.each(PINNED)("%s (%s) is byte-identical to the literal it replaced", (reason, detail, text) => {
    expect(refineRefundDescription(reason, detail)).toBe(text);
  });

  it("has copy for every reason, so a new failure class cannot reach the ledger nameless", () => {
    for (const reason of Object.keys(REFINE_REFUND_COPY) as RefineRefundReason[]) {
      expect(refineRefundDescription(reason).length).toBeGreaterThan(0);
      expect(refineRefundDescription(reason).startsWith("Refine refunded — ")).toBe(true);
    }
  });

  /**
   * The declared family must be EXACTLY the reasons with no sentence of their
   * own. Derived by subtraction here and declared in the module: the two are
   * compared, so giving one of the seven its own line without editing the list
   * reddens rather than silently narrowing the family.
   */
  it("declares the shared-sentence family as exactly the reasons without their own words", () => {
    const generic = refineRefundDescription("unknown");
    const measured = (Object.keys(REFINE_REFUND_COPY) as RefineRefundReason[])
      .filter((reason) => refineRefundDescription(reason) === generic)
      .sort();
    expect(measured).toEqual([...REFINE_REFUND_GENERIC_FAMILY].sort());
  });
});

describe("reading a class back off the ledger", () => {
  it.each(PINNED.filter(([reason]) => !REFINE_REFUND_GENERIC_FAMILY.includes(reason)))(
    "round-trips %s",
    (reason, detail) => {
      const reading = classifyRefineRefundDescription(refineRefundDescription(reason, detail));
      expect(reading).toEqual({ kind: "class", reason });
    },
  );

  it.each(PRODUCTION_ROWS)("classifies a real ledger row: %s", (description, reason) => {
    expect(classifyRefineRefundDescription(description)).toEqual({ kind: "class", reason });
  });

  /**
   * THE ARM THAT MATTERS MOST. Seven classes share one sentence, so the
   * honest answer names all seven. A classifier that returned `unknown` here
   * would report a precision the record does not have — and `unknown` is a
   * real member of that family, so the wrong answer looks exactly like a right
   * one on a report.
   */
  it("refuses to guess between the seven classes that share one sentence", () => {
    const reading = classifyRefineRefundDescription("Refine refunded — the generation failed");
    expect(reading.kind).toBe("family");
    if (reading.kind !== "family") throw new Error("unreachable");
    expect([...reading.reasons].sort()).toEqual([...REFINE_REFUND_GENERIC_FAMILY].sort());
    expect(refineRefundReadingLabel(reading)).toContain("provider_account");
  });

  it("never buckets a sentence it does not recognise", () => {
    for (const stranger of [
      "Refine refunded — the weather was poor",
      "Mint package: Full back failed (refund)",
      "Refine corrected — the render dropped a filed fact (D-184): pink hair",
      "",
    ]) {
      expect(classifyRefineRefundDescription(stranger)).toEqual({ kind: "unclassified" });
    }
  });

  /**
   * A detailed sentence is matched on its prefix because its tail is the
   * throw's own message — one real production row is 118 characters of earring
   * description. Asserted with a tail nothing has ever written, so the arm is
   * about the MATCHING RULE rather than about a sentence already in the list.
   */
  it("matches a detailed sentence however long its tail", () => {
    const invented = `${refineRefundDescription("facts_missing", "without")} a hat, a scarf, and every other thing this render forgot`;
    expect(classifyRefineRefundDescription(invented)).toEqual({
      kind: "class",
      reason: "facts_missing",
    });
  });

  it("trims, because a ledger row is text and text collects whitespace", () => {
    expect(classifyRefineRefundDescription("  Refine refunded — the image came back damaged  "))
      .toEqual({ kind: "class", reason: "render_fault" });
  });
});
