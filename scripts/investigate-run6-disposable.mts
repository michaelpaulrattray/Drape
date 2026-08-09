/**
 * DISPOSABLE — run-6 post-mortem, read-only.
 *
 * Answers three questions from fable-011 with rows rather than recollection:
 *
 * 1. Why did `remove her glasses` fail? (variant.failureClass, the operation's
 *    errorCode/publicMessage, and the stored verification verdict.)
 * 2. Did the freckles render land late, after step 1's window closed? (every
 *    variant on the candidate with its create/complete times.)
 * 3. Where did `hairWorn = "tied back, low ponytail"` come from on a fresh
 *    face? (the stored verification facts on every attempt.)
 *
 * Read-only: SELECTs only. Run under `railway.cmd run --service MySQL`.
 */
import { openDatabase, utc } from "./lib/dbConnection.mjs";
import { databaseUrl } from "./lib/attemptRows.mjs";

const CANDIDATE = process.argv[2] ?? "7c796a72-25d7-4702-b506-0d38c3d5d8b9";

function pretty(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}

async function main(): Promise<void> {
  const conn = await openDatabase(databaseUrl());
  try {
    const [candidates] = await conn.query<any[]>(
      `SELECT id, publicId, rollId, position, status, createdAt
         FROM casting_candidates WHERE publicId = ?`,
      [CANDIDATE],
    );
    if (candidates.length === 0) throw new Error(`no candidate ${CANDIDATE}`);
    const candidate = candidates[0];
    console.log(`candidate ${candidate.publicId}  id=${candidate.id}  position=${candidate.position}  ${candidate.status}  created ${utc(candidate.createdAt)}`);

    const [variants] = await conn.query<any[]>(
      `SELECT v.id, v.publicId, v.operationId, v.status, v.failureClass, v.pointsCost,
              v.requestText, v.createdAt, v.internalPrompt, v.imageKey,
              v.instructions, v.deltas, v.stepDeltas, v.outcome, v.outcomeAt,
              o.status AS opStatus, o.errorCode, o.publicMessage, o.chargedCredits,
              o.refundedCredits, o.createdAt AS opCreatedAt, o.completedAt AS opCompletedAt
         FROM casting_candidate_variants v
         LEFT JOIN generation_operations o ON o.id = v.operationId
        WHERE v.candidateId = ?
        ORDER BY v.createdAt ASC`,
      [candidate.id],
    );

    console.log(`\n${variants.length} variant row(s)\n${"=".repeat(78)}`);
    for (const v of variants) {
      console.log(`\n--- variant ${v.publicId}  "${v.requestText ?? "—"}"`);
      console.log(`    status=${v.status}  failureClass=${v.failureClass ?? "—"}  cost=${v.pointsCost}  outcome=${v.outcome ?? "—"} ${utc(v.outcomeAt)}`);
      console.log(`    created ${utc(v.createdAt)}`);
      console.log(`    instructions: ${JSON.stringify(pretty(v.instructions))}`);
      console.log(`    deltas:     ${JSON.stringify(pretty(v.deltas)).slice(0, 1500)}`);
      console.log(`    stepDeltas: ${JSON.stringify(pretty(v.stepDeltas)).slice(0, 1500)}`);
      console.log(`    op ${v.operationId ?? "—"}  ${v.opStatus ?? "—"}  charged=${v.chargedCredits ?? "—"} refunded=${v.refundedCredits ?? "—"}`);
      console.log(`    op created ${utc(v.opCreatedAt)}  completed ${utc(v.opCompletedAt)}`);
      if (v.errorCode || v.publicMessage) {
        console.log(`    errorCode=${v.errorCode ?? "—"}`);
        console.log(`    publicMessage=${v.publicMessage ?? "—"}`);
      }
      console.log(`    imageKey=${v.imageKey ?? "—"}`);
      const internal: any = pretty(v.internalPrompt);
      if (internal && typeof internal === "object") {
        console.log(`    internalPrompt keys: ${Object.keys(internal).join(", ")}`);
        if (internal.verification) {
          console.log(`    verification: ${JSON.stringify(internal.verification, null, 2).split("\n").join("\n    ")}`);
        }
        for (const key of ["composed", "delta", "editDelta", "instruction", "facets", "departed"]) {
          if (internal[key] !== undefined) {
            console.log(`    ${key}: ${JSON.stringify(internal[key]).slice(0, 1200)}`);
          }
        }
      } else if (internal) {
        console.log(`    internalPrompt: ${String(internal).slice(0, 600)}`);
      }
    }

    /* Where does the candidate's own record say her hair is worn? */
    const [rolls] = await conn.query<any[]>(
      `SELECT r.id, r.publicId, r.sessionId, r.createdAt, r.briefText AS brief, r.compiledBrief AS treatment
         FROM casting_rolls r WHERE r.id = ?`,
      [candidate.rollId],
    );
    if (rolls.length > 0) {
      const roll = rolls[0];
      console.log(`\n${"=".repeat(78)}\nroll ${roll.publicId}  created ${utc(roll.createdAt)}`);
      console.log(`brief:     ${JSON.stringify(pretty(roll.brief)).slice(0, 2000)}`);
      console.log(`treatment: ${JSON.stringify(pretty(roll.treatment)).slice(0, 2000)}`);
    }

    const [candidateFull] = await conn.query<any[]>(
      `SELECT * FROM casting_candidates WHERE id = ?`,
      [candidate.id],
    );
    const row = candidateFull[0];
    console.log(`\n${"=".repeat(78)}\ncandidate columns:`);
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) continue;
      const text = typeof value === "object" ? JSON.stringify(value) : String(value);
      if (/hair|identity|brief|prompt|schema|realiz|snapshot|facet/i.test(key) || text.length > 80) {
        console.log(`  ${key}: ${text.slice(0, 2500)}`);
      }
    }
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
