/**
 * ACCEPTANCE (b), THE CUSTOMER'S OWN ROAD — a face whose BRIEF names earrings,
 * asked to take them off, then asked for something else (fable-334, ≤250 dev
 * credits).
 *
 * The per-instance vacancy is built and unit-proven, and it could not be
 * reached: an earring removal on a branch is a PRUNING removal and refuses
 * before any recipe exists, while dev's only roll wears glasses and nothing
 * else. A vacancy is reachable by a BASE-WORN departure — the thing is in the
 * master, no step put it there — which is exactly the glasses case that now
 * works end to end. So this casts the missing specimen instead of simulating
 * one: a sheet whose brief states hoops.
 *
 *   step 1  "take her earrings off"   → both lobes retired, a vacancy filed
 *                                       under EACH, and the frame agrees
 *   step 2  "colour her hair copper"  → the PAIR sentence stands, once, no hoop
 *                                       crop rides beside it, lobes still bare
 *
 *   CASTING_REFERENCE_LIBRARY_SCOPE=users:1 CASTING_REPAINT_SCOPE=users:1 \
 *     npx tsx scripts/drive-earring-brief-acceptance-disposable.mts cast
 *   … then, with a candidate that is actually wearing them:
 *     npx tsx scripts/drive-earring-brief-acceptance-disposable.mts <publicId>
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import sharp from "sharp";
import { and, eq } from "drizzle-orm";

import { getDb } from "../server/db/connection";
import { castingCandidates, castingCandidateVariants } from "../drizzle/schema";
import { createCastingSession } from "../server/db/castingV2";
import { createRoll } from "../server/castingV2/rollService";
import { refineCandidate } from "../server/castingV2/refineService";
import { selectVariant } from "../server/db/castingV2Variants";
import { vacantPhraseFor } from "../server/castingV2/vacancyPhrases";
import { slotWordsRefusal } from "../server/castingV2/slotWordShape";
import { storageReadBytes } from "../server/storage";
import { assertOneWorld } from "./lib/worldGuard.mts";

const OUT = "output/shift64-earring-brief";
const USER = Number(process.env.USER_ID ?? 1);
const COST = 25;
/** Named in the brief so the hoops are BORN-WORN: in the master, put there by
 *  no step, which is the only shape a vacancy can be reached from today. */
const BRIEF = "A woman in her forties who wears small gold hoop earrings, one at each ear, "
  + "warm and unfussy, for an independent bookshop's about page.";

if (process.env.MYSQL_PUBLIC_URL) {
  throw new Error("this spends credits and is a DEV acceptance — it refuses to run against production");
}
assertOneWorld(["DATABASE_URL"]);
const where = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"));
console.log(`WORLD: DATABASE_URL → ${where.hostname}:${where.port}`);
await mkdir(OUT, { recursive: true });

const db = await getDb();
if (!db) throw new Error("no db");

/* ── cast the specimen ─────────────────────────────────────────────────────── */

if (process.argv[2] === "cast") {
  console.log(`PLAN: one roll on dev user ${USER} — about 160 credits\nBRIEF: ${BRIEF}\n`);
  const session = await createCastingSession({ userId: USER });
  const result = await createRoll({}, {
    userId: USER, clientRequestId: randomUUID(),
    sessionPublicId: session.publicId, briefText: BRIEF,
  });
  console.log(`roll ${result.rollPublicId} — waiting for the sheet to settle…`);
  for (let at = 0; at < 90; at += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    const rows = await db
      .select({ publicId: castingCandidates.publicId, status: castingCandidates.status, imageKey: castingCandidates.imageKey })
      .from(castingCandidates)
      .where(eq(castingCandidates.sessionId, session.id));
    const ready = rows.filter((row) => row.status === "ready");
    const settled = rows.filter((row) => row.status !== "queued" && row.status !== "dispatched");
    console.log(`  ${ready.length} ready / ${settled.length} settled of ${rows.length}`);
    if (rows.length > 0 && settled.length === rows.length) {
      console.log(`\nready candidates (their faces are written out so the hoops can be LOOKED at):`);
      for (const row of ready) {
        console.log(`  ${row.publicId}`);
        if (!row.imageKey) continue;
        const bytes = await storageReadBytes(row.imageKey);
        await writeFile(path.join(OUT, `cast-${row.publicId.slice(0, 8)}.png`), bytes.bytes);
        await sharp(bytes.bytes).extract({ left: 200, top: 300, width: 624, height: 400 })
          .resize({ width: 1250 }).png().toFile(path.join(OUT, `cast-${row.publicId.slice(0, 8)}-BAND.png`));
      }
      break;
    }
  }
  process.exit(0);
}

/* ── the acceptance ────────────────────────────────────────────────────────── */

const candidatePublicId = process.argv[2];
if (!candidatePublicId) throw new Error("pass a candidate public id, or `cast`");

const library = process.env.CASTING_REFERENCE_LIBRARY_SCOPE ?? "(unset)";
const repaint = process.env.CASTING_REPAINT_SCOPE ?? "(unset)";
console.log(`FLAGS: library ${library} · repaint ${repaint}`);
if (!/^(all|users:.*\b1\b.*)$/.test(repaint) || !/^(all|users:.*\b1\b.*)$/.test(library)) {
  throw new Error("the repaint road is not open for this user — set both scopes to users:1");
}

const [candidate] = await db.select().from(castingCandidates)
  .where(and(eq(castingCandidates.publicId, candidatePublicId), eq(castingCandidates.userId, USER)))
  .limit(1);
if (!candidate) throw new Error("no such candidate on this user");

let failures = 0;
const check = (ok: boolean, label: string, detail = ""): void => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
};

const rowsOfLibrary = async (): Promise<any[]> => {
  const [found] = await (await import("mysql2/promise")).default
    .createConnection(process.env.DATABASE_URL!)
    .then(async (connection) => {
      const result = await connection.query<any[]>(
        `SELECT id, role, slot, words, storageKey, version, retiredAt
           FROM casting_reference_library WHERE candidateId = ? ORDER BY id`, [candidate.id],
      );
      await connection.end();
      return result;
    });
  return found as any[];
};

console.log(`\nPLAN: ${2} paid steps × ${COST} = ${2 * COST} credits on dev user ${USER}`);
await selectVariant({ userId: USER, candidatePublicId, variantPublicId: null });

const STEPS = [
  { instruction: "take her earrings off", wants: "both lobes bare" },
  { instruction: "colour her hair copper", wants: "copper hair, and the lobes STILL bare" },
];
const walked: any[] = [];
for (const [at, step] of STEPS.entries()) {
  console.log(`\n── step ${at + 1}: "${step.instruction}" — want ${step.wants}`);
  const began = Date.now();
  let threw: string | null = null;
  let outcome: any = null;
  try {
    outcome = await refineCandidate({}, {
      userId: USER, clientRequestId: randomUUID(),
      candidatePublicId, instruction: step.instruction,
    });
  } catch (error) {
    threw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
  console.log(`  ${threw ?? outcome?.kind}  (${Math.round((Date.now() - began) / 1000)}s)`);

  const [row] = await db.select().from(castingCandidateVariants)
    .where(eq(castingCandidateVariants.publicId, outcome?.variantId ?? "—")).limit(1);
  const parsed = row && typeof row.internalPrompt === "string"
    ? (() => { try { return JSON.parse(row.internalPrompt as string); } catch { return null; } })()
    : (row?.internalPrompt as any) ?? null;
  const record = parsed?.repaint ?? null;
  check(row?.status === "ready", `[row] step ${at + 1} delivered`, row ? `#${row.id} ${row.status}` : `no row — ${threw ?? "?"}`);
  check(record !== null, `[row] step ${at + 1} came down the REPAINT road`, record ? `${record.references.length} references` : "no repaint record");
  if (record) {
    console.log(`      edited ${JSON.stringify(record.edited)} · vacated ${JSON.stringify(record.vacated)} · carried ${JSON.stringify(record.carried)}`);
    console.log(`      PROMPT AT THE WIRE:\n      "${String(record.prompt ?? "").replace(/\s+/g, " ")}"`);
  }
  if (row?.imageKey && row.status === "ready") {
    const bytes = await storageReadBytes(row.imageKey);
    await writeFile(path.join(OUT, `step${at + 1}.png`), bytes.bytes);
    await sharp(bytes.bytes).extract({ left: 200, top: 300, width: 624, height: 400 })
      .resize({ width: 1250 }).png().toFile(path.join(OUT, `step${at + 1}-BAND.png`));
  }
  walked.push({ step: step.instruction, threw, row, record });
}

const after = await rowsOfLibrary();
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
  check(slotWordsRefusal(String(row.slot), words) === null, `[db] ${row.slot} filed words that slot may say`, JSON.stringify(words));
}

const pair = vacantPhraseFor("earring")!;
const prompt = String(walked[1]?.record?.prompt ?? "");
check(prompt.includes(pair), "[wire] step 2 says the PAIR sentence again", pair);
check(prompt.split(pair).length === 2, "[wire] and says it ONCE", `${Math.max(0, prompt.split(pair).length - 1)} occurrence(s)`);
check(!/her (left|right) ear\b/.test(prompt), "[wire] and never as two per-side claims", prompt.match(/her (left|right) ear/)?.[0] ?? "none");
check(
  Array.isArray(walked[1]?.record?.references)
    && !walked[1].record.references.some((reference: any) => String(reference?.slot ?? "").startsWith("earring@")),
  "[wire] and sends no hoop crop beside it",
  JSON.stringify((walked[1]?.record?.references ?? []).map((reference: any) => reference?.slot ?? "master")),
);

const charged = walked.reduce((total, entry) => total + Number(entry.row?.pointsCost ?? 0), 0);
const delivered = walked.filter((entry) => entry.row?.status === "ready").length;
check(charged === delivered * COST, "[money] charged exactly for what was delivered",
  `charged ${charged} against ${delivered} × ${COST}`);

console.log(`\n${"=".repeat(96)}`);
console.log(failures === 0
  ? "ACCEPTANCE (b): a born-worn PAIR came off, was recorded lobe by lobe, and the next paid render\nsaid so once. Look at the ear bands before believing this line."
  : `${failures} assertion(s) went the wrong way — read the frames and the rows.`);
console.log("=".repeat(96));
await writeFile(path.join(OUT, "walk.json"), JSON.stringify({ candidate: candidatePublicId, walked, after, failures }, null, 2));
process.exit(failures === 0 ? 0 : 1);
