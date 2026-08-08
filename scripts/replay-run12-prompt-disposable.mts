/**
 * WHAT STEP 4 WOULD SAY NOW — the same filed row, through the new composer.
 *
 * The lane fix is argued from run-12's stored prompt, so the proof it works
 * belongs on the same artifact: take variant 131's OWN persisted deltas and
 * captions out of production, run them through `composeRenderPrompt` as it
 * stands today, and print the before and the after side by side.
 *
 * No render, no money, no model. Just the string the painter would be handed.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/replay-run12-prompt-disposable.mts
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { composeRenderPrompt, contradictedFacets, type RefineDelta } from "../server/castingV2/refineDelta";
import { EDIT_PROSE } from "../server/castingV2/refineService";
import type { Facet } from "../server/castingV2/refineFacets";

const CANDIDATE = "8154ac6d-64ee-45ad-834b-fcbabca0f3ef";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL — run under `railway run --service MySQL`");

const connection = await openDatabase(databaseUrl);
const [rows] = await connection.query<any[]>(
  `SELECT v.id, v.instructions, v.deltas, v.internalPrompt
     FROM casting_candidate_variants v
     JOIN casting_candidates c ON c.id = v.candidateId
    WHERE c.publicId = ? AND v.status = 'ready'
    ORDER BY v.id ASC`,
  [CANDIDATE],
);
await connection.end();

const parse = (value: unknown): any => (typeof value === "string" ? JSON.parse(value) : value);

const dump: any[] = [];
for (const [index, row] of rows.entries()) {
  const deltas = parse(row.deltas) as RefineDelta;
  const instructions = parse(row.instructions) as string[];
  /*
    THE CAPTIONS THIS RENDER CARRIED IN, which is the PREDECESSOR's set — a
    variant's own `captions` are what was written AFTER it rendered. Reading its
    own would be asking what it learnt, not what it was told.
  */
  const carried = index > 0 ? (parse(rows[index - 1]!.internalPrompt)?.captions ?? {}) : {};
  const before = String(parse(row.internalPrompt)?.prompt ?? "");
  const after = composeRenderPrompt(deltas, EDIT_PROSE, carried as Partial<Record<Facet, string>>);

  console.log(`\n${"=".repeat(78)}`);
  console.log(`v${row.id}  "${instructions.at(-1)}"`);
  console.log(`  carried captions: ${Object.keys(carried).join(", ") || "(none)"}`);
  console.log(`  contradicted now: ${JSON.stringify(contradictedFacets(after, deltas))}`);
  const marksBefore = /MARKS:[^.]*\./.exec(before);
  const marksAfterEdits = /MARKS:[^.]*\./.exec(after.edits);
  console.log(`  BEFORE, edits lane : ${marksBefore?.[0] ?? "(no MARKS clause)"}`);
  console.log(`  BEFORE, already-true: ${/MARKS: [^|.]*/.exec(before.split("ALREADY TRUE")[1] ?? "")?.[0] ?? "(none)"}`);
  console.log(`  AFTER,  edits lane : ${marksAfterEdits?.[0] ?? "(no MARKS clause)"}`);
  console.log(`  AFTER,  already-true: ${/MARKS: [^|.]*/.exec(after.captions)?.[0] ?? "(none)"}`);

  dump.push({ id: row.id, instruction: instructions.at(-1), before, after: after.full });
}

writeFileSync("output/marks-court/run12-replay.json", `${JSON.stringify(dump, null, 2)}\n`);
console.log(`\nwritten output/marks-court/run12-replay.json`);
