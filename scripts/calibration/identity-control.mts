/**
 * THE POSITIVE CONTROL, RE-RUN — with transcripts, because a summary is what
 * went wrong.
 *
 * D-199 claimed the identity reader was blind, and its damning detail was that
 * the reader "cited freckles that arrived mid-chain" against a base that "has
 * none". The founder checked the file. The base is heavily freckled. The
 * reader's observation was CORRECT and the entry's exhibit was not.
 *
 * So both readers run again here, on the real files, and every word they return
 * is printed rather than paraphrased.
 *
 *   npx tsx scripts/calibration/identity-control.mts
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

import { interpreterEngine } from "../../server/castingV2/interpreter";

const DIR = "output/quality-unit/specimens";
const base = readFileSync(`${DIR}/built-base.png`);
const drift = readFileSync(`${DIR}/built-step4.png`);
const engine = interpreterEngine();
if (!engine) throw new Error("no reader");

/** The chain that produced the specimen — verbatim, from specimens.mts. */
const INSTRUCTIONS = [
  "Give her a blunt bob.",
  "Make her eyes seafoam green.",
  "Add small gold hoop earrings.",
  "Make her hair copper.",
];

const HOLISTIC = [
  "You are shown two photographs. Answer whether they are the same PERSON.",
  "",
  "Ignore hair colour, hair style, makeup, jewellery and expression entirely — those are",
  "allowed to differ. Judge bone structure, eye shape and set, nose, mouth, jaw, ears and",
  "skin character only.",
  "",
  'Reply with JSON: {"samePerson": true|false, "why": "..."} and nothing else.',
].join("\n");

const PER_FEATURE = [
  "You are shown two photographs. Compare them FEATURE BY FEATURE and report what you",
  "actually see in each, then judge whether each feature MATCHES.",
  "",
  "Judge only: jaw width, face length/shape, nose shape, lip fullness, eye spacing,",
  "skin freckling (present or absent, and where), skin tone.",
  "",
  "Do not be charitable. If a feature reads differently, say it does not match.",
  "",
  'Reply with JSON: {"features":[{"name":"...","first":"...","second":"...",',
  '"matches":true|false}], "samePerson": true|false} and nothing else.',
].join("\n");

async function ask(system: string, label: string): Promise<unknown> {
  const reply = await engine!.complete({
    system,
    user: "First image, then second image.",
    images: [
      { bytes: base, contentType: "image/png" },
      { bytes: drift, contentType: "image/png" },
    ],
    json: true,
    temperature: 0,
    maxOutputTokens: 900,
  });
  console.log(`\n===== ${label} — VERBATIM =====`);
  console.log(reply.text.trim());
  try {
    return JSON.parse(reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""));
  } catch {
    return null;
  }
}

console.log("THE SPECIMEN CHAIN, VERBATIM:");
INSTRUCTIONS.forEach((line, index) => console.log(`  ${index + 1}. ${JSON.stringify(line)}`));
console.log("\nNote: 'seafoam green eyes' is INSTRUCTED. Green eyes in step 4 are styling,");
console.log("not drift, and any drift inventory that counted them was wrong.");

const holistic = await ask(HOLISTIC, "HOLISTIC READER (the one D-199 called blind)");
const perFeature = await ask(PER_FEATURE, "PER-FEATURE READER (the proposed replacement)");

writeFileSync(
  "output/quality-unit/identity-control.json",
  JSON.stringify({ instructions: INSTRUCTIONS, holistic, perFeature }, null, 2),
);
