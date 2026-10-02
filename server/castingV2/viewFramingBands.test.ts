/**
 * THE DECLARED BANDS, HELD AGAINST THE SENTENCES THEY RESTATE — #1612 part 1.
 *
 * # The risk this file exists for, named plainly
 *
 * Until the slice that hands the framing axis to the measurement, **one band is
 * stated twice**: once as the prose `spec.framing` the vision judge is asked,
 * and once as `band.rules`. That is a mirror, and working law 4 says a mirror
 * drifts. The scaffolding is legitimate — it is declared in both files, and the
 * act that resolves it is the DELETION of the prose question rather than a
 * promise — but a mirror standing for even one slice needs something holding
 * the two halves together, and that is this.
 *
 * So every rule names the clause of `spec.framing` it restates, and the clause
 * is read out of the spec at run time. Reword the sentence so a clause is gone
 * and this reddens, which is the moment somebody has to look at the band beside
 * it. When the prose framing question is deleted, this table goes with it and
 * one statement is left.
 *
 * # ⚠ AND IT COULD ONLY EVER FAIL ONE WAY — FOUND 2026-10-01, WHEN THE HAND-OVER
 * WAS PICKED UP
 *
 * Both directions above are about a rule: every RULE cites a clause, and every
 * CITED clause keeps its rule. **Neither of them can see a clause of the spec
 * that no rule ever cited** — and the hand-over's whole safety rests on exactly
 * that question, because it deletes the prose sentence and leaves the rules as
 * the framing axis's only answer. Measured at the four live specs the day it was
 * asked: **five clauses across four views are restated by nothing**, and one of
 * the four is `closeUp`, the only view whose band carries no `readerRemainder`
 * and therefore read as fully measured.
 *
 * The gap is declared on each band as `unrestated` and the arms below hold it:
 * each entry is still a substring of the live spec, the total only shrinks, and
 * a view cannot be read as hand-over-ready while it owes one. **This is the
 * class the repository keeps paying for — a guard wrong in the SILENT direction,
 * green while its subject was unproven** — and the cheap half of the repair is
 * that the arm now exists at all.
 *
 * ⚠ **AND THE LIST IS NOW EMPTY — 2026-10-02, the `frontClose` bound court.**
 * Four of the five were discharged into a reader's remainder (#1717) and the
 * fifth, *"a head-and-shoulders portrait"*, is restated by a measured rule whose
 * bound was read off 43 of his own production frames. **No view owes a clause,
 * which is what the hand-over was waiting for.** The arms do not retire with the
 * debt: every one of them is written about a list that may grow again, and the
 * next clause to arrive — a reworded spec, an eighth view — meets them.
 *
 * # And the population is derived, never typed
 *
 * The views are read from the package's own table. A view added tomorrow with
 * no band is a type error; a view added with a band and no entry here is a red
 * from `every view's band is accounted for`, which is the arm that stops this
 * file quietly covering six of seven.
 */
import { describe, expect, it } from "vitest";

import { CAST_VIEW_ANGLES, type CastViewAngle } from "../../shared/boardTypes";
import { castPackageView, readerFramingQuestion } from "./castViewPackage";
import { FRAMING_LANDMARKS, type FramingRule } from "./viewFramingGeometry";

/**
 * WHICH CLAUSE OF THE VIEW'S OWN SPEC EACH RULE RESTATES.
 *
 * Keyed by the rule written back as a string, so a rule that changes shape
 * loses its citation and reddens rather than silently keeping somebody else's.
 */
const CLAUSE_FOR: Record<CastViewAngle, Record<string, string>> = {
  closeUp: {
    "clearOf face bottom": "margin of skin visible BELOW that lower edge",
    "roomBelowAtMost face": "the neck and shoulders are in frame",
    "cutBy subject top": "the whole head fits with clear space above the hair",
  },
  frontClose: {
    "clearOf subject top": "the whole hair silhouette inside the frame with headroom above it",
    /* ROAD 1, paid 2026-10-02 by the `frontClose` bound court: the last of
       #1675's five, and the only one a box could honestly answer. The number and
       the two populations it was chosen between are on the band itself. */
    "roomBelowAtMost face": "a head-and-shoulders portrait",
  },
  threeQuarter: {},
  sideClose: {},
  frontFull: {
    "clearOf subject top": "nothing cropped at the top or bottom of the frame",
    "clearOf subject bottom": "nothing cropped at the top or bottom of the frame",
  },
  sideFull: {
    "clearOf subject top": "head to feet inside the frame",
    "clearOf subject bottom": "head to feet inside the frame",
  },
  backFull: {
    "clearOf subject top": "head to feet inside the frame",
    "clearOf subject bottom": "head to feet inside the frame",
  },
};

function keyOf(rule: FramingRule): string {
  return rule.must === "roomBelowAtMost"
    ? `roomBelowAtMost ${rule.landmark}`
    : `${rule.must} ${rule.landmark} ${rule.edge}`;
}

describe("every view declares a band, and the population is read from the table", () => {
  it("covers every angle the product has, with no entry this file invented", () => {
    expect(Object.keys(CLAUSE_FOR).sort()).toEqual([...CAST_VIEW_ANGLES].sort());
  });

  for (const angle of CAST_VIEW_ANGLES) {
    it(`${angle}: every rule cites a clause that is still in its own spec`, () => {
      const view = castPackageView(angle);
      const citations = CLAUSE_FOR[angle];
      for (const rule of view.band.rules) {
        const clause = citations[keyOf(rule)];
        expect(clause, `${angle} has a rule \`${keyOf(rule)}\` with no cited clause`).toBeTruthy();
        expect(
          view.spec.framing,
          `${angle}'s spec no longer says "${clause}" — re-read the band beside it`,
        ).toContain(clause!);
      }
    });

    it(`${angle}: every cited clause still has the rule that cites it`, () => {
      const written = new Set(castPackageView(angle).band.rules.map(keyOf));
      for (const key of Object.keys(CLAUSE_FOR[angle])) {
        expect(written, `${angle} cites ${key} and no longer declares it`).toContain(key);
      }
    });

    it(`${angle}: a band with nothing measurable says what a reader still answers`, () => {
      const band = castPackageView(angle).band;
      if (band.rules.length === 0) {
        /* An empty band folds to `inBand`, which is correct and is exactly why
           the remainder has to be written down: nothing was asked, so nothing
           failed, and the half a reader answers must not be hiding inside that
           pass. */
        expect(band.readerRemainder, `${angle} measures nothing and says nothing`).toBeTruthy();
      }
    });

    it(`${angle}: names only landmarks the measurement knows`, () => {
      for (const rule of castPackageView(angle).band.rules) {
        expect(FRAMING_LANDMARKS).toContain(rule.landmark);
      }
    });
  }
});

describe("the bands do not reach past what the spec asks", () => {
  /**
   * ⚠ THE FAILURE THIS ARM IS ABOUT IS THE TEMPTING ONE.
   *
   * `threeQuarter`'s directive says *"the entire hair silhouette stays inside
   * the frame"*, and adding that headroom rule to its band reads as obviously
   * safe — its two neighbours have it. It is not: the directive is what the
   * GENERATOR was asked for and the spec is the standard a delivered picture is
   * held to, and promoting one into the other refuses pictures for a rule
   * nobody wrote down. A band restates the spec or it restates nothing.
   */
  it("no rule cites a clause that is only in the directive", () => {
    for (const angle of CAST_VIEW_ANGLES) {
      const view = castPackageView(angle);
      for (const rule of view.band.rules) {
        const clause = CLAUSE_FOR[angle][keyOf(rule)]!;
        expect(
          view.spec.framing.includes(clause),
          `${angle}'s rule ${keyOf(rule)} is justified by the directive rather than the spec`,
        ).toBe(true);
      }
    }
  });

  /**
   * No band counts a feature. #1582 refused a three-eyed cast because a framing
   * sentence counted eyes; every landmark the vocabulary offers is a silhouette
   * or a region every cast has by construction, and a rule only ever asks where
   * it reaches or how much picture is below it. This arm holds the VOCABULARY
   * rather than today's bands, because a band cannot name what the vocabulary
   * does not contain and the vocabulary is where the mistake would be made.
   */
  it("the landmark vocabulary contains no countable human feature", () => {
    for (const countable of ["eyes", "eyebrows", "nose", "lips", "ear", "chin", "horns"]) {
      expect(FRAMING_LANDMARKS as readonly string[]).not.toContain(countable);
    }
  });

  /**
   * ⚠ AND NO BAND NAMES `shoulders` AGAIN — the rule this measurement started
   * with, and the one its first drive killed. `region("shoulders")` was wrong on
   * five of five of his close-ups and wrong in BOTH directions; the vocabulary
   * no longer offers it, and this arm is what says why to whoever reaches for it
   * next. The replacement is `roomBelowAtMost face`.
   */
  it("shoulders is not in the vocabulary, and the reason is on the record", () => {
    expect(FRAMING_LANDMARKS as readonly string[]).not.toContain("shoulders");
  });
});

describe("the two views that measure nothing say so, and why", () => {
  it("sideClose and threeQuarter are the whole of the reader's remainder today", () => {
    const unmeasured = CAST_VIEW_ANGLES.filter(
      (angle) => castPackageView(angle).band.rules.length === 0,
    );
    /* Named rather than derived-and-shrugged-at: if a third view ever measures
       nothing, that is a scope change somebody must state on a card, not a
       number this suite quietly follows. */
    expect([...unmeasured].sort()).toEqual(["sideClose", "threeQuarter"]);
  });
});

/**
 * ⚠ **THE HAND-OVER'S DEBT — what the measurement does NOT yet say that the
 * sentence it is replacing does (#1612, 2026-10-01).**
 *
 * The arms above pair rules with clauses; these pair the SPEC with everything
 * that accounts for it, which is the direction the hand-over turns on. A view is
 * ready to stop being asked its prose framing question when its rules plus its
 * `readerRemainder` say everything its spec says — i.e. when `unrestated` is
 * empty — and until then deleting that question deletes a stated test.
 *
 * Nothing here invents a taxonomy of what counts as a clause, which is the trap
 * the Atlas's price reader was left in for a day: each entry is a VERBATIM
 * substring of the view's own sentence, so the only judgement on the record is
 * *this clause is accounted for by nothing*, and a reworded spec makes the claim
 * red rather than stale.
 */
/**
 * ⚠ **THE DEBT AS A LIST OF CLAUSES, NOT AS A COUNT — and the first shape of
 * this arm WAS a count, which could not fail in the one direction that
 * matters.**
 *
 * A ceiling of five is satisfied by four, so emptying a band's `unrestated`
 * without restating the clause anywhere would have passed — which is precisely
 * the act this block exists to make impossible, since it is how the hand-over
 * deletes a stated framing test with nothing saying so. Named clauses can be
 * followed: each one below is either still owed, or **accounted for by
 * something the code states**.
 *
 * Read at the four live specs on 2026-10-01, when the hand-over was picked up.
 *
 * ⚠ **IT IS AT MODULE SCOPE BECAUSE IT IS THE RECORD, AND TWO BLOCKS NOW READ
 * IT** — the outstanding half below and road 2's ledger at the foot of the file.
 * A second copy beside the second reader is the mirror working law 4 is about,
 * on the one list whose whole job is to be the single account of what was owed.
 */
const OWED_AT_THE_HAND_OVER: ReadonlyArray<{ angle: CastViewAngle; clause: string }> = [
  /* An orientation and a feature-presence test, on the one view whose band
     carried no remainder and therefore read as fully measured. */
  { angle: "closeUp", clause: "front-on crop of the face" },
  { angle: "closeUp", clause: "The mouth, every eye the reference shows" },
  /* HOW MUCH OF HER IS IN THE PICTURE — the sharpest of the five: a full-length
     body with headroom satisfied this band's only rule. PAID 2026-10-02 by road
     1, a measured `roomBelowAtMost face` bound; it stays on this record because
     the record is what proves a later edit cannot drop the rule and the memory
     of the debt in one act. */
  { angle: "frontClose", clause: "a head-and-shoulders portrait" },
  /* Which way the body faces. Both are retired-or-live directions that two
     `clearOf subject` rules cannot tell apart. */
  { angle: "sideFull", clause: "seen from the side" },
  { angle: "backFull", clause: "seen from directly behind" },
];

describe("the hand-over's debt: clauses the measurement does not yet restate", () => {
  /**
   * THE THREE HONEST WAYS A DEBT IS DISCHARGED, read off the code rather than
   * trusted — the same three the band type names.
   *
   * `CLAUSE_FOR` is this file's own citation map, and leaning on it is not
   * circular: the arms above hold every citation in it to naming a rule the band
   * actually declares AND a clause the spec actually still contains, so claiming
   * a rule here cannot be done by typing one line.
   */
  function accountedFor(angle: CastViewAngle, clause: string): string | null {
    const view = castPackageView(angle);
    if (!view.spec.framing.includes(clause)) return "the spec no longer states it";
    if (Object.values(CLAUSE_FOR[angle]).includes(clause)) return "a rule restates it";
    if ((view.band.readerRemainder ?? "").includes(clause)) return "the remainder claims it";
    return null;
  }

  it("a clause only leaves the debt list when something accounts for it", () => {
    for (const { angle, clause } of OWED_AT_THE_HAND_OVER) {
      if ((castPackageView(angle).band.unrestated ?? []).includes(clause)) continue;
      expect(
        accountedFor(angle, clause),
        `${angle} stopped owing "${clause}" and nothing restates it: no rule cites it, the`
        + ` remainder does not name it, and the spec still asks for it. That is the hand-over`
        + ` deleting a stated framing test.`,
      ).not.toBeNull();
    }
  });

  it("a clause only joins the debt without a record if the record moves with it", () => {
    const recorded = new Set(OWED_AT_THE_HAND_OVER.map(({ angle, clause }) => `${angle} :: ${clause}`));
    for (const angle of CAST_VIEW_ANGLES) {
      for (const clause of castPackageView(angle).band.unrestated ?? []) {
        /* A new debt is a finding — a view that arrived owing something, or a spec
           that grew a clause nobody measured. Both are worth a red and a line
           here, which is the only place the next reader looks. */
        expect(
          recorded,
          `${angle} owes "${clause}" and it is not on the record: add it with what it is, or`
          + ` restate it`,
        ).toContain(`${angle} :: ${clause}`);
      }
    }
  });

  for (const angle of CAST_VIEW_ANGLES) {
    it(`${angle}: every clause it owes is still in its own spec, word for word`, () => {
      for (const clause of castPackageView(angle).band.unrestated ?? []) {
        expect(
          castPackageView(angle).spec.framing,
          `${angle} owes "${clause}" and its spec no longer says it — the debt is stale, not`
          + ` paid: re-read the band beside the sentence`,
        ).toContain(clause);
      }
    });

    it(`${angle}: a clause it owes is not also claimed by a rule or by the remainder`, () => {
      const view = castPackageView(angle);
      for (const clause of view.band.unrestated ?? []) {
        /* A clause cannot be both owed and paid. Claiming it in both places makes
           the discharge arm above pass for the wrong reason, which reads as
           progress. */
        expect(
          Object.values(CLAUSE_FOR[angle]),
          `${angle} owes "${clause}" and a rule also cites it — one of the two is wrong`,
        ).not.toContain(clause);
        expect(
          view.band.readerRemainder ?? "",
          `${angle} owes "${clause}" and its remainder names it too`,
        ).not.toContain(clause);
      }
    });
  }

  /**
   * ⚠ **THE SENTENCE THIS WHOLE BLOCK EXISTS TO MAKE UNSAYABLE.**
   *
   * `ViewFramingBand.readerRemainder` said *"a view with no remainder key is
   * fully measured"* until this slice, and `closeUp` — the only such view — owed
   * two clauses. The type's own documentation was the reading a hand-over would
   * have trusted, and it was wrong about the single view it described.
   *
   * So the population is NAMED here rather than derived and shrugged at, on the
   * same ground the arm at the foot of this file names the two unmeasured views:
   * a second band declaring no remainder is a claim that its spec is entirely
   * geometry, and that claim is a scope change somebody states on a card. What is
   * deliberately NOT pinned is that `closeUp` owes — that is the list above and it
   * is meant to reach zero; an arm asserting it would redden on the fix.
   *
   * ⚠ **AND IT WENT TO ZERO, WHICH THIS ARM ITSELF DID NOT SURVIVE — the
   * expectation read `["closeUp"]` and the fix for the defect above is precisely
   * to give `closeUp` a remainder.** The docblock one paragraph up warns against
   * writing an arm that reddens on the fix and then this arm did it, one field
   * over: it pinned the SYMPTOM's population rather than the claim. The claim is
   * what is kept — a band declaring no remainder asserts its spec is entirely
   * geometry — and with the list empty it is now stated the only way that cannot
   * rot: **no band makes that claim at all**, so the next one to make it is a
   * visible scope change rather than a number nudged from one to two.
   */
  it("no band claims its spec is entirely geometry", () => {
    const noRemainder = CAST_VIEW_ANGLES.filter(
      (angle) => castPackageView(angle).band.readerRemainder === undefined,
    );
    expect(
      [...noRemainder].sort(),
      "a band with no reader remainder asserts that every clause of its own framing spec is"
      + " answered by its rules. That is a scope change stated on a card, not a default —"
      + " `closeUp` made it silently and owed two clauses (#1612, the hand-over's debt).",
    ).toEqual([]);
  });
});

/**
 * ⚠ **ROAD 2's LEDGER — the discharges, held in both directions, which is the
 * guard road 2 never had (#1612, the hand-over's debt, 2026-10-01).**
 *
 * `CLAUSE_FOR` at the top of this file is road 1's citation map and it is held
 * both ways: every rule names a clause, and every named clause keeps its rule.
 * **Road 2 — a clause declared to be a reader's question forever — had no map at
 * all**, so a debt could be discharged by typing a sentence that does not
 * actually name the clause, or by naming a clause the spec no longer states. That
 * is the same one-way blindness `unrestated` was invented to close, one road over.
 *
 * Four of #1675's five clauses are discharged this way, and each is here with the
 * two readings that make the discharge real: the remainder NAMES it, and the spec
 * still ASKS it. A clause that stops being either is a red beside the band.
 *
 * ⚠ **Scope, stated rather than left to be inferred: this ledger is the discharges
 * of clauses that were on `OWED_AT_THE_HAND_OVER`, not an index of everything
 * every remainder mentions.** The five pre-existing remainders are prose written
 * before any of this existed; holding their every phrase to a verbatim spec
 * substring would mean rewording live judge-facing scope lines to suit a guard,
 * which is the tail wagging the dog. What this ledger guarantees is the thing the
 * hand-over turns on: **no clause left the debt list by a sentence that does not
 * name it.**
 */
describe("the hand-over's debt: the clauses discharged into a reader's remainder", () => {
  const DISCHARGED_INTO_REMAINDER: ReadonlyArray<{ angle: CastViewAngle; clause: string }> = [
    /* An orientation and a feature COUNT, on the view that carried no remainder
       at all. #1582 governs the count: a count refuses a being that does not have
       the feature, which is the specimen this card was filed about. */
    { angle: "closeUp", clause: "front-on crop of the face" },
    { angle: "closeUp", clause: "The mouth, every eye the reference shows" },
    /* Which way the body faces, on the two full-lengths that owed it. Two
       `clearOf subject` rules hold a body inside a frame and cannot tell a
       profile, a back and a front apart. */
    { angle: "sideFull", clause: "seen from the side" },
    { angle: "backFull", clause: "seen from directly behind" },
  ];

  for (const { angle, clause } of DISCHARGED_INTO_REMAINDER) {
    it(`${angle}: "${clause}" is named by the remainder that claims it`, () => {
      expect(
        castPackageView(angle).band.readerRemainder ?? "",
        `${angle} discharged "${clause}" into its reader remainder and the remainder does not`
        + ` say it. A discharge that does not name its clause is the clause going silent.`,
      ).toContain(clause);
    });

    it(`${angle}: "${clause}" is still something its own spec asks`, () => {
      expect(
        castPackageView(angle).spec.framing,
        `${angle}'s remainder claims "${clause}" and its spec no longer asks it — the`
        + ` discharge is stale, not paid: re-read the band beside the sentence.`,
      ).toContain(clause);
    });

    it(`${angle}: "${clause}" is not also claimed by a rule`, () => {
      expect(
        Object.values(CLAUSE_FOR[angle]),
        `${angle} left "${clause}" to the reader AND cites a rule for it — a clause is`
        + ` measured or it is read, never both, or the hand-over deletes a test twice over.`,
      ).not.toContain(clause);
    });
  }

  /**
   * THE LISTS ARE ONE FACT, and this is the arm that keeps them so: every clause
   * the record says was owed is now outstanding on its band, discharged into a
   * remainder above, or restated by a rule. A discharge with no debt behind it
   * means the record is wrong somewhere, and so does a debt that is none of the
   * three.
   *
   * ⚠ **IT KNEW TWO OF THE THREE ROADS AND WENT RED ON THE FIRST CLAUSE TO TAKE
   * THE THIRD — 2026-10-02, and the red was CORRECT both times over.** Road 1 —
   * a RULE restates the clause — is the road `frontClose`'s bound court paid its
   * debt by, and this arm had no reading for it: written when road 2 was the only
   * discharge anybody had used, it treated *"not outstanding and not in the
   * remainder ledger"* as *"vanished from the record"*. So it refused a payment
   * for being made in the one currency the band type names FIRST.
   *
   * **The repair is a derivation rather than a third list.** Road 1's discharge
   * is already stated, held in both directions, at the top of this file:
   * `CLAUSE_FOR` names the clause each rule restates, one arm holds every
   * citation to a clause the spec still contains, and another holds every cited
   * clause to still having its rule. A second list of road-1 discharges beside it
   * would be working law 4's own shape on the file whose whole job is to stop one
   * fact being written twice — and `accountedFor` in the block above was already
   * reading all three roads this way, so the two readings now agree instead of
   * one of them being a short list.
   */
  it("every clause that was owed is either discharged or still outstanding", () => {
    const discharged = new Set(
      DISCHARGED_INTO_REMAINDER.map(({ angle, clause }) => `${angle} :: ${clause}`),
    );
    for (const { angle, clause } of OWED_AT_THE_HAND_OVER) {
      const outstanding = (castPackageView(angle).band.unrestated ?? []).includes(clause);
      const restatedByARule = Object.values(CLAUSE_FOR[angle]).includes(clause);
      expect(
        outstanding || discharged.has(`${angle} :: ${clause}`) || restatedByARule,
        `${angle} owed "${clause}" and it is now none of the three: not on its band, not in`
        + ` the ledger above, and no rule cites it. A clause cannot leave the record by`
        + ` disappearing from it.`,
      ).toBe(true);
    }
  });

  /**
   * ⚠ **AND A CLAUSE IS PAID BY EXACTLY ONE ROAD — the arm the repair above
   * needs beside it, because widening an OR is how a guard stops failing.**
   *
   * The arm above now accepts three answers where it accepted two, and an
   * accepting arm earns a refusing one: a clause claimed by a rule AND a
   * remainder is a clause the hand-over would delete a test for twice, and a
   * clause both outstanding and restated is a debt list that has stopped being
   * read. The per-clause pairs for those two collisions already exist in the
   * block above; this says it once over the whole record, so a FOURTH road
   * invented later cannot quietly make the OR true for nothing.
   */
  it("a clause that was owed is paid by exactly one road, or by none yet", () => {
    for (const { angle, clause } of OWED_AT_THE_HAND_OVER) {
      const roads = [
        (castPackageView(angle).band.unrestated ?? []).includes(clause) && "still owed",
        Object.values(CLAUSE_FOR[angle]).includes(clause) && "a rule restates it",
        (castPackageView(angle).band.readerRemainder ?? "").includes(clause)
          && "the remainder claims it",
      ].filter((road): road is string => road !== false);
      expect(
        roads,
        `${angle}'s "${clause}" is accounted for ${roads.length} ways at once — a clause is`
        + ` measured, or read, or still owed, and never two of them.`,
      ).toHaveLength(1);
    }
  });

  it("a discharge is only recorded for a clause that was actually owed", () => {
    const owed = new Set(OWED_AT_THE_HAND_OVER.map(({ angle, clause }) => `${angle} :: ${clause}`));
    for (const { angle, clause } of DISCHARGED_INTO_REMAINDER) {
      expect(
        owed,
        `${angle} records a discharge of "${clause}" that was never on the debt list`,
      ).toContain(`${angle} :: ${clause}`);
    }
  });

  /**
   * ⚠ **WHICH VIEWS CAN STILL HAVE THEIR FRAMING AXIS HANDED OVER, AS ONE
   * READABLE FACT — and it is pinned because that is the question the next slice
   * opens with.**
   *
   * The hand-over is paid off per view: deleting a view's prose framing question
   * while it owes a clause deletes a stated test.
   *
   * ⚠ **NO VIEW OWES ONE — 2026-10-02, and this arm read `["frontClose"]` until
   * the debt it describes was paid.** That is the shape this file warns about two
   * blocks up (*"an arm asserting it would redden on the fix"*) and it is
   * deliberate here rather than an oversight: the docblock that wrote it said so
   * — *"paying this debt should force somebody to come here and say so"*. This is
   * somebody saying so.
   *
   * The clause was *"a head-and-shoulders portrait"*, the one debt of the five
   * that is real GEOMETRY and therefore the one road 2 would have been a lie
   * about. It is paid by a `roomBelowAtMost face` rule whose bound was measured
   * on 43 of his own production frames, in an empty band between two populations
   * that do not touch; **his eye closes the number** (law 9), and moving it means
   * coming to the band and reading the court.
   *
   * ⚠ **It was NOT ceremonial debt on a retired entry, which is the reading that
   * would have made it safe to ignore.** `frontClose` is absent from
   * `CAST_PACKAGE_VIEWS`, so no new Sign renders it — but `castProjection` builds
   * a historical Cast's slots from the package she BOUGHT, and `castSlotRetryOffer`
   * offers a Try again on one, which reaches `viewRetryService` and this spec. A
   * customer can still have a `frontClose` judged today.
   *
   * **The empty expectation is the stronger statement and is why it is kept
   * rather than deleted with the debt**: a view arriving with an unpaid clause —
   * a reworded spec, an eighth view — reddens here by name, and the list can
   * never silently grow back to one.
   */
  it("no view still owes, and the hand-over is paid off per view", () => {
    const owing = CAST_VIEW_ANGLES.filter(
      (angle) => (castPackageView(angle).band.unrestated ?? []).length > 0,
    );
    expect(
      [...owing].sort(),
      "a view whose prose framing question cannot be deleted yet. The list reached zero on"
      + " 2026-10-02 when `frontClose`'s \"a head-and-shoulders portrait\" was restated by a"
      + " measured bound; a view back on it owes a clause nothing measures.",
    ).toEqual([]);
  });
});

/**
 * ⚠ **WHAT THE JUDGE IS NO LONGER ASKED — the hand-over itself, and these arms
 * are the ONLY thing standing between a narrowing and a deletion (#1612).**
 *
 * The three arms at the top of this file pair a RULE with a clause. These pair
 * the POSTED QUESTION with the rules, which is a different question and is the
 * one the hand-over turns on: a sentence may leave the judge's post only when
 * the measurement answers it, and a measured clause that stays in the post must
 * be declared as such on the band.
 *
 * ⚠ **The direction that matters is the SILENT one, exactly as it was for
 * `unrestated`.** A sentence removed from the post with no rule answering it is
 * a stated framing test deleted, on a surface where the consequence is a
 * picture marked checked that nobody checked — and nothing above this block can
 * see it, because every arm up there starts from a rule and asks what it cites.
 */
describe("the narrowing — a sentence leaves the judge's post only when a rule answers it", () => {
  /** The clauses this view's rules restate, read off the citation table above. */
  const citationsOf = (angle: CastViewAngle): string[] =>
    castPackageView(angle).band.rules.map((rule) => CLAUSE_FOR[angle][keyOf(rule)]!);

  for (const angle of CAST_VIEW_ANGLES) {
    it(`${angle}: every sentence taken out of the post is still in the spec, verbatim`, () => {
      const view = castPackageView(angle);
      for (const sentence of view.band.restatedInFull ?? []) {
        expect(
          view.spec.framing,
          `${angle} says its rules restate a sentence its spec no longer contains — the spec was`
          + " reworded and the band was not re-read",
        ).toContain(sentence);
      }
    });

    it(`${angle}: every sentence taken out of the post is answered by a rule`, () => {
      /*
        THE LOAD-BEARING ARM. Without it a sentence could be listed, vanish from
        the judge's post, and be measured by nothing — which is #1675's defect
        pointed at the post instead of at the band, and with a worse consequence
        because the picture is already paid for.
      */
      const view = castPackageView(angle);
      const cited = citationsOf(angle);
      for (const sentence of view.band.restatedInFull ?? []) {
        const answering = cited.filter((clause) => sentence.includes(clause));
        expect(
          answering.length,
          `${angle} stops asking the judge "${sentence.slice(0, 48)}…" and no rule cites a clause`
          + " inside it",
        ).toBeGreaterThan(0);
      }
    });

    it(`${angle}: a measured clause the judge still sees is DECLARED, and one it cannot is not`, () => {
      /*
        The tie, in both directions, so the field can be neither silent nor
        decorative. A rule whose clause sits inside a sentence that is still
        posted is a clause answered twice — deterministically and by a reading
        that may disagree — and that costs a correct picture an `Unchecked` mark
        (part 2 means it costs nothing more than the mark). It is the whole
        remainder of the hand-over, so it is declared per view.
      */
      const view = castPackageView(angle);
      const removed = view.band.restatedInFull ?? [];
      const overlapping = citationsOf(angle).filter(
        (clause) => !removed.some((sentence) => sentence.includes(clause)),
      );
      if (overlapping.length > 0) {
        expect(
          view.band.readerAlsoAsked,
          `${angle} still posts the clause "${overlapping[0]!.slice(0, 48)}…" that one of its own`
          + " rules measures, and says nothing about it",
        ).toBeTruthy();
      } else {
        expect(
          view.band.readerAlsoAsked,
          `${angle} declares a reader overlap it does not have — the field would be decorative`,
        ).toBeUndefined();
      }
    });

    it(`${angle}: the posted question is a subsequence of his own sentences`, () => {
      /*
        ⚠ **THE ONE GUARANTEE A SHIFT MUST NOT BE ABLE TO BREAK.** The other road
        to this card's *"the prose framing spec stops being sent"* is to cut his
        sentences at their commas and post the halves — which composes a sentence
        he never wrote and stands it up as the standard a paid view is held to.
        #1582 measured three careful rewordings of ONE framing spec and each
        broke a correct picture. So the posted text is held to being his text:
        every sentence of it appears in the spec, in the same order, verbatim.
      */
      const spec = castPackageView(angle).spec.framing;
      const posted = readerFramingQuestion(angle);
      let at = 0;
      for (const sentence of posted.split(/(?<=\.)\s+/)) {
        const found = spec.indexOf(sentence, at);
        expect(
          found,
          `${angle} posts "${sentence.slice(0, 48)}…", which is not his sentence or is out of order`,
        ).toBeGreaterThanOrEqual(0);
        at = found + sentence.length;
      }
    });
  }

  it("⚠ CONTROL — the arms above are reading a real removal, on exactly one view", () => {
    /*
      Six of the seven specs state a measured test and a reader's test inside ONE
      sentence, so there is nothing to remove from them without recomposing.
      Without this control every arm above would pass on six views by having
      nothing to check, and the suite would read as coverage.
    */
    const narrowed = CAST_VIEW_ANGLES.filter(
      (angle) => (castPackageView(angle).band.restatedInFull ?? []).length > 0,
    );
    expect([...narrowed].sort()).toEqual(["closeUp"]);
    expect(readerFramingQuestion("closeUp")).not.toContain("TOO LOOSE");
    expect(castPackageView("closeUp").spec.framing).toContain("TOO LOOSE");
  });

  it("⚠ every view with a rule declares what the reader is still shown", () => {
    /*
      Stated as a population rather than per view, because the honest summary of
      this slice is a number: five of the seven views measure something and
      still show the reader a clause they measure. A view leaving that list is a
      real improvement and should have to come here and say so.
    */
    const declaring = CAST_VIEW_ANGLES.filter(
      (angle) => castPackageView(angle).band.readerAlsoAsked !== undefined,
    );
    expect([...declaring].sort()).toEqual(
      ["backFull", "closeUp", "frontClose", "frontFull", "sideFull"],
    );
  });
});
