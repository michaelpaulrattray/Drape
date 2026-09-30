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
 * # And the population is derived, never typed
 *
 * The views are read from the package's own table. A view added tomorrow with
 * no band is a type error; a view added with a band and no entry here is a red
 * from `every view's band is accounted for`, which is the arm that stops this
 * file quietly covering six of seven.
 */
import { describe, expect, it } from "vitest";

import { CAST_VIEW_ANGLES, type CastViewAngle } from "../../shared/boardTypes";
import { castPackageView } from "./castViewPackage";
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
