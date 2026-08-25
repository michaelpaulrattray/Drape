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
import { packageViewExpectation } from "./castViewPackage";

const log = createModuleLogger("castingV2/viewConformance");

export const CONFORMANCE_AXES = ["identity", "angle", "wardrobe"] as const;
export type ConformanceAxis = (typeof CONFORMANCE_AXES)[number];

export type AxisVerdict = {
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
};

export type ViewConformanceInput = {
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
export const AXIS_VERDICTS = ["matches", "differs", "unsure"] as const;
export type AxisVerdictWord = (typeof AXIS_VERDICTS)[number];

const axisSchema = z.object({
  verdict: z.enum(AXIS_VERDICTS),
  note: z.string().max(400).optional(),
});

const verdictSchema = z.object({
  identity: axisSchema,
  angle: axisSchema,
  wardrobe: axisSchema,
});

const JUDGE_SYSTEM = [
  "You inspect photographs for a casting studio before they are delivered to the customer.",
  "You are given two images: IMAGE 1 is the signed reference photograph of the person, and IMAGE 2 is a new photograph that is supposed to be the same person, delivered against a written specification.",
  "Judge three things independently. Do not let one influence another.",
  "1. identity — is the person in IMAGE 2 the same individual as in IMAGE 1? Judge bone structure, facial proportions, skin, hair and build. A similar-looking person of the same type is a FAIL.",
  "2. angle — does IMAGE 2 show the framing the specification asks for? Judge only what the specification names.",
  "3. wardrobe — does IMAGE 2 show the clothing the specification names, unchanged from IMAGE 1 where both are visible?",
  "Answer ONLY with a JSON object of the form",
  '{"identity":{"verdict":"matches","note":"..."},"angle":{"verdict":"matches","note":"..."},"wardrobe":{"verdict":"matches","note":"..."}}',
  'Each verdict is exactly one of "matches", "differs" or "unsure".',
  'Use "matches" when the image satisfies the specification for that axis, "differs" when it does not, and "unsure" when you genuinely cannot tell from what you can see.',
  "The note is one short sentence saying what you saw. The VERDICT is your answer — never write a note that argues against your own verdict; if the note would say the image is fine, the verdict is \"matches\".",
].join(" ");

/** Fail-closed on every axis, with one honest reason. */
function unjudged(method: string, reason: string): ViewConformanceVerdict {
  const axis: AxisVerdict = { pass: false, note: reason };
  return {
    pass: false,
    method,
    unjudged: true,
    axes: { identity: { ...axis }, angle: { ...axis }, wardrobe: { ...axis } },
  };
}

export type ViewConformanceJudgeConfig = {
  engine: TextEngine;
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

    const expectation = packageViewExpectation(input.angle, input.wardrobeLine ?? null);
    let text: string;
    try {
      const reply = await config.engine.complete({
        about: "verify",
        system: JUDGE_SYSTEM,
        user: [
          "SPECIFICATION for IMAGE 2:",
          `Framing: ${expectation.framing}`,
          `Wardrobe: ${expectation.wardrobe}`,
        ].join("\n"),
        images: [input.anchor, input.candidate],
        json: true,
        temperature: 0,
        maxOutputTokens: 500,
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
        return unjudged("refused", "the conformance judge refused to answer");
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
        return unjudged("account", "our judging account is out of funds");
      }
      log.error({ angle: input.angle, err: error }, "[viewConformance] judge call failed — failing closed");
      return unjudged("unavailable", "the conformance judge could not be reached");
    }

    const parsed = verdictSchema.safeParse(readJson(text));
    if (!parsed.success) {
      log.error(
        { angle: input.angle },
        "[viewConformance] judge reply did not parse — failing closed",
      );
      return unjudged("unparsed", "the conformance judge's answer could not be read");
    }

    /*
      `pass` is DERIVED, never read. It exists so every downstream reader — the
      slot marker, the room's confession, the receipt — keeps the shape it
      already has, but it is a projection of the verdict rather than a second
      field the model can contradict.

      `unsure` fails, which is §I stated in one place instead of relied upon in
      a prompt: an axis nobody could judge is not an axis that passed.
    */
    const axes: Record<ConformanceAxis, AxisVerdict> = {
      identity: axisFrom(parsed.data.identity),
      angle: axisFrom(parsed.data.angle),
      wardrobe: axisFrom(parsed.data.wardrobe),
    };
    return {
      pass: CONFORMANCE_AXES.every((axis) => axes[axis].pass),
      method: `judge:${config.engine.id}`,
      axes,
    };
  };
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
