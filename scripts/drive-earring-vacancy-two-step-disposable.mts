/**
 * ACCEPTANCE (b) ON THE REAL PATH — the earring removal that could not be
 * recorded until tonight, bought in dev (fable-332's ruling, in pixels).
 *
 * `4c98c7fc` carries a gold hoop on each lobe from the shift-59 walk: two live
 * `carry` rows with crops. So "take her earrings off" here is a real removal of
 * something the branch is genuinely wearing — the master alone has bare lobes,
 * and it is the LIBRARY that keeps putting the hoops back.
 *
 *   step 1  "take her earrings off"    → delivered; both carries retired; a
 *                                        vacancy filed under EACH lobe
 *   step 2  "colour her hair copper"   → delivered; the recipe says the PAIR
 *                                        sentence once and sends no hoop crop;
 *                                        her lobes are still bare
 *
 * What only a paid run can prove, and the reason this is not a bench: the
 * service filing two per-side rows through the door that used to refuse them,
 * and the next paid recipe reading them back through its own lineage walk and
 * COLLAPSING them into one sentence.
 *
 * Dev only, 50 dev credits, user 1's own face. Frames are written out with
 * their ear bands so the verdict is taken by eye — the per-ear reader has
 * produced false passes on this specimen and does not grade this.
 *
 *   CASTING_REFERENCE_LIBRARY_SCOPE=users:1 CASTING_REPAINT_SCOPE=users:1 \
 *     npx tsx scripts/drive-earring-vacancy-two-step-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import sharp from "sharp";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { refineCandidate } from "../server/castingV2/refineService";
import { selectVariant } from "../server/db/castingV2Variants";
import { vacantPhraseFor } from "../server/castingV2/accessoryKinds";
import { slotWordsRefusal } from "../server/castingV2/slotWordShape";
import { storageReadBytes } from "../server/storage";

const OUT = "output/shift64-earring-two-step";
const FACE = process.env.FACE ?? "4c98c7fc-453c-4666-9a2c-86a393ade900";
const USER = Number(process.env.USER_ID ?? 1);
const COST = 25;
const STEPS = [
  { instruction: "take her earrings off", wants: "both lobes bare" },
  { instruction: "colour her hair copper", wants: "copper hair, and the lobes STILL bare" },
];

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
  throw new Error("the repaint road is not open for this user — set both scopes to users:1");
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

let failures = 0;
const check = (ok: boolean, label: string, detail = ""): void => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
};

const libraryRows = async (): Promise<any[]> => await query(
  `SELECT id, role, slot, words, storageKey, version, retiredAt
     FROM casting_reference_library WHERE candidateId = ? ORDER BY id`, [candidate.id],
);
const before = await libraryRows();
const wornLobes = before.filter((row) => row.role === "carry" && String(row.slot).startsWith("earring@") && row.retiredAt === null);
console.log(`── before: ${wornLobes.length} live earring carry row(s) — ${wornLobes.map((row) => row.slot).join(", ") || "none"}`);
if (wornLobes.length < 2) throw new Error("this face is not wearing a hoop on each lobe — a removal here would prove nothing");

const startedAt = new Date();
/*
  STAND ON THE BRANCH THAT IS WEARING THEM, not on the master.

  The first run of this asked the master to take her earrings off and was
  refused for free, correctly: *"Her brief didn't ask for earrings, and nothing
  since has added any, so there's nothing on record to take off."* The hoops
  belong to a BRANCH — the library rows were written against variant 155 — and a
  removal is asked of the branch state. So the walk stands where the earrings
  are, which is also the customer's own situation: she added them, then changed
  her mind.
*/
const standOn = process.env.VARIANT ?? null;
await selectVariant({ userId: USER, candidatePublicId: candidate.publicId, variantPublicId: standOn });
console.log(`standing on ${standOn ?? "the master"}`);

const walked: any[] = [];
for (const [at, step] of STEPS.entries()) {
  console.log(`\n── step ${at + 1}: "${step.instruction}" — want ${step.wants}`);
  const began = Date.now();
  let threw: string | null = null;
  let outcome: any = null;
  try {
    outcome = await refineCandidate({}, {
      userId: USER, clientRequestId: randomUUID(),
      candidatePublicId: candidate.publicId, instruction: step.instruction,
    });
  } catch (error) {
    threw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
  console.log(`  ${threw ?? outcome?.kind}  (${Math.round((Date.now() - began) / 1000)}s)`);

  const row = (await query(
    `SELECT v.id, v.publicId, v.status, v.pointsCost, v.imageKey, v.failureClass,
            v.internalPrompt, o.chargedCredits, o.refundedCredits, o.publicMessage
       FROM casting_candidate_variants v
       LEFT JOIN generation_operations o ON o.id = v.operationId
      WHERE v.candidateId = ? AND v.requestText = ? AND v.createdAt >= ?
      ORDER BY v.id DESC LIMIT 1`,
    [candidate.id, step.instruction, startedAt],
  ))[0] ?? null;
  const parsed = row && typeof row.internalPrompt === "string"
    ? (() => { try { return JSON.parse(row.internalPrompt); } catch { return null; } })()
    : row?.internalPrompt ?? null;
  const record = parsed?.repaint ?? null;

  check(row?.status === "ready", `[row] step ${at + 1} delivered`,
    row ? `#${row.id} ${row.status}${row.failureClass ? ` · ${row.failureClass}` : ""}${row.publicMessage ? ` · ${row.publicMessage}` : ""}` : "no row");
  check(record !== null, `[row] step ${at + 1} came down the REPAINT road`, record ? `${record.references.length} references` : "no repaint record");
  if (record) {
    console.log(`      edited ${JSON.stringify(record.edited)} · vacated ${JSON.stringify(record.vacated)} · carried ${JSON.stringify(record.carried)}`);
    console.log(`      PROMPT AT THE WIRE:\n      "${String(record.prompt ?? "").replace(/\s+/g, " ")}"`);
  }
  walked.push({ step: step.instruction, threw, row, record });
}

/* ── the library now ───────────────────────────────────────────────────────── */

const after = await libraryRows();
console.log(`\n── the library after the walk`);
for (const row of after) {
  const words = typeof row.words === "string" ? JSON.parse(row.words) : (row.words ?? []);
  console.log(`  #${row.id} ${String(row.role).padEnd(7)} ${String(row.slot).padEnd(14)} v${row.version}`
    + `${row.retiredAt ? " RETIRED" : "        "} ${row.storageKey ? "crop" : "    "}  ${JSON.stringify(words).slice(0, 100)}`);
}
const vacancies = after.filter((row) => row.role === "vacancy" && String(row.slot).startsWith("earring@") && row.retiredAt === null);
check(vacancies.length === 2, "[db] a vacancy under EACH lobe", vacancies.map((row) => row.slot).join(", ") || "none");
for (const row of vacancies) {
  const words = typeof row.words === "string" ? JSON.parse(row.words) : (row.words ?? []);
  check(slotWordsRefusal(String(row.slot), words) === null, `[db] ${row.slot}'s words are ones that slot may file`, JSON.stringify(words));
}
const stillCarrying = after.filter((row) => row.role === "carry" && String(row.slot).startsWith("earring@") && row.retiredAt === null);
check(stillCarrying.length === 0, "[db] neither hoop is still being carried", stillCarrying.map((row) => `#${row.id} ${row.slot}`).join(", ") || "none live");

/* ── the wire: the pair sentence, once, and no hoop crop ───────────────────── */

const pair = vacantPhraseFor("earring")!;
const second = walked[1]?.record;
const prompt = String(second?.prompt ?? "");
check(prompt.includes(pair), "[wire] step 2 says the PAIR sentence again", `"${pair}"`);
check(prompt.split(pair).length === 2, "[wire] and says it ONCE, not once per lobe",
  `${Math.max(0, prompt.split(pair).length - 1)} occurrence(s)`);
check(!/her (left|right) ear\b/.test(prompt), "[wire] and never as two per-side claims", prompt.match(/her (left|right) ear/)?.[0] ?? "none");
check(
  Array.isArray(second?.references) && !second.references.some((reference: any) => String(reference?.slot ?? "").startsWith("earring@")),
  "[wire] and sends no hoop crop beside the sentence saying they are gone",
  JSON.stringify((second?.references ?? []).map((reference: any) => reference?.slot ?? "master")),
);

/* ── the pictures ──────────────────────────────────────────────────────────── */

for (const [at, entry] of walked.entries()) {
  if (!entry.row?.imageKey || entry.row.status !== "ready") continue;
  const bytes = await storageReadBytes(entry.row.imageKey);
  const file = path.join(OUT, `step${at + 1}.png`);
  await writeFile(file, bytes.bytes);
  await sharp(bytes.bytes).extract({ left: 200, top: 300, width: 624, height: 400 })
    .resize({ width: 1250 }).png().toFile(path.join(OUT, `step${at + 1}-BAND.png`));
  console.log(`  frame ${at + 1} → ${file} (+ its ear band, to be looked at)`);
}

/* ── the money ─────────────────────────────────────────────────────────────── */

const charged = walked.reduce((total, entry) => total + Number(entry.row?.pointsCost ?? 0), 0);
const refunded = walked.reduce((total, entry) => total + Number(entry.row?.refundedCredits ?? 0), 0);
const delivered = walked.filter((entry) => entry.row?.status === "ready").length;
check(charged - refunded === delivered * COST, "[money] she paid for what she received and nothing else",
  `charged ${charged}, refunded ${refunded}, net ${charged - refunded} against ${delivered} delivered × ${COST}`);

console.log(`\n${"=".repeat(96)}`);
console.log(failures === 0
  ? "THE EARRING REMOVAL IS RECORDED AND KEPT — filed under each lobe, said once as a pair on the\nnext paid render. Look at the ear bands before believing this line."
  : `${failures} assertion(s) went the wrong way — read the frames and the rows.`);
console.log("=".repeat(96));
await writeFile(path.join(OUT, "walk.json"), JSON.stringify({ before, walked, after, failures }, null, 2));
await connection.end();
process.exit(failures === 0 ? 0 : 1);
