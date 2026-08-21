/**
 * IS THE REMOVAL WALL INK-SPECIFIC, OR CAN THE INTERPRETER NOT READ A REMOVAL
 * AT ALL? — the control the first removal drive owed (§10 item 3a).
 *
 * The first drive found every ink-removal sentence coming back `unreadable`,
 * which makes `inkRemovalNotYet` unreachable. A finding that large needs to
 * know its own scope before it is filed: if *"take her glasses off"* also
 * walls, this is the interpreter's removal lane and not the ink road's; if it
 * goes through, the ink road is the thing to fix.
 *
 * ⚠ THE FIRST RUN OF THIS SCRIPT WAS A HARNESS ARTIFACT AND IS THE FINDING.
 *
 * It passed `mode: "edit"` — copied from the transform drive beside it — and
 * every removal came back `unreadable`, which read as *"removals are broken
 * product-wide"*. They are not. `runOnce` gates the entire removal lane on
 * `input.mode !== "edit"`, and the service's own default passes NO mode at all:
 * `mode: "edit"` is only ever the SECOND, disambiguating re-read of a sentence
 * whose removal word was weak. So the harness had switched off the very lane it
 * was auditing, and the model — answering correctly the whole time with
 * `{"statedAccessories": []}` — was being discarded by a parser that had been
 * told not to expect it.
 *
 * The wrapper below records the RAW reply for exactly this reason: an "empty
 * reply — re-sampling" warning is what a discarded GOOD answer looks like from
 * the outside, and the two are indistinguishable without reading the bytes.
 *
 * Cost: one text call per sentence on OpenRouter. Nothing written anywhere.
 */
import "dotenv/config";

import { interpretRefinement } from "../server/castingV2/refineInterpreter";
import { facetsWrittenBy } from "../server/castingV2/refineDelta";

const CASES: Array<{ said: string; why: string; prior: Record<string, string[]> }> = [
  /* A NON-INK removal, on a subject the product has removed for a long time. */
  { said: "take her glasses off", why: "CONTROL — non-ink removal", prior: { statedAccessories: ["round tortoiseshell glasses"] } },
  { said: "remove her earrings", why: "CONTROL — non-ink removal", prior: { statedAccessories: ["small gold hoops"] } },
  /* The ink removals again, beside them, so both live in one reading. */
  { said: "take his chest tattoo off", why: "ink removal", prior: { ink: ["a fine-line swallow chest piece"] } },
  { said: "remove his tattoo", why: "ink removal, plainest form", prior: { ink: ["a fine-line swallow chest piece"] } },
  /* And a non-removal ink ask, proving the transport and the prior are fine. */
  { said: "make his chest tattoo bigger", why: "CONTROL — ink, not a removal", prior: { ink: ["a fine-line swallow chest piece"] } },
];

for (const { said, why, prior } of CASES) {
  const parsed = await interpretRefinement({
    instruction: said,
    /* ⚠ NO `mode`, AND THAT IS THE WHOLE CORRECTION (see the header). */
    prior,
    inkDocumentedByDelivery: true,
    currentEyeColour: null,
    currentEyeShape: null,
  });
  const delta = parsed.ok && "delta" in parsed ? parsed.delta : null;
  const facets = delta ? Array.from(facetsWrittenBy(delta)) : [];
  console.log(`${why.padEnd(34)} ${JSON.stringify(said).padEnd(34)} `
    + `${parsed.ok ? "THROUGH" : `WALLED ${JSON.stringify((parsed as { refusal: { reason?: string } }).refusal?.reason)}`}`);
  console.log(`${" ".repeat(34)} delta ${delta ? JSON.stringify(delta) : "(none)"}`);
  console.log(`${" ".repeat(34)} facets ${JSON.stringify(facets)}\n`);
}

process.exit(0);
