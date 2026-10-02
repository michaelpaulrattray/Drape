/**
 * View conformance — the cohort validator's three axes (§I, D-92).
 *
 * **"View conformance is theatre unless it can fail."** That sentence is the
 * design, and everything here exists to make it literally true:
 *
 *  - three INDEPENDENT axes, because a package that keeps the face but returns
 *    the wrong angle in a different shirt is not shippable, and one blended
 *    "looks right" score cannot say which of those went wrong. The M3
 *    calibration is the evidence: identity held across the whole package while
 *    the wardrobe quietly did not, and nothing in the design would have caught
 *    it (`CASTING_V2_M3_CALIBRATION_REPORT.md`, "Consequence for M7");
 *  - **a parse failure or a refusal is a FAILURE**, never a default pass. Where
 *    no trustworthy verdict exists the slot refuses (§I "fail closed") — the
 *    alternative is a check that reports success loudest exactly when it
 *    understood nothing;
 *  - judged against the **spec**, never against the generation prompt. The
 *    judge is handed `packageViewExpectation(angle)` and the two images, and it
 *    is structurally incapable of seeing what we asked the generator for
 *    (`castViewPackage.ts` holds that boundary);
 *  - a **forced-fail switch**, so the refusal path — refund slice, failed slot,
 *    the room's confession — can be walked end to end with real money on a real
 *    Cast, rather than only in a unit test where the money is imaginary.
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
import { castPackageView, packageViewExpectation } from "./castViewPackage";
import { pronounsForSex, type CastPronouns } from "./castPronouns";
import { boundForJudge, type JudgedFrame } from "./judgeFrame";
import {
  measureViewFraming,
  type FramingMeasurement,
  type FramingReader,
} from "./viewFramingGeometry";

const log = createModuleLogger("castingV2/viewConformance");

export const CONFORMANCE_AXES = ["identity", "angle", "wardrobe"] as const;
type ConformanceAxis = (typeof CONFORMANCE_AXES)[number];

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

/** One place where a verdict becomes a pass, so there is one rule. */
function axisFrom(answer: { verdict: AxisVerdictWord; note?: string }): AxisVerdict {
  return {
    pass: answer.verdict === "matches",
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
  /**
   * WHAT THIS CAST IS WEARING — the snapshotted line (design §3.3, item 6).
   *
   * ⚠ **The judge must be handed the SAME answer the generator was composed
   * from.** `packageViewExpectation` and `composePackageViewPrompt` both derive
   * their sentence from this value through one function, because a judge told a
   * different outfit than the prompt asked for fails a view for obeying its
   * instructions — five views, the wardrobe axis, refunded slices.
   *
   * `null` or absent is every Cast signed to date and keeps today's sentence
   * exactly, including its *anything below the frame cannot be compared* clause.
   */
  wardrobeLine?: string | null;
  /**
   * HER BRIEF, WHEN THE CAST HAS ONE ON RECORD (#1278 part 1).
   *
   * The judge takes it for one reason only: the generator's wardrobe sentence
   * narrows when a brief is on record, and a judge reading the unnarrowed one
   * would refuse a view for wearing exactly what the prompt asked for. `null` or
   * absent keeps today's sentence, which is every Cast with no source roll.
   */
  description?: string | null;
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
  angle: axisSchema,
  wardrobe: axisSchema,
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
const judgeSystemFor = (pronouns: CastPronouns): string => [
  "You inspect photographs for a casting studio before they are delivered to the customer.",
  "You are given two images: IMAGE 1 is the signed reference photograph of the person, and IMAGE 2 is a new photograph that is supposed to be the same person, delivered against a written specification.",
  "Judge three things independently. Do not let one influence another.",
  `1. identity — is the person in IMAGE 2 the same individual as in IMAGE 1? Judge bone structure, facial proportions, skin, hair and build, and also the MARKINGS AND MAKEUP ${pronouns.possessive} skin carries: tattoos and ink, piercings, scars, birthmarks and freckling, and the makeup ${pronouns.subject} ${pronouns.plural ? "are" : "is"} wearing. Anything of that kind visible in IMAGE 1 must be present in IMAGE 2 wherever IMAGE 2's frame reaches it — a bare, unmade version of the same face is a FAIL, not a match. Judge only where both frames reach: a marking outside IMAGE 2's crop is not missing. A similar-looking person of the same type is a FAIL.`,
  "2. angle — does IMAGE 2 show the framing the specification asks for? Judge only what the specification names.",
  "3. wardrobe — does IMAGE 2 show the clothing the specification names, unchanged from IMAGE 1 where both are visible?",
  "Answer ONLY with a JSON object of the form",
  '{"identity":{"verdict":"matches","note":"..."},"angle":{"verdict":"matches","note":"..."},"wardrobe":{"verdict":"matches","note":"..."}}',
  'Each verdict is exactly one of "matches", "differs" or "unsure".',
  'Use "matches" when the image satisfies the specification for that axis, "differs" when it does not, and "unsure" when you genuinely cannot tell from what you can see.',
  "The note is one short sentence saying what you saw. The VERDICT is your answer — never write a note that argues against your own verdict; if the note would say the image is fine, the verdict is \"matches\".",
].join(" ");

/**
 * ⚠ **THE FRAMING AXIS, FOLDED — the hand-over of #1612, and the measurement is
 * the AUTHORITY rather than a second opinion.**
 *
 * His ruling, 2026-09-30: *"are the shoulders in frame", "is the face between
 * the eyebrows and the bottom of the face", "is the whole body head-to-feet in
 * frame" are geometry*, and a vision model reading a two-part prose rule
 * answers whichever half is easiest — measured four ways in one afternoon, over-
 * and under-refusing the SAME view in the same sitting (#1582, #1594, #1595,
 * #1611). So the geometry decides where it can, and the reading is kept for the
 * half no box answers.
 *
 * The order of these three branches IS the rule:
 *
 *  1. **`outOfBand` → `differs`, and the reader is not consulted.** This is the
 *     whole point. #1611's frame — a close-up with the whole neck and shoulders
 *     in it — read `matches` 50 times out of 100 against a spec that calls it
 *     too loose; the measurement answers it the same way every time. A fold
 *     that let a `matches` reading rescue an out-of-band frame would have
 *     shipped the coin with extra steps.
 *  2. **`cannotMeasure` → the reader may still FAIL it, but may not pass it.**
 *     A segmenter that found no face is not evidence the crop is right, so the
 *     axis cannot read `matches` off a question nobody answered; and a reader
 *     that looked and said `differs` saw something real, so that is kept. The
 *     result is `unsure`, which under part 2 of this card DELIVERS the view
 *     charged and unchecked with a free Try again — the customer keeps the
 *     picture and nobody pretends it was checked.
 *  3. **`inBand` → the reading governs**, because what is left of the posted
 *     question is the half the geometry cannot reach: an orientation, a turn, a
 *     concealment, a stride, a feature count. Those are real tests and a pass
 *     is not a pass without them.
 *
 * ⚠ **`null` is the pre-hand-over behaviour and exists for ONE reason**: a judge
 * constructed with no reader at all, which is every test that does not care
 * about framing. The production factory (`signEngine.ts`) refuses to build one
 * without a reader, and `signEngineFramingReader.test.ts` asserts that at the
 * wire — because an optional dependency on a money path is otherwise a silent
 * road back to the coin.
 */
export function foldFramingAxis(input: {
  measurement: FramingMeasurement | null;
  read: { verdict: AxisVerdictWord; note?: string };
}): AxisVerdict {
  const { measurement, read } = input;
  if (measurement === null) return axisFrom(read);
  const failing = measurement.readings.filter((reading) => reading.held === false);
  const unanswered = measurement.readings.filter((reading) => reading.held === null);
  if (measurement.verdict === "outOfBand") {
    return {
      pass: false,
      verdict: "differs",
      note: `measured out of band: ${failing.map((reading) => reading.note).join("; ")}`,
    };
  }
  if (measurement.verdict === "cannotMeasure") {
    if (read.verdict === "differs") {
      return {
        pass: false,
        verdict: "differs",
        note: `the framing could not be measured and the reader turned it down: ${read.note ?? ""}`.trim(),
      };
    }
    return {
      pass: false,
      verdict: "unsure",
      note: `the framing could not be measured: ${unanswered.map((reading) => reading.note).join("; ")}`,
    };
  }
  return axisFrom({
    verdict: read.verdict,
    note: `measured in band; ${read.note ?? "the reader raised nothing"}`,
  });
}

/** Fail-closed on every axis, with one honest reason. */
function unjudged(
  method: string,
  reason: string,
  frames?: readonly JudgedFrame[],
): ViewConformanceVerdict {
  const axis: AxisVerdict = { pass: false, note: reason };
  return {
    pass: false,
    method,
    unjudged: true,
    axes: { identity: { ...axis }, angle: { ...axis }, wardrobe: { ...axis } },
    /* The frames ride the fail-closed verdicts too, and they are worth most
       there: an `unavailable` row that names what was posted is the difference
       between "the judge timed out" and "the judge timed out on 13 MB". */
    ...(frames ? { frames } : {}),
  };
}

export type ViewConformanceJudgeConfig = {
  engine: TextEngine;
  /**
   * ⚠ **THE SEGMENTER THAT ANSWERS THE FRAMING BAND — #1612's hand-over, and it
   * belongs HERE for the same reason `boundForJudge` does.**
   *
   * Both roads into this judge — a Sign's five views and a Try again — reach it
   * through one function, so a measurement taken here cannot be forgotten by a
   * caller and cannot drift between the two. `viewRetryService` was the half of
   * the refusal road that #1492 got stuck in, and it could not have been covered
   * from `signService` at all.
   *
   * **It costs no new fal allowance, read rather than assumed** (the memory this
   * repository keeps: a FIFTH declared fal path refuses to boot).
   * `falRegionReader` calls `throughFalGate`, so every read here waits on the
   * same `FAL_CONCURRENCY` courtesy pool the face scan and every other region
   * read already share — `falBudget.ts`'s four paths and their sum of 19 are
   * untouched by this change.
   *
   * **What it costs per Sign, stated** (law 3 of the disappearing-technology
   * law): the five views a Sign buys name `subject` three times and
   * `face`+`subject` once between them — `threeQuarter` names nothing, because a
   * band with no rules is measured without a single call. That is **4 segmenter
   * reads per Sign at ~1¢ each**, taken in parallel with the judge's own call,
   * which runs 23–36 s on his own frames.
   *
   * ⚠ **THIS CLAUSE READ *"a region read is a second or two against that"*
   * UNTIL #1776, AND IT WAS WRONG BY ABOUT TEN TIMES.** Driven on his own
   * frames through the real segmenter: a TWO-landmark band measures in
   * **21.5 / 18.5 / 22.5 s**, so a single region read is ~10 s, not one or two.
   * **The conclusion still holds and that is why the sentence is corrected
   * rather than reversed** — 21.5 s inside a 23–36 s judge call still adds
   * nothing to the wall clock, because the two run in parallel. What the wrong
   * number hid was the SHAPE of the risk: a leg believed to take a second does
   * not look like one that needs a deadline, and it had none (#1776).
   */
  framingReader?: FramingReader;
  /**
   * HOW LONG THE MEASUREMENT MAY RUN BEFORE THE AXIS FALLS TO THE READER —
   * {@link FRAMING_MEASUREMENT_TIMEOUT_MS} when it is not given, which is what
   * every production caller gets.
   *
   * ⚠ **IT EXISTS SO THE DEADLINE CAN BE DRIVEN THROUGH THE REAL JUDGE, AND
   * THAT IS THE WHOLE REASON.** The alternative was a fake clock, and the judge
   * does real work either side of this promise (it downscales both frames
   * before the measurement starts); faking timers around that proved to stall
   * on the frame work rather than on the thing under test, which is a test that
   * passes or hangs for reasons unrelated to its subject.
   *
   * It is never set in production, and `viewFramingDeadline.test.ts` holds that
   * by DERIVING the caller list from the tree rather than by saying so here.
   */
  framingDeadlineMs?: number;
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
        axes: { identity: { ...forced }, angle: { ...forced }, wardrobe: { ...forced } },
      };
    }

    const expectation = packageViewExpectation(
      input.angle,
      input.wardrobeLine ?? null,
      input.description ?? null,
    );

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
    const [anchor, candidate] = await Promise.all([
      boundForJudge(input.anchor),
      boundForJudge(input.candidate),
    ]);
    const frames: readonly JudgedFrame[] = [anchor.record, candidate.record];

    /*
      THE BAND IS MEASURED ON THE FRAME THE CUSTOMER GETS, and it starts HERE so
      it runs beside the judge's own call rather than in front of it.

      ⚠ **`input.candidate.bytes`, NOT `candidate.image`** — and the distinction
      is the one `judgeFrame.ts` exists about. The bounded frame is a downscaled
      copy made so the pair fits inside the reader's deadline; the band is a
      statement about the PICTURE THAT IS DELIVERED, so it is measured on the
      provider's own bytes. The geometry is scale-free by construction (both
      terms of every rule come off the same mask in the same frame), so this is
      not about the answer changing — it is about which frame the record is a
      claim about.

      ⚠ **`.catch` is not belt-and-braces: without it an abandoned measurement
      is an unhandled rejection.** Every road below this line can return early —
      a refusal, an account failure, a timeout, an unparsed reply — and the
      promise would still be in flight. `measureViewFraming` already turns a
      reader that throws into a `cannotMeasure` per rule, so this arm is for the
      failure it cannot see (its own bug, a band that refuses), and it fails the
      way the rest of this file fails: toward "nobody could tell", which
      delivers.
    */
    /* Bound once, because the deadline now takes a CALLBACK (#1781) and a
       property read inside one is no longer narrowed by the ternary around it.
       A `!` would have said the same thing with nothing holding it true. */
    const framingReader = config.framingReader;
    const measuring: Promise<FramingMeasurement | null> = framingReader
      ? withinFramingDeadline((signal) => measureViewFraming({
        band: castPackageView(input.angle).band,
        image: input.candidate.bytes,
        reader: framingReader,
        /* #1781 — the bound passing also cancels the reads it started, so the
           abandoned measurement gives its provider slots back instead of
           holding them to the transport's ~300 s. */
        signal,
      }), config.framingDeadlineMs ?? FRAMING_MEASUREMENT_TIMEOUT_MS).catch((error: unknown) => {
        log.error(
          { angle: input.angle, err: error },
          "[viewConformance] the framing band could not be measured — the axis falls to the reader",
        );
        return {
          verdict: "cannotMeasure",
          readings: [],
          landmarksRead: [],
          method: `geometry:refused — ${error instanceof Error ? error.message : String(error)}`,
        } satisfies FramingMeasurement;
      })
      : Promise.resolve(null);

    let text: string;
    try {
      const reply = await config.engine.complete({
        about: "verify",
        system: judgeSystemFor(input.pronouns ?? pronounsForSex(null)),
        user: [
          "SPECIFICATION for IMAGE 2:",
          `Framing: ${expectation.framing}`,
          `Wardrobe: ${expectation.wardrobe}`,
        ].join("\n"),
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

      `unsure` fails, which is §I stated in one place instead of relied upon in
      a prompt: an axis nobody could judge is not an axis that passed.
    */
    /*
      ⚠ **AND THE FRAMING AXIS IS THE ONE AXIS THAT IS NO LONGER THE READER'S
      ANSWER — #1612's hand-over.** `identity` and `wardrobe` are untouched, by
      name and on purpose: #1229 is a whole card about not moving the identity
      sentence, and this change does not move a byte of it.
    */
    const measurement = await measuring;
    const axes: Record<ConformanceAxis, AxisVerdict> = {
      identity: axisFrom(parsed.data.identity),
      angle: foldFramingAxis({ measurement, read: parsed.data.angle }),
      wardrobe: axisFrom(parsed.data.wardrobe),
    };
    return {
      pass: CONFORMANCE_AXES.every((axis) => axes[axis].pass),
      /*
        The method names BOTH readers, because a row that records a framing
        verdict should say what answered it. `conformanceMethod` is matched for
        EQUALITY against `"unavailable"` and nothing else (`viewDeliveredUnchecked`,
        `castProjection`), so extending the success value is safe — checked at
        every reader of the key rather than assumed.
      */
      method: measurement === null
        ? `judge:${config.engine.id}`
        : `judge:${config.engine.id}+${measurement.method}`,
      axes,
      frames,
    };
  };
}

/**
 * HOW LONG THE BAND MEASUREMENT MAY HOLD A PAID VIEW — #1776.
 *
 * ## The defect, in what a customer waits
 *
 * The measurement was started with no deadline of any kind. The judge's own
 * call beside it is capped at 75 s (`timeoutMs` below); a segmenter that
 * ACCEPTS and never answers is bounded only by the transport, which is
 * undici's ~300 s headers timeout (measured at 306.6 s in #1177). So the
 * slowest leg set the wall clock, and a Sign or a Try again could sit for five
 * minutes before folding to `cannotMeasure` and delivering.
 *
 * ## Why 45 s, and why it is NOT the 20 s the card proposed
 *
 * ⚠ **20 s was measured to break working measurements, which is the dangerous
 * direction: a bound that fires on a healthy read converts a real check into
 * `cannotMeasure`, and an unchecked view is DELIVERED with a free Try again.**
 * That trades a rare five-minute wait for routinely giving the check away.
 *
 * Driven on his own production frames through the real segmenter, on the
 * widest band there is:
 *
 * | view | landmarks | verdict | seconds |
 * |---|---|---|---|
 * | `closeUp` (asset 306) | 2 | `inBand` | **21.5** |
 * | `closeUp` (asset 322) | 2 | `outOfBand` | **18.5** |
 * | `frontClose` (asset 306) | 2 | `outOfBand` | **22.5** |
 *
 * Every one of those three is at or above 20 s. **The widest band in the
 * product reads TWO distinct landmarks** — read off the bands rather than
 * assumed: `closeUp` names `face` + `subject`, `frontFull` and `backFull` name
 * `subject` alone, `threeQuarter` and `sideClose` name none — so 22.5 s is the
 * worst case and not a sample of a longer tail.
 *
 * 45 s is **twice the worst success observed**, which is the rule the judge's
 * own 75 s was set by, in the docblock a few lines below. It leaves the hung
 * case ~6.7× shorter than the transport's ceiling while no healthy read comes
 * near it.
 *
 * ## ⚠ ~~What this does NOT do~~ — CLOSED BY #1781, and the paragraph is kept
 * ## because the ROAD is what a later reader needs
 *
 * ~~**It stops the WAITING; it does not cancel the REQUEST.** The abandoned
 * call keeps running and keeps its `FAL_CONCURRENCY` slot until the transport
 * gives up, so a hung segmenter still costs the pool one of its five for
 * ~300 s.~~
 *
 * That was true of #1776 and is no longer true of this file. The fix is the one
 * this paragraph named: an `AbortSignal` threaded to the reader's `post`, which
 * already took one. {@link withinFramingDeadline} owns the controller, aborts
 * it when the bound passes, and `measureViewFraming` carries the signal to
 * `RegionReader.region` / `.subject`, which now take one PER CALL.
 *
 * ⚠ **Per call, and the reason is a fact about this product rather than a
 * preference**: `signEngine.ts` caches `judge` at module level, so there is ONE
 * framing reader for every view of every Sign in the process. Aborting the
 * reader's construction-time signal — which is what a first reading of
 * `createFalRegionReader` suggests — would cancel every other customer's read.
 *
 * What is still true, and is the honest remainder: `falRegionReader` declines
 * the caller's signal on its two SHARED reads (the memoised face axis and the
 * frame-address check), because one caller's deadline must not abort a read
 * another caller is awaiting. Both are bounded by their own timeouts.
 */
export const FRAMING_MEASUREMENT_TIMEOUT_MS = 45_000;

/**
 * Bound one measurement, and REJECT when the bound passes.
 *
 * Rejecting rather than resolving is deliberate: the `.catch` already on the
 * call turns any failure into a `cannotMeasure` whose `method` names the
 * reason, so a deadline that rejects lands in the one place that already
 * decides what an unmeasurable band does — rather than inventing a second
 * route to the same verdict, which is working law 4's shape.
 *
 * The timer is cleared on BOTH outcomes. A `setTimeout` left running holds the
 * event loop open, and this is called once per view on every Sign.
 *
 * It is local rather than `casting/geminiClient`'s `withTimeout`, which does
 * the same job: that helper's every consumer is inside `server/casting/`, the
 * legacy tree the retirement program is unpicking, and a V2 money path taking
 * its first dependency on it would be one more caller to unpick for ten lines.
 */
function withinFramingDeadline<T>(
  /*
    ⚠ **A FACTORY, NOT A PROMISE, AND THAT IS #1781's WHOLE SHAPE.** The
    controller has to exist BEFORE the work starts or the work cannot be told
    about it — so this hands the signal in rather than taking a promise already
    in flight. Taking a promise is what let the previous version stop the
    waiting without stopping the request.
  */
  start: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const giveUp = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => {
        /*
          ABORT FIRST, THEN REJECT. The reads are the thing holding the provider
          slot, and rejecting first would let the caller's `.catch` and the rest
          of the view's road run while they are still in flight — the same
          ordering bug one level up from the one this card is about.
        */
        giveUp.abort(new Error(`the framing measurement passed its ${ms / 1000}s deadline`));
        reject(new Error(`the framing measurement passed its ${ms / 1000}s deadline`));
      },
      ms,
    );
  });
  const work = start(giveUp.signal);
  /*
    `work` keeps a handler through the race even when the deadline wins, so its
    later rejection — which is now the NORMAL way an abandoned measurement ends,
    since the abort makes its reads throw — is handled rather than unhandled.
  */
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
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
export function viewConformanceRefuses(verdict: ViewConformanceVerdict): boolean {
  if (verdict.unjudged === true) return false;
  return !verdict.axes[REFUSING_AXIS].pass;
}

/** The axis {@link viewConformanceRefuses} reads. One name, one place. */
export const REFUSING_AXIS = "identity" as const satisfies ConformanceAxis;

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
 */
export function viewDeliveredUnchecked(provenance: unknown): boolean {
  if (provenance === null || typeof provenance !== "object") return false;
  const record = provenance as { conformanceMethod?: unknown; conformance?: unknown };
  if (record.conformanceMethod === "unavailable") return true;
  const axes = record.conformance;
  if (axes === null || typeof axes !== "object") return false;
  return CONFORMANCE_AXES.some((axis) => {
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
