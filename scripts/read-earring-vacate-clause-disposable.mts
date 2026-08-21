/**
 * WHAT AN EARRING REMOVAL SAYS TODAY, at the wire — free, no renders, no rows.
 *
 * The per-instance phrase changes what a vacate says, and a change is only
 * legible against what is being changed. `repaintAsksFor` vacates every slot
 * the kind owns, so a pair vacates two — and the question this answers is
 * whether the change clause therefore says the pair phrase TWICE today.
 *
 *   npx tsx scripts/read-earring-vacate-clause-disposable.mts
 */
import { repaintAsksFor } from "../server/castingV2/repaintAsks";
import { assembleRecipe } from "../server/castingV2/recipeAssembler";
import { EDIT_PROSE } from "../server/castingV2/refineService";

for (const noun of ["earrings", "glasses"]) {
  const asks = repaintAsksFor({
  /* §5e: the reask questions and the vacancy phrases are a function of the
     Cast's own pronouns now — a bench supplies one Cast. */
  pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
    delta: { absent: { statedAccessories: [noun] }, free: { statedAccessories: [] } } as any,
    prose: EDIT_PROSE,
  });
  console.log(`\n── "${noun}" departing`);
  if (!asks.ok) {
    console.log(`  refused: ${asks.reason} — ${asks.detail}`);
    continue;
  }
  console.log(`  slots: ${asks.asks.map((ask) => `${ask.slot}${ask.vacate ? " (vacate)" : ""}`).join(" · ")}`);
  const recipe = assembleRecipe({
    master: { key: "master" },
    pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
    library: [],
    asks: asks.asks,
  });
  if (!recipe.ok) {
    console.log(`  recipe refused: ${recipe.reason}`);
    continue;
  }
  console.log(`  vacated: ${JSON.stringify(recipe.vacated)}`);
  console.log(`  PROMPT: "${recipe.prompt}"`);
}

process.exit(0);
