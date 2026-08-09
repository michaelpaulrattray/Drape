/**
 * THE FOUNDER'S OWN STACK, IN ROWS — fable-115's artifact pulls.
 *
 * He asked for "dangly cross earrings" on a face he had already paid to wear
 * her hair down, and got a frame with the hair back UP and no earrings. Four
 * findings in one afternoon of dogfooding, and every one of them is answerable
 * from artifacts that already exist. This reads them and nothing else — it
 * writes no row, spends nothing, and asks no model.
 *
 * Fable's order is "rows, not stories", so the output is deliberately flat:
 * every field printed is a column or a JSON key, named where it came from.
 *
 *   MYSQL_PUBLIC_URL=… npx tsx scripts/pull-founder-stack-disposable.mts --list
 *   … --variant <publicId>          the full artifact set for one render
 *   … --candidate <publicId>        every variant, segment and charge on a face
 *
 * Run under `railway.cmd run --service MySQL` for production rows.
 */
import mysql from "mysql2/promise";

import { assertOneWorld } from "./lib/worldGuard.mts";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);

const url = process.env[databaseKey];
if (!url) { console.error("no database url — run under `railway run --service MySQL`"); process.exit(1); }

/* The founder, by his own identifier rather than by `id = 1` (a row number is
   not a fact — worldGuard's sibling lesson). */
const OPEN_ID = "google_109438922864282769159";
const DAYS = Number(arg("days", "3"));

const connection = await mysql.createConnection({ uri: url, timezone: "Z" } as any);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};

const [owner] = await query("SELECT id, openId FROM users WHERE openId = ? LIMIT 1", [OPEN_ID]);
if (!owner) { console.error(`no account for ${OPEN_ID} — wrong world`); process.exit(1); }
/* The balance lives in its own table (`points`), not on the user row. */
const [balance] = await query("SELECT balance FROM points WHERE userId = ? LIMIT 1", [owner.id]);
console.log(`account ${owner.id} (${owner.openId})  balance ${balance?.balance ?? "?"}\n`);

const stamp = (value: unknown): string =>
  value instanceof Date ? value.toISOString().replace("T", " ").slice(0, 19) : String(value ?? "");

const json = (value: unknown): any => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return value; } }
  return value;
};

async function listRecent(): Promise<void> {
  const rows = await query(
    `SELECT v.id, v.publicId, v.parentVariantId, c.publicId AS candidatePublicId,
            v.requestText, v.status, v.failureClass, v.pointsCost, v.operationId,
            v.imageKey, v.outcome, v.createdAt
       FROM casting_candidate_variants v
       JOIN casting_candidates c ON c.id = v.candidateId
      WHERE v.userId = ? AND v.createdAt > (NOW() - INTERVAL ? DAY)
      ORDER BY v.id ASC`,
    [owner.id, DAYS],
  );
  console.log(`${rows.length} variant rows in the last ${DAYS} day(s)\n`);
  console.log("  id  parent  candidate  created              status      cost  landed  request");
  for (const row of rows) {
    console.log(
      `${String(row.id).padStart(5)}  ${String(row.parentVariantId ?? "-").padStart(6)}  `
      + `${String(row.candidatePublicId).slice(0, 8)}   ${stamp(row.createdAt)}  `
      + `${String(row.status).padEnd(10)}  ${String(row.pointsCost).padStart(4)}  `
      + `${row.imageKey ? "yes   " : "NO    "}  ${row.requestText ?? "(no requestText)"}`
      + `${row.failureClass ? `   [${row.failureClass}]` : ""}`,
    );
  }
}

async function dumpVariant(publicId: string): Promise<void> {
  const [variant] = await query(
    `SELECT v.*, c.publicId AS candidatePublicId
       FROM casting_candidate_variants v
       JOIN casting_candidates c ON c.id = v.candidateId
      WHERE v.publicId LIKE ? AND v.userId = ?`,
    [`${publicId}%`, owner.id],
  );
  if (!variant) { console.log(`no variant ${publicId} on this account`); return; }

  console.log("=".repeat(78));
  console.log(`VARIANT ${variant.publicId}  (id ${variant.id})  on candidate ${variant.candidatePublicId}`);
  console.log("=".repeat(78));
  console.log(`request      ${variant.requestText ?? "(null)"}`);
  console.log(`status       ${variant.status}${variant.failureClass ? `  failureClass=${variant.failureClass}` : ""}`);
  console.log(`created      ${stamp(variant.createdAt)}`);
  console.log(`parent       ${variant.parentVariantId ?? "NULL (made from the candidate itself)"}`);
  console.log(`imageKey     ${variant.imageKey ?? "NULL — nothing landed"}`);
  console.log(`cost         ${variant.pointsCost}   operation ${variant.operationId}`);
  console.log(`outcome      ${variant.outcome ?? "(none recorded)"}${variant.outcomeAt ? ` at ${stamp(variant.outcomeAt)}` : ""}`);
  console.log(`provider     ${variant.provider ?? "-"} / ${variant.providerModel ?? "-"}`);

  const instructions = json(variant.instructions);
  console.log(`\ninstructions (${Array.isArray(instructions) ? instructions.length : 0}, oldest first)`);
  if (Array.isArray(instructions)) instructions.forEach((line, index) => console.log(`  ${index + 1}. ${line}`));

  const steps = json(variant.stepDeltas);
  if (Array.isArray(steps)) {
    console.log(`\nstepDeltas (${steps.length})`);
    steps.forEach((step, index) => console.log(`  ${index + 1}. ${JSON.stringify(step)}`));
  }

  const internal = json(variant.internalPrompt) ?? {};

  console.log("\n--- verification (internalPrompt.verification) ---");
  if (!internal.verification) console.log("  (absent — no verdict was recorded on this row)");
  else {
    /* Printed raw. The shape has changed twice this campaign and a printer that
       assumes one is a reader that quietly drops the field that matters. */
    console.log(JSON.stringify(internal.verification, null, 2).slice(0, 8000));
  }

  console.log("\n--- assembly (internalPrompt.assembly) — what the composite pasted ---");
  console.log(internal.assembly ? JSON.stringify(internal.assembly, null, 2).slice(0, 3000) : "  (absent — nothing was carried into this render)");

  console.log("\n--- captions (internalPrompt.captions) ---");
  console.log(internal.captions ? JSON.stringify(internal.captions).slice(0, 1200) : "  (absent)");

  console.log("\n--- presentation / resolved identity (the pinned state) ---");
  console.log(`presentation ${internal.presentation ? JSON.stringify(internal.presentation) : "(absent)"}`);
  const resolved = internal.resolved ?? null;
  if (resolved) {
    for (const key of ["hair", "hairWorn", "accessories", "makeup", "marks"]) {
      if (resolved[key] !== undefined) console.log(`resolved.${key} = ${JSON.stringify(resolved[key]).slice(0, 400)}`);
    }
  }

  console.log("\n--- the prompt that was actually sent ---");
  console.log(typeof internal.prompt === "string" ? internal.prompt.slice(0, 4000) : "(absent)");

  await dumpOperation(variant.operationId);
}

async function dumpOperation(operationId: string): Promise<void> {
  const [operation] = await query(
    `SELECT id, kind, status, plannedCredits, chargedCredits, refundedCredits, chargeReferenceId,
            errorCode, publicMessage, phase, createdAt, completedAt
       FROM generation_operations WHERE id = ?`,
    [operationId],
  );
  console.log("\n--- operation row ---");
  if (!operation) { console.log(`  (no generation_operations row for ${operationId})`); return; }
  console.log(`  ${operation.id}  kind=${operation.kind}  status=${operation.status}  phase=${operation.phase ?? "-"}`);
  console.log(`  planned=${operation.plannedCredits}  charged=${operation.chargedCredits}  refunded=${operation.refundedCredits}`);
  console.log(`  chargeReferenceId=${operation.chargeReferenceId ?? "-"}  errorCode=${operation.errorCode ?? "-"}`);
  if (operation.publicMessage) console.log(`  message: ${operation.publicMessage}`);
  console.log(`  created=${stamp(operation.createdAt)}  completed=${stamp(operation.completedAt)}`);

  const ledger = await query(
    `SELECT id, amount, type, description, referenceId, balanceAfter, createdAt
       FROM point_transactions
      WHERE userId = ? AND referenceId LIKE ?
      ORDER BY id ASC`,
    [owner.id, `%${operationId}%`],
  );
  console.log(`\n--- ledger rows referencing this operation (${ledger.length}) ---`);
  for (const row of ledger) {
    console.log(`  ${stamp(row.createdAt)}  ${String(row.type).padEnd(10)} ${String(row.amount).padStart(5)}  `
      + `balance ${row.balanceAfter}   ref=${row.referenceId}   ${row.description ?? ""}`);
  }
  if (ledger.length === 0 && operation) {
    const byCharge = await query(
      `SELECT id, amount, type, description, referenceId, balanceAfter, createdAt
         FROM point_transactions WHERE userId = ? AND referenceId = ?`,
      [owner.id, operation.chargeReferenceId],
    );
    for (const row of byCharge) {
      console.log(`  ${stamp(row.createdAt)}  ${String(row.type).padEnd(10)} ${String(row.amount).padStart(5)}  `
        + `balance ${row.balanceAfter}   ref=${row.referenceId}   ${row.description ?? ""}`);
    }
  }
}

async function dumpCandidate(publicId: string): Promise<void> {
  /* Prefixes are accepted: the listing prints eight characters, and retyping a
     full uuid from a screen is its own transcription error. */
  const [candidate] = await query(
    "SELECT id, publicId, userId, createdAt FROM casting_candidates WHERE publicId LIKE ?",
    [`${publicId}%`],
  );
  if (!candidate) { console.log(`no candidate ${publicId}`); return; }
  console.log(`CANDIDATE ${candidate.publicId} (id ${candidate.id}) cast ${stamp(candidate.createdAt)}\n`);

  const variants = await query(
    `SELECT id, publicId, parentVariantId, requestText, status, failureClass, pointsCost,
            imageKey, createdAt
       FROM casting_candidate_variants WHERE candidateId = ? ORDER BY id ASC`,
    [candidate.id],
  );
  console.log(`--- variants (${variants.length}) ---`);
  for (const row of variants) {
    console.log(`${String(row.id).padStart(5)}  ${row.publicId}  parent=${String(row.parentVariantId ?? "-").padStart(5)}  `
      + `${stamp(row.createdAt)}  ${String(row.status).padEnd(10)} ${row.imageKey ? "landed" : "NO IMAGE"}  `
      + `${row.pointsCost}cr  ${row.requestText ?? ""}${row.failureClass ? `  [${row.failureClass}]` : ""}`);
  }

  const segments = await query(
    `SELECT id, publicId, variantId, provenance, facet, region, version, verdict, verifiedAt,
            detector, bboxX, bboxY, bboxW, bboxH, createdAt
       FROM casting_segments WHERE candidateId = ? ORDER BY id ASC`,
    [candidate.id],
  );
  console.log(`\n--- segments kept on this face (${segments.length}) ---`);
  if (segments.length === 0) console.log("  NONE — nothing on this face keeps pixels; every facet is re-rolled by words.");
  for (const row of segments) {
    console.log(`${String(row.id).padStart(5)}  variant=${String(row.variantId ?? "-").padStart(5)}  `
      + `${String(row.provenance).padEnd(13)} ${String(row.facet).padEnd(16)} region=${String(row.region).padEnd(14)} `
      + `v${row.version}  verdict=${row.verdict ?? "-"}  ${row.bboxW}x${row.bboxH}  ${stamp(row.createdAt)}`);
  }
}

const listMode = process.argv.includes("--list");
const variantId = arg("variant");
const candidateId = arg("candidate");

if (listMode) await listRecent();
if (candidateId) await dumpCandidate(candidateId);
if (variantId) await dumpVariant(variantId);
if (!listMode && !variantId && !candidateId) await listRecent();

await connection.end();
