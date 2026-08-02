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
  pass: boolean;
  /** One short sentence. Internal — persisted on the slot, never projected. */
  note: string;
};

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
  signal?: AbortSignal;
};

export type ViewConformanceJudge = (input: ViewConformanceInput) => Promise<ViewConformanceVerdict>;

const axisSchema = z.object({
  pass: z.boolean(),
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
  '{"identity":{"pass":true,"note":"..."},"angle":{"pass":true,"note":"..."},"wardrobe":{"pass":true,"note":"..."}}',
  "Each note is one short sentence saying what you saw. If you are unsure about an axis, that axis fails.",
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

    const expectation = packageViewExpectation(input.angle);
    let text: string;
    try {
      const reply = await config.engine.complete({
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

    const axes: Record<ConformanceAxis, AxisVerdict> = {
      identity: { pass: parsed.data.identity.pass, note: parsed.data.identity.note ?? "" },
      angle: { pass: parsed.data.angle.pass, note: parsed.data.angle.note ?? "" },
      wardrobe: { pass: parsed.data.wardrobe.pass, note: parsed.data.wardrobe.note ?? "" },
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
