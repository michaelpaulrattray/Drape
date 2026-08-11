/**
 * C5D production adapter proof. It writes one reserved synthetic object,
 * proves an exact read, and always deletes it before reporting success.
 * Output is counts/booleans only; keys and credentials never print.
 */
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import mysql, { type RowDataPacket } from "mysql2/promise";
import sharp from "sharp";
import {
  buildReferencePlateStorageKey,
} from "../server/casting/evidence/evidenceDelivery";
import {
  getConfiguredPrivateEvidenceStorageAdapter,
  parsePrivateEvidenceStorageConfig,
} from "../server/casting/evidence/privateEvidenceStorage";
import {
  assertPrivateEvidenceScopeOff,
  parsePrivateEvidenceCeremonyArgs,
} from "../server/casting/evidence/privateEvidenceCeremony";
import { assertReadOnlyAuditSql } from "../server/casting/deletionAudit";
import { openDatabase } from "./lib/dbConnection.mts";

const SYNTHETIC_USER_ID = 2_147_483_647;
const SYNTHETIC_MODEL_ID = 2_147_483_646;

async function collect(body: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function readOnlySyntheticIdFence(databaseUrl: string): Promise<void> {
  const connection = await openDatabase({
    uri: databaseUrl,
    connectTimeout: 15_000,
  });
  try {
    for (const statement of [
      "START TRANSACTION READ ONLY",
      "SELECT (SELECT COUNT(*) FROM users WHERE id = ?) AS users, (SELECT COUNT(*) FROM models WHERE id = ?) AS models",
      "ROLLBACK",
    ]) assertReadOnlyAuditSql(statement);
    await connection.query("START TRANSACTION READ ONLY");
    const [[row]] = await connection.query<RowDataPacket[]>(
      "SELECT (SELECT COUNT(*) FROM users WHERE id = ?) AS users, (SELECT COUNT(*) FROM models WHERE id = ?) AS models",
      [SYNTHETIC_USER_ID, SYNTHETIC_MODEL_ID],
    );
    await connection.query("ROLLBACK");
    if (Number(row?.users) !== 0 || Number(row?.models) !== 0) {
      throw new Error("synthetic_evidence_ids_are_not_reserved");
    }
  } finally {
    await connection.end();
  }
}

async function main(): Promise<void> {
  const args = parsePrivateEvidenceCeremonyArgs(
    process.argv.slice(2),
    "probe",
  );
  assertPrivateEvidenceScopeOff(process.env.R7_EVIDENCE_INGEST_SCOPE);
  const config = parsePrivateEvidenceStorageConfig(process.env);
  if (!config || config.bucket !== args.evidenceBucket) {
    throw new Error("private_evidence_bucket_confirmation_mismatch");
  }
  const adapter = getConfiguredPrivateEvidenceStorageAdapter();
  if (!adapter) throw new Error("private_evidence_adapter_unconfigured");
  await readOnlySyntheticIdFence(args.databaseUrl);
  const expected = args.expectedObjectCount!;
  const listLimit = Math.min(100_000, Math.max(100, expected + 2));
  const before = await adapter.listCanonicalKeys({ maxKeys: listLimit });
  if (before.length !== expected) {
    throw new Error("private_evidence_probe_initial_count_mismatch");
  }

  const entityId = randomUUID();
  const key = buildReferencePlateStorageKey({
    userId: SYNTHETIC_USER_ID,
    modelId: SYNTHETIC_MODEL_ID,
    plateId: entityId,
  });
  const bytes = await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).webp({ lossless: true }).toBuffer();
  const digest = createHash("sha256").update(bytes).digest("hex");
  let cleanupFailure: string | null = null;
  let originalFailure: unknown;
  try {
    await adapter.putCanonical(key, bytes, "image/webp");
    const during = await adapter.listCanonicalKeys({ maxKeys: listLimit });
    if (during.length !== expected + 1 || !during.includes(key)) {
      throw new Error("private_evidence_probe_write_not_visible");
    }
    const read = await adapter.readCanonical({
      key,
      expectedByteSize: bytes.byteLength,
    });
    const returned = await collect(read.body);
    if (
      returned.byteLength !== bytes.byteLength
      || createHash("sha256").update(returned).digest("hex") !== digest
    ) {
      throw new Error("private_evidence_probe_read_mismatch");
    }
  } catch (error) {
    originalFailure = error;
  } finally {
    // Delete even after an ambiguous PutObject failure: the key is fresh and
    // reserved, so an idempotent exact delete is the only safe settlement.
    const deleted = await adapter.deleteExact(key);
    if (!deleted.success) cleanupFailure = deleted.errorCode;
    const after = await adapter.listCanonicalKeys({ maxKeys: listLimit });
    if (after.length !== expected || after.includes(key)) {
      cleanupFailure = "private_evidence_probe_residue";
    }
  }
  if (cleanupFailure) throw new Error(cleanupFailure);
  if (originalFailure) throw originalFailure;
  process.stdout.write(`${JSON.stringify({
    mode: "production-private-evidence-probe",
    target: { appId: args.appId, host: args.host, database: args.database },
    initialObjects: expected,
    writtenObjects: 1,
    exactRead: true,
    deletedObjects: 1,
    finalObjects: expected,
    residue: 0,
  })}\n`);
}

main().then(() => process.exit(0)).catch(() => {
  process.stderr.write("private_evidence_probe_failed\n");
  process.exit(1);
});
