/**
 * THE TRANSPORT THE PLATE MINT RUNS ON — station three's wiring (fable-968 §2).
 *
 * Sibling of `signEngine.ts` and `rollEngine.ts`, and it follows their two
 * rules for their reasons: one process-wide queue per path so admission and
 * dispatch cannot disagree, and the credential is read where the answer can
 * still be a sentence rather than at dispatch.
 *
 * # THE ENGINE IS NOT CHOSEN HERE — it is READ from the ruling
 *
 * The founder ruled it on the court's own sheet (*"NBP wins"*, fable-963 §2)
 * and `INK_PLATE_ENGINE` carries that verdict beside the measurement. This file
 * builds the engine that constant NAMES, through a record keyed by the ruled
 * name — so ruling a different engine is a change to the constant, and the
 * compiler then requires a builder for it here. A ruling nothing is keyed on is
 * a comment, and this program has paid for that shape more than once.
 *
 * # WHY NULL RATHER THAN A THROW WITH NO KEY
 *
 * `mintInkPlate` takes `engine: InkPlateEngine | null` and turns the absence
 * into the transport door's own sentence, before a database is touched. So a
 * deployment with no `FAL_KEY` refuses a mint in words rather than crashing an
 * upload — which is the opposite of the Sign path deliberately, because Sign
 * has already CHARGED by the time it reaches its engine and this has not.
 *
 * # THE ALLOWANCE
 *
 * One slot, `INK_PLATE_CONCURRENCY`, declared in `FAL_ALLOWANCES` — the fifth
 * path on an account whose twenty concurrent requests were already spent
 * exactly. Where the slot came from and why it costs the panel nothing is the
 * arithmetic in `falBudget.ts`'s header.
 */
import { createFalIdentityEngine } from "../providers/falQueue";
import { ProviderQueue } from "../providers/providerQueue";
import { falAllowanceOf } from "./falBudget";
import { INK_PLATE_ENGINE, platesByIdentityEngine, type InkPlateEngine } from "./inkPlateEngines";

/** The ruled name, as a type — so the record below cannot fall behind it. */
type RuledPlateEngine = typeof INK_PLATE_ENGINE;

let plateQueue: ProviderQueue | null = null;
let engine: InkPlateEngine | null = null;

export function inkPlateQueue(): ProviderQueue {
  if (!plateQueue) {
    plateQueue = new ProviderQueue({
      name: "fal-ink-plates",
      concurrency: falAllowanceOf("INK_PLATE_CONCURRENCY"),
      /*
        Shallow on purpose. A mint is ~37s measured, so a deep queue would hold
        an upload open for minutes with no sign of it; the cap is eight designs
        per Cast, and a depth beyond that is somebody's script rather than a
        customer.
      */
      maxQueueDepth: 8,
    });
  }
  return plateQueue;
}

/**
 * Every engine a plate may be drawn by, keyed by the name the RULING uses.
 *
 * One entry, and that is the state of the ruling rather than an oversight: the
 * court's losing arm still exists in `inkPlateEngines.ts` for a re-run, and a
 * builder here would make it reachable from production wiring, which is not
 * what a loser is for.
 */
const BUILDERS: Record<RuledPlateEngine, (apiKey: string) => InkPlateEngine> = {
  nanoBananaPro: (apiKey) => platesByIdentityEngine(
    createFalIdentityEngine({ apiKey, queue: inkPlateQueue() }),
    /* 2K because both tiers cost the same $0.15 and a plate is minted once and
       shown to an engine on every later render — see `inkPlateEngines.ts`. The
       aspect ratio stays ABSENT: that is the shape the court measured and the
       founder approved his plates on. */
    { resolution: "2K" },
  ),
};

/**
 * The plate engine for this deployment, or `null` where there is no transport.
 *
 * Memoized like its siblings: the queue is the allowance, and a second engine
 * would be a second allowance nobody declared.
 */
export function inkPlateEngine(): InkPlateEngine | null {
  if (!engine) {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) return null;
    engine = BUILDERS[INK_PLATE_ENGINE](apiKey);
  }
  return engine;
}

/** Test seam: the memo is process-wide, and a suite that changes the key or the
 *  allowance must be able to rebuild rather than read a stale engine. */
export function resetInkPlateEngineForTests(): void {
  plateQueue = null;
  engine = null;
}
