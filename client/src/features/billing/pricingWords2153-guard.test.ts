import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { readListedSource } from "../../../../server/testing/listedSource";
import { CONTENDED_TEST_TIMEOUT_MS } from "../../../../server/testing/contendedTestTimeout";
import { PLAN_BLURBS } from "../settings/planBlurbs";

/**
 * #2153 — Pricing Phase 2's final wording (Yuna and Quistis's table on the
 * Desk, approved by him 2026-10-09: *"pricing word card here ive approved the
 * code changes required too"*), on the plans page and the compare table.
 *
 * Each row below is one changed string from that table: the NEW wording must
 * be in the shipped source and the OLD wording must be gone from it, so a
 * revert of either half reddens. The rollover and cancel rows shipped in #2152
 * (#2157) and are pinned in `server/routes/moneyWording1940.test.ts`; they are
 * not repeated here.
 *
 * Read with comments stripped — a guard must never read the prose about the
 * rule it is checking (the comments above several constants quote the OLD
 * wording on purpose, as history).
 */

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const MODAL = join(__dirname, "ChangePlanModal.tsx");
const ADD_CREDITS = join(__dirname, "AddCreditsModal.tsx");

function code(path: string): string {
  const raw = readListedSource(path);
  expect(raw, `${path} could not be read — every arm below would be reading nothing`)
    .not.toBeNull();
  const text = (raw ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
  expect(text.length, `${path} read empty`).toBeGreaterThan(500);
  return text;
}

/** [table row, old wording, new wording] — the new is read verbatim from the Desk table. */
const MODAL_ROWS: Array<[string, string, string]> = [
  [
    "CPM:218 trust line",
    "Credits back if a result doesn't arrive.",
    "See the price before you make anything. Credits back if a generation fails.",
  ],
  [
    "CPM:230 what credits back covers",
    "Credits come back if a result fails, is blocked, or doesn't arrive.",
    "If a generation fails or is blocked, you get the credits back. ",
  ],
  [
    "CPM:230 what credits back covers (badly broken)",
    "Credits come back if a result fails",
    "If one comes out badly broken, we'll often refund it too. ",
  ],
  [
    "CPM:248 on every plan",
    "Casting studio · Boards · Wardrobe · Credit packs whenever you need them",
    "Casting studio · Credit packs whenever you need them",
  ],
  [
    "CPM:265 coming line",
    "We'll say when they land.",
    "The cinema studio: write the script, direct the takes, add voice, cut the film. The image and video generators, and the canvas. We'll say when each one lands.",
  ],
  [
    "CPM:280 enterprise band",
    "A pool built around your volume, invoiced, and arranged with us directly.",
    "A pool of credits sized to your volume, invoiced and arranged with us directly. Tell us what you're making and we'll price it.",
  ],
  [
    "CPM:893 enterprise mail subject",
    "credits` : null]",
    "credits left` : null]",
  ],
  [
    "CPM:1091 free reason line",
    "Your free credits arrived once when you signed up. A plan tops you up every month.",
    "Your starting credits arrived once, when you joined. A plan adds credits every month.",
  ],
  ["CPM:1167 annual badge", "{monthsFree()} MONTHS FREE", "{monthsFree()} MONTHS OFF"],
  [
    "CPM:1222 plan unreadable",
    "We could not read which plan you are on just now",
    "We couldn't load your plan just now. Close this and try again in a moment.",
  ],
  [
    "CPM:1957 finished character note",
    "A finished character is a roll to find her",
    "A finished character is one you've found, refined and locked, with the same five views on every plan.",
  ],
  ["CPM:1996 buy extra credits (Free column)", '"On a plan"', '"With a plan"'],
  ["CPM:2035 coming group heading", 'title: "Cinema"', 'title: "Films, images and video"'],
  [
    "CPM:2068 Free price cell",
    'plan.priceInCents === 0 ? "Free"',
    "read: (plan) => formatWholeDollars(priceOf(plan)),",
  ],
  ["CPM:2295 slider ceiling clause", "credits a month on its own", "credits a month with its"],
  [
    "CPM:2301 enterprise footnote",
    "Enterprise is arranged with us directly.</>",
    "Talk to us about Enterprise.</>",
  ],
];

const NEW_BLURBS: Record<string, string> = {
  starter: "For one creator making UGC videos with a handful of characters.",
  pro: "For a creator making videos every week with characters they keep.",
  studio: "For one marketer or producer making ads or a short film a month.",
  enterprise: "For studios and marketing teams making films and ads at volume.",
};

const SLIDER_HELP = "Slide for more credits each month. The price updates as you go.";

/** A gendered pronoun — the founder's 2026-10-09 rule: never gender anyone. */
const GENDERED = /\b(she|her|hers|he|him|his)\b/i;

describe("#2153 — the plans page and the compare table carry the approved wording", () => {
  it("every changed row is the new wording, and the old one is gone", () => {
    const modal = code(MODAL);
    for (const [row, before, after] of MODAL_ROWS) {
      expect(modal, `${row}: the approved wording is missing`).toContain(after);
      expect(modal, `${row}: the old wording is back`).not.toContain(before);
    }
  });

  it("the four who-lines are the approved ones, read off the real map", () => {
    for (const [id, line] of Object.entries(NEW_BLURBS)) {
      expect(PLAN_BLURBS[id], `${id}'s who-line is not the approved one`).toBe(line);
    }
  });

  it("⚠ the slider's helper line is drawn on the slider's card and nowhere else", () => {
    const modal = code(MODAL);
    expect(modal, "the helper's wording moved").toContain(
      `const SLIDER_HELP = "${SLIDER_HELP}";`,
    );
    /* Exactly two mentions: the declaration and the one place it is drawn. */
    expect(modal.split("SLIDER_HELP").length - 1, "the helper is drawn more than once, or not at all")
      .toBe(2);
    /* The one place is inside the `hasDial` branch, after the range input — a
       card without the slider must not carry a line about a slider. */
    const open = modal.indexOf("{hasDial ? (");
    expect(open, "the slider's branch is gone — re-read and re-anchor").toBeGreaterThan(-1);
    expect(modal.split("{hasDial ? (").length - 1, "the slider's branch anchor is not unique")
      .toBe(1);
    const close = modal.indexOf(") : null}", open);
    const branch = modal.slice(open, close);
    expect(branch, "the slider's branch has no range input — the slice is wrong").toContain(
      'type="range"',
    );
    expect(branch, "the helper line is not inside the slider's branch").toContain(
      '<span className="dp-plan__dialhint">{SLIDER_HELP}</span>',
    );
    expect(branch.indexOf("dp-plan__dialhint"), "the helper sits above the slider")
      .toBeGreaterThan(branch.indexOf('type="range"'));
  });

  it("⚠ the annual badge reads the same on both modals — one framing everywhere", () => {
    for (const path of [MODAL, ADD_CREDITS]) {
      const body = code(path);
      expect(body, `${path} lost the derived badge`).toContain("{monthsFree()} MONTHS OFF");
      expect(body, `${path} still says FREE on the badge`).not.toContain("MONTHS FREE");
    }
  });

  it("⚠ no new string genders anybody, and the reader can see one that does", () => {
    const fresh = [
      ...MODAL_ROWS.map(([, , after]) => after),
      ...Object.values(NEW_BLURBS),
      SLIDER_HELP,
    ];
    for (const line of fresh) {
      expect(line, `a gendered word in: ${line}`).not.toMatch(GENDERED);
    }
    /* WORKING LAW 2 — the old compare note this card replaced is the positive control. */
    expect("A finished character is a roll to find her, a refine to correct her").toMatch(
      GENDERED,
    );
  });
});
