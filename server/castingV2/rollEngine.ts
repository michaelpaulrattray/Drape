/**
 * The casting image transport, and the door in front of it (plan §H.8).
 *
 * One process-wide queue for one provider. Both the dispatch path and the
 * admission check read the *same* instance on purpose: an admission check
 * against a different queue than the one that will hold the work is decoration.
 *
 * §H.8's rule is that queue pressure produces an honest refusal at roll
 * creation — a real `TOO_MANY_REQUESTS` — never a silent backlog of paid work.
 * A roll admitted here commits to eight jobs, so admission asks whether all
 * eight fit, not whether one does.
 */
import {
  createFalCreativeEngine,
  FAL_GPT_IMAGE_25_FLARE,
  FAL_GPT_IMAGE_25_SUNBURST,
} from "../providers/falImages";
import { type CastingRollEngineModel, castingRollEngineModelFor } from "./castingV2Scope";
import { falAllowanceOf } from "./falBudget";
import { ProviderQueue } from "../providers/providerQueue";
import type { CreativeEngine } from "../providers/types";
import { envInt } from "../_core/env";


let queue: ProviderQueue | null = null;
let engine: CreativeEngine | null = null;
/** One memoized engine per chosen 2.5 model, all on the one queue. */
const chosenEngines = new Map<CastingRollEngineModel, CreativeEngine>();
const MODEL_ENDPOINTS: Readonly<Record<CastingRollEngineModel, string>> = {
  flare: FAL_GPT_IMAGE_25_FLARE,
  sunburst: FAL_GPT_IMAGE_25_SUNBURST,
};

function castingImageQueue(): ProviderQueue {
  if (!queue) {
    queue = new ProviderQueue({
      name: "fal-casting-images",
      /* From the shared budget, which the boot check proves fits inside the
         account's ceiling beside the scans, the views and the edits. */
      concurrency: falAllowanceOf("ROLL_IMAGE_CONCURRENCY"),
      maxQueueDepth: envInt("ROLL_IMAGE_MAX_QUEUE_DEPTH"),
    });
  }
  return queue;
}

function falApiKey(): string {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    // Fail here rather than at dispatch: reaching dispatch means the user is
    // already charged, and a missing credential is a configuration fault, not
    // a generation failure they should have to be refunded for.
    throw new Error("FAL_KEY is required for casting image generation");
  }
  return apiKey;
}

/**
 * THE ENGINE FOR THIS USER'S ROLL (#1079). Two memoized engines, ONE queue:
 * the budget the boot check proves fits inside the account's ceiling is spent
 * from one place whichever model paints.
 *
 * ⚠ **EVERY ROLL RENDERS ON GPT IMAGE 2.5 SUNBURST NOW, and the scope flag
 * governs an EXCEPTION rather than the road** (#1340, his word 2026-09-26:
 * *"anywhere we currently use gpt image 2.0 will be 2.5 sunburst by default
 * now … switching all engines to gpt image 2.5 sunburst is a now job"*).
 * Until this commit the unscoped branch was GPT Image 2, so **his account
 * rolled on Sunburst and every other account rolled on the older engine** —
 * the gap this closes. `CASTING_ROLL_ENGINE_SCOPE` + `CASTING_ROLL_ENGINE_MODEL`
 * still decide, and are now how a court puts somebody on `flare` instead.
 *
 * Both halves of the swap are measured rather than assumed, which is clause 3
 * of the disappearing-technology law (*name the price and the latency*):
 *
 *   price     $0.015 a picture against GPT Image 2's $0.099 — #1134's clean
 *             window, and every re-reading of GPT Image 2 sits BELOW its own
 *             constant while every reading of Sunburst is at least three times
 *             below it (`scripts/lib/falSpend.mts`, `FAL_MEASURED_USD`).
 *   latency   median roll wall time **26.5s on Sunburst (n=22) against 45.5s
 *             on GPT Image 2 (n=12)**, read at 45 days of production rolls
 *             (`casting_rolls.operationId` → `generation_operations`, grouped
 *             by `casting_candidates.providerModel`). The arms straddle an
 *             engine change rather than randomising it, and roll wall time
 *             includes our own queue and the judge, so it is a reading of the
 *             PRODUCT rather than of the model — which is the figure a customer
 *             actually waits.
 *
 * Cheaper and faster, and his eye had already chosen it (N1 signed off on a
 * Sunburst roll, 2026-09-23).
 *
 * A caller with no user in hand (none today — both the roll and the retry
 * dispatch know whose roll it is) gets the default, which is now Sunburst.
 */
export function castingCreativeEngine(userId?: number): CreativeEngine {
  const chosen = userId !== undefined ? castingRollEngineModelFor(userId) : null;
  if (chosen !== null) {
    let picked = chosenEngines.get(chosen);
    if (!picked) {
      picked = createFalCreativeEngine({
        apiKey: falApiKey(),
        model: MODEL_ENDPOINTS[chosen],
        queue: castingImageQueue(),
      });
      chosenEngines.set(chosen, picked);
    }
    return picked;
  }
  if (!engine) {
    engine = createFalCreativeEngine({
      apiKey: falApiKey(),
      /* Named here rather than left to the factory's default, so the engine a
         roll renders on is readable at the roll's own call site. */
      model: FAL_GPT_IMAGE_25_SUNBURST,
      queue: castingImageQueue(),
    });
  }
  return engine;
}

export type AdmissionDecision =
  | { admitted: true }
  | { admitted: false; reason: "busy" | "unavailable" };

/**
 * Asks whether a whole roll fits — before the claim, before the charge.
 *
 * The breaker check is not redundant with the queue's own: the queue refuses
 * an *individual dispatch* once it is open, which for a roll would mean
 * charging the user and then failing all eight. Refusing at the door means
 * they were never charged at all.
 */
export function admitRoll(candidateCount: number, stats = castingImageQueue().stats()): AdmissionDecision {
  if (stats.breaker === "open") return { admitted: false, reason: "unavailable" };
  if (stats.depth + candidateCount > stats.maxQueueDepth) return { admitted: false, reason: "busy" };
  return { admitted: true };
}

/** Test seam: drops the memoized queue/engine so config changes take effect. */
export function resetCastingEngineForTests(): void {
  queue = null;
  engine = null;
  chosenEngines.clear();
}
