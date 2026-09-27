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
 * Two engines, because they answer different questions: one makes the picture,
 * and the judge decides whether it may land. They must not be the same model —
 * a generator grading its own output is not a second opinion, and prompt
 * compliance as the sole check is the settled anti-pattern (§I).
 *
 * ⚠ **AND THE ONE THAT MAKES THE PICTURE IS NOW TWO, BECAUSE THE SIGN AND THE
 * REFINE ARE ON DIFFERENT ENGINES (#1459, 2026-09-27).** His word closed the
 * outfit court: *"sunburst produced the best result easily"*. So a SIGNED VIEW
 * renders on GPT Image 2.5 Sunburst `high` (`castingViewEngine`), and the paid
 * refine's non-repaint edit stays on Nano Banana Pro at `1K`
 * (`castingIdentityEngine`, which `refineService.ts` reads). Read
 * `createFalSunburstViewEngine`'s own docblock for the measurement, the price
 * and the reason the two did not move together — the short version is that his
 * word moved the signed views and nothing else.
 */
import { createOpenRouterTextEngine, DEFAULT_INTERPRETER_MODEL } from "../providers/openrouterText";
import { createFalIdentityEngine } from "../providers/falQueue";
import { createFalSunburstViewEngine } from "../providers/falImages";
import { falAllowanceOf } from "./falBudget";
import { ProviderQueue } from "../providers/providerQueue";
import type { IdentityEngine } from "../providers/types";
import { CAST_PACKAGE_VIEWS } from "./castViewPackage";
import {
  createViewConformanceJudge,
  forcedFailAnglesFromEnv,
  type ViewConformanceJudge,
} from "./viewConformance";
import { envInt } from "../_core/env";


let viewQueue: ProviderQueue | null = null;
let identityEngine: IdentityEngine | null = null;
let viewEngine: IdentityEngine | null = null;
let judge: ViewConformanceJudge | null = null;

function castPackageQueue(): ProviderQueue {
  if (!viewQueue) {
    viewQueue = new ProviderQueue({
      name: "fal-cast-views",
      /*
        Lower than the sheet's eight on purpose. A package is five 2K identity
        generations against one account-level fal concurrency ceiling that the
        sheet is also drawing on; a Sign that starves the rolls behind it trades
        one customer's wait for everybody's.
      */
      concurrency: falAllowanceOf("SIGN_VIEW_CONCURRENCY"),
      maxQueueDepth: envInt("SIGN_VIEW_MAX_QUEUE_DEPTH"),
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

/**
 * WHAT A SIGNED VIEW RENDERS ON — his word, 2026-09-27 (#1459).
 *
 * `packageOrchestrator`'s attempt loop takes this one, so the Sign and a Try
 * again are one engine (they must be, or one cast wears two looks). Everything
 * else that reaches `castingIdentityEngine` above — the refine's non-repaint
 * edit, and the courts that pin the old engine on purpose — is untouched.
 *
 * ⚠ **IT SHARES THE SIGN'S QUEUE, AND THAT IS THE WHOLE BUDGET STORY.** The
 * fal account's ceiling is spent by four declared paths (`falBudget.ts`) and
 * this road is one of them at `SIGN_VIEW_CONCURRENCY` 3. The engine changed;
 * the path did not, so the arithmetic `assertFalBudget()` refuses to boot
 * against is unmoved — a second queue here would have been a fifth spender
 * that no table knew about, which is the defect that table exists for.
 *
 * The missing-credential refusal is the same one, for the same reason stated
 * at the top of this file: it fires before the money moves, not at dispatch.
 */
export function castingViewEngine(): IdentityEngine {
  if (!viewEngine) {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) throw new Error("FAL_KEY is required to build a signed Cast package");
    viewEngine = createFalSunburstViewEngine({ apiKey, queue: castPackageQueue() });
  }
  return viewEngine;
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
