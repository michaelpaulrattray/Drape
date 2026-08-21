/**
 * DISPOSABLE — §10 item 2, SECOND HALF: does a describer NAME a tattoo it is
 * looking at? (opus-956 §7: *"whether a describer names tattoos on a master
 * reliably enough to be the step-1 producer"*.)
 *
 * # Why it asks the POSITIVE frames and not masters
 *
 * The first half already answered the population question: the segmenter found
 * ink on 0 of 37 production masters and on 0 of 2 paired negatives, while
 * firing 3 of 3 on frames this product painted. **There is no ink on a master
 * to name**, so asking a describer about masters would buy a null with no
 * fixture behind it — the exact trap the first half was designed around.
 *
 * What is still worth knowing, and what this buys, is whether the describer
 * COULD be step 1 for a population that does not exist yet: shown a frame that
 * genuinely carries a tattoo, does it say so unprompted? A describer-first
 * design is only cheaper than a segmenter-per-master if the answer is yes.
 *
 * THREE frames, three calls, hardcoded by name. It touches no database and
 * spends ~$0.03 of house money.
 */
import "dotenv/config";

import { spawnSync } from "node:child_process";

import { interpreterEngine } from "../server/castingV2/interpreter";

const railway = (...args: string[]): string => {
  const result = spawnSync("railway.cmd", args, { encoding: "utf8", shell: true });
  if (result.status !== 0) throw new Error(`railway ${args[0]} failed`);
  return result.stdout ?? "";
};

const bucket = railway("variables", "--service", "Drape", "--kv").split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line.startsWith("R2_PUBLIC_URL="))
  ?.slice("R2_PUBLIC_URL=".length);

const engine = interpreterEngine();
if (!bucket || !engine) {
  console.log(`UNREAD — bucket ${Boolean(bucket)} engine ${Boolean(engine)}`);
  process.exit(1);
}

/* The frames the first half PROVED carry ink, with the pixel count it measured
   — so this arm's subject is a fact rather than a hope. */
const FRAMES = [
  { id: "v206/ink:neck", key: "casting-v2/variants/e1a2ffd8-15c5-490d-9eac-2afa825cebb4.png", ink: "36,115 px" },
  { id: "v207/ink:upperChest", key: "casting-v2/variants/8501c0f2-4d03-4c5d-89b9-e7b169a45dee.png", ink: "48,783 px" },
  { id: "v209/ink:neck", key: "casting-v2/variants/0e76a979-2a94-4c84-9121-c45f6da18573.png", ink: "45,097 px" },
];

/*
  AN OPEN QUESTION, DELIBERATELY — never "does this person have a tattoo?".

  A yes/no about a named thing is a leading question: a model that says yes to
  everything scores identically to one that can see. The step-1 producer this is
  auditioning for has to volunteer the feature UNPROMPTED, so the question is
  the open one it would really be asked, and naming ink is the model's own move.
*/
const ASK = [
  "Look at this photograph of a person.",
  "List any distinctive or unusual features of their appearance that a casting",
  "director would write down — things that make this specific person",
  "recognisable. Be concrete and brief.",
  "",
  'Reply with JSON: {"features": ["...", "..."]} and nothing else.',
].join("\n");

const INK_WORDS = /tattoo|tatoo|inked|body art|ink\b/i;

console.log(`[bucket] ${bucket}\n`);
let named = 0;
for (const frame of FRAMES) {
  const response = await fetch(`${bucket}/${frame.key}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const reply = await engine.complete({
    about: "describe",
    system: "You describe photographs precisely and briefly. You never invent detail.",
    user: ASK,
    images: [{ bytes, contentType: "image/png" }],
    json: true,
    temperature: 0,
    maxOutputTokens: 600,
  });
  const text = reply.text ?? "";
  const saidInk = INK_WORDS.test(text);
  if (saidInk) named += 1;
  console.log(`${frame.id.padEnd(22)} ink present ${frame.ink.padStart(10)}   NAMED IT: ${saidInk ? "YES" : "no"}`);
  console.log(`   ${text.replace(/\s+/g, " ").slice(0, 300)}\n`);
}

console.log(`──────── THE READING ────────`);
console.log(`the describer named ink on ${named} of ${FRAMES.length} frames that certainly carry it`);

/* A SCRIPT ENDS BY ENDING THE PROCESS. */
process.exit(0);
