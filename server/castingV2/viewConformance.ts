/**
 * View conformance — THE CATASTROPHIC CHECK, and nothing else (§I, D-92).
 *
 * ⚠ **THIS FILE USED TO HOLD THREE AXES OF OPINION — identity, framing and
 * wardrobe — AND HIS RULING OF 2026-10-07 TOOK TWO OF THEM AWAY (#1903),
 * verbatim and entire:**
 *
 * > *"i think we ditch the measure and checker i mean it been nothing but
 * > problems it should only detect catastropic failure the image engine is
 * > excellent and following our prompting"*
 *
 * **So what is left is three questions a picture can fail CATASTROPHICALLY, and
 * he approved the list by name:** it is not her; the picture is broken; there
 * is not exactly one person in it. **Everything else is delivered.** A view is
 * no longer refused, marked or second-guessed for its crop, its direction, its
 * pose, what it conceals or what it is wearing.
 *
 * **The whole framing MEASUREMENT went with the axis it served**, and that is
 * one act rather than two: `angle` was a fold of a segmenter measurement and a
 * vision model's reading of the half no box could answer, so deleting the
 * measurement alone would have handed the axis straight back to the model —
 * which is the coin #1612 was filed to remove. Both halves are gone together.
 *
 * **What survives from the original design, because his ruling narrows the
 * checker's SUBJECT and does not weaken its spine:**
 *
 *  - **INDEPENDENT axes.** Three catastrophes are three different events and one
 *    blended "looks right" score cannot say which happened. The M3 calibration
 *    is still the evidence that a single score hides a real failure
 *    (`CASTING_V2_M3_CALIBRATION_REPORT.md`, "Consequence for M7").
 *  - **Identity still fails CLOSED, byte for byte.** `differs` refuses and so
 *    does `unsure`, because *"I cannot tell whether this is the same person"* is
 *    not something to hand over under a signed likeness. His ruling did not
 *    touch that axis and neither does this change (#1229).
 *  - **The other two refuse only on `differs`, and that asymmetry is DECLARED
 *    rather than discovered.** His list is three things a picture IS; *"I cannot
 *    tell whether this picture is broken"* is not a detection of a broken
 *    picture, and refusing on it would re-import the over-refusal he has just
 *    removed. {@link AXIS_REFUSES_ON_UNSURE} is the one place that rule lives.
 *  - **A parse failure or a refusal is still not a pass.** It is `unjudged`,
 *    which under D-246 DELIVERS the picture rather than refusing it — the
 *    difference between *"we decided it was wrong"* and *"we could not tell"*.
 *  - a **forced-fail switch**, so the refusal path — refund slice, failed slot,
 *    the room's confession — can be walked end to end with real money on a real
 *    Cast, rather than only in a unit test where the money is imaginary.
 *
 * ⚠ **AND THE JUDGE NO LONGER SEES A SPECIFICATION AT ALL.** It used to be
 * handed `packageViewExpectation(angle)` — the framing sentence and the wardrobe
 * sentence — so that it judged the spec rather than the prompt. There is no
 * spec left to meet: a judge given one would volunteer an opinion about it, and
 * the opinion is the thing that went. It gets the two images and the three
 * questions, and `packageViewExpectation` has no caller left.
 *
 * Retryable transport failures are deliberately NOT converted into verdicts:
 * they are thrown, so the orchestrator's retry law (§H.5) handles a flaky judge
 * exactly as it handles a flaky generator. Only a judge that answered and was
 * not understood, or refused, becomes a fail-closed verdict.
 */
import { z } from "zod";

import type { CastViewAngle } from "../../shared/boardTypes";
import { createModuleLogger } from "../logging/logger";
import { ProviderError, type ReferenceImage, type TextEngine } from "../providers/types";
import { pronounsForSex, type CastPronouns } from "./castPronouns";
import { boundForJudge, readFrameIntegrity, type JudgedFrame } from "./judgeFrame";

const log = createModuleLogger("castingV2/viewConformance");

/**
 * THE THREE CATASTROPHES — his approved list, in the order he was shown it.
 *
 * Road words, never copy: a customer meets none of these names. `intact` is
 * *the picture rendered properly*; `people` is *there is exactly one person in
 * it* — nobody and a crowd are the same failure from the product's side, which
 * is why one axis answers both.
 */
export const CONFORMANCE_AXES = ["identity", "intact", "people"] as const;
export type ConformanceAxis = (typeof CONFORMANCE_AXES)[number];

/**
 * ⚠ **THE AXIS NAMES A LANDED ROW MAY STILL CARRY — AND THIS IS A MEASURED
 * REQUIREMENT, NOT A PRECAUTION.**
 *
 * {@link viewDeliveredUnchecked} reads the STORED record, and a row written
 * before this card carries `angle` and `wardrobe`. Read at production the hour
 * this change was written (60 rows carry a conformance record, all time):
 * **three landed rows carry a failing `angle` axis under a real judge method**
 * — assets 383, 389 and 391, delivered unchecked by #1612 part 2 after it
 * merged that morning — and three more carry all three axes false under
 * `unavailable`.
 *
 * So iterating only the CURRENT axis set would have stopped seeing those three
 * rows, and each of them is a view somebody paid for that is owed a free Try
 * again. **The retired names stay in the reader until the free Try again itself
 * is retired** (this card's slice 2), and they are deliberately absent from
 * {@link CONFORMANCE_AXES} so nothing can ever ASK the judge for them again.
 *
 * ⚠ The docblock on {@link viewDeliveredUnchecked} said *"0 landed rows carry a
 * failing axis today"* and was true the day it was written — #1612 part 2 had
 * not merged yet. It is the reason this was read rather than carried.
 */
const RETIRED_CONFORMANCE_AXES = ["angle", "wardrobe"] as const;

/** Every axis name a stored row may carry — current and retired, one list. */
const RECORDED_CONFORMANCE_AXES: readonly string[] = [
  ...CONFORMANCE_AXES,
  ...RETIRED_CONFORMANCE_AXES,
];

/**
 * ⚠ **WHICH AXES REFUSE ON *"I CANNOT TELL"* — the one place the asymmetry
 * lives, and the only judgement this change makes that his ruling did not.**
 *
 * **Identity: YES.** §I's fail-closed rule in full, unchanged since it was
 * written and reaffirmed by his #1612 ruling — a signed Cast's whole promise is
 * that the person is the person, so an unreadable answer there is not handed
 * over.
 *
 * **The other two: NO.** His list is three things a picture IS — *it is not
 * her*, *it is broken*, *it holds the wrong number of people*. A judge that
 * cannot tell whether a picture is broken has not detected a broken picture; it
 * has failed to answer. Refusing there would take a deliverable frame away on
 * an absence of evidence, which is precisely the over-refusal *"it been nothing
 * but problems"* is about.
 *
 * **Stated as the alternative that was declined** (the fidelity law's rule):
 * making all three fail closed would be simpler to read and strictly worse for
 * a customer, and a strict reading of "catastrophic only" is what rejects it.
 * Flagged on the pull request for the relay's eye rather than left as a silent
 * default.
 */
const AXIS_REFUSES_ON_UNSURE: Record<ConformanceAxis, boolean> = {
  identity: true,
  intact: false,
  people: false,
};

type AxisVerdict = {
  /**
   * DERIVED from `verdict`. Never written by the model, never read as the
   * source of truth — it is here so downstream readers keep their shape.
   */
  pass: boolean;
  /** One short sentence. Internal — persisted on the slot, never projected. */
  note: string;
  /**
   * The judge's actual answer, persisted beside the derivation.
   *
   * Absent on the fail-closed defaults, where no judge answered at all — which
   * is itself the distinction between "it said differs" and "we never got a
   * verdict", and support needs to be able to tell those apart.
   */
  verdict?: AxisVerdictWord;
};

/**
 * One place where a verdict becomes a pass, so there is one rule.
 *
 * ⚠ **IT TAKES THE AXIS NOW, AND THAT IS THE WHOLE OF #1903'S ASYMMETRY.**
 * `pass` means *this axis does not take the picture away* — which is how every
 * reader downstream already uses it ({@link viewConformanceRefuses}, the slot
 * marker, the receipt) — so the axis's own rule about `unsure` belongs here
 * rather than in a second reading somewhere else. {@link AXIS_REFUSES_ON_UNSURE}
 * carries the reasons.
 */
function axisFrom(
  axis: ConformanceAxis,
  answer: { verdict: AxisVerdictWord; note?: string },
): AxisVerdict {
  const refuses = answer.verdict === "differs"
    || (answer.verdict === "unsure" && AXIS_REFUSES_ON_UNSURE[axis]);
  return {
    pass: !refuses,
    note: answer.note ?? "",
    verdict: answer.verdict,
  };
}

export type ViewConformanceVerdict = {
  /** Every axis passed. A slot lands on this and nothing else. */
  pass: boolean;
  axes: Record<ConformanceAxis, AxisVerdict>;
  /** How the verdict was reached, so a pass is never read as an absolute. */
  method: string;
  /**
   * TRUE when this is a fail-closed default rather than a judgment — the judge
   * refused, or answered something we could not read. Recorded because "we
   * decided it was wrong" and "we could not tell" are different facts about a
   * slot the customer paid for, and the second is the one that needs an alarm.
   */
  unjudged?: boolean;
  /**
   * THE FRAMES THE JUDGE ACTUALLY READ — anchor first, then the candidate.
   *
   * #1408: the pair used to go out at full resolution as PNG, 12–13 MB of
   * base64, and above ~8–9 MB no answer came back inside the deadline — so 3 of
   * 27 production views were delivered unchecked and charged. They are bounded
   * now (`judgeFrame.ts`), and a row that records a verdict should be able to
   * say what was in front of the reader when it gave one.
   *
   * Absent on the fail-closed defaults that never reached a frame — a forced
   * failure, and any `unjudged` raised before the post.
   */
  frames?: readonly JudgedFrame[];
};

type ViewConformanceInput = {
  angle: CastViewAngle;
  /** The signed anchor — the face the customer chose. */
  anchor: ReferenceImage;
  /** The view that wants to land. */
  candidate: ReferenceImage;
  /*
    ⚠ `wardrobeLine` AND `description` WERE HERE AND ARE GONE — #1903.

    They existed for one reason: the judge was handed the generator's own
    wardrobe sentence, so that it could not fail a view for wearing exactly what
    the prompt asked for. **There is no wardrobe axis to protect any more**, and
    a judge handed an outfit sentence would start having opinions about the
    outfit — which is the thing his ruling removed. Both are still read by the
    GENERATOR at the same call sites; only the judge stopped being told.
  */
  /**
   * WHOSE FACE THIS IS — #1480 finding A, third site, on his own audit order
   * (*"ensure the checker isn't running on legacy rules"*).
   *
   * Absent keeps `they`, which is this product's answer for a person whose
   * pronouns are not known and is what every caller sent before it existed.
   */
  pronouns?: CastPronouns;
  signal?: AbortSignal;
};

export type ViewConformanceJudge = (input: ViewConformanceInput) => Promise<ViewConformanceVerdict>;

/**
 * The judge's answer per axis — ONE field, and `pass` is derived from it.
 *
 * The old shape asked for a boolean AND a sentence, which is two fields for one
 * fact and therefore two facts that can disagree. They did: a real side profile
 * came back `pass: false` beside the note *"overall it satisfies the 90-degree
 * side profile requirement"*. The customer was refunded 50 credits for a
 * correct view, and the record contained its own contradiction.
 *
 * That is the drift class every record-truth fix this month has killed, so it
 * is killed the same way — by removing the second field. The model chooses a
 * verdict; the note explains the verdict and has no authority over it. A note
 * that disagrees is now merely a badly-written sentence rather than a second
 * opinion the code has to arbitrate.
 *
 * `unsure` is explicit rather than inferred, because §I's fail-closed rule is
 * only honest if the judge can SAY it is unsure instead of being forced to
 * pick a side and hedge in prose.
 */
const AXIS_VERDICTS = ["matches", "differs", "unsure"] as const;
type AxisVerdictWord = (typeof AXIS_VERDICTS)[number];

const axisSchema = z.object({
  verdict: z.enum(AXIS_VERDICTS),
  note: z.string().max(400).optional(),
});

const verdictSchema = z.object({
  identity: axisSchema,
  intact: axisSchema,
  people: axisSchema,
});

/**
 * ⚠ **THE IDENTITY AXIS NAMES MARKINGS AND MAKEUP — 2026-09-25 (#1221).**
 *
 * It read *"Judge bone structure, facial proportions, skin, hair and build"*,
 * and a view that came back with the right bones and none of her ink satisfied
 * every word of it. The founder's Sifr2 close-up did exactly that — heavy neck
 * tattoos and dark makeup on the master, a bare unmade face in the delivery —
 * and **this judge would have passed it.**
 *
 * ⚠ **IT WOULD NOT HAVE SAVED THAT CLOSE-UP AND THIS IS NOT WHY IT IS HERE** —
 * that view went unjudged entirely (#1220). This axis is what stops the NEXT
 * one being delivered, and it is the half of the repair that survives a future
 * regression in the prompt: the prompt asks for her ink, and the judge is what
 * notices when the asking stops working.
 *
 * **Bounded on purpose, both ways.** *"Wherever IMAGE 2's frame reaches it"*
 * keeps a full-length view from failing because an ear stud is four pixels
 * across, and the explicit *"a marking outside IMAGE 2's crop is not missing"*
 * is there because this judge is told elsewhere that an axis it is unsure about
 * FAILS — an unbounded marking clause would refund views for being cropped,
 * which is the refund noise `CLOSE_UP_WARDROBE`'s own docblock was written
 * about.
 */
/**
 * ⚠ **THE JUDGE TAKES THE CAST'S PRONOUNS TOO — #1480 finding A, third site,
 * and it was found by HIS OWN AUDIT ORDER**: *"ensure the checker isn't running
 * on legacy rules"*.
 *
 * Its identity rule named *"the MARKINGS AND MAKEUP **her** skin carries … the
 * makeup **she** is wearing"* — fixed pronouns handed to the checker for every
 * cast, male or creature, on the same day the generator's own reference
 * paragraph was found doing it. The two move in one commit on purpose: a
 * generator told *his* and a judge told *her* are describing two people, and
 * the axis that would notice is the one axis whose whole job is identity.
 *
 * ⚠ **This IS a change to the judge's system prompt and therefore to every
 * verdict on every signed cast, which is not a thing to slip in** (#1229 is a
 * whole card about not doing it lightly). It is admitted here because it is a
 * CORRECTNESS fix he ordered by name, and because it moves no threshold: the
 * three axes, their questions, their verdict vocabulary and the note rule are
 * byte-identical, and for a female cast the composed bytes are identical too.
 */
/**
 * ⚠ **AND #1903 REWROTE TWO OF THE THREE QUESTIONS — HIS ORDER, AND THE
 * IDENTITY SENTENCE IS UNTOUCHED BYTE FOR BYTE.**
 *
 * That is the one thing to check in this function before anything else: #1229
 * and #1221 and #1480 all live in question 1, and none of them moves. What
 * changed is questions 2 and 3, which used to ask the model for an OPINION
 * about the crop and the clothing and now ask it for two facts a picture either
 * carries or does not.
 *
 * **Both new questions are deliberately written to be easy.** The whole lesson
 * of #1582/#1594/#1595/#1611 is that a vision model reading a two-part prose
 * rule answers whichever half is easiest and reports confidence either way.
 * *"Is this a broken render"* and *"how many people are in it"* are not two-part
 * rules and have no threshold to slide: there is nothing in them to interpret
 * generously, which is why they can be asked of the same model that could not
 * be trusted with a crop.
 *
 * **The specification is gone from the user message**, so the model has nothing
 * to measure the picture AGAINST and cannot volunteer the verdict that was
 * taken away from it.
 *
 * ## ⚠ WHAT THIS PROMPT WAS MEASURED TO DO, through the real reader on his own
 * ## production frames — because a rewritten judge is a NEW INSTRUMENT and a
 * ## green unit suite says only what the CODE does with a fixed answer
 *
 * Working law 2, and it paid for itself twice in one sitting (#1903's court,
 * 2026-10-07, ten arms + four probes, house money):
 *
 *  - **A BACK VIEW READ `unsure` AND THEREFORE REFUSED — the defect this court
 *    was run to find, and the change would have shipped with it.** The old
 *    prompt was handed a specification, so a judge looking at a figure from
 *    behind knew that was what it was meant to see. Handed nothing, it answered
 *    *"no facial features are visible to confirm identity"* — and identity is
 *    still fail-closed on `unsure`, so **every back view of every Sign would
 *    have been refused and refunded**. No unit arm in this tree could have seen
 *    it. The any-angle sentence above question 2 is the repair, and it is a
 *    sentence about what is EXPECTED rather than about the angle, so it asks
 *    the judge to judge nothing new.
 *  - **Its control is the one that matters**: a DIFFERENT cast's back view
 *    still refuses (`unsure`, measured), so the clause did not simply switch
 *    identity off whenever a face is missing. Three same-cast views across two
 *    casts — a crop that does not match the anchor, a back view, a full-length
 *    — all deliver clean; a different person, a blank frame and a garbled frame
 *    all refuse.
 *  - ⚠ **THE `people` AXIS HAS A MEASURED BLIND SPOT AND IT IS STATED RATHER
 *    THAN DISCOVERED LATER.** Two full-length figures in one frame: CAUGHT,
 *    twice, with the second named in the note. A tight two-FACE diptych:
 *    MISSED, three of three, *"Only one person is visible"*. So the axis
 *    answers the realistic shape of this failure — an engine asked for one
 *    person returning two figures in a scene — and not a head-and-shoulders
 *    contact sheet. **It fails toward DELIVERING**, which is the safe direction
 *    under his ruling and the direction this whole card moves in; a stronger
 *    wording was tried first (*"look over the WHOLE frame, edge to edge"*) and
 *    did not move it, and three rewordings of one question is exactly what
 *    #1582 measured breaking correct pictures.
 *  - **One of the court's own arms was the defect, not the reader** — a
 *    two-figure fixture whose second figure painted over the first, asked twice
 *    before anyone LOOKED at it (law 9). The frames are read now before their
 *    verdicts are.
 */
const judgeSystemFor = (pronouns: CastPronouns): string => [
  "You inspect photographs for a casting studio before they are delivered to the customer.",
  "You are given two images: IMAGE 1 is the signed reference photograph of the person, and IMAGE 2 is a new photograph that is supposed to be the same person.",
  "You are looking ONLY for catastrophic failures. Judge three things independently. Do not let one influence another.",
  `1. identity — is the person in IMAGE 2 the same individual as in IMAGE 1? Judge bone structure, facial proportions, skin, hair and build, and also the MARKINGS AND MAKEUP ${pronouns.possessive} skin carries: tattoos and ink, piercings, scars, birthmarks and freckling, and the makeup ${pronouns.subject} ${pronouns.plural ? "are" : "is"} wearing. Anything of that kind visible in IMAGE 1 must be present in IMAGE 2 wherever IMAGE 2's frame reaches it — a bare, unmade version of the same face is a FAIL, not a match. Judge only where both frames reach: a marking outside IMAGE 2's crop is not missing. A similar-looking person of the same type is a FAIL.`,
  "IMAGE 2 may be taken from ANY angle, including from the side or from directly behind, where little or none of the face is visible. That is expected and is NEVER by itself a reason to be unsure about identity: judge from whatever IMAGE 2 does show — hair, build, skin, markings — and answer \"differs\" only when what you can see belongs to somebody else.",
  "2. intact — is IMAGE 2 a real, complete photograph? Answer \"differs\" ONLY if it is blank, a solid or near-solid colour, corrupted, scrambled, or so garbled that it does not read as a photograph of anything at all.",
  "3. people — how many people are in IMAGE 2? Look over the WHOLE frame, edge to edge, before answering: a second person can be standing beside the subject, behind them, or at either edge. Answer \"matches\" for exactly one, and \"differs\" if there is nobody at all or if more than one person is present. Reflections, statues, posters, mannequins and background crowds that are clearly not the subject do not count as extra people.",
  "Do NOT judge the crop, the camera angle, the pose, the direction the person faces, what is or is not visible, or the clothing. Those are not your business and are never a reason to answer \"differs\".",
  "Answer ONLY with a JSON object of the form",
  '{"identity":{"verdict":"matches","note":"..."},"intact":{"verdict":"matches","note":"..."},"people":{"verdict":"matches","note":"..."}}',
  'Each verdict is exactly one of "matches", "differs" or "unsure".',
  'Use "matches" when the image is fine on that axis, "differs" when it catastrophically fails it, and "unsure" when you genuinely cannot tell from what you can see.',
  "The note is one short sentence saying what you saw. The VERDICT is your answer — never write a note that argues against your own verdict; if the note would say the image is fine, the verdict is \"matches\".",
].join(" ");

/**
 * Fail-closed on every axis, with one honest reason.
 *
 * ⚠ **EXPORTED SINCE #1903, AND THE REASON IS WORKING LAW 4 RATHER THAN
 * CONVENIENCE.** `packageOrchestrator` built this same shape by hand for the
 * case where the judge itself throws — a second list of the axis names, in
 * another file, that the axis rename found by breaking it. It would equally
 * have found it by NOT breaking it, which is the version that ships a verdict
 * carrying two axes nothing reads and missing one everything does.
 *
 * One builder, so the axis set is stated once.
 */
export function unjudgedVerdict(
  method: string,
  reason: string,
  frames?: readonly JudgedFrame[],
): ViewConformanceVerdict {
  const axis: AxisVerdict = { pass: false, note: reason };
  return {
    pass: false,
    method,
    unjudged: true,
    axes: Object.fromEntries(
      CONFORMANCE_AXES.map((name) => [name, { ...axis }]),
    ) as Record<ConformanceAxis, AxisVerdict>,
    /* The frames ride the fail-closed verdicts too, and they are worth most
       there: an `unavailable` row that names what was posted is the difference
       between "the judge timed out" and "the judge timed out on 13 MB". */
    ...(frames ? { frames } : {}),
  };
}

/** The in-file name, unchanged, so every call site below reads as it did. */
const unjudged = unjudgedVerdict;

/**
 * ASK THE JUDGE, AND TURN ITS OWN FAILURE INTO AN HONEST VERDICT RATHER THAN
 * INTO A VERDICT AT ALL.
 *
 * The judge converts a refusal or an unreadable answer into `unjudged` itself;
 * what reaches here is a transport failure that survived its retries, and it
 * gets the same treatment. **`unjudged` is not "it failed" — it is "nobody
 * looked"**, and since D-246 every caller DELIVERS on it and records the fact.
 *
 * §I's fail-closed law is not repealed by that. It said a check that reports
 * success loudest exactly when it understood nothing is worthless, and that is
 * still true: nothing here reports success. It reports that no opinion exists,
 * which is a different sentence and lands on the row as one.
 *
 * ⚠ **IT LIVES HERE, BESIDE {@link unjudgedVerdict}, BECAUSE THERE ARE TWO
 * ROADS NOW AND A SECOND COPY WOULD HAVE BEEN THE WORST POSSIBLE ONE — #1904.**
 * It was `packageOrchestrator`'s private helper, called once, on the per-view
 * road. His option A moved the Sign's judging into `signSheetCoordinator`,
 * which needs exactly this rule — and the first draft of that coordinator let a
 * judge fault propagate instead, on the plausible-sounding ground that
 * delivering an unlooked-at picture would be dishonest. **It would have made a
 * judge outage refund the whole Sign**: D-246's founder ruling exactly inverted
 * (*detectors must not block real generations because the detectors are
 * flawed*), and nothing in the row would have been more honest for it. One
 * function, two roads, one rule — and the arm that caught it is the Sign's own
 * *"DELIVERS a view it could not check"*.
 */
export async function judgeUnjudgedOnFailure(
  judge: ViewConformanceJudge,
  input: Parameters<ViewConformanceJudge>[0],
): Promise<ViewConformanceVerdict> {
  try {
    return await judge(input);
  } catch (error) {
    log.error(
      { angle: input.angle, err: error },
      "[viewConformance] the conformance judge failed — no opinion exists about this view",
    );
    /* ⚠ THE AXES WERE SPELLED OUT BY HAND AT THE OLD CALL SITE AND ARE DERIVED
       NOW — #1903. A second list of the axis names in a second file is working
       law 4, and it was found the hard way: the rename broke that literal. The
       silent version of the same mistake ships a verdict naming axes nothing
       reads. */
    return unjudgedVerdict("unavailable", "the view could not be checked");
  }
}

export type ViewConformanceJudgeConfig = {
  engine: TextEngine;
  /*
    ⚠ `framingReader` AND `framingDeadlineMs` WERE HERE AND ARE GONE — #1903.

    They were #1612's hand-over: a segmenter measured the crop, the reading
    answered the half no box could, and the deadline bounded the measurement.
    **His ruling took the question away, so the apparatus goes with it** — the
    four segmenter reads a Sign paid for, the 45 s bound, and `signEngine`'s
    refusal to build a judge without a reader (which existed so the absence of
    a measurement could never be a silent road back to a coin).

    **What it gives back and what it does NOT**, so nobody expects the wrong
    thing: ~4 segmenter reads per Sign at ~1¢ each stop being bought, and
    **the wall clock does not improve** — the measurement ran in parallel
    inside the judge's own 23–36 s call, so removing it removes a cost and
    not a wait.
  */
  /**
   * Angles this judge must fail regardless of the picture, or `"all"`.
   *
   * The forced-fail switch. Server-owned, never client-reachable, and it does
   * not fake a refund or a marker — it fails the axis and lets the real refusal
   * path run, which is the only way to learn whether the refund, the slot
   * record and the room's confession actually work together.
   */
  forceFail?: readonly CastViewAngle[] | "all";
};

export function createViewConformanceJudge(config: ViewConformanceJudgeConfig): ViewConformanceJudge {
  return async function judgeViewConformance(input) {
    if (
      config.forceFail === "all"
      || (Array.isArray(config.forceFail) && config.forceFail.includes(input.angle))
    ) {
      log.warn(
        { angle: input.angle },
        "[viewConformance] FORCED FAILURE — the conformance switch is on for this angle",
      );
      const forced: AxisVerdict = { pass: false, note: "forced failure switch" };
      return {
        pass: false,
        method: "forced",
        axes: { identity: { ...forced }, intact: { ...forced }, people: { ...forced } },
      };
    }

    /*
      THE PAIR IS BOUNDED BEFORE IT IS POSTED (#1408), and this is the only
      place it can be: both roads into this judge — a Sign's five views and a
      Try again — reach it through this one function, so a bound here cannot be
      forgotten by a caller and cannot drift between the two.

      Full reasoning, the measurements and what it deliberately does not change
      are in `judgeFrame.ts`. The one sentence that belongs here: the frames
      posted to the reader are NOT the frames delivered to the customer —
      `packageOrchestrator` stores the provider's own bytes before it calls this
      and delivers those.
    */
    const [anchor, candidate, integrity] = await Promise.all([
      boundForJudge(input.anchor),
      boundForJudge(input.candidate),
      /*
        ⚠ **THE ONE CATASTROPHE THAT IS NOT LEFT TO A MODEL — the repair owed on
        PR #1915, and working law 3 is the rule it answers:** *a backstop needs a
        test the model cannot rescue.* Until this line, `intact` and `people`
        were both answered ONLY by the vision call below, so a frame the judge
        could not be asked about at all — a provider rejecting the image as
        non-retryable is the measured shape — fell through to `unjudged`, and
        D-246 DELIVERS an `unjudged` view and CHARGES for it. **Catastrophe 2
        reached a paying customer by the one road built to protect a view nobody
        could look at.**

        `people` stays model-only and says so on its own band: there is no cheap
        deterministic count of people in a photograph, and inventing one would be
        the approximation the fidelity law forbids. `identity` likewise.
      */
      readFrameIntegrity(input.candidate),
    ]);
    const frames: readonly JudgedFrame[] = [anchor.record, candidate.record];

    if (!integrity.intact) {
      /*
        ⚠ **IT REFUSES RATHER THAN GOING `unjudged`, AND THAT DISTINCTION IS THE
        WHOLE POINT OF THE ARM.** `unjudged` means *nobody formed an opinion*, and
        {@link viewConformanceRefuses} answers it first and DELIVERS (D-246). An
        opinion was formed here — by a decoder rather than by a model, which is
        the stronger of the two witnesses, not the weaker — so this is an ordinary
        refusal and takes the ordinary refund road.

        **`identity` and `people` pass, and that is not a claim about the
        picture.** {@link axisFrom}'s own rule is that `pass` means *this axis
        does not take the picture away*, and neither of them is why this one went:
        a reader who sees all three false would be told three things failed when
        one did, and the diagnostic capture's key would name three axes for one
        fault. Their `verdict` word is ABSENT, which is already this type's
        spelling for *no judge answered* — and no judge did; the model was never
        called, which is also the ~$0.01 and the 20-35 s this arm saves on a frame
        that was never deliverable.
      */
      log.warn(
        { angle: input.angle, fault: integrity.fault, size: candidate.record.size },
        "[viewConformance] the frame is not a complete picture — refusing it without asking the judge",
      );
      const notAsked = "not asked — the frame was refused before the judge was called";
      return {
        pass: false,
        method: `intact:${integrity.fault}`,
        axes: {
          identity: { pass: true, note: notAsked },
          intact: { pass: false, note: integrity.note },
          people: { pass: true, note: notAsked },
        },
        frames,
      };
    }

    let text: string;
    try {
      const reply = await config.engine.complete({
        about: "verify",
        system: judgeSystemFor(input.pronouns ?? pronounsForSex(null)),
        /*
          ⚠ **THERE IS NO SPECIFICATION ANY MORE — #1903, and its ABSENCE is the
          control.**

          This used to carry `packageViewExpectation(angle)`: a framing sentence
          and a wardrobe sentence, so the judge measured the picture against the
          spec rather than against the prompt. His ruling removed both axes, and
          a model still handed those two sentences would keep answering them —
          in the note if not in the verdict, and the note is what a support
          reader and a future court read. The three questions are in the system
          prompt and they are about the PICTURE, so the user turn says only
          which image is which.
        */
        user: "IMAGE 1 is the signed reference photograph. IMAGE 2 is the new photograph. Answer about IMAGE 2.",
        images: [anchor.image, candidate.image],
        json: true,
        temperature: 0,
        /*
          THE CEILING IS FOR THE VERDICT, AND NOTHING ELSE MAY EAT IT (#1220).

          Three verdicts and three short notes is ~200 tokens. The judge asked
          for 500 — twice what the answer needs — and still came back empty
          twice in thirty seconds on his Sifr2 Sign, because the served model
          spent 640 and 531 characters on reasoning first and the completion
          never started. The view was delivered UNJUDGED and charged 50 credits,
          and it was the one he reported wrong.
        */
        reasoning: "off",
        /*
          AND THE CEILING IS RAISED ANYWAY, because a transport must not depend
          on a model honouring a request. 1,000 is five times the answer and
          still small: a model that reasons regardless cannot get far before the
          truncation arm below — now retryable rather than "unreachable" — takes
          over. It costs nothing when unused; `max_tokens` is a bound, not a buy.
        */
        maxOutputTokens: 1_000,
        /*
          AND THE SECOND ROAD TO AN UNJUDGED VIEW IS THE CLOCK, measured the
          same hour (#1220).

          Asset 317 — his Sifr side profile, delivered unjudged and charged —
          died on `TimeoutError` at the transport's 45 s default, and that
          default is sized for *a describer's short read*. This is not one: the
          judge posts TWO full-resolution frames as data URIs, **7,578 prompt
          tokens measured**, and the answer comes back in **23.3 s and 36.3 s**
          on his own two frames. One of those two needed a second attempt to
          beat 45 s at all.

          75 s is twice the worst success observed. `retries: 1` is the price of
          asking for it — the deadline is per ATTEMPT and sits inside the retry
          loop, so this is a worst case of 150 s against the 135 s three
          45-second attempts already allowed, while the FIRST attempt now
          succeeds. The brief interpreter took the same road for the same reason
          (#121), and the rule it wrote down is that a call lengthening its
          deadline says how many times it may pay it.
        */
        timeoutMs: 75_000,
        retries: 1,
        signal: input.signal,
      });
      if (reply.truncated) {
        /*
          D-83, in the judge's clothing: a reply cut off at the ceiling is a
          fragment, and a fragment of JSON fails the whole parse. Thrown as
          transport so the retry law sees it, because the model did not fail —
          our ceiling did.
        */
        throw new ProviderError("transport", "the conformance judge was cut off at the token ceiling");
      }
      text = reply.text;
    } catch (error) {
      if (error instanceof ProviderError && error.retryable) throw error;
      if (error instanceof ProviderError && error.failureClass === "content_policy") {
        // A refusal is a failure, never a pass (D-92).
        return unjudged("refused", "the conformance judge refused to answer", frames);
      }
      if (error instanceof ProviderError && error.failureClass === "provider_account") {
        /*
          OUT OF FUNDS, said as such.

          This is the failure that cost a real package. Our OpenRouter balance
          ran out, every image-bearing judge call came back 402, all five views
          fail-closed and refunded — and the record said "the conformance judge
          could not be reached", which reads like a flaky network and sent the
          first hour of the investigation somewhere useless.

          Nothing about the request is wrong, every remaining view will fail the
          same way, and no retry or user action fixes it. It gets the roll
          alarm's shape and its own persisted reason (founder ruling,
          2026-08-02).
        */
        log.error(
          { angle: input.angle, engine: config.engine.id },
          "[viewConformance] JUDGING ACCOUNT UNUSABLE — our key or balance is refusing work, not the customer's Cast",
        );
        return unjudged("account", "our judging account is out of funds", frames);
      }
      log.error({ angle: input.angle, err: error }, "[viewConformance] judge call failed — failing closed");
      return unjudged("unavailable", "the conformance judge could not be reached", frames);
    }

    const parsed = verdictSchema.safeParse(readJson(text));
    if (!parsed.success) {
      log.error(
        { angle: input.angle },
        "[viewConformance] judge reply did not parse — failing closed",
      );
      return unjudged("unparsed", "the conformance judge's answer could not be read", frames);
    }

    /*
      `pass` is DERIVED, never read. It exists so every downstream reader — the
      slot marker, the room's confession, the receipt — keeps the shape it
      already has, but it is a projection of the verdict rather than a second
      field the model can contradict.

      ⚠ **WHAT `unsure` DOES IS NOW PER AXIS — #1903**, and the rule and its
      reasons live in {@link AXIS_REFUSES_ON_UNSURE} rather than here. The short
      version: identity keeps §I in full, and the two catastrophe axes refuse
      only on a positive `differs`, because failing to answer *"is this picture
      broken"* is not a finding that it is.
    */
    const axes: Record<ConformanceAxis, AxisVerdict> = {
      identity: axisFrom("identity", parsed.data.identity),
      intact: axisFrom("intact", parsed.data.intact),
      people: axisFrom("people", parsed.data.people),
    };
    return {
      pass: CONFORMANCE_AXES.every((axis) => axes[axis].pass),
      /*
        ⚠ **ONE READER AGAIN.** This used to append the segmenter's method when a
        band had been measured; there is no second reader to name (#1903).
        `conformanceMethod` is matched for EQUALITY against `"unavailable"` and
        nothing else (`viewDeliveredUnchecked`, `castProjection`), so the shape
        of the success value has never been load-bearing — checked at every
        reader of the key rather than assumed.
      */
      method: `judge:${config.engine.id}`,
      axes,
      frames,
    };
  };
}

/**
 * WHAT A LANDED VIEW'S ROW RECORDS ABOUT ITS CHECK — one projection, read by
 * both roads that land a view.
 *
 * There are two writers (`packageOrchestrator`'s Sign and `viewRetryService`'s
 * Try again) and they were spelling the same two fields out separately. Adding
 * a third to both by hand is working law 4's exact shape — a second list
 * shadowing a source of truth always drifts from it — so the shape is derived
 * here instead, where the verdict is made.
 *
 * ⚠ **`conformanceMethod`'s VALUE is a contract and does not move.**
 * {@link viewDeliveredUnchecked} matches it for equality against
 * `"unavailable"`, which is what makes a Try again free on an unchecked view
 * (#1220) and what keeps that view's price at zero (D-246). The new field sits
 * beside it rather than inside it for that reason alone.
 */
export function conformanceProvenance(verdict: ViewConformanceVerdict): {
  conformance: Record<ConformanceAxis, AxisVerdict>;
  conformanceMethod: string;
  conformanceFrames?: readonly JudgedFrame[];
} {
  return {
    conformance: verdict.axes,
    conformanceMethod: verdict.method,
    ...(verdict.frames ? { conformanceFrames: verdict.frames } : {}),
  };
}

/**
 * ⚠ **THE ONE AXIS THAT TAKES A PICTURE AWAY — his ruling, 2026-09-30
 * (terminal), #1612 part 2.**
 *
 * His question: *"dont you think having really strict checkers is
 * unreliable?"*; on the two changes put back to him: *"i agree with you"*.
 *
 * Until this, an axis that did not say `matches` refused the view, refunded its
 * slice and dropped the picture — three axes each holding a veto. **Read at the
 * production rows the hour this was written, every signed Cast, all time: 8
 * refused views, 5 of them on wardrobe and 3 on angle, and NOT ONE on
 * identity.** So every refusal this product has ever made took a picture away
 * for a reason that is not *it isn't her*, and four of those eight are the four
 * measurements on the card (#1582, #1594, #1595, #1611) where the reading was
 * simply wrong about what it was looking at.
 *
 * **Identity is the axis whose failure breaks the promise a signed Cast
 * makes**, so it keeps §I's fail-closed refusal in full: `differs` refuses, and
 * so does `unsure`, because *"I cannot tell whether this is the same person"*
 * is not something to hand over under a signed likeness.
 *
 * **Framing and wardrobe deliver either way** — charged, marked unchecked, with
 * the free Try again the product already offers on an unchecked view. The
 * customer is not handed a worse picture by this; they are handed a picture
 * they may well have wanted instead of a refund for one they never saw.
 *
 * ⚠ **`unjudged` IS NOT A REFUSAL AND IS ANSWERED FIRST, which is not
 * decoration.** Its fail-closed default writes `pass: false` on all three axes
 * including identity, so a rule that read identity without checking this would
 * silently reverse D-246 and start refusing every view the judge could not
 * reach — the exact failure D-246 exists to prevent, reintroduced through a
 * clause about a different axis. There is a sabotage arm on precisely that.
 */
/**
 * ⚠ **AND #1903 MADE IT EVERY AXIS AGAIN — WHICH IS NOT A REVERSAL OF THE
 * RULING ABOVE, IT IS WHAT THAT RULING LOOKS LIKE ONCE THE OPINIONS ARE GONE.**
 *
 * Read the two together or this reads backwards. #1612 kept three axes and let
 * ONE of them refuse, because the other two were opinions about a crop and an
 * outfit and those were taking pictures away wrongly. #1903 deleted the
 * opinions outright: **every axis this judge still has is a catastrophe he
 * named**, so every one of them refuses, and `REFUSING_AXIS` — a single axis
 * name — had nothing left to mean.
 *
 * **The rule is therefore structural rather than a list**: a failing axis
 * refuses because {@link CONFORMANCE_AXES} contains nothing but catastrophes.
 * ⚠ **That is a real obligation on whoever adds a fourth.** An axis added here
 * takes pictures away from customers on the day it merges; if it is not
 * something he would call catastrophic, it does not belong in this judge at
 * all — not with a `deliver anyway` branch bolted beside it, which is exactly
 * the two-tier shape his ruling dissolved.
 *
 * ⚠ **`unjudged` is still answered FIRST and it still is not a refusal.** Its
 * fail-closed default writes `pass: false` on every axis, so a rule that read
 * the axes without checking it would reverse D-246 and start refusing every
 * view the judge could not reach. The sabotage arm on that is unchanged and is
 * worth more now, not less: the clause it protects is one line shorter.
 */
export function viewConformanceRefuses(verdict: ViewConformanceVerdict): boolean {
  if (verdict.unjudged === true) return false;
  return CONFORMANCE_AXES.some((axis) => !verdict.axes[axis].pass);
}

/**
 * WAS THIS VIEW DELIVERED WITHOUT A COMPLETE CHECK? — read at the row, and
 * written here beside the function that writes the row.
 *
 * It answers the question the room's `Unchecked · Try again` and the retry
 * entrance's price both turn on, and it has TWO roads into it now:
 *
 *  - `conformanceMethod === "unavailable"` — **nobody looked at all** (D-246,
 *    #1220). Unchanged, and still an equality on a contract value.
 *  - **a recorded axis that did not pass** — somebody looked, framing or
 *    wardrobe did not hold, and {@link viewConformanceRefuses} delivered it
 *    anyway (#1612 part 2). Before that rule no landed row could be in this
 *    state, which is why one reading used to be enough.
 *
 * ⚠ **A ROW WITH NO CONFORMANCE RECORD AT ALL KEEPS TODAY'S ANSWER — CHECKED —
 * AND THAT IS A MEASURED CHOICE, NOT AN OVERSIGHT.** Read at production before
 * this function was written: of 69 landed views, 46 carry a full judged record,
 * 3 carry `unavailable`, and **20 carry no `conformance` key whatsoever** —
 * views that landed before the field existed. Reading absence as *unchecked*
 * would hand every one of those 20 a free Try again tonight, retroactively, on
 * a money surface, for a change about something else entirely. **0 landed rows
 * carry a failing axis today**, so the second road above moves no history at
 * all: it can only describe views delivered from here on.
 *
 * ⚠ **THAT LAST SENTENCE WAS TRUE WHEN IT WAS WRITTEN AND IS NOT TRUE NOW —
 * AND READING IT AGAIN RATHER THAN CARRYING IT IS WHAT MADE #1903 SAFE.** #1612
 * part 2 merged the morning of 2026-10-07 and immediately began writing the
 * rows it describes. Read at production the same day, all time: **three landed
 * rows carry a failing `angle` axis under a real judge method** (assets 383,
 * 389, 391), plus three older rows under `unavailable`.
 *
 * So the second road is live history, and #1903's axis rename would have
 * silently stopped seeing it — **three customers losing a free Try again they
 * are owed, with nothing failing.** The reader iterates
 * {@link RECORDED_CONFORMANCE_AXES}, which carries the retired names beside the
 * current ones, for exactly as long as the free Try again itself exists.
 */
export function viewDeliveredUnchecked(provenance: unknown): boolean {
  if (provenance === null || typeof provenance !== "object") return false;
  const record = provenance as { conformanceMethod?: unknown; conformance?: unknown };
  if (record.conformanceMethod === "unavailable") return true;
  const axes = record.conformance;
  if (axes === null || typeof axes !== "object") return false;
  return RECORDED_CONFORMANCE_AXES.some((axis) => {
    const entry = (axes as Record<string, unknown>)[axis];
    if (entry === null || typeof entry !== "object") return false;
    return (entry as { pass?: unknown }).pass !== true;
  });
}

/**
 * Reads the object out of a reply that may be wrapped in prose or a fence.
 *
 * Deliberately tolerant of packaging and intolerant of content: anything that
 * is not a readable object returns null and fails closed above. It never
 * repairs, guesses or fills a missing axis — a judge that has to be corrected
 * into agreeing is not a second opinion.
 */
function readJson(text: string): unknown {
  const direct = tryParse(text);
  if (direct !== undefined) return direct;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    const parsed = tryParse(fenced);
    if (parsed !== undefined) return parsed;
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return tryParse(text.slice(start, end + 1));
  return null;
}

function tryParse(value: string): unknown {
  try {
    return JSON.parse(value.trim()) as unknown;
  } catch {
    return undefined;
  }
}

/** Parses the server-only forced-fail switch. Unknown angles are ignored loudly. */
export function forcedFailAnglesFromEnv(
  raw: string | undefined,
  known: readonly CastViewAngle[],
): readonly CastViewAngle[] | "all" | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (value === "all") return "all";
  const angles = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is CastViewAngle => (known as readonly string[]).includes(entry));
  return angles.length > 0 ? angles : undefined;
}
