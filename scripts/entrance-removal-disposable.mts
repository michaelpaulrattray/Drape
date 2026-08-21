/**
 * WHAT DOES THE INTERPRETER ACTUALLY FILE FOR AN ASK TO TAKE A TATTOO OFF?
 * (§10 item 3a, before a line of it is built; countersigned fable-1310.)
 *
 * The removal's composition shape depends on a fact no code read can settle.
 * `free: {ink: []}` is the delta shape that clears the pointers — the
 * composition rule says so by name — but an emptied plural subject
 * DELIBERATELY answers no facet (*"[] is not an answer"*), and the door into
 * this whole lane fires on `facetsWrittenBy(editDelta).has("ink")`. If the
 * interpreter's own removal delta answers the ink facet through some OTHER key
 * — `absent.ink` is the candidate — then the removal delta needs BOTH halves:
 * that key so the facet is answered and the renderer is told, and `free.ink: []`
 * so the pointers go empty with the words.
 *
 * Get that wrong in either direction and the failure is the expensive one this
 * program names: a paid removal that does not remove, or a delta that reads as
 * saying nothing and renders a no-op she paid for.
 *
 * Driving beats reading here — this program is three-for-three on drives
 * changing an answer a code read had already given.
 *
 * Cost: one text call per sentence on OpenRouter. No engine, no segmenter, no
 * credits, no database, nothing written anywhere.
 */
import "dotenv/config";

import { interpretRefinement } from "../server/castingV2/refineInterpreter";
import { facetsWrittenBy } from "../server/castingV2/refineDelta";
import { inkSlotSheAsksAbout, readInkPriorAsk } from "../server/castingV2/inkPriorAsk";

/* A branch wearing exactly ONE tattoo — the entire production population
   (opus-966 §1) and 3a's whole customer. */
const PRIOR = { ink: ["a fine-line swallow chest piece"] };
const DELIVERED = ["ink:upperChest"];

const SENTENCES: Array<{ said: string; why: string; want: "gone" | "fresh" | "change" }> = [
  { said: "his upper chest tattoo — remove it", why: "the popover's own prefill", want: "gone" },
  { said: "take his chest tattoo off", why: "the bare ask box", want: "gone" },
  { said: "get rid of the tattoo", why: "no placement named at all", want: "gone" },
  /* ⚠ NEGATIVE CONTROL — a TRANSFORM on the same branch and the same state.
     It must NOT read as a removal, or the action would take off a tattoo the
     customer asked to enlarge. */
  { said: "make his chest tattoo bigger", why: "NEGATIVE CONTROL (transform)", want: "change" },
];

let wrong = 0;
for (const { said, why, want } of SENTENCES) {
  const reading = readInkPriorAsk(said);
  const onSlot = inkSlotSheAsksAbout(said, DELIVERED);
  const documented = DELIVERED.length > 0 && reading.want !== "fresh";
  const parsed = await interpretRefinement({
    instruction: said,
    mode: "edit",
    prior: PRIOR,
    inkDocumentedByDelivery: documented,
    currentEyeColour: null,
    currentEyeShape: null,
  });
  const delta = parsed.ok && "delta" in parsed ? parsed.delta : null;
  const facets = delta ? Array.from(facetsWrittenBy(delta)) : [];
  if (reading.want !== want) wrong += 1;
  console.log("----", why);
  console.log("said        ", JSON.stringify(said));
  console.log("prior read  ", JSON.stringify(reading), " expected want:", want);
  console.log("slot        ", JSON.stringify(onSlot));
  console.log("interpreter ", parsed.ok ? "through" : `walled ${JSON.stringify((parsed as { refusal: unknown }).refusal)}`);
  console.log("delta       ", delta ? JSON.stringify(delta) : "(none)");
  console.log("  free.ink  ", delta ? JSON.stringify((delta as { free?: Record<string, unknown> }).free?.ink) : "-");
  console.log("  absent    ", delta ? JSON.stringify((delta as { absent?: unknown }).absent) : "-");
  console.log("facets      ", JSON.stringify(facets), facets.includes("ink") ? "← ink answered" : "← INK NOT ANSWERED");
}
console.log("====", wrong === 0 ? "every sentence read as intended" : `${wrong} SENTENCE(S) MISREAD`);

process.exit(wrong === 0 ? 0 : 1);
