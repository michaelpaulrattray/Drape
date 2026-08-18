/**
 * THE REMOVAL SURVIVES THE NEXT PAID STEP — on the real path, in dev
 * (fable-329 order 2, acceptance (a) bought rather than simulated).
 *
 * Shift 63 proved the vacancy fix in pixels off the ledger: the same later ask,
 * with the library holding an EMPTY glasses slot, says the absence again and
 * delivers her without them. Everything in that proof was real except the two
 * things only a paid render exercises — the SERVICE filing the vacancy row
 * after the removal lands, and the next paid step reading it back through its
 * own lineage walk.
 *
 * So this buys the two-step:
 *
 *   step 1  "take her glasses off"    → delivered, and a `vacancy` row filed
 *   step 2  "colour her hair copper"  → delivered, and SHE IS STILL WITHOUT THEM
 *
 * # What is asserted, and where
 *
 *   [row]    both steps carry `internalPrompt.repaint` — the new road, read off
 *            the row rather than off the flag (a flag says what was configured)
 *   [wire]   step 2's dispatch record carries the vacant phrase in `standing`,
 *            so the absence was SENT and not merely stored
 *   [db]     a `role='vacancy'` row exists on the glasses slot after step 1
 *   [pixels] the product's own reader confirms no glasses in step 2's frame,
 *            and the frame is written out to be looked at
 *   [money]  charged − refunded === delivered × 25
 *
 * # The paid path's own open question, answered in passing
 *
 * The bench is 24-of-24 on the glasses ask and the paid path is 0-of-2, which
 * is at most a 1-in-64 coincidence (opus-266 §4). Shift 63 said the next paid
 * occurrence would diff `recipe.prompt` against the bench's. Step 1 IS that
 * occurrence, so its prompt is printed in full beside the bench's wording
 * whether it lands or not.
 *
 * Dev only, user 1's own face, 50 dev credits. Refuses if the flags that make
 * this the repaint road are not on, rather than quietly grading the old one.
 *
 *   CASTING_REFERENCE_LIBRARY_SCOPE=users:1 CASTING_REPAINT_SCOPE=users:1 \
 *     npx tsx scripts/drive-vacancy-two-step-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { refineCandidate } from "../server/castingV2/refineService";
import { selectVariant } from "../server/db/castingV2Variants";
import { aboutFacet, verifyRender } from "../server/castingV2/renderVerification";
import { facetOfSubject } from "../server/castingV2/refineFacets";
import { vacantPhraseFor } from "../server/castingV2/vacancyPhrases";
import { storageReadBytes } from "../server/storage";

const OUT = "output/shift64-paid-two-step";
/** Library 0, born-worn glasses, removed 2/2 off the ledger on shift 63. */
const FACE = process.env.FACE ?? "43ac4560-c59c-46ea-95cb-0bcd814062d3";
const USER = Number(process.env.USER_ID ?? 1);
const COST = 25;
const STEPS = [
  { instruction: "take her glasses off", wants: "the glasses gone" },
  { instruction: "colour her hair copper", wants: "copper hair, and STILL no glasses" },
];
const ASKED = "no glasses — they have been taken off and are not in the picture";

/* ── the world, the flags, the price — before a credit is spent ────────────── */

if (process.env.MYSQL_PUBLIC_URL) {
  throw new Error("this spends credits and is a DEV acceptance — it refuses to run against production");
}
assertOneWorld(["DATABASE_URL"]);
const where = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"));
const library = process.env.CASTING_REFERENCE_LIBRARY_SCOPE ?? "(unset)";
const repaint = process.env.CASTING_REPAINT_SCOPE ?? "(unset)";
console.log(`WORLD: DATABASE_URL → ${where.hostname}:${where.port}`);
console.log(`FLAGS: library ${library} · repaint ${repaint}`);
if (!/^(all|users:.*\b1\b.*)$/.test(repaint) || !/^(all|users:.*\b1\b.*)$/.test(library)) {
  throw new Error("the repaint road is not open for this user — set CASTING_REFERENCE_LIBRARY_SCOPE and CASTING_REPAINT_SCOPE to users:1");
}
console.log(`PLAN:  ${STEPS.length} paid steps × ${COST} credits = ${STEPS.length * COST} on dev user ${USER}\n`);

const connection = await openDatabase(process.env.DATABASE_URL!);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};
await mkdir(OUT, { recursive: true });

const candidate = (await query(
  "SELECT id, publicId, userId, imageKey FROM casting_candidates WHERE publicId = ?", [FACE],
))[0];
if (!candidate) throw new Error(`no candidate ${FACE} in dev`);
if (Number(candidate.userId) !== USER) throw new Error(`candidate belongs to user ${candidate.userId}, not ${USER}`);

const startedAt = new Date();
let failures = 0;
const check = (ok: boolean, label: string, detail = ""): void => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
};

const repaintRecordOf = (internalPrompt: unknown): any | null => {
  const parsed = typeof internalPrompt === "string"
    ? (() => { try { return JSON.parse(internalPrompt); } catch { return null; } })()
    : internalPrompt;
  const record = (parsed as any)?.repaint;
  return record && Array.isArray(record.references) ? record : null;
};

/* ── the two steps ─────────────────────────────────────────────────────────── */

await selectVariant({ userId: USER, candidatePublicId: candidate.publicId, variantPublicId: null });

const walked: any[] = [];
for (const [at, step] of STEPS.entries()) {
  console.log(`\n── step ${at + 1}: "${step.instruction}" — want ${step.wants}`);
  const began = Date.now();
  let outcome: any = null;
  let threw: string | null = null;
  try {
    outcome = await refineCandidate({}, {
      userId: USER,
      clientRequestId: randomUUID(),
      candidatePublicId: candidate.publicId,
      instruction: step.instruction,
    });
  } catch (error) {
    threw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
  console.log(`  ${threw ?? `${outcome?.kind}`}  (${Math.round((Date.now() - began) / 1000)}s)`);

  /* The refund lives on the OPERATION, not on the variant — the variant carries
     what the step cost, the operation carries what came back. Read together so
     the money line below is the ledger's arithmetic and not a guess. */
  const row = (await query(
    `SELECT v.id, v.publicId, v.status, v.requestText, v.pointsCost, v.imageKey,
            v.failureClass, v.internalPrompt, v.createdAt,
            o.chargedCredits, o.refundedCredits, o.publicMessage
       FROM casting_candidate_variants v
       LEFT JOIN generation_operations o ON o.id = v.operationId
      WHERE v.candidateId = ? AND v.requestText = ? AND v.createdAt >= ?
      ORDER BY v.id DESC LIMIT 1`,
    [candidate.id, step.instruction, startedAt],
  ))[0] ?? null;

  const record = row ? repaintRecordOf(row.internalPrompt) : null;
  check(row !== null, `[row] step ${at + 1} left a row this run created`,
    row ? `#${row.id} ${row.status}${row.failureClass ? ` · ${row.failureClass}` : ""}${row.publicMessage ? ` · ${row.publicMessage}` : ""}` : "none");
  if (row) {
    check(record !== null, `[row] step ${at + 1} came down the REPAINT road`, record ? `${record.references.length} references` : "no repaint record — this is the old road");
    if (record) {
      console.log(`      edited ${JSON.stringify(record.edited)} · vacated ${JSON.stringify(record.vacated)} · carried ${JSON.stringify(record.carried)}`);
      console.log(`      standing ${JSON.stringify(record.standing)}`);
      console.log(`      PROMPT AT THE WIRE:\n      "${String(record.prompt ?? "(not recorded)").replace(/\s+/g, " ")}"`);
    }
  }
  walked.push({ step: step.instruction, threw, kind: outcome?.kind ?? null, row, record });
}

/* ── what the library holds now ────────────────────────────────────────────── */

const rows = await query(
  `SELECT id, role, slot, tier, noun, words, storageKey, version, retiredAt, createdAt
     FROM casting_reference_library WHERE candidateId = ? ORDER BY id`,
  [candidate.id],
);
console.log(`\n── the library after the walk (${rows.length} rows, live and retired)`);
for (const row of rows) {
  const words = typeof row.words === "string" ? JSON.parse(row.words) : (row.words ?? []);
  console.log(`  #${row.id} ${String(row.role).padEnd(7)} ${String(row.slot).padEnd(14)} v${row.version}`
    + `${row.retiredAt ? " RETIRED" : "        "} ${row.storageKey ? "crop" : "    "}  ${JSON.stringify(words).slice(0, 110)}`);
}
const vacancy = rows.find((row) => row.role === "vacancy" && String(row.slot) === "glasses" && row.retiredAt === null);
check(vacancy !== undefined, "[db] the removal is on the record — a live vacancy row on the glasses slot",
  vacancy ? `#${vacancy.id}` : "no vacancy row: the next step had nothing to re-say");

/* ── the wire: step 2 SAID the absence ─────────────────────────────────────── */

const phrase = vacantPhraseFor("glasses")!;
const second = walked[1]?.record;
/*
  ON THE PROMPT, NOT ON `standing` — the record's `standing` is the list of
  SLOTS that stood (["glasses"]), and asserting the phrase against it failed
  this run while the sentence was in the dispatched prompt all along. A
  contract about what gets SENT is proven on the outgoing request (invariant 5),
  and the outgoing request is `record.prompt`. The slot list is asserted beside
  it, because "the glasses slot stood" and "the sentence went" are two facts.
*/
check(
  typeof second?.prompt === "string" && second.prompt.includes(phrase),
  "[wire] step 2's dispatched prompt says the absence again",
  second ? `"${String(second.prompt ?? "").replace(/\s+/g, " ").slice(0, 120)}…"` : "no repaint record on step 2",
);
check(
  Array.isArray(second?.standing) && second.standing.includes("glasses"),
  "[wire] and the glasses slot is the one that stood",
  second ? JSON.stringify(second.standing ?? []) : "—",
);
console.log(`      the catalogue's phrase: "${phrase}"`);

/* ── the pixels ────────────────────────────────────────────────────────────── */

for (const [at, entry] of walked.entries()) {
  if (!entry.row?.imageKey || entry.row.status !== "ready") continue;
  const bytes = await storageReadBytes(entry.row.imageKey);
  const verdict = await verifyRender({
    bytes: bytes.bytes, contentType: "image/png",
    facts: [{ subject: aboutFacet(facetOfSubject("statedAccessories")), asked: ASKED, binding: true, absenceIsTheAsk: true }],
  });
  const seen = verdict.checks[0];
  const gone = seen?.verified === true;
  const file = path.join(OUT, `step${at + 1}-${gone ? "no-glasses" : "GLASSES-THERE"}.png`);
  await writeFile(file, bytes.bytes);
  check(gone, `[pixels] step ${at + 1}'s delivered frame has no glasses on her`, `"${seen?.saw ?? "(nothing named)"}" → ${file}`);
}

/* ── the money ─────────────────────────────────────────────────────────────── */

const charged = walked.reduce((total, entry) => total + Number(entry.row?.pointsCost ?? 0), 0);
const refunded = walked.reduce((total, entry) => total + Number(entry.row?.refundedCredits ?? 0), 0);
const delivered = walked.filter((entry) => entry.row?.status === "ready").length;
check(charged - refunded === delivered * COST, "[money] she paid for what she received and nothing else",
  `charged ${charged}, refunded ${refunded}, net ${charged - refunded} against ${delivered} delivered × ${COST}`);

console.log(`\n${"=".repeat(96)}`);
console.log(failures === 0
  ? "THE REMOVAL SURVIVED THE NEXT PAID STEP — on the real path, with the service filing the vacancy\nand the next recipe re-saying it."
  : `${failures} assertion(s) went the wrong way — read the frames and the rows before concluding anything.`);
console.log("=".repeat(96));
await writeFile(path.join(OUT, "two-step.json"), JSON.stringify({ face: candidate.publicId, walked, rows, failures }, null, 2));
await connection.end();
process.exit(failures === 0 ? 0 : 1);
