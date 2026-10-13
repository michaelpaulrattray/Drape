/**
 * #2469 — WHY did a design with no `previewText` answer 400? The service always
 * sends one, so production is unaffected; but `VoiceEngine.designVoices` types
 * `previewText` as OPTIONAL, and an optional field the provider actually
 * requires is a trap for the next caller (N4b-2's "Make new voices" is the next
 * caller).
 *
 * Both arms driven at the wire. The descriptions here are HOUSE text, never a
 * customer's line, which is why the body may be printed.
 *
 *   npx tsx scripts/_2469-design-floor-disposable.mts
 */
import "dotenv/config";

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error("ELEVENLABS_API_KEY absent");
  process.exit(1);
}

const DESCRIPTION = "A steady, mid-range narrator with a dry edge and unhurried pace.";
const PREVIEW_TEXT =
  "Let me take it from the top, and I will keep going until you tell me to stop. The room is quiet. "
  + "Soft things first: a hush, a whisper. Then the hard edges. Stop. Back. Pick it up. Put it down.";

async function design(label: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch("https://api.elevenlabs.io/v1/text-to-voice/design", {
    method: "POST",
    headers: { "xi-api-key": key!, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  console.log(`\n${label}`);
  console.log(`  payload keys: ${Object.keys(payload).join(", ")}`);
  console.log(`  status ${response.status}`);
  if (response.ok) {
    const body = JSON.parse(text) as { previews?: unknown[] };
    console.log(`  previews: ${body.previews?.length ?? 0}`);
  } else {
    console.log(`  body: ${text.slice(0, 400)}`);
  }
}

/* ARM 1 — no preview text, which is what failed. */
await design("ARM 1 · description only (previewText omitted)", {
  voice_description: DESCRIPTION,
  model_id: "eleven_ttv_v3",
  output_format: "mp3_44100_128",
});

/* ARM 2 — the same description WITH preview text: the service's own shape. */
await design("ARM 2 · description + previewText (what the service always sends)", {
  voice_description: DESCRIPTION,
  model_id: "eleven_ttv_v3",
  output_format: "mp3_44100_128",
  text: PREVIEW_TEXT,
});

console.log(`\n(preview text was ${PREVIEW_TEXT.length} characters)`);
process.exit(0);
