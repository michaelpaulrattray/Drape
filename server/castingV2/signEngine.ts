/**
 * The transports the Sign ceremony uses, and the door in front of them.
 *
 * Sibling of `rollEngine.ts`, and it follows the same two rules for the same
 * reasons: one process-wide queue per provider so admission and dispatch cannot
 * disagree, and a **missing credential fails before the money moves**, never at
 * dispatch — reaching dispatch means the customer has already been charged, and
 * a key we forgot to set is a configuration fault, not a generation failure
 * they should have to be refunded for.
 *
 * Two engines, because they answer different questions: the identity engine
 * (Nano Banana Pro) makes the picture, and the judge decides whether it may
 * land. They must not be the same model — a generator grading its own output is
 * not a second opinion, and prompt compliance as the sole check is the settled
 * anti-pattern (§I).
 */
import { createOpenRouterTextEngine, DEFAULT_INTERPRETER_MODEL } from "../providers/openrouterText";
import { createFalIdentityEngine } from "../providers/falQueue";
import { falAllowanceOf } from "./falBudget";
import { ProviderQueue } from "../providers/providerQueue";
import type { IdentityEngine } from "../providers/types";
import { CAST_PACKAGE_VIEWS } from "./castViewPackage";
import {
  createViewConformanceJudge,
  forcedFailAnglesFromEnv,
  type ViewConformanceJudge,
} from "./viewConformance";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return parsed;
}

let viewQueue: ProviderQueue | null = null;
let identityEngine: IdentityEngine | null = null;
let judge: ViewConformanceJudge | null = null;

export function castPackageQueue(): ProviderQueue {
  if (!viewQueue) {
    viewQueue = new ProviderQueue({
      name: "fal-cast-views",
      /*
        Lower than the sheet's eight on purpose. A package is six 2K identity
        generations against one account-level fal concurrency ceiling that the
        sheet is also drawing on; a Sign that starves the rolls behind it trades
        one customer's wait for everybody's.
      */
      concurrency: falAllowanceOf("SIGN_VIEW_CONCURRENCY"),
      maxQueueDepth: envInt("SIGN_VIEW_MAX_QUEUE_DEPTH", 24),
    });
  }
  return viewQueue;
}

export function castingIdentityEngine(): IdentityEngine {
  if (!identityEngine) {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) throw new Error("FAL_KEY is required to build a signed Cast package");
    identityEngine = createFalIdentityEngine({ apiKey, queue: castPackageQueue() });
  }
  return identityEngine;
}

export function castingViewConformanceJudge(): ViewConformanceJudge {
  if (!judge) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      /*
        No judge, no Sign — and this refusal is UNTOUCHED by D-246.

        There is a difference between "the checker broke mid-render, after the
        customer paid" and "this deployment has no checker at all". The first is
        the founder's flawed-detector case and now delivers (see
        `packageOrchestrator`); the second is a configuration mistake caught
        BEFORE any spend, which costs nobody a picture and nobody a credit.
        §I's law lives here, at the door, where refusing is free.
      */
      throw new Error("OPENROUTER_API_KEY is required to validate a signed Cast package");
    }
    judge = createViewConformanceJudge({
      engine: createOpenRouterTextEngine({
        apiKey,
        // Vision-capable, and the same slug the interpreter is pinned to — one
        // model to reason about, one retention conversation.
        model: process.env.SIGN_JUDGE_MODEL || DEFAULT_INTERPRETER_MODEL,
        queue: new ProviderQueue({ name: "openrouter-view-judge", concurrency: 3, maxQueueDepth: 24 }),
      }),
      ...(function forced() {
        const angles = forcedFailAnglesFromEnv(
          process.env.CASTING_V2_SIGN_FORCE_FAIL_VIEWS,
          CAST_PACKAGE_VIEWS,
        );
        return angles ? { forceFail: angles } : {};
      })(),
    });
  }
  return judge;
}

/** Test seam: drops the memoized engines so config changes take effect. */
export function resetSignEnginesForTests(): void {
  viewQueue = null;
  identityEngine = null;
  judge = null;
}
