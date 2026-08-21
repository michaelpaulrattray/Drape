/**
 * A CARRIED TATTOO WALLS A NEW ONE — the repro, and now the real-reader arm of
 * its FIX (found by the capability census's first run, 2026-08-21; FIXED
 * 2026-08-22, ruled fable-1326 §3).
 *
 * ⚠ IT WAS CALLED INTERMITTENT FOR A DAY AND IT NEVER WAS. Extension-1's first
 * run reported it absent on a real branch, which read as model-dependence; the
 * census's per-row repin showed that run had been measuring an UNPINNED cast —
 * the branch was not there to carry anything. Deterministic here throughout.
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
const CARRIED = ["a fine-line swallow on his upper chest"];
/*
  FIXED 2026-08-22 (ruled fable-1326 §3): the gate now skips an item warranted
  ONLY by the prior — the restatement we ourselves instructed the model to make.
  The two NEGATIVE arms are the half that matters, because a fix that simply
  switched the gate off on any inked branch would pass the first two and leave a
  words-rendered tattoo landing wherever the model felt like putting it.
*/
const arms = [
  { name: "CONTROL — bare prior", ask: ASK, prior: {}, expect: "served" },
  { name: "a chest piece already carried", ask: ASK, prior: { ink: CARRIED }, expect: "served" },
  {
    name: "NEG — SHE asks for the chest, inked branch",
    ask: "give him another swallow tattoo on his upper chest",
    prior: { ink: CARRIED }, expect: "refused:gate_ink_uncarried",
  },
  {
    name: "NEG — undocumented place, inked branch",
    ask: "give him a tattoo on his lower back",
    prior: { ink: CARRIED }, expect: "refused:gate_ink_document",
  },
] as const;

let wrong = 0;
for (const arm of arms) {
  const parsed = await interpretRefinement({
    instruction: arm.ask, prior: arm.prior, inkWordsRoadOpen: true, currentEyeColour: null, currentEyeShape: null,
  } as Parameters<typeof interpretRefinement>[0]);
  const got = parsed.ok ? "served" : `refused:${(parsed as { refusal: { reason: string; place?: string } }).refusal.reason}`;
  const place = !parsed.ok ? (parsed as { refusal: { place?: string } }).refusal.place : undefined;
  const ok = got === arm.expect;
  if (!ok) wrong += 1;
  console.log(`${ok ? "  ok " : "WRONG"}  ${arm.name.padEnd(34)} → ${got}${place ? ` (place: ${place})` : ""}   expected ${arm.expect}`);
}
console.log(wrong === 0 ? "all four arms correct — the carried tattoo no longer walls, and both walls still stand" : `WRONG on ${wrong} arm(s)`);

process.exit(wrong === 0 ? 0 : 1);
