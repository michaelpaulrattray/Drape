/**
 * WHAT DID STEP 4 ACTUALLY ASK FOR? — the artifact, not the design note.
 *
 * Frames 03 and 04 of run-15 came back at her bare-face floor: the freckles she paid
 * for at step 1 are not in it. The obvious fix — *the recipe says the bare noun
 * "freckles", so make it remember the density she accepted* — assumes the
 * prompt said "freckles" and nothing more.
 *
 * But recipe v3 already does exactly that, by another name. After a render is
 * kept, a vision pass writes a CAPTION for each facet the edit wrote, and every
 * later render carries the captions of facets it is not itself rewriting. Step
 * 1 wrote `marks`, so step 1 should have captioned it, and steps 3 and 4 should
 * both have carried that caption into their prompts.
 *
 * If they did, then the memory already exists and frame 04 lost its freckles
 * with a specific description in the prompt — which is a completely different
 * defect from a vague one, and building a second memory would be building the
 * thing that is already there.
 *
 * So: read the prompts. Read-only, no renders, no money.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-run15-prompts-disposable.mts
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const CANDIDATE = "154fb36b-334e-4cb1-92aa-9a2c567f6d26";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL — run under `railway run --service MySQL`");

const connection = await openDatabase(databaseUrl);
const [rows] = await connection.query<any[]>(
  `SELECT v.id, v.publicId, v.status, v.instructions, v.deltas, v.stepDeltas, v.internalPrompt
     FROM casting_candidate_variants v
     JOIN casting_candidates c ON c.id = v.candidateId
    WHERE c.publicId = ?
    ORDER BY v.id ASC`,
  [CANDIDATE],
);
await connection.end();

const parse = (value: unknown): any =>
  typeof value === "string" ? JSON.parse(value) : value;

const dump: any[] = [];
for (const row of rows) {
  const internal = parse(row.internalPrompt) ?? {};
  const deltas = parse(row.deltas) ?? {};
  const instructions = parse(row.instructions) ?? [];
  const prompt = typeof internal.prompt === "string"
    ? internal.prompt
    : JSON.stringify(internal.prompt ?? null);

  console.log(`\n${"=".repeat(78)}`);
  console.log(`v${row.id} ${row.status}  instructions: ${JSON.stringify(instructions)}`);
  console.log(`  deltas.free.marks   ${JSON.stringify(deltas?.free?.marks ?? null)}`);
  console.log(`  captions            ${JSON.stringify(internal.captions ?? null)}`);
  const checks = internal.verification?.checks ?? [];
  for (const check of checks) {
    if (check.facet !== "marks") continue;
    console.log(`  marks check         verified=${check.verified} read=${check.read} saw="${check.saw ?? ""}"`);
  }
  /* The line the painter was actually given about her skin. */
  const marksLine = String(prompt).split("\n").filter((line) => /MARKS|freckle/i.test(line));
  console.log(`  MARKS in the prompt ${marksLine.length ? "" : "(none)"}`);
  for (const line of marksLine) console.log(`    | ${line.trim().slice(0, 200)}`);

  dump.push({
    id: row.id, publicId: row.publicId, status: row.status, instructions,
    marksDelta: deltas?.free?.marks ?? null,
    captions: internal.captions ?? null,
    marksChecks: checks.filter((check: any) => check.facet === "marks"),
    prompt,
  });
}

writeFileSync("output/marks-court/run15-prompts.json", `${JSON.stringify(dump, null, 2)}\n`);
console.log(`\nwritten output/marks-court/run15-prompts.json`);
