import { getDb } from "../../db/connection";

const EXPECTED_COLUMN_TYPE = "enum('public_r2','private_evidence_r2')";
const EXPECTED_INDEX_COLUMNS = ["batchId", "storageBackend", "storageKey"];

interface SchemaQueryClient {
  query(
    statement: string,
    values?: readonly unknown[],
  ): Promise<[unknown, unknown]>;
}

interface ColumnRow {
  COLUMN_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_DEFAULT: string | null;
}

interface IndexRow {
  NON_UNIQUE: number;
  SEQ_IN_INDEX: number;
  COLUMN_NAME: string;
}

export class PrivateEvidenceSchemaMismatchError extends Error {
  constructor() {
    super(
      "Private evidence storage requires cleanup-backend migration 0012 before this runtime can start.",
    );
    this.name = "PrivateEvidenceSchemaMismatchError";
  }
}

export class PrivateEvidenceSchemaUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      "Private evidence cleanup schema could not be verified before startup.",
      { cause },
    );
    this.name = "PrivateEvidenceSchemaUnavailableError";
  }
}

function columnRows(value: unknown): ColumnRow[] {
  return Array.isArray(value) ? value as ColumnRow[] : [];
}

function indexRows(value: unknown): IndexRow[] {
  return Array.isArray(value) ? value as IndexRow[] : [];
}

export async function assertPrivateEvidenceCleanupSchemaWithClient(
  client: SchemaQueryClient,
): Promise<void> {
  const [rawColumns] = await client.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'storage_cleanup_items'
        AND COLUMN_NAME = 'storageBackend'`,
  );
  const columns = columnRows(rawColumns);
  if (
    columns.length !== 1
    || columns[0].COLUMN_TYPE !== EXPECTED_COLUMN_TYPE
    || columns[0].IS_NULLABLE !== "NO"
    || columns[0].COLUMN_DEFAULT !== "public_r2"
  ) {
    throw new PrivateEvidenceSchemaMismatchError();
  }

  const [rawIndexes] = await client.query(
    `SELECT NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'storage_cleanup_items'
        AND INDEX_NAME = 'uq_storage_cleanup_items_batch_key'
      ORDER BY SEQ_IN_INDEX`,
  );
  const indexes = indexRows(rawIndexes);
  if (
    indexes.length !== EXPECTED_INDEX_COLUMNS.length
    || indexes.some((row, index) => (
      Number(row.NON_UNIQUE) !== 0
      || Number(row.SEQ_IN_INDEX) !== index + 1
      || row.COLUMN_NAME !== EXPECTED_INDEX_COLUMNS[index]
    ))
  ) {
    throw new PrivateEvidenceSchemaMismatchError();
  }
}

/**
 * The first adapter-capable runtime refuses old-schema skew before accepting
 * traffic. Transient database startup failures receive a small bounded retry
 * so the stronger fence does not create needless deploy-time UX outages.
 */
export async function assertPrivateEvidenceCleanupSchema(
  options: {
    attempts?: number;
    retryDelayMs?: number;
    getClient?: () => Promise<SchemaQueryClient>;
  } = {},
): Promise<void> {
  const attempts = options.attempts ?? 4;
  const retryDelayMs = options.retryDelayMs ?? 750;
  if (
    !Number.isSafeInteger(attempts)
    || attempts <= 0
    || !Number.isSafeInteger(retryDelayMs)
    || retryDelayMs < 0
  ) {
    throw new TypeError("Invalid private evidence schema retry configuration");
  }
  const getClient = options.getClient ?? (async () => {
    const db = await getDb();
    if (!db) throw new Error("database unavailable");
    return db.$client as unknown as SchemaQueryClient;
  });
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await assertPrivateEvidenceCleanupSchemaWithClient(await getClient());
      return;
    } catch (error) {
      if (error instanceof PrivateEvidenceSchemaMismatchError) throw error;
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
  }
  throw new PrivateEvidenceSchemaUnavailableError(lastError);
}
