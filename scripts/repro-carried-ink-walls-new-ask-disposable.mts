/**
 * REPRO — A CARRIED TATTOO WALLS A NEW ONE (found by the capability census's
 * first run, 2026-08-21; reproduced here in isolation, two text calls).
 *
 * On a branch that already wears a chest piece, *"give him a small swallow
 * tattoo on his neck"* — the words road's proven placement — is refused with
 * the CHEST sentence: *"…top covers their upper chest, so a tattoo there
 * wouldn't survive the next edit…"*. Nobody asked for the chest.
 *
 * Mechanism (read at `refineDelta.ts`, the ink document gate): `free.ink` is
 * ONE subject holding every tattoo she has (fable-1167 §2e), so the
 * interpreter restates the carried chest item beside the new neck item, and
 * the gate classifies EVERY item — the carried "upper chest" hits `not_carried`
 * first and walls the whole ask. The gate cannot tell a new item from a
 * restated one, because the words half is flat prose (the keying work, §10 3b).
 *
 * Founder-visible: his cast 1641 wears the chest piece on v208, so a neck ask
 * on that branch reads the chest refusal.
 *
 *   npx tsx scripts/repro-carried-ink-walls-new-ask-disposable.mts
 *
 * Cost: two OpenRouter text calls. No engine, no credits, no database.
 */
import "dotenv/config";

process.env.CASTING_V2_SCOPE = process.env.CASTING_V2_SCOPE ?? "all";

const { interpretRefinement } = await import("../server/castingV2/refineInterpreter");

const ASK = "give him a small swallow tattoo on his neck";
const arms = [
  { name: "CONTROL — bare prior", prior: {}, expect: "served" },
  { name: "a chest piece already carried", prior: { ink: ["a fine-line swallow on his upper chest"] }, expect: "served" },
] as const;

let wrong = 0;
for (const arm of arms) {
  const parsed = await interpretRefinement({
    instruction: ASK, prior: arm.prior, inkWordsRoadOpen: true, currentEyeColour: null, currentEyeShape: null,
  } as Parameters<typeof interpretRefinement>[0]);
  const got = parsed.ok ? "served" : `refused:${(parsed as { refusal: { reason: string; place?: string } }).refusal.reason}`;
  const place = !parsed.ok ? (parsed as { refusal: { place?: string } }).refusal.place : undefined;
  const ok = got === arm.expect;
  if (!ok) wrong += 1;
  console.log(`${ok ? "  ok " : "WRONG"}  ${arm.name.padEnd(34)} → ${got}${place ? ` (place: ${place})` : ""}   expected ${arm.expect}`);
}
console.log(wrong === 0 ? "no defect reproduced" : `DEFECT REPRODUCED: ${wrong} arm(s) — a carried tattoo walls a new ask`);

process.exit(wrong === 0 ? 0 : 1);
