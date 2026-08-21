/**
 * DOES THE PANEL POPOVER'S OWN SENTENCE REACH THE TRANSFORM LANE?
 * (fable-1288 §5's condition, before the flag moves.)
 *
 * The service drive used doubles for the interpreter. This asks the ONE thing a
 * double cannot answer: whether the sentence the popover actually composes —
 * the row's prefill plus what he types — comes back from the REAL interpreter as
 * a delta that names ink, which is the condition the prior question's door fires
 * on.
 *
 * The prefill is `facePanel.ts`'s own (`prefillFor`: "his upper chest tattoo — ")
 * and the typed half is his own words from fable-1269 §2.
 *
 * ⚠ THE FIRST RUN OF THIS SCRIPT IS THE FINDING: both sentences came back
 * `gate_ink_document` — D-137's wall, 1,860 lines before the road they were
 * built to reach. The gate's third document (`inkDocumentedByDelivery`) is the
 * fix, and the two arms below are set exactly as the service now sets it.
 *
 * THE NEGATIVE CONTROL IS NOT OPTIONAL HERE. A gate opened one clause too wide
 * renders a tattoo from words, which is the render D-137 exists to forbid — so a
 * FRESH ask on the same branch, with the same state, must still wall.
 *
 * Cost: one text call per sentence on OpenRouter. No engine, no segmenter, no
 * credits, no database, nothing written anywhere.
 */
import "dotenv/config";

import { interpretRefinement } from "../server/castingV2/refineInterpreter";
import { facetsWrittenBy } from "../server/castingV2/refineDelta";
import { inkSlotSheAsksAbout, readInkPriorAsk } from "../server/castingV2/inkPriorAsk";

/* What the branch holds — a delivered chest piece, which is the state the prior
   question reads and the thing his sentence points at. */
const PRIOR = { ink: ["a fine-line swallow chest piece"] };
const DELIVERED = ["ink:upperChest"];

const SENTENCES: Array<{ said: string; why: string; expect: "through" | "walled" }> = [
  /* THE ENTRANCE, exactly as the popover composes it today. */
  { said: "his upper chest tattoo — make it bigger", why: "the popover", expect: "through" },
  /* The same ask typed into the bare ask box, which is the other door into the
     same lane and carries no prefill at all. */
  { said: "make his chest tattoo bigger", why: "the ask box", expect: "through" },
  /* ⚠ THE NEGATIVE CONTROL — a FRESH chest tattoo from words, on the very same
     branch. D-137's wall must still hold: no pointer, no change word, and the
     indefinite form disqualifies the sentence outright. */
  { said: "give him a tattoo of an anchor on his chest", why: "NEGATIVE CONTROL", expect: "walled" },
];

let wrong = 0;
for (const { said, why, expect } of SENTENCES) {
  const reading = readInkPriorAsk(said);
  const onSlot = inkSlotSheAsksAbout(said, DELIVERED);
  /* Exactly as `refineService` composes it: both halves, neither alone. */
  const documented = DELIVERED.length > 0 && reading.want !== "fresh";
  const parsed = await interpretRefinement({
    /*
      ⚠ NO `mode` — CORRECTED 2026-08-21 (ordered fable-1314 §4(i)).

      This passed `mode: "edit"`, which the service uses ONLY as the second,
      disambiguating re-read of a sentence whose removal word was weak. Its
      default — and therefore the faithful argument — is no mode at all.

      It did not change THIS script's answer, because a transform parses the
      same either way. It changed the answer of the removal drive that copied
      it: `runOnce` gates the whole removal lane on `input.mode !== "edit"`, so
      the copy switched off the very lane it was auditing and every removal read
      as `unreadable`. A tracked script carrying a known-wrong argument is the
      next copy waiting to happen, which is why this is fixed rather than noted.
    */
    instruction: said,
    prior: PRIOR,
    inkDocumentedByDelivery: documented,
    /* Required by the contract and irrelevant to this question — the gate is
       about ink, and a null current value is what a face with no engineered
       eye edit actually has. */
    currentEyeColour: null,
    currentEyeShape: null,
  });
  const facets = parsed.ok && "delta" in parsed ? Array.from(facetsWrittenBy(parsed.delta)) : [];
  const fires = facets.includes("ink") && reading.want === "change" && onSlot.kind === "one";
  const got = parsed.ok ? "through" : "walled";
  if ((expect === "through") !== fires) wrong += 1;
  console.log("----", why);
  console.log("said        ", JSON.stringify(said));
  console.log("prior read  ", JSON.stringify(reading));
  console.log("slot        ", JSON.stringify(onSlot));
  console.log("documented  ", documented);
  console.log("interpreter ", got, parsed.ok ? "" : JSON.stringify((parsed as { refusal: unknown }).refusal));
  console.log("delta       ", parsed.ok && "delta" in parsed ? JSON.stringify(parsed.delta) : "(none)");
  console.log("facets      ", JSON.stringify(facets));
  console.log("DOOR FIRES  ", fires, "  expected:", expect);
}
console.log("====", wrong === 0 ? "ALL ARMS AS EXPECTED" : `${wrong} ARM(S) WRONG`);
/* The script guard's own rule: end by ending the process, as the last
   top-level statement. A non-zero code when an arm did not do what it said it
   would, so a caller reads the verdict rather than the prose. */
process.exit(wrong === 0 ? 0 : 1);
