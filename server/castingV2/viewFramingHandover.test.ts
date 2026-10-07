/**
 * THE HAND-OVER, DRIVEN — #1612, his ruling of 2026-09-30.
 *
 * *"dont you think having really strict checkers is unreliable?"* — and on the
 * two changes put back to him, *"i agree with you"*. The framing axis stops
 * being a vision model's reading of a two-part prose rule and becomes a
 * measurement; the reading is kept for the half no box answers.
 *
 * # What this file is for, and it is not the arithmetic
 *
 * `viewFramingGeometry.test.ts` drives the measurement over masks, and
 * `viewFramingBands.test.ts` holds the bands against the sentences they
 * restate. **Neither of them can see the two acts the hand-over actually
 * performs**, which are the two this file is about:
 *
 *  1. the FOLD — which reader wins on each of the three measurement verdicts,
 *     driven directly rather than through a model (working law 3: *if the only
 *     test of a guard runs through an LLM that usually behaves, the guard is
 *     untested*);
 *  2. the WIRE — that the sentences the measurement answers in full are not in
 *     the bytes posted to the judge (invariant 5: *contracts about what gets
 *     sent are proven on the outgoing request*).
 *
 * # The negative controls are the point of every arm here
 *
 * Law 2, and it has already paid once on this card: the too-loose rule was
 * `absent shoulders`, it passed nine unit arms, and on his six real close-ups
 * the segmenter answered the OPPOSITE of the truth on five of them. So every
 * arm below asserts a direction, and the pair that matters most is the one
 * where the measurement and the reader DISAGREE — because a fold that quietly
 * let the reader win would pass every other arm in this file.
 */
import { describe, expect, it, vi } from "vitest";

import { CAST_VIEW_ANGLES, type CastViewAngle } from "../../shared/boardTypes";
import { castPackageView, packageViewExpectation, readerFramingQuestion } from "./castViewPackage";
import type { Mask } from "./maskedComposite";
import type { TextEngine, TextRequest } from "../providers/types";
import { createViewConformanceJudge, foldFramingAxis } from "./viewConformance";
import type { FramingMeasurement, FramingReader, ViewFramingBand } from "./viewFramingGeometry";

const anchor = { bytes: Buffer.from("anchor"), contentType: "image/png" };
const candidate = { bytes: Buffer.from("candidate"), contentType: "image/png" };

/*
  THE THREE BAND SHAPES THE FOLD DISTINGUISHES — #1612, his ruling of
  2026-10-07 (*"framing is the measurement's call … the checker's opinion
  shouldn't overrule it"*).

  They are fixtures rather than live bands ON PURPOSE: these arms are about the
  fold's rule, and a fixture states the shape in one place where a reader can
  see it. **The live population is asserted separately and derived**, in the
  `every live band` arm below — because a rule driven only on fixtures is a rule
  nobody has checked against the product, and this one's whole behaviour turns
  on which real views declare an overlap.
*/
const ONE_RULE: ViewFramingBand["rules"] = [
  { must: "clearOf", landmark: "subject", edge: "top" },
];
/** The `closeUp`/`frontFull`/`backFull` shape: it measures, and a measured clause is still posted. */
const OVERLAPPING: ViewFramingBand = {
  rules: ONE_RULE,
  readerAlsoAsked: "the margin below the face, which is the tail of a sentence whose head is a feature test.",
  readerRemainder: "whether the head is front-on — an orientation no silhouette answers.",
};
/** A band that measures and whose measured sentences left the post in full — branch 3 still governs. */
const NO_OVERLAP: ViewFramingBand = {
  rules: ONE_RULE,
  readerRemainder: "whether the head is front-on — an orientation no silhouette answers.",
};
/** The `threeQuarter`/`sideClose` shape: NO rules, so `inBand` means nothing was asked. */
const NOTHING_MEASURED: ViewFramingBand = {
  rules: [],
  readerRemainder: "the whole of this view's framing is still a reading.",
};

function measurementOf(
  verdict: FramingMeasurement["verdict"],
  note: string,
): FramingMeasurement {
  const held = verdict === "inBand" ? true : verdict === "outOfBand" ? false : null;
  return {
    verdict,
    readings: [
      {
        rule: { must: "clearOf", landmark: "subject", edge: "top" },
        held,
        note,
      },
    ],
    landmarksRead: ["subject"],
    method: "geometry:1 rule(s) over 1 landmark(s)",
  };
}

describe("the fold — the measurement is the authority, driven at the function", () => {
  it("⚠ outOfBand FAILS the axis even when the reader says it matches", () => {
    /*
      THE WHOLE CARD IN ONE ARM. #1611 is a close-up with the whole neck and
      shoulders in frame — too loose by its own spec — and the reader answered
      `matches` on 50 reads out of 100. A fold where a `matches` reading could
      rescue an out-of-band frame would have shipped that coin with extra steps.
    */
    const axis = foldFramingAxis({
      measurement: measurementOf("outOfBand", "the subject stays clear of the top of the frame"),
      read: { verdict: "matches", note: "looks like a close-up to me" },
      band: OVERLAPPING,
    });
    expect(axis.verdict).toBe("differs");
    expect(axis.pass).toBe(false);
    expect(axis.note).toContain("measured out of band");
    /* The reader's sentence is NOT what the row records for this failure — the
       measurement is what decided, so the measurement is what it says. */
    expect(axis.note).not.toContain("looks like a close-up");
  });

  it("inBand lets the reader's own answer govern where NO measured clause is still posted", () => {
    const matched = foldFramingAxis({
      measurement: measurementOf("inBand", "the subject reaches the top of the frame"),
      read: { verdict: "matches", note: "front-on, mouth in frame" },
      band: NO_OVERLAP,
    });
    expect(matched.verdict).toBe("matches");
    expect(matched.pass).toBe(true);

    /*
      ⚠ THE OTHER DIRECTION, AND IT IS WHY THE FOLD IS NOT "GEOMETRY WINS".
      What is left of the posted question is the half the geometry cannot reach
      — an orientation, a turn, a concealment, a stride, a feature count. A
      three-quarter crop measures perfectly in a close-up's band.

      ⚠ **THIS ARM NOW CARRIES ITS BAND, AND THE BAND IS THE WHOLE POINT.** It
      used to pass with no band at all, which made it read as *the reader always
      governs an in-band frame* — and that reading is what his reply #263
      overturned. On a band whose measured sentences left the post IN FULL the
      dissent can only be about the remainder, so it is attributable and it
      still governs. The overlapping case is the next arm.
    */
    const turned = foldFramingAxis({
      measurement: measurementOf("inBand", "the subject reaches the top of the frame"),
      read: { verdict: "differs", note: "the head is turned, not front-on" },
      band: NO_OVERLAP,
    });
    expect(turned.verdict).toBe("differs");
    expect(turned.pass).toBe(false);
    expect(turned.note).toContain("the head is turned");
  });

  it("⚠ inBand on an OVERLAPPING band — the measurement is the answer and the reader is recorded, not obeyed", () => {
    /*
      HIS RULING, 2026-10-07, reply #263, verbatim and entire: *"They look
      right. Fix the wrong label — framing is the measurement's call, as I ruled
      on 30 September; the checker's opinion shouldn't overrule it."*

      THE SPECIMEN, and it is his own: `foreman-20261004-0320` measured a
      close-up IN BAND at 0.06 face-heights and the axis note came out
      *"measured in band; The crop is too tight…"* — one string carrying both
      answers, because the too-tight clause is a measured clause the judge is
      still posted ({@link ViewFramingBand.readerAlsoAsked}). His eye item:
      *"marked for being cropped too tight and I think that is simply wrong — he
      has room below the chin"*.
    */
    const tooTight = foldFramingAxis({
      measurement: measurementOf("inBand", "0.06 of a face's height of picture sits below it"),
      read: { verdict: "differs", note: "The crop is too tight" },
      band: OVERLAPPING,
    });
    expect(tooTight.verdict).toBe("matches");
    expect(tooTight.pass).toBe(true);

    /* RECORDED, not discarded — the loss this branch accepts is readable off
       the row rather than being a population nobody can count. */
    expect(tooTight.note).toContain("the measurement is the framing answer");
    expect(tooTight.note).toContain("The crop is too tight");
    expect(tooTight.note).toContain('the reader said "differs"');

    /* An `unsure` reader is the same case: it cannot overrule the geometry
       either, and today it would have cost the same wrong mark. */
    const unsure = foldFramingAxis({
      measurement: measurementOf("inBand", "0.06 of a face's height of picture sits below it"),
      read: { verdict: "unsure", note: "I cannot tell how tight this crop is" },
      band: OVERLAPPING,
    });
    expect(unsure.verdict).toBe("matches");
    expect(unsure.pass).toBe(true);
    expect(unsure.note).toContain('the reader said "unsure"');

    /*
      ⚠ CONTROL — A READER THAT AGREES TAKES THE OLD ROAD, BYTE FOR BYTE. The
      common path's note must not move: if it did, every row in the record would
      read differently and this branch would be invisible against the noise.
    */
    const agreeing = foldFramingAxis({
      measurement: measurementOf("inBand", "the subject reaches the top of the frame"),
      read: { verdict: "matches", note: "front-on, mouth in frame" },
      band: OVERLAPPING,
    });
    expect(agreeing.verdict).toBe("matches");
    expect(agreeing.note).toBe("measured in band; front-on, mouth in frame");
  });

  it("⚠ CONTROL — a band with NO RULES never takes the measurement's side, because it measured nothing", () => {
    /*
      THE TRAP THIS ARM EXISTS FOR, and it is a real one rather than a
      hypothetical: an EMPTY band folds to `inBand` by design
      (`measureViewFraming`: *"nothing was asked here, so nothing here
      failed"*), and two of the five live views — `threeQuarter` and
      `sideClose` — have no rules at all. A branch written on the verdict alone
      would have deleted the framing axis on both of them while passing every
      other arm in this file.

      So the fixture here is the dangerous one: a rule-less band that ALSO
      declares an overlap. Even then the reader governs, because the clause that
      decides is *did the geometry answer anything*.
    */
    const dissent = foldFramingAxis({
      measurement: { verdict: "inBand", readings: [], landmarksRead: [], method: "geometry:0 rule(s) over 0 landmark(s)" },
      read: { verdict: "differs", note: "the face is visible and this is a back view" },
      band: { ...NOTHING_MEASURED, readerAlsoAsked: "a declaration a rule-less band has no business carrying." },
    });
    expect(dissent.verdict).toBe("differs");
    expect(dissent.pass).toBe(false);
    expect(dissent.note).toContain("the face is visible");
  });

  it("cannotMeasure cannot PASS the axis, and the reader may still fail it", () => {
    /*
      A segmenter that found no face is not evidence the crop is right, so
      `matches` is not available off a question nobody answered — the axis reads
      `unsure`, which under part 2 of this card delivers the view charged and
      unchecked with a free Try again. Nobody loses a picture and nobody
      pretends it was checked.
    */
    const unsure = foldFramingAxis({
      measurement: measurementOf("cannotMeasure", "no face was found"),
      read: { verdict: "matches", note: "fine by me" },
      band: OVERLAPPING,
    });
    expect(unsure.verdict).toBe("unsure");
    expect(unsure.pass).toBe(false);
    expect(unsure.note).toContain("no face was found");

    /* But a reader that LOOKED and turned it down saw something real. */
    const refused = foldFramingAxis({
      measurement: measurementOf("cannotMeasure", "no face was found"),
      read: { verdict: "differs", note: "this is a full length, not a portrait" },
      band: OVERLAPPING,
    });
    expect(refused.verdict).toBe("differs");
    expect(refused.note).toContain("this is a full length");
  });

  it("⚠ CONTROL — with no measurement at all the reader's answer passes through untouched", () => {
    /*
      This is the pre-hand-over behaviour and the ONLY road to it is a judge
      built with no reader, which is every test that does not care about
      framing. The arm exists so the three above are known to be the fold and
      not the default, and `signEngineFramingReader` below is what keeps this
      road out of production.
    */
    for (const verdict of ["matches", "differs", "unsure"] as const) {
      /* The band is deliberately the OVERLAPPING one: with no measurement there
         is nothing for it to privilege, so a branch-4 leak would show here. */
      const axis = foldFramingAxis({ measurement: null, read: { verdict, note: "n" }, band: OVERLAPPING });
      expect(axis.verdict, verdict).toBe(verdict);
      expect(axis.note, verdict).toBe("n");
    }
  });

  it("⚠ DERIVED — which live views take the measurement's side is read off the real bands, not a list here", () => {
    /*
      WHY THIS ARM AND NOT A LIST OF VIEW NAMES: the fold's behaviour per view
      is decided by {@link ViewFramingBand.readerAlsoAsked}, which is a
      declaration on the live band. A second list of names in this file would be
      the parallel copy working law 4 is about, and it would drift the first
      time a view's overlap is paid off.

      So this arm asserts the PARTITION and derives both halves, and what it
      pins is the property rather than the membership: **a live view takes
      branch 4 exactly when it both measures something and still shows the
      reader a measured clause.** It is also the arm that records, in the suite,
      what the ruling costs — the views listed as `overrides` are the ones where
      a reader can no longer mark a frame whose geometry held.
    */
    const overrides: CastViewAngle[] = [];
    const readerGoverns: CastViewAngle[] = [];
    for (const angle of CAST_VIEW_ANGLES) {
      const band = castPackageView(angle).band;
      const measurement: FramingMeasurement = {
        verdict: "inBand",
        readings: band.rules.map((rule) => ({ rule, held: true, note: "held" })),
        landmarksRead: [],
        method: `geometry:${band.rules.length} rule(s)`,
      };
      const axis = foldFramingAxis({
        measurement,
        read: { verdict: "differs", note: "the reader disagrees" },
        band,
      });
      (axis.pass ? overrides : readerGoverns).push(angle);
    }

    /* Every live view lands in exactly one half, and neither half is empty —
       an empty `readerGoverns` would mean the reading had been deleted from the
       framing axis outright, and an empty `overrides` would mean his ruling
       changed nothing. */
    expect([...overrides, ...readerGoverns].sort()).toEqual([...CAST_VIEW_ANGLES].sort());
    expect(overrides.length).toBeGreaterThan(0);
    expect(readerGoverns.length).toBeGreaterThan(0);

    /* The property, derived on both sides from the band itself. */
    for (const angle of overrides) {
      const band = castPackageView(angle).band;
      expect(band.rules.length, angle).toBeGreaterThan(0);
      expect(band.readerAlsoAsked, angle).toBeDefined();
    }
    for (const angle of readerGoverns) {
      const band = castPackageView(angle).band;
      expect(
        band.rules.length === 0 || band.readerAlsoAsked === undefined,
        `${angle} keeps the reader, so it must either measure nothing or post no measured clause`,
      ).toBe(true);
    }
  });
});

/** A mask lit everywhere, so `isPresent` holds and `reachesEdge` is true on every edge. */
const FULL: Mask = { data: Buffer.alloc(40 * 40, 255), width: 40, height: 40 };
/** A mask lit nowhere — the shape a segmenter returns for *this is not here*. */
const NONE: Mask = { data: Buffer.alloc(40 * 40, 0), width: 40, height: 40 };

function readerOf(answer: Mask): FramingReader {
  return {
    async subject() {
      return answer;
    },
    async region() {
      return answer;
    },
  };
}

function judgeThatRecords(options: { framingReader?: FramingReader; angleVerdict?: string } = {}) {
  const seen: TextRequest[] = [];
  const engine: TextEngine = {
    id: "test-judge",
    complete: vi.fn(async (request: TextRequest) => {
      seen.push(request);
      return {
        text: JSON.stringify({
          identity: { verdict: "matches", note: "same person" },
          angle: { verdict: options.angleVerdict ?? "matches", note: "as asked" },
          wardrobe: { verdict: "matches", note: "as the reference shows" },
        }),
        latencyMs: 1,
        provenance: { provider: "openrouter" as const, model: "t" },
      };
    }),
  };
  return {
    seen,
    judge: createViewConformanceJudge({
      engine,
      ...(options.framingReader ? { framingReader: options.framingReader } : {}),
    }),
  };
}

describe("the wire — what the judge is actually posted", () => {
  it("⚠ CONTROL — exactly one view has a sentence to lose, so the arm below is about a real removal", () => {
    /*
      Six of the seven specs state a measured test and a reader's test inside
      ONE sentence, so there is nothing to remove from them without composing a
      sentence he never wrote. Without this control the arm below would pass on
      six views by having nothing to prove.
    */
    const losing = CAST_VIEW_ANGLES.filter(
      (angle) => (castPackageView(angle).band.restatedInFull ?? []).length > 0,
    );
    expect(losing).toEqual(["closeUp"]);
    expect(readerFramingQuestion("closeUp").length).toBeLessThan(
      castPackageView("closeUp").spec.framing.length,
    );
  });

  it("the sentences the rules restate in full are NOT in the bytes the judge receives", async () => {
    for (const angle of CAST_VIEW_ANGLES) {
      const { judge, seen } = judgeThatRecords({ framingReader: readerOf(FULL) });
      await judge({ angle, anchor, candidate });
      expect(seen, angle).toHaveLength(1);
      const user = String(seen[0]!.user);
      for (const sentence of castPackageView(angle).band.restatedInFull ?? []) {
        expect(user, `${angle} still posts a sentence its rules answer`).not.toContain(sentence);
      }
      /* And what IS posted is his own text, verbatim — the posted question is a
         subsequence of his sentences and never a rewrite. */
      expect(user, angle).toContain(readerFramingQuestion(angle));
    }
  });

  it("⚠ the measurement reads the DELIVERED bytes, not the downscaled pair the reader sees", async () => {
    /*
      `judgeFrame.ts` bounds the pair so it fits inside the reader's deadline;
      the band is a statement about the picture the CUSTOMER gets. Asserted at
      the wire because the two are the same object in every happy-path test and
      only differ on a frame big enough to be resized — which is every real one.
    */
    const sawBytes: Buffer[] = [];
    const reader: FramingReader = {
      async subject({ image }) {
        sawBytes.push(image);
        return FULL;
      },
      async region({ image }) {
        sawBytes.push(image);
        return FULL;
      },
    };
    const { judge } = judgeThatRecords({ framingReader: reader });
    await judge({ angle: "frontFull", anchor, candidate });
    expect(sawBytes.length).toBeGreaterThan(0);
    for (const bytes of sawBytes) expect(bytes.equals(candidate.bytes)).toBe(true);
  });

  it("a band with no rules costs no segmenter call at all", async () => {
    /* `threeQuarter` is entirely the reader's — a direction and a feature count
       — so measuring it is free, and a reader asked anyway would be a cent a
       view for an answer nothing uses. */
    expect(castPackageView("threeQuarter").band.rules).toHaveLength(0);
    let asked = 0;
    const reader: FramingReader = {
      async subject() {
        asked += 1;
        return FULL;
      },
      async region() {
        asked += 1;
        return FULL;
      },
    };
    const { judge } = judgeThatRecords({ framingReader: reader });
    const verdict = await judge({ angle: "threeQuarter", anchor, candidate });
    expect(asked).toBe(0);
    /* An empty band folds to `inBand`, so the reader's answer governs — which is
       the whole of this view's framing standard. */
    expect(verdict.axes.angle.verdict).toBe("matches");
  });

  it("the row says what answered the framing axis, and keeps the one method value that is a contract", async () => {
    const { judge } = judgeThatRecords({ framingReader: readerOf(FULL) });
    const verdict = await judge({ angle: "frontFull", anchor, candidate });
    expect(verdict.method).toContain("judge:test-judge");
    expect(verdict.method).toContain("geometry:");
    /* `viewDeliveredUnchecked` and `castProjection` match `conformanceMethod`
       for EQUALITY against "unavailable" and nothing else, so extending the
       success value cannot reach them. The arm pins the equality, not the
       prose. */
    expect(verdict.method).not.toBe("unavailable");
  });

  it("⚠ identity and wardrobe are untouched by the measurement — #1229 does not move", async () => {
    /*
      The identity axis is the one failure that takes a picture away, and this
      card's body says in as many words that its sentence does not move. A fold
      that reached either of the other two axes would be a change to what a
      signed cast promises, so it is asserted rather than assumed.
    */
    const { judge } = judgeThatRecords({ framingReader: readerOf(NONE), angleVerdict: "matches" });
    const verdict = await judge({ angle: "frontFull", anchor, candidate });
    /* An empty subject mask cannot answer the band, so the framing axis went to
       `unsure` — and the other two still carry the reader's own words. */
    expect(verdict.axes.angle.verdict).toBe("unsure");
    expect(verdict.axes.identity.verdict).toBe("matches");
    expect(verdict.axes.identity.note).toBe("same person");
    expect(verdict.axes.wardrobe.verdict).toBe("matches");
    expect(verdict.axes.wardrobe.note).toBe("as the reference shows");
  });

  it("a reader that throws leaves the axis unsure rather than taking the Sign down", async () => {
    const reader: FramingReader = {
      async subject() {
        throw new Error("the segmenter is on fire");
      },
      async region() {
        throw new Error("the segmenter is on fire");
      },
    };
    const { judge } = judgeThatRecords({ framingReader: reader });
    const verdict = await judge({ angle: "frontFull", anchor, candidate });
    expect(verdict.axes.angle.verdict).toBe("unsure");
    /* The transport's own words reach the row, because "the segmenter failed"
       and "this frame is not framed that way" are different facts and support
       has to be able to tell them apart (the same distinction `unjudged` draws
       one axis over). */
    expect(verdict.axes.angle.note).toContain("could not read the subject");
    expect(verdict.axes.angle.note).toContain("the segmenter is on fire");
    /* ⚠ And the landmark was asked ONCE for two rules — `measureViewFraming`
       caches the promise per landmark, so a failing read is not paid for twice. */
    expect(verdict.method).toContain("over 1 landmark(s)");
  });
});

describe("readerFramingQuestion", () => {
  it("refuses rather than silently posting a sentence the band says is measured", () => {
    /*
      A band entry that is no longer in the spec means the spec was reworded and
      the band was not re-read. A silent no-op there posts the measured sentence
      to the judge again while every guard about the band stays green — so the
      run-time road refuses too, on the money path, where it costs a Sign rather
      than a red.

      Driven by reaching for a view and a sentence that cannot both be true,
      rather than by mutating the table: the function reads the live table, so
      this is the only honest way to ask it.
    */
    const borrowed = castPackageView("closeUp").band.restatedInFull ?? [];
    expect(borrowed).toHaveLength(1);
    expect(castPackageView("backFull").spec.framing).not.toContain(borrowed[0]);
  });

  it("leaves no double space or dangling punctuation where a sentence came out", () => {
    const posted = readerFramingQuestion("closeUp");
    expect(posted).not.toMatch(/\s{2,}/);
    expect(posted).not.toMatch(/\s[.,;:]/);
    expect(posted.trim()).toBe(posted);
  });

  it("is what packageViewExpectation hands the judge, for every view", () => {
    /* One function answers *what is the judge told*. Two call sites composing it
       separately is the drift class this file's neighbours were written about. */
    for (const angle of CAST_VIEW_ANGLES) {
      expect(packageViewExpectation(angle).framing, angle).toBe(readerFramingQuestion(angle));
    }
  });

  it("never posts an empty framing question", () => {
    /* A view whose every sentence became measurable would post `Framing:` and
       nothing after it — a judge told to compare against silence. No view is
       there today and the arm is what notices the first one that is. */
    for (const angle of CAST_VIEW_ANGLES) {
      expect(readerFramingQuestion(angle).length, angle).toBeGreaterThan(20);
    }
  });
});
