/**
 * DISPOSABLE, READ-ONLY — the founder's REFUSED reference ask, off PRODUCTION.
 *
 * Ordered fable-1139 §2b: artifacts before theory. His screenshot says a female
 * hairstyle reference onto his bald male cyborg ("Stone-faced", roll 81)
 * answered the likeness wall. This does not reconstruct the ask from the
 * screenshot — it reads the rows.
 *
 * Three questions, in this order, because they discriminate different faults:
 *
 *   1. WAS A PICTURE EVER ATTACHED to that Cast, and when? If
 *      `casting_reference_attachments` holds no row for his candidate, the
 *      handle never existed and the fault is at the attach door, not the wall.
 *   2. WHAT DID HIS ASK SAY, and what did the interpreter file? The variant
 *      rows carry `instructions` and `deltas`, so his exact sentence and the
 *      filed wall come off the row rather than off a report.
 *   3. DID THE ASK AND THE ATTACHMENT COINCIDE IN TIME? A picture attached
 *      after the refused ask is a different story from one attached before it.
 *
 * It reads the production database. It writes nothing, migrates nothing, and
 * never prints a credential. It prints a customer's own instruction text
 * because that text IS the subject of the court; nothing else from the row.
 */
import { spawnSync } from "node:child_process";
import { openDatabase } from "./lib/dbConnection.mts";

const railway = (...args: string[]): string => {
  const result = spawnSync("railway.cmd", args, { encoding: "utf8", shell: true });
  if (result.status !== 0) {
    throw new Error(`railway ${args[0]} failed: ${(result.stderr ?? "").slice(0, 200)}`);
  }
  return result.stdout ?? "";
};

const url = railway("variables", "--service", "MySQL", "--kv").split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line.startsWith("MYSQL_PUBLIC_URL="))
  ?.slice("MYSQL_PUBLIC_URL=".length);

if (!url) {
  console.log("UNREAD — MYSQL_PUBLIC_URL not readable from this shell");
  process.exit(1);
}

const parsed = new URL(url);
console.log(`[db] ${parsed.hostname}:${parsed.port}${parsed.pathname}`);

const connection = await openDatabase(url);
type Row = Record<string, unknown>;

function show(label: string, rows: Row[]): void {
  console.log(`\n──── ${label} — ${rows.length} row(s)`);
  for (const row of rows) {
    console.log(JSON.stringify(row));
  }
}

try {
  /* 1. Every attachment on his account, newest first. The whole table is tiny
        (the door opened yesterday), so no window is needed and none is guessed. */
  const [attachments] = await connection.query(
    "SELECT a.publicId, a.candidateId, c.publicId AS candidatePublicId, a.provenance,"
      + " a.width, a.height, a.byteSize, a.createdAt"
      + " FROM casting_reference_attachments a"
      + " JOIN casting_candidates c ON c.id = a.candidateId"
      + " WHERE a.userId = 1 ORDER BY a.id DESC LIMIT 20",
  );
  show("attachments on user 1", attachments as Row[]);

  /* 2. His refine asks of the last day, with the filed outcome. `instructions`
        is the sentence he typed; `deltas` is what the interpreter came back
        with, wall included. */
  const [variants] = await connection.query(
    "SELECT v.publicId, v.candidateId, v.status, v.createdAt,"
      + " CAST(v.instructions AS CHAR) AS instructions, CAST(v.deltas AS CHAR) AS deltas"
      + " FROM casting_candidate_variants v"
      + " WHERE v.userId = 1 AND v.createdAt > DATE_SUB(NOW(), INTERVAL 2 DAY)"
      + " ORDER BY v.id DESC LIMIT 40",
  );
  show("refine variants, last 2 days", variants as Row[]);

  /* 3. The Cast itself, so "roll 81 / Stone-faced" in his words is tied to the
        candidate ids above rather than assumed to be. */
  const [casts] = await connection.query(
    "SELECT c.id, c.publicId, c.status, c.createdAt, r.rollIndex, r.id AS rollId"
      + " FROM casting_candidates c JOIN casting_rolls r ON r.id = c.rollId"
      + " WHERE c.userId = 1 AND c.createdAt > DATE_SUB(NOW(), INTERVAL 3 DAY)"
      + " ORDER BY c.id DESC LIMIT 30",
  );
  show("his recent candidates", casts as Row[]);

  /*
    4. THE REFUSAL ITSELF. A walled refine writes NO variant row — nothing is
       charged and nothing is claimed — so the only durable trace is the audit
       row `countRefusal` files: reason, outcome, and the candidate it was about.
       Deliberately not her sentence (`refusalCounter.ts`: "Reason, facet,
       outcome — and nothing she typed"), which is why this court cannot get his
       words off the database and has to say so.
  */
  const [refusals] = await connection.query(
    "SELECT id, userId, action, resourceType, resourceId, CAST(metadata AS CHAR) AS metadata, createdAt"
      + " FROM audit_logs WHERE action = ? AND createdAt > DATE_SUB(NOW(), INTERVAL 3 DAY)"
      + " ORDER BY id DESC LIMIT 40",
    ["casting.refusal"],
  );
  show("counted refusals, last 3 days", refusals as Row[]);

  const [actions] = await connection.query(
    "SELECT action, COUNT(*) AS n FROM audit_logs"
      + " WHERE createdAt > DATE_SUB(NOW(), INTERVAL 3 DAY) GROUP BY action ORDER BY n DESC LIMIT 30",
  );
  show("every audit action in the window — the control on the name above", actions as Row[]);
} finally {
  await connection.end();
}

/*
  THE LAST STATEMENT ENDS THE PROCESS. A read against a remote database leaves
  a pool the runtime may keep alive, and a script that hangs after printing its
  answer is a script somebody kills before reading the tail of it.
*/
process.exit(0);
