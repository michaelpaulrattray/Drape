import { describe, expect, it } from "vitest";

import {
  CANDIDATE_FAILURE_CHIPS,
  CANDIDATE_FAILURE_KINDS,
  CANDIDATE_FAILURE_LINES,
  type CandidateFailureKind,
} from "@shared/candidateFailure";
import { ENGINE_AND_VENDOR_NAMES } from "@shared/engineVocabulary";

/**
 * A FAILED TILE SAYS WHAT HAPPENED, NEVER WHAT DID IT (#1551, approved on the
 * Notion desk 2026-09-30).
 *
 * The disappearing-technology law's narrow prohibition: **no engine name on a
 * path someone must walk to reach their picture — not the primary button, not a
 * loader, not an error, not a required step.** A refused candidate is exactly
 * that path, and until #1551 its chip said **Content filter** and **Engine
 * error**: our own components, named to a customer who cannot act on either.
 * Clause 6 — *when the machinery is visible, that is the defect* — and the
 * honest loader's rule (#55) is the line it draws: name what is HAPPENING to
 * their picture, never what is doing it.
 *
 * ⚠ **THIS IS A GUARD ON A CLASS, NOT A SNAPSHOT OF FIVE STRINGS.** The rewrite
 * was one commit; the class is every future failure kind, and a new kind's copy
 * is written by whoever adds the road, in the vocabulary they have in their head
 * at the time — which is the pipeline's. So the population is DERIVED from the
 * two maps over `CANDIDATE_FAILURE_KINDS` (working law 4: never a second list),
 * and a kind added to the union without a customer-facing sentence fails at
 * `pnpm check` before it ever reaches here, because both maps are
 * `Record<CandidateFailureKind, string>`.
 *
 * Its sibling is `client/src/features/castingV2/refundedPill.test.ts`, which
 * owns the other property of these same strings — that the REFUNDED pill and the
 * sentence beneath it never contradict each other about money. Neither suite
 * restates the other's rule.
 */

/**
 * The vocabulary, each entry with the reason it is refused rather than a bare
 * blocklist — because the next person to read a red needs to know what to write
 * INSTEAD, and "the word engine is banned" does not tell them.
 *
 * ⚠ Deliberately NOT here: "refused", "failed", "blocked", "safety". Those are
 * outcomes in anybody's words. The test is not "does this sound technical"; it
 * is "does this name a part of our machine, or a term of art the customer never
 * agreed to learn".
 */
const MACHINERY_WORDS: ReadonlyArray<{ readonly word: string; readonly why: string }> = [
  { word: "engine", why: "our word for the model behind the picture; the customer never chose one" },
  { word: "content filter", why: "a component of the provider's, named as though the customer knows it" },
  { word: "moderation", why: "the provider's term for the same door" },
  { word: "nsfw", why: "a classifier's label, not a sentence" },
  { word: "provider", why: "who we buy from is our homework (clause 1)" },
  { word: "transport", why: "the wire's name for itself" },
  { word: "rate limit", why: "our account's ceiling, which is not the customer's problem" },
  { word: "timeout", why: "an implementation detail of the wait" },
  { word: "prompt", why: "the pipeline's word for what they typed" },
  { word: "contact sheet", why: "a photographer's term of art, and working law 8 means the STYLIST's ontology rather than the darkroom's" },
  /*
    Engine NAMES. Clause 5 allows a picker to name models plainly, as a
    first-class feature; it never allows one on a failure. These are the engines
    the casting road actually runs today (`rollEngine.ts`, `signEngine.ts`,
    `falImages.ts`) plus the family it ran before, so the guard names the real
    population rather than a plausible one.

    ⚠ **THEY ARE IMPORTED SINCE #1560, NOT LISTED HERE.** That card found the
    same six words a second time — on the landing page's *Powered by Gemini*
    badge — and a second guard keeping its own copy is the mirror working law 4
    is about. The engine this product rolls on moved three times in September
    2026 (#1340, #1459, #1278 path E); the list has to move once, not twice.
    `shared/engineVocabulary.ts` holds them with the same `{ word, why }` shape,
    and they stay LAST so the positive control's expected order below is the
    order this reader still produces.
  */
  ...ENGINE_AND_VENDOR_NAMES,
];

/** The one reader, used by the arms AND by the positive control below. */
function machineryIn(text: string): ReadonlyArray<string> {
  const lower = text.toLowerCase();
  return MACHINERY_WORDS.filter(({ word }) => lower.includes(word)).map(({ word }) => word);
}

/** Every string a customer reads off a failed tile, derived from the maps. */
function customerFacingStrings(): ReadonlyArray<{
  kind: CandidateFailureKind;
  where: string;
  text: string;
}> {
  return CANDIDATE_FAILURE_KINDS.flatMap((kind) => [
    { kind, where: "chip", text: CANDIDATE_FAILURE_CHIPS[kind] },
    { kind, where: "line", text: CANDIDATE_FAILURE_LINES[kind] },
  ]);
}

describe("a failed candidate tile speaks in outcomes, not in machinery", () => {
  it("names no part of our machine and no engine, on any kind", () => {
    for (const { kind, where, text } of customerFacingStrings()) {
      const found = machineryIn(text);
      const why = found
        .map((word) => MACHINERY_WORDS.find((entry) => entry.word === word)?.why)
        .join("; ");
      expect(found, `${kind} ${where} = "${text}" — ${why}`).toEqual([]);
    }
  });

  it("CAN FAIL — the retired strings are flagged, each by the word that retired it", () => {
    /*
      THE POSITIVE CONTROL (working law 2: verify the instrument before believing
      its finding). An arm asserting an empty list passes on a reader that
      matches nothing at all — a typo in one entry, `.includes` against the
      un-lowercased text, an empty `MACHINERY_WORDS` — and every one of those
      reads as a clean sheet. So the reader is driven against the REAL strings
      this card retired, quoted from #1551's own evidence section, and each must
      be caught by the specific word that caught it.
    */
    expect(machineryIn("Content filter")).toEqual(["content filter"]);
    expect(machineryIn("Engine error")).toEqual(["engine"]);
    expect(machineryIn("Refused by the engine's content filter · refunded")).toEqual([
      "engine",
      "content filter",
    ]);
    expect(machineryIn("Engine error · refunded")).toEqual(["engine"]);
    expect(machineryIn("Came back as a contact sheet, not a portrait · refunded")).toEqual([
      "contact sheet",
    ]);
    // And an engine name, which no string here has ever carried — the arm that
    // would have caught it if one ever had.
    expect(machineryIn("Sunburst could not draw this")).toEqual(["sunburst"]);
  });

  it("does not fire on the outcome words the rewrite chose, which is the other half of the control", () => {
    /*
      A reader wrong toward NOISE is the error that gets written down as a fact
      (CLAUDE.md, on the un-wiring differ). A blocklist that caught "blocked" or
      "refused" would make every honest sentence unwritable and push the next
      author back toward the machinery for something that passes.
    */
    for (const honest of [
      "Blocked",
      "Blocked by a safety check · refunded",
      "Didn't finish",
      "Didn't finish on our side · refunded",
      "Came back as several faces, not one · refunded",
      "Didn't arrive · refunded",
      "Didn't start · not charged",
      "Not a portrait",
      "Not charged",
      "Cancelled · refunded",
    ]) {
      expect(machineryIn(honest), `"${honest}" must read as honest`).toEqual([]);
    }
  });

  it("reads every kind, so a new failure road cannot arrive unread", () => {
    /*
      The derived-population arm. `customerFacingStrings()` is what the first arm
      iterates, and a reader that silently returned nothing would make that arm
      vacuous — the shape the promoted-subject memory is about. Two strings per
      kind, no kind missing, nothing empty.
    */
    const seen = customerFacingStrings();
    expect(seen).toHaveLength(CANDIDATE_FAILURE_KINDS.length * 2);
    expect(CANDIDATE_FAILURE_KINDS.length).toBeGreaterThan(1);
    for (const { kind, where, text } of seen) {
      expect(text.trim(), `${kind} ${where} is empty`).not.toBe("");
    }
  });

  it("carries the approved words for the three kinds that were rewritten", () => {
    /*
      The guard above would pass on any wording free of machinery, including a
      worse one. These are what he approved on the Notion desk (#1551), so a
      later change is a deliberate edit against a named ruling rather than a
      drift — and the prototype frames on that page
      (`failure-chips-02-after-dark`, `failure-chips-03-after-light`) show
      exactly these.

      ⚠ The card number stays in THIS comment and out of the title above:
      `client/src/foundation/token-guard.test.ts` reads a `#` followed by four
      hex digits as a colour literal, strips comments, and `#1551` is valid hex.
      It caught this on the first preflight run, which is the guard working.
    */
    expect(CANDIDATE_FAILURE_CHIPS.content_filter).toBe("Blocked");
    expect(CANDIDATE_FAILURE_LINES.content_filter).toBe("Blocked by a safety check · refunded");
    expect(CANDIDATE_FAILURE_CHIPS.engine).toBe("Didn't finish");
    expect(CANDIDATE_FAILURE_LINES.engine).toBe("Didn't finish on our side · refunded");
    // Its chip was already plain; only its line named the darkroom.
    expect(CANDIDATE_FAILURE_CHIPS.render_fault).toBe("Not a portrait");
    expect(CANDIDATE_FAILURE_LINES.render_fault).toBe(
      "Came back as several faces, not one · refunded",
    );
    // Untouched by this card, and named so a sweep that moved them reddens here.
    expect(CANDIDATE_FAILURE_CHIPS.unpaid).toBe("Not charged");
    expect(CANDIDATE_FAILURE_LINES.unpaid).toBe("Didn't start · not charged");
    expect(CANDIDATE_FAILURE_CHIPS.unknown).toBe("Didn't arrive");
    expect(CANDIDATE_FAILURE_LINES.unknown).toBe("Didn't arrive · refunded");
  });
});
