/**
 * #2469 — THE REAL DRIVE, through the real entrances, on the DEV database and
 * HIS provider account.
 *
 * The card's done-when, in its own order: a design returns three MP3 previews;
 * a Keep saves, records and stores the clip with its sha256 and writes the row;
 * the counter is read before and after. The receipt it asks for wants the
 * measured cost, wait and size of a ~90 s clip and how long a preview id stays
 * saveable, so every one of those is timed here rather than estimated.
 *
 * ⚠ **IT SPENDS HOUSE MONEY — about a cent of design, plus voice operations at
 * one per save.** Under THE SPEND THRESHOLD ($50), so it runs and reports.
 * Customer credits are never touched: the fixture is `verify-bot@local.test`'s
 * signed cast in DEV, so no customer and no credit is involved.
 *
 *   npx tsx scripts/_2469-drive-disposable.mts
 */

/* The scope flags must be set BEFORE the service is imported — module side
   effects run at import time, and `captureCastingVoiceEnabled` reads env. */
process.env.CASTING_VOICE_SCOPE = "users:823";
process.env.CASTING_V2_SCOPE = "all";

import { createHash } from "node:crypto";

import "dotenv/config";
import { designCastVoices, keepCastVoice, releaseVoiceSlots } from "../server/castingV2/voiceService";
import { createElevenLabsVoiceEngine } from "../server/providers/elevenlabsVoice";
import { VOICE_AUDITION_PASSAGE } from "../server/castingV2/voiceAuditionPassage";
import { getDb } from "../server/db/connection";
import { storageGet } from "../server/storage";
import { assertOneWorld } from "./lib/worldGuard.mts";

/* Writes R2 objects as well as database rows — both worlds declared. */
assertOneWorld(["DATABASE_URL", "R2_BUCKET"]);

const USER_ID = 823;
const MODEL_ID = 300;

const db = await getDb();
if (!db) throw new Error("no database");
const client = (db as unknown as {
  session: { client: { query: (sql: string) => Promise<[unknown[], unknown]> } };
}).session.client;

const engine = createElevenLabsVoiceEngine();
const say = (line: string) => console.log(line);

/* ── 1 · the allowance BEFORE anything is spent ───────────────────────────── */
const before = await engine.readAllowance();
say("ALLOWANCE BEFORE");
say(`  tier ${before.tier} · slots ${before.slotsUsed}/${before.slotsTotal} · `
  + `operations ${before.operationsUsed}/${before.operationsTotal} · cloning ${before.instantCloning}`);

/* ── 2 · a design: the cast's own words become three voices ───────────────── */
const designStarted = Date.now();
const design = await designCastVoices({ userId: USER_ID, modelId: MODEL_ID });
if (!design.ok) {
  console.error(`DESIGN REFUSED — ${design.refusal} ${design.failureClass ?? ""}`);
  process.exit(1);
}
say(`\nDESIGN — ${design.previews.length} previews in ${design.latencyMs} ms`);
say(`  from the cast's own line: "${design.designSentence}"`);
for (const [index, preview] of design.previews.entries()) {
  say(`  voice ${index + 1}: ${preview.bytes.byteLength} bytes · ${preview.contentType}`
    + `${preview.durationSeconds ? ` · ${preview.durationSeconds.toFixed(1)} s` : ""}`);
}

const afterDesign = await engine.readAllowance();
say(`  operations after the design: ${afterDesign.operationsUsed}/${afterDesign.operationsTotal} `
  + `(a design spends ${afterDesign.operationsUsed - before.operationsUsed})`);

/* ── 3 · KEEP the second preview — save, record, store, write ──────────────── */
const keepStarted = Date.now();
const keep = await keepCastVoice({
  userId: USER_ID,
  modelId: MODEL_ID,
  previewId: design.previews[1]!.previewId,
  designSentence: design.designSentence,
});
const keepElapsed = Date.now() - keepStarted;
if (!keep.ok) {
  console.error(`KEEP REFUSED — ${keep.refusal} ${keep.failureClass ?? ""}`);
  process.exit(1);
}
say(`\nKEEP — ${keepElapsed} ms end to end`);
say(`  save    ${keep.saveLatencyMs} ms`);
say(`  audition ${keep.speakLatencyMs} ms for ${VOICE_AUDITION_PASSAGE.length} characters`);
say(`  clip    ${keep.clipBytes} bytes (${(keep.clipBytes / 1024).toFixed(0)} KB) ${keep.clipContentType}`);
say(`  sha256  ${keep.clipSha256}`);
say(`  key     ${keep.clipStorageKey}`);
say(`  passage version ${keep.passageVersion}`);

/* ── 4 · the allowance AFTER — the counter must have moved by exactly one ──── */
const after = await engine.readAllowance();
say(`\nALLOWANCE AFTER`);
say(`  slots ${after.slotsUsed}/${after.slotsTotal} · operations ${after.operationsUsed}/${after.operationsTotal}`);
say(`  a Keep spent ${after.operationsUsed - afterDesign.operationsUsed} operation(s) `
  + `and ${after.slotsUsed - before.slotsUsed} slot(s)`);

/* ── 5 · the ROW, read back from the database (working law 1) ──────────────── */
const [rows] = await client.query(
  "select id, modelId, userId, voiceId, clipStorageKey, clipSha256, clipBytes, clipContentType, "
  + "passageVersion, lastUsedAt, keptAt, char_length(designSentence) as sentenceChars "
  + `from cast_voices where modelId = ${MODEL_ID} and userId = ${USER_ID}`,
);
const row = (rows as Array<Record<string, unknown>>)[0];
say("\nTHE ROW, READ BACK");
if (!row) {
  console.error("  ⚠ NO ROW — the Keep reported success and wrote nothing");
  process.exit(1);
}
for (const [key, value] of Object.entries(row)) say(`  ${key.padEnd(16)} ${String(value)}`);
say(`  sha256 matches the Keep's: ${row.clipSha256 === keep.clipSha256}`);

/* ── 6 · THE STORED OBJECT — and its bytes hashed again, not assumed ──────── */
const stored = await storageGet(keep.clipStorageKey);
const fetched = await fetch(stored.url);
const storedBytes = Buffer.from(await fetched.arrayBuffer());
const storedSha = createHash("sha256").update(storedBytes).digest("hex");
say("\nTHE STORED CLIP");
say(`  http ${fetched.status} · ${storedBytes.byteLength} bytes · ${fetched.headers.get("content-type")}`);
say(`  sha256 of what came back: ${storedSha}`);
say(`  matches the row: ${storedSha === String(row.clipSha256)}`);

/* ── 7 · HOW LONG A PREVIEW ID STAYS SAVEABLE — the card's open question ──── */
const elapsedSinceDesign = Math.round((Date.now() - designStarted) / 1000);
say(`\nPREVIEW SAVEABILITY — trying preview 3, ${elapsedSinceDesign} s after its design`);
let thirdVoiceId: string | null = null;
try {
  const saved = await engine.saveVoice({
    previewId: design.previews[2]!.previewId,
    name: `klieg-2469-saveability-probe`,
    description: design.designSentence,
  });
  thirdVoiceId = saved.voiceId;
  say(`  SAVEABLE at ${elapsedSinceDesign} s (${saved.latencyMs} ms) — a measured LOWER BOUND, not a limit`);
} catch (error) {
  say(`  refused at ${elapsedSinceDesign} s: ${(error as Error).message}`);
}

/* The probe's slot is released immediately — the operation it spent is not
   refundable (measured), and that is reported rather than hidden. */
if (thirdVoiceId) {
  const released = await releaseVoiceSlots([{ voiceId: thirdVoiceId }]);
  say(`  probe slot released: ${JSON.stringify(released)}`);
  const afterProbe = await engine.readAllowance();
  say(`  operations after releasing it: ${afterProbe.operationsUsed}/${afterProbe.operationsTotal} `
    + `— a delete refunds ${after.operationsUsed + 1 - afterProbe.operationsUsed} operation(s)`);
  say(`  slots after releasing it: ${afterProbe.slotsUsed}/${afterProbe.slotsTotal}`);
}

say("\nThe kept voice and its row are LEFT IN PLACE for the deletion drive.");
process.exit(0);
