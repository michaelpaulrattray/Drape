/**
 * THE POSSIBLY-FIXED READING, DRIVEN (#494).
 *
 * Two things are proven here and they are different in kind:
 *
 *   1. **THE RULE** — `isPossiblyDone` and `cardNumbersIn`, driven directly
 *      with no `gh` and no database, because working law 3 says a guard whose
 *      only test runs through something that usually behaves is untested.
 *   2. **THE SHAPE** — serialize/parse, whose only failure mode must be "nothing
 *      flagged": his ENTIRE Crew tab is one `crew.getState` call, so a throw in
 *      this projection is a blank page for the founder.
 *
 * ⚠ **AND THE ARMS THE CARD ITSELF ASKED FOR ARE THE POSITIVE CONTROLS**, in
 * his own words: *"a fixture PR body naming an open card must be reported; a
 * body naming it inside 'filed, not fixed' prose is STILL reported (the reader
 * flags for a re-read; it does not judge)."* Both are below and the second one
 * is the one that matters — an instrument that started reading prose would look
 * cleverer and would be the wrong instrument.
 */
import { describe, expect, it } from "vitest";

import {
  CITED_CARDS_CEILING,
  NO_POSSIBLY_DONE,
  QUEUE_POSSIBLY_DONE_CAP,
  cardNumbersIn,
  isCitingRatherThanFixing,
  isPossiblyDone,
  parsePossiblyDone,
  possiblyDoneSentence,
  qualifyingNamings,
  serializePossiblyDone,
} from "../shared/crewQueuePossiblyDone";

const FILED = Date.parse("2026-09-01T00:00:00Z");
const at = (iso: string) => Date.parse(iso);

describe("the rule — a merged PR named it, and nobody answered", () => {
  it("FLAGS a card a later PR named and nobody touched since", () => {
    expect(isPossiblyDone(FILED, at("2026-09-02T10:00:00Z"), [
      { pr: 500, mergedAt: at("2026-09-02T10:00:00Z") },
    ])).toBe(true);
  });

  it("⚠ FLAGS when the merge and the card's own timestamp are the SAME instant", () => {
    /*
      THE LOAD-BEARING ARM. GitHub stamps `updatedAt` when a merged PR's
      reference lands on the card, so the commonest true positive in this
      repository has the two within the same second. A strict `>` would drop
      exactly the cards this instrument exists to find, silently — which is why
      the rule is `mergedAt >= updatedAt` and why this arm exists to hold it
      there. Sabotage `>=` to `>` and only this arm reddens.
    */
    const same = at("2026-09-02T10:00:00Z");
    expect(isPossiblyDone(FILED, same, [{ pr: 500, mergedAt: same }])).toBe(true);
  });

  it("does NOT flag when somebody touched the card AFTER the PR merged", () => {
    /* A comment, a label, an edit — any of them is a person having looked at
       the card in light of that work, which is the whole discriminator. */
    expect(isPossiblyDone(FILED, at("2026-09-02T11:00:00Z"), [
      { pr: 500, mergedAt: at("2026-09-02T10:00:00Z") },
    ])).toBe(false);
  });

  it("does NOT flag on a PR that merged BEFORE the card was filed", () => {
    expect(isPossiblyDone(FILED, FILED, [
      { pr: 400, mergedAt: at("2026-08-30T10:00:00Z") },
    ])).toBe(false);
  });

  /*
    ⚠ THE TWO ARMS BELOW EXIST BECAUSE THE ONE ABOVE PASSED FOR THE WRONG
    REASON, and the sabotage driver is what found it.

    Deleting the *"merged after the card was filed"* guard outright broke
    NOTHING: in that fixture `updatedAt` equals `filedAt`, so the untouched-since
    comparison rejected the old pull request all by itself. One arm, two guards,
    and no way to tell which was working — `fixture-family-shares-a-property`
    exactly. These two isolate the first guard by choosing fixtures the second
    one cannot reject.
  */
  it("⚠ an OLD pull request does not flag even when the card's updates are unreadable", () => {
    /* With `updatedAt` unreadable the untouched-since branch returns true for
       anything, so ONLY the merged-after-filing guard can reject here. Delete
       that guard and this arm is the one that reddens. */
    expect(isPossiblyDone(FILED, Number.NaN, [
      { pr: 400, mergedAt: at("2026-08-30T10:00:00Z") },
    ])).toBe(false);
  });

  it("⚠ a pull request merged in the same instant the card was FILED does not flag", () => {
    /* The tie. `mergedAt === filedAt === updatedAt` satisfies the untouched-since
       comparison, so again only the first guard rejects. A card filed and a PR
       merged in the same second is not that PR's subject. */
    expect(isPossiblyDone(FILED, FILED, [{ pr: 400, mergedAt: FILED }])).toBe(false);
  });

  it("does NOT flag a card no merged PR names at all", () => {
    /*
      ⚠ THE INSTRUMENT'S OWN STATED LIMIT, PINNED. Two of the five cards the
      2 September triage found already fixed — #57 and #59 — are named by no
      merged pull request in this repository's whole history. This reading is a
      FLOOR, and an empty flag list means "this reading found nothing", never
      "nothing is stale".
    */
    expect(isPossiblyDone(FILED, FILED, [])).toBe(false);
  });

  it("takes ANY one qualifying PR out of several that do not qualify", () => {
    expect(isPossiblyDone(FILED, at("2026-09-03T00:00:00Z"), [
      { pr: 400, mergedAt: at("2026-08-30T10:00:00Z") },
      { pr: 410, mergedAt: at("2026-09-02T00:00:00Z") },
      { pr: 500, mergedAt: at("2026-09-04T00:00:00Z") },
    ])).toBe(true);
  });

  it("a naming with no readable merge date is skipped", () => {
    expect(isPossiblyDone(FILED, Number.NaN, [{ pr: 500, mergedAt: Number.NaN }])).toBe(false);
  });

  it("⚠ an unreadable FILING date never flags — the precondition cannot be established", () => {
    /*
      The two unreadable-timestamp cases are NOT the same question, and this
      pair of arms is what forced the distinction to be written down: the code
      and its own docblock disagreed until they were driven. Without a filing
      date there is no way to know the pull request came after the card, so
      there is no finding to make — only a guess.
    */
    expect(isPossiblyDone(Number.NaN, FILED, [{ pr: 500, mergedAt: at("2026-09-02T00:00:00Z") }])).toBe(false);
  });

  it("⚠ an unreadable UPDATED date still flags — only the discriminator is missing", () => {
    /* Here the precondition holds: the card was filed and a PR named it
       afterwards. All that is unknown is whether anybody looked since. Failing
       quiet would drop a real finding to save a shift a thirty-second re-read. */
    expect(isPossiblyDone(FILED, Number.NaN, [{ pr: 500, mergedAt: at("2026-09-02T00:00:00Z") }])).toBe(true);
  });
});

describe("the flag and its receipt come from ONE predicate (PR #498, finding 1)", () => {
  /*
    ⚠ THE LOG LINE A SHIFT ACTS ON IS THE ONE THIS PROTECTS. The writer built
    its *"named by merged PR #488"* receipt with its own inline copy of the
    rule's two comparisons — working law 4's second list, one line from its
    source. Drift it and a card still flags while the receipt empties, so the
    3am log reads "#486 may already be done — named by merged PR " and the
    shift has nothing to open.
  */
  const NAMINGS = [
    { pr: 400, mergedAt: at("2026-08-30T10:00:00Z") },   // before the card was filed
    { pr: 488, mergedAt: at("2026-09-02T10:00:00Z") },   // qualifies
    { pr: 490, mergedAt: at("2026-09-03T10:00:00Z") },   // qualifies
  ];

  it("a flagged card ALWAYS has a non-empty receipt", () => {
    expect(isPossiblyDone(FILED, at("2026-09-02T10:00:00Z"), NAMINGS)).toBe(true);
    expect(qualifyingNamings(FILED, at("2026-09-02T10:00:00Z"), NAMINGS).length).toBeGreaterThan(0);
  });

  it("the receipt names ONLY the pull requests that satisfied the rule", () => {
    /* #400 merged before the card existed and is not the reason for anything.
       #8 on the live queue is mentioned by ten PRs and answered by none. */
    expect(qualifyingNamings(FILED, at("2026-09-02T10:00:00Z"), NAMINGS).map((n) => n.pr))
      .toEqual([488, 490]);
  });

  it("an unflagged card has an EMPTY receipt — the two answers cannot disagree", () => {
    const touched = at("2026-09-04T00:00:00Z");
    expect(isPossiblyDone(FILED, touched, NAMINGS)).toBe(false);
    expect(qualifyingNamings(FILED, touched, NAMINGS)).toEqual([]);
  });
});

describe("a pull request that CITES cards is not evidence about any of them (#514)", () => {
  /*
    THE INSTRUMENT'S OWN PULL REQUEST WAS ITS LOUDEST FALSE SIGNAL. PR #498
    built this flag and cited sixteen cards while arguing about the reading;
    all sixteen turned *possibly fixed* on his panel the hour it merged.

    ⚠ These arms drive the RULE. What the rule is worth was settled by driving
    it over the live queue instead — 92 open cards against 220 merged pull
    requests, 14 flags to 13, and the single flag it removes is `#532`, named by
    the Machinist patrol report that FILED it. A threshold with a passing unit
    test and no reading of the real queue would be a number chosen by feel with
    a green tick beside it.
  */
  it("POSITIVE CONTROL — an ordinary two-card PR is not citing, so both still flag", () => {
    expect(isCitingRatherThanFixing(cardNumbersIn("Closes #123. Also touches #45.", 500).length)).toBe(false);
  });

  it("PR #498's own shape — sixteen cards reads as citing", () => {
    const body = Array.from({ length: 16 }, (_, at) => `#${at + 100}`).join(", ");
    const cards = cardNumbersIn(body, 498);
    expect(cards).toHaveLength(16);
    expect(isCitingRatherThanFixing(cards.length)).toBe(true);
  });

  it("the boundary is exactly where the constant says, on both sides", () => {
    /*
      PINNED AT BOTH EDGES BECAUSE A `>` THAT DRIFTS TO `>=` IS SILENT: it would
      drop three more merged pull requests, and each of those three — #515, #347
      and #314, measured — genuinely FIXES the card in its title while citing
      seven others. Losing them costs real findings, and nothing would say so.
    */
    expect(isCitingRatherThanFixing(CITED_CARDS_CEILING)).toBe(false);
    expect(isCitingRatherThanFixing(CITED_CARDS_CEILING + 1)).toBe(true);
  });

  it("the ceiling stays inside the range the measurement supports", () => {
    /*
      A GUARD ON THE NUMBER ITSELF, not on the comparison. The distribution
      (p50 3, p75 4, p90 6, p95 8 over 220 merged PRs) is what makes 8
      defensible; a later edit to 3 or to 40 would leave every arm above green
      while making the rule meaningless in one direction or the other.

      ⚠ THE LOWER BOUND IS 7, THE BOTTOM OF THE MEASURED-IDENTICAL BAND — NOT 6
      (PR #593 review). It read `>= 6` first, and 6 is the one nearby value this
      change's own driven reading CONDEMNS: on the live queue 7, 8 and 9 were
      identical, while 6 lost two genuine findings (#482 and #479). So an edit
      from 8 to 6 would have left every arm here green — the boundary arm is
      relative to the constant, the positive control uses two cards, the #498
      arm uses sixteen — while silently dropping real findings, which is exactly
      the drift this arm exists to catch. A guard whose range admits the value
      its own measurement rejects is not guarding that measurement.
    */
    expect(CITED_CARDS_CEILING).toBeGreaterThanOrEqual(7);
    expect(CITED_CARDS_CEILING).toBeLessThanOrEqual(10);
  });

  it("a PR naming nothing is not citing — the empty case is not the loud case", () => {
    expect(isCitingRatherThanFixing(0)).toBe(false);
  });
});

describe("the naming scan — his card's own positive controls", () => {
  it("reports a card named in an ordinary PR body", () => {
    expect(cardNumbersIn("Closes #123 and touches #45.", 500)).toEqual([123, 45]);
  });

  it("⚠ STILL reports a card named inside 'filed, not fixed' prose", () => {
    /*
      HIS BAR, VERBATIM: *"a body naming it inside 'filed, not fixed' prose is
      STILL reported (the reader flags for a re-read; it does not judge)."*
      Nothing here parses a sentence, and #376 — whose entire subject is PR
      bodies that explain they are not closing a card — is flagged by this rule
      on the live queue today. That is correct behaviour, not a defect.
    */
    expect(cardNumbersIn("Measured on the way past: #57 is filed, NOT fixed.", 500)).toEqual([57]);
  });

  it("reports a card named in a PR title", () => {
    expect(cardNumbersIn("#494: the switch count cannot see a fix that landed", 497)).toEqual([494]);
  });

  it("drops the pull request's own number", () => {
    expect(cardNumbersIn("This PR #500 closes #123.", 500)).toEqual([123]);
  });

  it("does not read a number that is not a card reference", () => {
    /* `#12x` is not card 12, `##12` is a heading, and `abc#12` is a fragment. */
    expect(cardNumbersIn("#12x ##12 abc#12", 0)).toEqual([]);
  });

  it("names each card once however often it appears", () => {
    expect(cardNumbersIn("#8 #8 #8 and again #8", 0)).toEqual([8]);
  });

  it("reads an empty or absent body as no cards, never as a throw", () => {
    expect(cardNumbersIn("", 1)).toEqual([]);
    expect(cardNumbersIn(undefined as unknown as string, 1)).toEqual([]);
  });
});

describe("the stored shape", () => {
  it("round-trips a reading", () => {
    expect(parsePossiblyDone(serializePossiblyDone([486, 462]))).toEqual({ count: 2, cards: [486, 462] });
  });

  it("⚠ keeps the COUNT when the card list is capped", () => {
    /*
      THE REASON THIS VALUE IS AN OBJECT AND NOT AN ARRAY. A category with more
      flagged cards than the cap must still say the true number — a capped array
      read as its own total would quietly under-report, and a number that got
      smaller for an invisible reason is the failure this whole panel exists to
      prevent.
    */
    const many = Array.from({ length: QUEUE_POSSIBLY_DONE_CAP + 7 }, (_, index) => index + 1);
    const reading = parsePossiblyDone(serializePossiblyDone(many));
    expect(reading.count).toBe(many.length);
    expect(reading.cards).toHaveLength(QUEUE_POSSIBLY_DONE_CAP);
  });

  it("dedupes at the write so the count never exceeds the cards it came from", () => {
    expect(parsePossiblyDone(serializePossiblyDone([8, 8, 8]))).toEqual({ count: 1, cards: [8] });
  });

  it("drops values that are not card numbers", () => {
    expect(parsePossiblyDone(serializePossiblyDone([0, -3, 1.5, Number.NaN, 42] as number[])))
      .toEqual({ count: 1, cards: [42] });
  });

  it("⚠ every malformed value reads as NOTHING FLAGGED rather than throwing", () => {
    /*
      His whole Crew tab is one `crew.getState` call — a throw here is a blank
      page for the founder, which is the failure the briefing parse arm already
      exists to prevent. The degraded state is the panel he has today.
    */
    for (const bad of [
      null, undefined, "", "   ", "not json", "[]", '{"n":"two"}', '{"n":-1}', '{"n":1.5}',
      '{"cards":[1]}', '["n",1]', "42", '{"n":0,"cards":[]}', '{"n":2,"cards":"486"}', '{"n":2}',
    ]) {
      expect(parsePossiblyDone(bad), `${String(bad)} should read as nothing flagged`).toEqual(NO_POSSIBLY_DONE);
    }
  });

  it("⚠ a count with no card LIST reads as nothing flagged, not as a nameless number", () => {
    /* The writer always writes the pair, so `n` without an array is corrupt.
       Reading it as "2 flagged, none of them nameable" would put a number on
       his panel with nothing behind it — and this panel's whole reason (#285)
       is that a number he cannot see behind is what failed him. Junk INSIDE a
       real list is a different case and is simply dropped: the shape held. */
    expect(parsePossiblyDone('{"n":2,"cards":"486"}')).toEqual(NO_POSSIBLY_DONE);
    expect(parsePossiblyDone('{"n":2,"cards":[0,-1]}')).toEqual({ count: 2, cards: [] });
  });

  it("⚠ RAISES a count that is smaller than the cards it carries", () => {
    /* The two are written in one statement and cannot legitimately disagree, so
       a pair that does is corrupt — and of the two repairs, showing him MORE
       flagged cards is the safe direction. Silently dropping named cards to
       satisfy a wrong number is how a count goes quiet. */
    expect(parsePossiblyDone('{"n":1,"cards":[486,462]}')).toEqual({ count: 2, cards: [486, 462] });
  });

  it("keeps a count LARGER than its cards — that is the capped case, not corruption", () => {
    expect(parsePossiblyDone('{"n":30,"cards":[486]}')).toEqual({ count: 30, cards: [486] });
  });
});

describe("the sentence the panel says", () => {
  it("is his card's own words", () => {
    expect(possiblyDoneSentence({ count: 2, cards: [486, 462] })).toBe("2 possibly fixed");
  });

  it("⚠ is NULL when nothing is flagged, so the ordinary row is unchanged", () => {
    /* `Process (12)` must look exactly as it does today — no comma, no dangling
       parenthesis, no trailing space. An empty string would draw all three. */
    expect(possiblyDoneSentence(NO_POSSIBLY_DONE)).toBeNull();
    expect(possiblyDoneSentence({ count: 0, cards: [] })).toBeNull();
  });

  it("says the count and not the sample, when the sample is capped", () => {
    expect(possiblyDoneSentence({ count: 30, cards: [486] })).toBe("30 possibly fixed");
  });
});
