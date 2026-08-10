/**
 * WHICH NULL IS IT — the reader, the prompt, or the picture? (fable-233 §2)
 *
 * v#145 and v#146 each wrote `statedAccessories @ earring` (segments 8 and 9),
 * each landed a paid picture, and each persisted `hairWorn` and NO
 * `statedAccessories` caption at all — so every library slot filed `noWords` and
 * neither render contributed anything. v#144, one ask earlier, did.
 *
 * `captionRealization` has three null paths and they mean completely different
 * things:
 *
 *   empty caption      the reader answered with nothing — a READER failure
 *   matches !== true   the reader answered, and said the ASK IS NOT IN THE
 *                      PICTURE (the D-183 corroboration gate). Not a captioner
 *                      defect at all: a delivery failure, correctly refused
 *   a throw            the reader could not be reached
 *
 * So this calls the engine DIRECTLY with `captionRealization`'s own system
 * prompt and user message, and prints the raw `{caption, matches}` — the
 * artifact, rather than a null that has already forgotten which door it came
 * through.
 *
 * TWO ARMS PER FRAME, because that is what separates the gate from the reader:
 *
 *   with `asked`    the corroboration gate is live, exactly as production ran it
 *   without         the gate cannot fire, so a caption here proves the reader
 *                   and the picture are both fine and the GATE was the null
 *
 * **v#144 IS THE POSITIVE CONTROL** and it is not optional: it produced a real
 * caption in production, so a harness that reads it as null is broken and its
 * verdicts on the other two are worthless.
 *
 * Costs no credits. Reads three stored frames and spends vision calls on the
 * dev account. Nothing is written anywhere.
 *
 *   npx tsx scripts/probe-caption-nulls-disposable.mts [--reps 2]
 */
import "dotenv/config";

import { openDatabase } from "./lib/dbConnection.mjs";
import { fetchImageBytes } from "./lib/imageBytes.mjs";
import { interpreterEngine } from "../server/castingV2/interpreter";

const reps = Number(process.argv[process.argv.indexOf("--reps") + 1] ?? 2) || 2;
const bucket = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
if (!bucket) throw new Error("no R2_PUBLIC_URL");

/* The system prompt and user message are REPRODUCED from realizationCaption.ts
   rather than imported, because the pieces that build them are module-private.
   That is a copy, and a copy drifts — so it is checked against the file's own
   bytes before anything is read. A probe measuring a prompt the product no
   longer sends is a probe measuring nothing. */
const SYSTEM_PROMPT = [
  "You look at a photograph of a person and describe ONE named feature of it with the",
  "precision of a person writing a note so the exact same thing can be reproduced later.",
  "",
  "You never describe the person's identity, their mood, the lighting, the framing or the",
  "background. Only the feature you are asked about, and only what you can actually see.",
  "",
  "Be concrete and physical. Not 'nice hair' — 'a shaggy mullet, short choppy layers through",
  "the crown and fringe, length falling past the collar at the back'. Not 'dark hair' —",
  "'blue-black, cool-toned, slightly deeper at the roots'.",
  "",
  "",
  "You are also told what the edit ASKED for. Answer honestly whether that ask is visibly",
  "true in this photograph. If the asked-for change is not there, say so — a description of",
  "what is there instead would be recorded as if it had been wanted.",
  "",
  'Reply with JSON: {"caption": "...", "matches": true|false} and nothing else.',
  "The caption is under 160 characters.",
].join("\n");

const { readFile } = await import("node:fs/promises");
const source = await readFile(new URL("../server/castingV2/realizationCaption.ts", import.meta.url), "utf8");
for (const line of ["You look at a photograph of a person and describe ONE named feature", "Reply with JSON:", "The caption is under 160 characters."]) {
  if (!source.includes(line)) throw new Error(`the probe's copy of the system prompt has drifted: "${line}" is not in realizationCaption.ts`);
}
/* And the heading, likewise — `facetHeading("statedAccessories")`. */
const HEADING = "accessories worn";
if (!source.includes("Describe this person's ${heading.toLowerCase()}.")) {
  throw new Error("the probe's copy of the user message has drifted");
}

const engine = interpreterEngine();
if (!engine) throw new Error("no text engine — set OPENROUTER_API_KEY");

const connection = await openDatabase();
const [rows] = await connection.query<any[]>(`
  SELECT v.id, v.requestText, v.imageKey
    FROM casting_candidate_variants v
   WHERE v.userId = 1 AND v.id IN (144, 145, 146)
   ORDER BY v.id`);
await connection.end();

console.log(`heading: "${HEADING}"   reps: ${reps}\n`);
for (const row of rows as any[]) {
  const image = await fetchImageBytes(`${bucket}/${row.imageKey}`);
  const label = row.id === 144 ? "v#144  POSITIVE CONTROL" : `v#${row.id}`;
  console.log(`${label}  "${row.requestText}"`);
  /* An approximation of production's `asked`, which was
     `currentValueOfFacet(applyDelta(identity, composed), facet)` and is not
     stored. Stated as an approximation rather than presented as the string. */
  const asked = String(row.requestText ?? "").replace(/^give her /i, "");
  for (const [arm, ask] of [["with asked", asked], ["no asked ", null]] as const) {
    for (let rep = 0; rep < reps; rep += 1) {
      let out = "";
      try {
        const reply = await engine.complete({
          system: SYSTEM_PROMPT,
          user: [
            `Describe this person's ${HEADING}.`,
            ...(ask ? [`The edit asked for: ${ask}`] : []),
          ].join("\n"),
          /* `.mime`, NOT `.contentType`. The first version of this probe read a
             field the helper does not have, and the data URL became
             `data:undefined;base64,…` — every call 400'd as `capability`, and
             the POSITIVE CONTROL is the only reason that was read as a broken
             harness rather than as a finding about the product. A missing field
             stringified into a plausible-looking value: the `?? "stored"` class,
             in a probe, again. */
          images: [{ bytes: image.bytes, contentType: image.mime }],
          json: true,
          temperature: 0.1,
          maxOutputTokens: 300,
        });
        const parsed = JSON.parse(reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""));
        const caption = typeof parsed?.caption === "string" ? parsed.caption.trim() : "";
        const wouldReturn = !caption ? "NULL (empty caption)"
          : (ask && parsed?.matches !== true) ? "NULL (matches=false — the D-183 gate)"
            : "a caption";
        out = `matches=${String(parsed?.matches)}  → ${wouldReturn}\n        saw: ${caption.slice(0, 120)}`;
      } catch (error) {
        out = `THREW: ${(error as Error).message.slice(0, 100)}`;
      }
      console.log(`   ${arm}  #${rep + 1}  ${out}`);
    }
  }
  console.log("");
}
process.exit(0);
