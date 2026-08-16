import { createModuleLogger } from "../logging/logger";
import { ProviderError } from "./types";

const log = createModuleLogger("providers/bannedEngines");

/**
 * THE ENGINE BAN, AND THE SEAM THAT ENFORCES IT.
 *
 * This lived in `falImages.ts` as a lone constant until 2026-08-17, where it was
 * referenced by no production code at all — the ban was prose, and its only
 * reader was the eye-shape test, whose own comment said what that is worth:
 * *"a ban that only lives in prose is a note to someone already looking."*
 * It moved here so the transport can consult it without importing the engine
 * module back (a cycle), which is the whole reason it was never wired.
 *
 * ⛔ FLUX.2 PRO IS BANNED FROM THIS PROGRAM — founder ruling, 2026-08-07.
 *
 * Never tested again, on anything. Struck from the engine pool, the routing
 * table, and every future probe design. The record is 0-for-4:
 *
 *   1. the engine bake-off — OVER-STYLED, consistently the least restrained
 *      photographically (seam 35.9 and 21.1 against NBP's and GPT2's teens)
 *   2. the glasses silhouette case — GHOSTED, doubled frame outlines, the only
 *      engine to fail that scenario visibly
 *   3. seam convergence — NEVER CONVERGED at any radius, alone among the three
 *   4. eye geometry, its one reputed strength, given a caged chance on a face
 *      measured flat enough to show the delta — it DECORATED rather than
 *      restructured (-0.42deg, inside the instrument's own noise)
 *
 * **The reputation was always styling mistaken for anatomy.** It looked like the
 * engine that changed structure because it changed the most, and "changed the
 * most" is the one thing this program has learned not to read as compliance.
 *
 * Do not add it back for a fifth try. If a successor model appears it is a new
 * entry with its own evidence, not this one rehabilitated.
 */
export const BANNED_ENGINES = ["fal-ai/flux-2-pro", "fal-ai/flux-2-pro/edit"] as const;

/**
 * THE BAN IS ON THE MODEL, NOT ON ONE VENDOR'S SPELLING OF IT.
 *
 * The founder banned an engine, and the two ids above are how fal happens to
 * name it today. The same model reached through OpenRouter would be
 * `black-forest-labs/flux-2-pro` and an exact-match guard would wave it
 * through — a ban that only holds on the road nobody was going to take it down
 * anyway. So the check is on the model slug, and the slugs are DERIVED from the
 * list above rather than typed beside it (working law 4: derive, never mirror).
 *
 * It matches by containment, which deliberately over-reaches onto ids like
 * `flux-2-pro-ultra`. That direction is the safe one: the failure is a loud
 * throw naming this ruling, in front of whoever is choosing the engine — not a
 * paid render by a banned model.
 *
 * A genuinely NEW model is a new entry with its own evidence, as the ruling
 * says. Nothing here decides anything about one.
 */
export const BANNED_MODEL_SLUGS: readonly string[] = Array.from(
  new Set(
    BANNED_ENGINES.map((engine) => {
      const parts = engine.toLowerCase().split("/");
      // `vendor/model` and `vendor/model/edit` are the same model.
      return parts[1] ?? parts[0];
    }),
  ),
);

export function isBannedEngine(engine: string): boolean {
  const id = engine.toLowerCase();
  return BANNED_MODEL_SLUGS.some((slug) => id.includes(slug));
}

/**
 * Refuse before dispatch — the fifth member of the refuse-before-dispatch family,
 * and the only one that is about us rather than about the ask.
 *
 * Classed `capability` so it is non-retryable (three tries at a banned engine is
 * still a banned engine) and so it does not trip the provider breaker, which is
 * for provider health and knows nothing about our routing table. Nothing selects
 * a banned engine today, so this changes no behaviour; it exists so that the day
 * something does, it stops at the seam instead of billing a customer for it.
 */
export function assertEngineNotBanned(engine: string, where: string): void {
  if (!isBannedEngine(engine)) return;
  log.error({ engine, where }, "[bannedEngines] refused a dispatch to a banned engine");
  throw new ProviderError(
    "capability",
    `"${engine}" is a BANNED engine (founder ruling 2026-08-07, see BANNED_ENGINES) and was refused at ${where} before dispatch`,
  );
}
