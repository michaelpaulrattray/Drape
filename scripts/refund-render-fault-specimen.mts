/**
 * The D-93 specimen refund — a support correction, run under ceremony.
 *
 * The founder's k-pop verification returned a contact sheet where a portrait
 * should have been. It landed `ready`, was charged, and was never refunded:
 * "manually note that roll" was said at the time and nothing followed. D-113's
 * support-correction precedent exists for exactly this, applied case by case,
 * and the founder ruled this is the case.
 *
 * # What it corrects is the LEDGER, not the candidate
 *
 * The candidate row may already have been purged by the 7-day retention sweep
 * and that changes nothing: the customer was charged, and the charge is what is
 * being put right. So this reads the CHARGE first and refunds against it. If
 * the candidate row survives it is used to confirm the amount; if it does not,
 * the amount comes from the roll's own per-slice arithmetic.
 *
 * # The reference, and why it is not the ordinary one
 *
 * A failure refund uses `refund:<candidate charge reference>`, and that
 * reference is the ledger's authority for "this candidate was refunded as a
 * failure". A correction is a different fact about the same money — reusing the
 * reference would either collide with a real failure refund or teach the
 * recovery adjudicator that this candidate failed, which it did not. It
 * succeeded, at producing garbage.
 *
 * So corrections live in their own namespace: `refund:correction:<charge ref>`.
 * Deterministic, so a second run is a duplicate rather than a second payment.
 *
 * # Running it
 *
 *   npx tsx scripts/refund-render-fault-specimen.mts --roll <publicId> --position 1
 *   npx tsx scripts/refund-render-fault-specimen.mts --roll <publicId> --position 1 --apply
 *
 * Without `--apply` it reports and writes nothing. Against production it runs
 * under the standing ceremony: `railway whoami` first, `MYSQL_PUBLIC_URL` in
 * this one command's env and never in a file, and a verifying query after.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

import { addCredits, normalizeCreditReferenceId } from "../server/db/credits";
import { candidateChargeReference } from "../server/castingV2/rollRecovery";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const rollPublicId = arg("roll");
const position = Number(arg("position") ?? "1");
const apply = process.argv.includes("--apply");

if (!rollPublicId) {
  console.error("usage: --roll <rollPublicId> --position <1-based tile> [--apply]");
  process.exit(1);
}

/**
 * The correction's reference.
 *
 * One helper, so the dry run and the write can never disagree about the key
 * that makes this idempotent.
 */
export function correctionReference(operationId: string, candidatePublicId: string): string {
  return normalizeCreditReferenceId(
    `refund:correction:${candidateChargeReference(operationId, candidatePublicId)}`,
  );
}

const conn = await mysql.createConnection(process.env.DATABASE_URL!);

const [rolls] = await conn.query<any[]>(
  `SELECT id, publicId, userId, operationId, priceCredits, briefText, CAST(createdAt AS CHAR) AS createdAt
   FROM casting_rolls WHERE publicId = ?`,
  [rollPublicId],
);
if (rolls.length === 0) {
  console.error(`no roll with publicId ${rollPublicId}`);
  process.exit(1);
}
const roll = rolls[0];
console.log(`roll ${roll.publicId}  user=${roll.userId}  created=${roll.createdAt}`);
console.log(`  brief: ${roll.briefText}`);
console.log(`  operation: ${roll.operationId}  rollPrice=${roll.priceCredits}`);

const [candidates] = await conn.query<any[]>(
  `SELECT publicId, position, status, pointsCost, imageKey FROM casting_candidates
   WHERE rollId = ? AND position = ?`,
  [roll.id, position - 1],
);
const candidate = candidates[0];
if (candidate) {
  console.log(`  tile ${position}: ${candidate.publicId} status=${candidate.status} cost=${candidate.pointsCost} image=${candidate.imageKey ?? "PURGED"}`);
} else {
  console.log(`  tile ${position}: row is GONE (retention sweep) — correcting the ledger anyway`);
}

/*
  THE CHARGE IS THE AUTHORITY. Confirm it exists and was never refunded before
  putting anything right — a correction issued against a charge that already
  came back is an overpayment, and the ledger is the only thing that knows.
*/
const chargeReference = candidate
  ? candidateChargeReference(roll.operationId, candidate.publicId)
  : null;
const opCharge = normalizeCreditReferenceId(`op:${roll.operationId}:charge`);

const [ledger] = await conn.query<any[]>(
  `SELECT id, type, amount, referenceId, description, CAST(createdAt AS CHAR) AS createdAt
   FROM point_transactions WHERE referenceId IN (?, ?, ?, ?) ORDER BY id`,
  [
    opCharge,
    chargeReference ?? "-",
    chargeReference ? normalizeCreditReferenceId(`refund:${chargeReference}`) : "-",
    candidate ? correctionReference(roll.operationId, candidate.publicId) : "-",
  ],
);
console.log(`\nledger rows for this roll's references: ${ledger.length}`);
for (const row of ledger) {
  console.log(`  #${row.id} ${row.type.padEnd(8)} ${String(row.amount).padStart(6)}  ${row.referenceId}`);
  console.log(`        ${row.description}  (${row.createdAt})`);
}

const sliceCost = candidate?.pointsCost
  ?? (roll.priceCredits > 0 ? Math.round(roll.priceCredits / 8) : 0);
console.log(`\nslice to correct: ${sliceCost} credits`);

if (!candidate) {
  console.error("\nthe candidate row is gone, so no per-candidate reference can be derived.");
  console.error("Refund by hand against the operation charge, with a description naming D-93.");
  await conn.end();
  process.exit(1);
}

const reference = correctionReference(roll.operationId, candidate.publicId);
console.log(`correction reference: ${reference}`);

const already = ledger.find((row) => row.referenceId === reference);
if (already) {
  console.log(`\nALREADY CORRECTED as ledger row #${already.id}. Nothing to do.`);
  await conn.end();
  process.exit(0);
}

if (!apply) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to issue the correction.");
  await conn.end();
  process.exit(0);
}

const result = await addCredits(
  roll.userId,
  sliceCost,
  "refund",
  "Correction: this tile returned a contact sheet rather than a portrait (D-93). Charged and never refunded.",
  reference,
);
console.log(`\napply: success=${result.success} duplicate=${result.duplicate === true} ${result.error ?? ""}`);

const [after] = await conn.query<any[]>(
  `SELECT id, type, amount, referenceId, CAST(createdAt AS CHAR) AS createdAt
   FROM point_transactions WHERE referenceId = ?`,
  [reference],
);
console.log("verified by direct query:", JSON.stringify(after));
await conn.end();
process.exit(result.success ? 0 : 1);
