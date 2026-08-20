/**
 * WHAT STEP TWO ACTUALLY SENT — the wire reading fable-1166 §2b ordered.
 *
 * The carry drive found a delivered tattoo gone on the next unrelated edit, and
 * the report beside it said the master was bare-chested. §2b names three
 * discriminations and forbids reconstructing any of them: the RECORD is read,
 * never a rebuilt input (`reconstruction-needs-an-independent-record`).
 *
 * Read-only, dev, one connection. Prints the request text, the references the
 * recipe carried by role and digest, and only the CLAUSES that bear on the
 * question — wardrobe words and ink words — never the whole internal prompt.
 *
 *   npx tsx scripts/read-ink-carry-wire-disposable.mts
 */
import "dotenv/config";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const SESSION = "af5011d8-ca5f-4bd8-a785-7cc516c8361d";
const url = resolveDatabaseUrl();
if (!url) throw new Error("no database url");
console.log(`world: ${worldOf(url)}`);
const conn = await openDatabase(url);

const [candidates] = await conn.execute(
  `SELECT c.id, c.publicId, c.userId, c.imageKey
     FROM casting_candidates c
     JOIN casting_sessions s ON s.id = c.sessionId
    WHERE s.publicId = ?`,
  [SESSION],
);
const rows = candidates as Array<{ id: number; publicId: string; userId: number; imageKey: string }>;
console.log(`candidates in session: ${rows.length}`);
for (const candidate of rows) {
  console.log(`  candidate ${candidate.id} ${candidate.publicId} user=${candidate.userId}`);
  console.log(`    master imageKey: ${candidate.imageKey}`);
}

for (const candidate of rows) {
  const [variants] = await conn.execute(
    `SELECT id, publicId, status, requestText, parentVariantId, imageKey, createdAt,
            JSON_EXTRACT(internalPrompt, '$.repaint') IS NOT NULL AS hasRepaint,
            JSON_UNQUOTE(JSON_EXTRACT(internalPrompt, '$.repaint.prompt')) AS prompt,
            JSON_EXTRACT(internalPrompt, '$.repaint.references') AS refs,
            JSON_EXTRACT(internalPrompt, '$.repaint.edited') AS edited,
            JSON_EXTRACT(internalPrompt, '$.repaint.carried') AS carried,
            JSON_EXTRACT(internalPrompt, '$.repaint.standing') AS standing
       FROM casting_candidate_variants
      WHERE candidateId = ? ORDER BY id ASC`,
    [candidate.id],
  );
  for (const v of variants as Array<Record<string, unknown>>) {
    console.log("");
    console.log(`=== variant ${v.id} (${v.publicId}) status=${v.status} created=${String(v.createdAt)}`);
    console.log(`    asked: ${JSON.stringify(v.requestText)}`);
    console.log(`    parent:${v.parentVariantId}`);
    console.log(`    landed:${v.imageKey}`);
    console.log(`    repaint record present: ${v.hasRepaint}`);
    console.log(`    edited:   ${JSON.stringify(v.edited)}`);
    console.log(`    carried:  ${JSON.stringify(v.carried)}`);
    console.log(`    standing: ${JSON.stringify(v.standing)}`);
    console.log(`    references: ${JSON.stringify(v.refs)}`);
    const prompt = typeof v.prompt === "string" ? v.prompt : null;
    if (prompt === null) { console.log("    prompt: (none on the record)"); continue; }
    console.log(`    prompt length: ${prompt.length}`);
    const sentences = prompt.split(/(?<=[.;])\s+/);
    const wardrobe = sentences.filter((one) =>
      /shirt|t-?shirt|tee|top|clothes|clothing|garment|dress|neckline|collar|bare|shirtless|torso|chest/i.test(one));
    const ink = sentences.filter((one) => /tattoo|ink|design|dinosaur|skeleton|t-?rex/i.test(one));
    console.log(`    WARDROBE/CHEST clauses (${wardrobe.length}):`);
    for (const line of wardrobe) console.log(`      · ${line.trim()}`);
    console.log(`    INK clauses (${ink.length}):`);
    for (const line of ink) console.log(`      · ${line.trim()}`);
  }
}

const [designs] = await conn.execute(
  `SELECT d.id, d.publicId, d.candidateId, d.placement, d.side, d.cutRoute, d.digest, d.createdAt
     FROM casting_ink_designs d
     JOIN casting_candidates c ON c.id = d.candidateId
     JOIN casting_sessions s ON s.id = c.sessionId
    WHERE s.publicId = ?`,
  [SESSION],
);
console.log("");
console.log(`ink design rows on this session: ${JSON.stringify(designs)}`);

await conn.end();
process.exit(0);
