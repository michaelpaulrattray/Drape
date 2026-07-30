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
import { createFalCreativeEngine, FAL_GPT_IMAGE_2 } from "../providers/falImages";
import { ProviderQueue } from "../providers/providerQueue";
import type { CreativeEngine } from "../providers/types";

/** Set to 8 for the fal transport per the M3 report's recommendation 7. */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return parsed;
}

let queue: ProviderQueue | null = null;
let engine: CreativeEngine | null = null;

export function castingImageQueue(): ProviderQueue {
  if (!queue) {
    queue = new ProviderQueue({
      name: "fal-casting-images",
      concurrency: envInt("ROLL_IMAGE_CONCURRENCY", 8),
      maxQueueDepth: envInt("ROLL_IMAGE_MAX_QUEUE_DEPTH", 64),
    });
  }
  return queue;
}

export function castingCreativeEngine(): CreativeEngine {
  if (!engine) {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      // Fail here rather than at dispatch: reaching dispatch means the user is
      // already charged, and a missing credential is a configuration fault, not
      // a generation failure they should have to be refunded for.
      throw new Error("FAL_KEY is required for casting image generation");
    }
    engine = createFalCreativeEngine({
      apiKey,
      model: FAL_GPT_IMAGE_2,
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
}
