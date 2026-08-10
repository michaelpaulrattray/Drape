/**
 * THE FOUNDER'S FINDING, SWEPT FOR SIBLINGS (working law 7).
 *
 * His hair-down edit was reverted by the next render he paid for, and his
 * "dangly cross earrings" were delivered and charged on a frame the reader
 * itself said had none. Both are answered on his own rows — but a bug found
 * once is a pattern until proven unique, so this counts how often each shape
 * occurs across every chain in the database.
 *
 * TWO CLASSES, COUNTED SEPARATELY
 *
 * 1. **THE OVERWRITTEN DELIVERY.** A render that edits a PRESENTATION facet
 *    stores a realization caption in free text; the next render retires it
 *    (D-238 owns only the closed arrangement vocabulary), re-reads the facet
 *    from the MASTER, and states the master's value to the painter as already
 *    true. The tell is arithmetic: the child's stored caption is one of the ten
 *    vocabulary wordings, byte for byte, while its parent's is prose.
 *
 * 2. **THE PRESENCE MISS, DELIVERED.** A check that READ the frame, did not
 *    verify it, and was advisory — so the render landed and the credit was
 *    spent. Split by whether the reader's own words describe an ABSENCE
 *    ("no … visible", "not present") or a DEGREE, because those are two
 *    different arguments about what `binding` is for.
 *
 *   MYSQL_PUBLIC_URL=… railway.cmd run --service MySQL -- \
 *     npx tsx scripts/sweep-pin-and-advisory-disposable.mts [--days 30]
 */
import mysql from "mysql2/promise";

import { assertOneWorld } from "./lib/worldGuard.mts";
import { HAIR_ARRANGEMENTS } from "../server/castingV2/hairArrangement.js";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const url = process.env[databaseKey];
if (!url) { console.error("no database url — run under `railway run --service MySQL`"); process.exit(1); }

const DAYS = Number(arg("days", "30"));
const VOCABULARY = new Set<string>(Object.values(HAIR_ARRANGEMENTS));

const connection = await mysql.createConnection({ uri: url, timezone: "Z" } as any);
const [rows] = await connection.query<any[]>(
  `SELECT v.id, v.publicId, v.userId, v.candidateId, v.parentVariantId, v.requestText,
          v.status, v.pointsCost, v.imageKey, v.stepDeltas, v.internalPrompt, v.createdAt
     FROM casting_candidate_variants v
    WHERE v.createdAt > (NOW() - INTERVAL ? DAY)
    ORDER BY v.id ASC`,
  [DAYS],
);
await connection.end();

const json = (value: unknown): any => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return null; } }
  return value;
};

const byId = new Map<number, any>(rows.map((row) => [row.id, row]));
const captionOf = (row: any, facet: string): string | null => json(row?.internalPrompt)?.captions?.[facet] ?? null;

console.log(`${rows.length} variant rows in the last ${DAYS} day(s)\n`);

/* ------------------------------------------------ class 1: the overwritten delivery */

console.log("=".repeat(78));
console.log("CLASS 1 — a delivered presentation edit, restated to the painter as the MASTER's value");
console.log("=".repeat(78));

type Overwritten = {
  parent: any;
  child: any;
  parentCaption: string;
  childCaption: string;
};
const overwritten: Overwritten[] = [];
const editedHairWorn: any[] = [];

for (const row of rows) {
  const steps = json(row.stepDeltas);
  const writesHairWorn = Array.isArray(steps)
    && steps.some((step: any) => step?.free?.hairWorn !== undefined || step?.hairWorn !== undefined);
  if (!writesHairWorn || !row.imageKey) continue;
  editedHairWorn.push(row);

  /* Its children: rows naming it as parent, plus (for chains written before
     `parentVariantId` existed) the next landed row on the same candidate. */
  const children = rows.filter((other) => other.parentVariantId === row.id
    || (other.parentVariantId === null && other.candidateId === row.candidateId && other.id > row.id));
  for (const child of children) {
    const parentCaption = captionOf(row, "hairWorn");
    const childCaption = captionOf(child, "hairWorn");
    if (!parentCaption || !childCaption) continue;
    /* The signature: the parent's caption is prose from the delivered frame,
       the child's is a vocabulary wording byte for byte. */
    if (!VOCABULARY.has(parentCaption) && VOCABULARY.has(childCaption)) {
      overwritten.push({ parent: row, child, parentCaption, childCaption });
    }
  }
}

console.log(`${editedHairWorn.length} landed renders edited how the hair is WORN.`);
console.log(`${overwritten.length} of their children restated the master's arrangement as already-true.\n`);
for (const hit of overwritten) {
  console.log(`user ${hit.parent.userId}  v#${hit.parent.id} "${hit.parent.requestText}" `
    + `-> v#${hit.child.id} "${hit.child.requestText}"  (${hit.child.pointsCost}cr)`);
  console.log(`   delivered : ${hit.parentCaption.slice(0, 96)}`);
  console.log(`   restated  : ${hit.childCaption.slice(0, 96)}`);
}
if (overwritten.length === 0) console.log("(none — the class is the founder's chain alone)");

/* ------------------------------------------------- class 2: the presence miss, delivered */

console.log(`\n${"=".repeat(78)}`);
console.log("CLASS 2 — read, not verified, advisory: delivered and charged anyway");
console.log("=".repeat(78));

const ABSENCE = /\bno\b|\bnot\b|absent|missing|without|none|cannot see|isn't|is not/i;
let charged = 0;
let advisoryMisses = 0;
const presence: Array<{ row: any; check: any }> = [];
const degree: Array<{ row: any; check: any }> = [];

for (const row of rows) {
  if (!row.imageKey || row.pointsCost <= 0) continue;
  charged += 1;
  const checks = json(row.internalPrompt)?.verification?.checks;
  if (!Array.isArray(checks)) continue;
  for (const check of checks) {
    if (!check.read || check.verified || check.binding) continue;
    advisoryMisses += 1;
    (ABSENCE.test(String(check.saw ?? "")) ? presence : degree).push({ row, check });
  }
}

console.log(`${charged} charged renders landed in the window.`);
console.log(`${advisoryMisses} advisory misses on them — read, not verified, not refunded.`);
console.log(`   the reader's words describe an ABSENCE : ${presence.length}`);
console.log(`   the reader's words describe a DEGREE   : ${degree.length}\n`);

const show = (label: string, entries: Array<{ row: any; check: any }>) => {
  console.log(`--- ${label} (${entries.length}) ---`);
  for (const entry of entries.slice(0, 40)) {
    console.log(`user ${entry.row.userId}  v#${entry.row.id}  ${entry.row.pointsCost}cr  `
      + `${entry.check.facet}  asked="${String(entry.check.asked).slice(0, 60)}"`);
    console.log(`     saw: ${String(entry.check.saw).slice(0, 130)}`);
  }
  if (entries.length > 40) console.log(`… and ${entries.length - 40} more`);
};
show("ABSENCE — the thing asked for is not in the picture", presence);
console.log("");
show("DEGREE — the thing is there and the reader argues about how much", degree);

console.log(
  `\nCredits spent on renders carrying an absence-shaped advisory miss: `
  + `${presence.reduce((total, entry) => total + entry.row.pointsCost, 0)}`,
);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
