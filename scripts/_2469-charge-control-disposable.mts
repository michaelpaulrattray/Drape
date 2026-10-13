/**
 * #2469 — WHAT IS A "Voice Generation" CHARGE? The card asks what the six
 * unexplained 350-character charges on #499 were, *"before money is reckoned
 * per design"*.
 *
 * `/v1/history` holds TTS items only and shows ZERO items billed 350
 * characters, so the hypothesis under test is: **a text-to-voice DESIGN call is
 * billed a flat 350 characters and never appears in TTS history** — which would
 * make the six charges the spike's own designs rather than anything unexplained.
 *
 * The control is a single design with the character counter read either side.
 * Costs about a cent of house money and spends no voice operation (measured).
 *
 *   npx tsx scripts/_2469-charge-control-disposable.mts
 */
import "dotenv/config";

import { createElevenLabsVoiceEngine } from "../server/providers/elevenlabsVoice";
import { VOICE_PREVIEW_TEXT } from "../server/castingV2/voiceAuditionPassage";

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error("ELEVENLABS_API_KEY absent");
  process.exit(1);
}

const readCounters = async () => {
  const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: { "xi-api-key": key },
  });
  const body = (await response.json()) as Record<string, number>;
  return {
    characters: body.character_count,
    operations: body.voice_add_edit_counter,
    slots: body.voice_slots_used,
  };
};

const engine = createElevenLabsVoiceEngine();
const say = (line: string) => console.log(line);

const before = await readCounters();
say(`BEFORE  characters ${before.characters} · operations ${before.operations} · slots ${before.slots}`);

/*
  ONE design. The description is house text, not a customer's line.

  ⚠ `previewText` is REQUIRED and that was found by this very script: without it
  the provider answers 400 `"You need to provide either 'text' or
  'auto_generate_text'"` (driven in `_2469-design-floor-disposable.mts`), so the
  interface was tightened and this call is what the typechecker then caught.
*/
const design = await engine.designVoices({
  description: "A steady, mid-range narrator with a dry edge and unhurried pace.",
  previewText: VOICE_PREVIEW_TEXT,
});
say(`\nDESIGN  ${design.previews.length} previews in ${design.latencyMs} ms`);
for (const [index, preview] of design.previews.entries()) {
  say(`  voice ${index + 1}: ${preview.bytes.byteLength} bytes`
    + `${preview.durationSeconds ? ` · ${preview.durationSeconds.toFixed(1)} s` : ""}`);
}

/* The provider's counters settle asynchronously, so poll briefly rather than
   reading once and reporting a zero that only means "not yet". */
let after = await readCounters();
for (let attempt = 0; attempt < 10 && after.characters === before.characters; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  after = await readCounters();
}

say(`\nAFTER   characters ${after.characters} · operations ${after.operations} · slots ${after.slots}`);
const charged = after.characters - before.characters;
say(`\nONE DESIGN COST: ${charged} characters · ${after.operations - before.operations} voice operation(s) `
  + `· ${after.slots - before.slots} slot(s)`);
/*
  THE ANSWER, and it is not the flat 350 the hypothesis guessed: a design is
  billed THE PREVIEW TEXT'S OWN CHARACTER COUNT, once — not per preview, and no
  voice operation. So a "Voice Generation" charge of 350 characters is a design
  whose preview text was 350 characters long, which is what the spike's was.
  Nothing on #499 is unexplained.
*/
say(
  charged === VOICE_PREVIEW_TEXT.length
    ? `  → EXACTLY the preview text's length (${VOICE_PREVIEW_TEXT.length}). A design is billed its `
      + `preview text, once, and spends no voice operation — so the six 350-character `
      + `"Voice Generation" charges on #499 are six designs with a 350-character preview text.`
    : `  → ${charged} charged against a ${VOICE_PREVIEW_TEXT.length}-character preview text, so the `
      + `billing is NOT simply the preview text and the question stays open.`,
);

process.exit(0);
