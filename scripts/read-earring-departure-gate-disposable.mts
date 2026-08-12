/**
 * WHY A FACE WEARING HOOPS, FROM A BRIEF THAT ASKED FOR HOOPS, IS TOLD HER
 * BRIEF NEVER ASKED — the two halves of the departure gate, read directly.
 *
 * `refineService` lets a removal through when the record names the thing, OR
 * the brief names it (`briefNamesIt`), OR her face shows it (`faceWearsIt`).
 * Tonight a candidate rolled from *"a woman … who wears small gold hoop
 * earrings, one at each ear"* — hoops plainly on both lobes, looked at on the
 * contact sheet — was refused for free with "her brief didn't ask for
 * earrings".
 *
 * So both halves are read here, on that candidate, with no spending:
 *
 *   the BRIEF half   what `readBriefFacts` says `statedAccessories` holds, and
 *                    whether `textMentions` matches the word the parser used
 *   the FACE half    the segmenter's coverage for the same noun, against the
 *                    band the gate compares it to — which is
 *                    `COVERAGE_BANDS.eyewearFrames`, a band measured on GLASSES
 *
 *   npx tsx scripts/read-earring-departure-gate-disposable.mts <candidatePublicId>
 */
import "dotenv/config";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { getBriefForOwnedCandidate } from "../server/db/castingV2";
import { readBriefFacts } from "../server/castingV2/rollProjection";
import { textMentions } from "../server/castingV2/refineRemoval";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { coverage, COVERAGE_BANDS } from "../server/castingV2/maskGeometry";
import { storageReadBytes } from "../server/storage";

const FACE = process.argv[2] ?? "40279ed9-3e55-416e-859b-3c3b6d53f93b";
const USER = Number(process.env.USER_ID ?? 1);
const NOUN = process.env.NOUN ?? "earrings";

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const where = new URL((process.env[key] ?? "").replace(/^mysql:/, "http:"));
console.log(`WORLD: ${key} → ${where.hostname}:${where.port}`);
const connection = await openDatabase(process.env[key]!);
const [candidates] = await connection.query<any[]>(
  "SELECT id, publicId, imageKey FROM casting_candidates WHERE publicId = ?", [FACE],
);
const candidate = candidates[0];
await connection.end();
if (!candidate) throw new Error(`no candidate ${FACE}`);

/* ── the BRIEF half ────────────────────────────────────────────────────────── */

const brief = await getBriefForOwnedCandidate(USER, FACE);
console.log(`\n── the brief half`);
if (!brief) {
  console.log("  no brief found for this candidate at all");
} else {
  console.log(`  briefText: "${String(brief.briefText ?? "").slice(0, 200)}"`);
  const facts = readBriefFacts(brief.lockContract, brief.compiledBrief, brief.briefText);
  console.log(`  statedAccessories: ${JSON.stringify(facts.statedAccessories)}`);
  const named = (facts.statedAccessories ?? []).some((worn: string) => textMentions(worn, NOUN));
  console.log(`  textMentions(…, "${NOUN}") → briefNamesIt = ${named}`);
  for (const worn of facts.statedAccessories ?? []) {
    console.log(`    "${worn}" → ${textMentions(worn, NOUN)}`);
  }
}

/* ── the FACE half ─────────────────────────────────────────────────────────── */

console.log(`\n── the face half`);
const bytes = await storageReadBytes(candidate.imageKey);
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY ?? "" });
try {
  const seen = await reader.region({ image: bytes.bytes, name: NOUN });
  const area = coverage(seen);
  const band = COVERAGE_BANDS.eyewearFrames;
  console.log(`  the segmenter's "${NOUN}" covers ${(area * 100).toFixed(4)}% of the frame`);
  console.log(`  the gate compares it to COVERAGE_BANDS.eyewearFrames.min = ${(band.min * 100).toFixed(4)}%`
    + ` → faceWearsIt = ${area >= band.min}`);
  console.log(`  (that band was measured on GLASSES. A pair of small hoops is a far smaller object.)`);
} catch (error) {
  console.log(`  the segmenter would not answer: ${error instanceof Error ? error.message : String(error)}`);
  console.log(`  → faceWearsIt = false (the catch treats an unanswerable read as "not there")`);
}

process.exit(0);
