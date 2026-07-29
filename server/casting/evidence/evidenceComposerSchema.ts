import { getDb } from "../../db/connection";
import { promiseSchemaQueryClient } from "./privateEvidenceSchema";

interface SchemaQueryClient {
  query(
    statement: string,
    values?: readonly unknown[],
  ): Promise<[unknown, unknown]>;
}

interface ColumnRow {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  COLUMN_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_DEFAULT: string | null;
}

interface IndexRow {
  TABLE_NAME: string;
  INDEX_NAME: string;
  NON_UNIQUE: number;
  SEQ_IN_INDEX: number;
  COLUMN_NAME: string;
}

interface CheckRow {
  CONSTRAINT_NAME: string;
  CHECK_CLAUSE: string;
}

const NEW_TABLE_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  model_identity_feature_intents: [
    "id", "userId", "modelId", "capabilityKey", "activeCapabilityKey",
    "status", "category", "operation", "ontologyVersion", "zone", "surface",
    "side", "normalizedDescriptor", "sourceAssetId", "expectedStateVersion",
    "identitySnapshotId", "packageSnapshotId", "createdByOperationId",
    "resolvedByOperationId", "resolvedCandidateId", "resolvedFeatureId",
    "createdAt", "resolvedAt",
  ],
  casting_evidence_candidates: [
    "id", "userId", "modelId", "intentId", "originatingOperationId",
    "capabilityKey", "activeSlot", "expectedStateVersion",
    "identitySnapshotId", "packageSnapshotId", "targetViewAngle",
    "sourceAssetId", "status", "readyAttemptId", "acceptedAssetId",
    "acceptedIdentitySnapshotId", "acceptedPackageSnapshotId",
    "cleanupBatchId", "composerRecipeVersion", "probeRecipeVersion",
    "createdAt", "expiresAt", "resolvedAt", "resolvedByOperationId",
  ],
  casting_evidence_candidate_attempts: [
    "id", "candidateId", "attemptNumber", "generationId", "status",
    "privatePlateId", "privateStorageKey", "mime", "width", "height",
    "byteSize", "contentHash", "promotedPublicStorageKey", "cleanupBatchId",
    "actualImageEngine", "composerRecipeVersion", "probeModel",
    "probeRecipeVersion", "predictedVisibility", "identityOutcome",
    "placementOutcome", "featureMatchOutcome", "poseFramingOutcome",
    "unexpectedInkOutcome", "overallOutcome", "createdAt", "storedAt",
    "probedAt", "promotedAt",
  ],
  model_identity_features: [
    "id", "modelId", "category", "createdByOperationId", "createdAt",
  ],
  model_identity_feature_versions: [
    "id", "modelId", "featureId", "operation", "ontologyVersion", "zone",
    "surface", "side", "normalizedDescriptor", "sourceAssetId",
    "sourceViewAngle", "sourceReferencePlateId", "acceptedCandidatePlateId",
    "evidenceCropId", "recipeVersion", "createdByOperationId", "createdAt",
    "acceptedAssetId",
  ],
  model_snapshot_feature_selections: [
    "id", "modelId", "identitySnapshotId", "featureId", "featureVersionId",
    "selectionReason", "sourceSelectionId", "createdAt",
  ],
};

const EXISTING_COLUMN_TYPES: Readonly<Record<string, string>> = {
  "models.status":
    "enum('draft','active','locked','archived','provisioning')",
  "generations.type":
    "enum('masterPrompt','castingImage','fullBody','multiView','iteration','upscale','wardrobeVTO','wardrobeComposite','wardrobeRefinement','wardrobeDigitize','evidenceCandidate')",
  "storage_cleanup_batches.kind":
    "enum('model_delete','account_delete','evidence_cleanup','candidate_cleanup')",
  "model_reference_plates.kind":
    "enum('uploaded_reference','accepted_candidate')",
  "model_reference_plates.featureIntentId": "varchar(36)",
  "model_reference_plates.createdByOperationStepKey": "varchar(64)",
  "model_evidence_crops.createdByOperationStepKey": "varchar(64)",
  "casting_evidence_ingestions.purpose":
    "enum('reference_plate','evidence_crop','fork_copy')",
  "casting_evidence_ingestions.stepKey": "varchar(64)",
  "model_package_snapshots.reason":
    "enum('bootstrap','create','identity_change','image_refine','slot_generate','slot_refresh','slot_restore','add_views','whole_restore','mint','late_view','evidence_accept')",
  "model_package_snapshot_slots.selectionReason":
    "enum('generated','carried','refreshed','restored','late_view','bootstrap','evidence_accept')",
  "model_identity_feature_intents.status":
    "enum('pending','resolved','cancelled')",
  "model_identity_feature_intents.category": "enum('ink')",
  "model_identity_feature_intents.operation": "enum('add')",
  "casting_evidence_candidates.activeSlot": "enum('active')",
  "casting_evidence_candidates.targetViewAngle": "enum('frontFull')",
  "casting_evidence_candidates.status":
    "enum('processing','ready','accepted','rejected','cancelled','expired','invalid')",
  "casting_evidence_candidate_attempts.status":
    "enum('planned','generating','stored','probe_passed','probe_failed','probe_unknown','promoted','cleanup_pending','cleaned')",
  "casting_evidence_candidate_attempts.overallOutcome":
    "enum('pass','fail','unknown')",
  "model_identity_features.category": "enum('ink')",
  "model_identity_feature_versions.operation": "enum('present')",
  "model_identity_feature_versions.sourceAssetId": "int",
  "model_identity_feature_versions.acceptedAssetId": "int",
  "model_identity_feature_versions.sourceViewAngle": "enum('frontFull')",
  "model_snapshot_feature_selections.selectionReason":
    "enum('accepted','carried','restored')",
};

const COLUMN_DEFAULT_EXPECTATIONS: Readonly<Record<
  string,
  { nullable: "YES" | "NO"; defaultValue: string | null }
>> = {
  "model_reference_plates.createdByOperationStepKey": {
    nullable: "NO",
    defaultValue: "primary",
  },
  "model_evidence_crops.createdByOperationStepKey": {
    nullable: "NO",
    defaultValue: "primary",
  },
  "casting_evidence_ingestions.stepKey": {
    nullable: "NO",
    defaultValue: "primary",
  },
  "model_identity_feature_intents.activeCapabilityKey": {
    nullable: "YES",
    defaultValue: null,
  },
  "model_identity_feature_intents.status": {
    nullable: "NO",
    defaultValue: "pending",
  },
  "casting_evidence_candidates.activeSlot": {
    nullable: "YES",
    defaultValue: null,
  },
  "casting_evidence_candidates.status": {
    nullable: "NO",
    defaultValue: "processing",
  },
  "casting_evidence_candidate_attempts.status": {
    nullable: "NO",
    defaultValue: "planned",
  },
  "model_identity_feature_versions.sourceAssetId": {
    nullable: "YES",
    defaultValue: null,
  },
  "model_identity_feature_versions.acceptedAssetId": {
    nullable: "YES",
    defaultValue: null,
  },
};

const EXPECTED_INDEXES: Readonly<Record<string, readonly string[]>> = {
  "model_identity_feature_intents.PRIMARY": ["id"],
  "model_identity_feature_intents.uq_identity_feature_intents_model_active": [
    "modelId", "activeCapabilityKey",
  ],
  "model_identity_feature_intents.uq_identity_feature_intents_created_operation": [
    "createdByOperationId",
  ],
  "casting_evidence_candidates.PRIMARY": ["id"],
  "casting_evidence_candidates.uq_evidence_candidates_origin_operation": [
    "originatingOperationId",
  ],
  "casting_evidence_candidates.uq_evidence_candidates_intent_active": [
    "intentId", "activeSlot",
  ],
  "casting_evidence_candidate_attempts.PRIMARY": ["id"],
  "casting_evidence_candidate_attempts.uq_evidence_candidate_attempt_number": [
    "candidateId", "attemptNumber",
  ],
  "casting_evidence_candidate_attempts.uq_evidence_candidate_attempt_generation": [
    "generationId",
  ],
  "casting_evidence_candidate_attempts.uq_evidence_candidate_attempt_plate": [
    "privatePlateId",
  ],
  "casting_evidence_candidate_attempts.uq_evidence_candidate_attempt_private_key": [
    "privateStorageKey",
  ],
  "casting_evidence_candidate_attempts.uq_evidence_candidate_attempt_public_key": [
    "promotedPublicStorageKey",
  ],
  "model_identity_features.PRIMARY": ["id"],
  "model_identity_features.uq_identity_features_created_operation": [
    "createdByOperationId",
  ],
  "model_identity_feature_versions.PRIMARY": ["id"],
  "model_identity_feature_versions.uq_identity_feature_versions_created_operation": [
    "createdByOperationId",
  ],
  "model_identity_feature_versions.uq_identity_feature_versions_accepted_asset": [
    "acceptedAssetId",
  ],
  "model_snapshot_feature_selections.PRIMARY": ["id"],
  "model_snapshot_feature_selections.uq_snapshot_feature_selections_snapshot_feature": [
    "identitySnapshotId", "featureId",
  ],
  "model_snapshot_feature_selections.uq_snapshot_feature_selections_snapshot_version": [
    "identitySnapshotId", "featureVersionId",
  ],
  "model_reference_plates.uq_model_reference_plates_feature_intent": [
    "featureIntentId",
  ],
  "model_reference_plates.uq_model_reference_plates_operation_step": [
    "createdByOperationId", "createdByOperationStepKey",
  ],
  "model_evidence_crops.uq_model_evidence_crops_operation_step": [
    "createdByOperationId", "createdByOperationStepKey",
  ],
  "casting_evidence_ingestions.uq_casting_evidence_ingestions_operation_step": [
    "operationId", "stepKey",
  ],
};

const EXPECTED_NONUNIQUE_INDEXES: Readonly<Record<string, readonly string[]>> = {
  "model_identity_feature_intents.idx_identity_feature_intents_owner_model_status": [
    "userId", "modelId", "status",
  ],
  "model_identity_feature_intents.idx_identity_feature_intents_model_created": [
    "modelId", "createdAt",
  ],
  "casting_evidence_candidates.idx_evidence_candidates_owner_model_status": [
    "userId", "modelId", "status",
  ],
  "casting_evidence_candidates.idx_evidence_candidates_intent_created": [
    "intentId", "createdAt",
  ],
  "casting_evidence_candidates.idx_evidence_candidates_status_expiry": [
    "status", "expiresAt",
  ],
  "casting_evidence_candidate_attempts.idx_evidence_candidate_attempt_status": [
    "candidateId", "status",
  ],
  "model_identity_features.idx_identity_features_model_created": [
    "modelId", "createdAt",
  ],
  "model_identity_feature_versions.idx_identity_feature_versions_model_created": [
    "modelId", "createdAt",
  ],
  "model_identity_feature_versions.idx_identity_feature_versions_feature": [
    "featureId",
  ],
  "model_snapshot_feature_selections.idx_snapshot_feature_selections_model": [
    "modelId",
  ],
  "model_snapshot_feature_selections.idx_snapshot_feature_selections_snapshot": [
    "identitySnapshotId",
  ],
  "model_snapshot_feature_selections.idx_snapshot_feature_selections_version": [
    "featureVersionId",
  ],
};

const RETIRED_INDEXES = new Set([
  "uq_model_reference_plates_operation",
  "uq_model_evidence_crops_operation",
  "uq_casting_evidence_ingestions_operation",
]);

export class EvidenceComposerSchemaMismatchError extends Error {
  constructor() {
    super(
      "Evidence composer requires the complete R7-7E migration 0014 before it can be enabled.",
    );
    this.name = "EvidenceComposerSchemaMismatchError";
  }
}

export class EvidenceComposerSchemaUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Evidence composer schema could not be verified before startup.", {
      cause,
    });
    this.name = "EvidenceComposerSchemaUnavailableError";
  }
}

function normalizeType(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function stripBalancedOuterParentheses(value: string): string {
  let normalized = value;
  while (normalized.startsWith("(") && normalized.endsWith(")")) {
    let depth = 0;
    let wrapsWholeExpression = true;
    for (let index = 0; index < normalized.length; index += 1) {
      const character = normalized[index];
      if (character === "(") depth += 1;
      else if (character === ")") depth -= 1;
      if (depth === 0 && index < normalized.length - 1) {
        wrapsWholeExpression = false;
        break;
      }
      if (depth < 0) {
        wrapsWholeExpression = false;
        break;
      }
    }
    if (!wrapsWholeExpression || depth !== 0) break;
    normalized = normalized.slice(1, -1);
  }
  return normalized;
}

export async function assertEvidenceComposerSchemaWithClient(
  client: SchemaQueryClient,
): Promise<void> {
  const newTables = Object.keys(NEW_TABLE_COLUMNS);
  const [rawColumns] = await client.query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND (
          TABLE_NAME IN (${newTables.map(() => "?").join(",")})
          OR (TABLE_NAME = 'models' AND COLUMN_NAME = 'status')
          OR (TABLE_NAME = 'generations' AND COLUMN_NAME = 'type')
          OR (TABLE_NAME = 'storage_cleanup_batches' AND COLUMN_NAME = 'kind')
          OR (TABLE_NAME = 'model_reference_plates'
              AND COLUMN_NAME IN ('kind','featureIntentId','createdByOperationStepKey'))
          OR (TABLE_NAME = 'model_evidence_crops'
              AND COLUMN_NAME = 'createdByOperationStepKey')
          OR (TABLE_NAME = 'casting_evidence_ingestions'
              AND COLUMN_NAME IN ('purpose','stepKey'))
          OR (TABLE_NAME = 'model_package_snapshots' AND COLUMN_NAME = 'reason')
          OR (TABLE_NAME = 'model_package_snapshot_slots'
              AND COLUMN_NAME = 'selectionReason')
        )
      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    newTables,
  );
  const columns = Array.isArray(rawColumns) ? rawColumns as ColumnRow[] : [];

  for (const [tableName, expectedColumns] of Object.entries(NEW_TABLE_COLUMNS)) {
    const actual = columns
      .filter((row) => row.TABLE_NAME === tableName)
      .map((row) => row.COLUMN_NAME);
    if (
      actual.length !== expectedColumns.length
      || actual.some((column, index) => column !== expectedColumns[index])
    ) {
      throw new EvidenceComposerSchemaMismatchError();
    }
  }

  for (const [key, expectedType] of Object.entries(EXISTING_COLUMN_TYPES)) {
    const [tableName, columnName] = key.split(".");
    const match = columns.find(
      (row) => row.TABLE_NAME === tableName && row.COLUMN_NAME === columnName,
    );
    if (!match || normalizeType(match.COLUMN_TYPE) !== normalizeType(expectedType)) {
      throw new EvidenceComposerSchemaMismatchError();
    }
    const expectation = COLUMN_DEFAULT_EXPECTATIONS[key];
    if (
      expectation
      && (
        match.IS_NULLABLE !== expectation.nullable
        || match.COLUMN_DEFAULT !== expectation.defaultValue
      )
    ) {
      throw new EvidenceComposerSchemaMismatchError();
    }
  }

  const relevantTables = [
    ...newTables,
    "model_reference_plates",
    "model_evidence_crops",
    "casting_evidence_ingestions",
  ];
  const [rawIndexes] = await client.query(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (${relevantTables.map(() => "?").join(",")})
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
    relevantTables,
  );
  const indexes = Array.isArray(rawIndexes) ? rawIndexes as IndexRow[] : [];
  if (indexes.some((row) => RETIRED_INDEXES.has(row.INDEX_NAME))) {
    throw new EvidenceComposerSchemaMismatchError();
  }
  for (const [key, expectedColumns] of Object.entries(EXPECTED_INDEXES)) {
    const separator = key.indexOf(".");
    const tableName = key.slice(0, separator);
    const indexName = key.slice(separator + 1);
    const actual = indexes
      .filter(
        (row) => row.TABLE_NAME === tableName && row.INDEX_NAME === indexName,
      )
      .sort((a, b) => Number(a.SEQ_IN_INDEX) - Number(b.SEQ_IN_INDEX));
    if (
      actual.length !== expectedColumns.length
      || actual.some(
        (row, index) =>
          Number(row.NON_UNIQUE) !== 0
          || Number(row.SEQ_IN_INDEX) !== index + 1
          || row.COLUMN_NAME !== expectedColumns[index],
      )
    ) {
      throw new EvidenceComposerSchemaMismatchError();
    }
  }
  for (const [key, expectedColumns] of Object.entries(EXPECTED_NONUNIQUE_INDEXES)) {
    const separator = key.indexOf(".");
    const tableName = key.slice(0, separator);
    const indexName = key.slice(separator + 1);
    const actual = indexes
      .filter(
        (row) => row.TABLE_NAME === tableName && row.INDEX_NAME === indexName,
      )
      .sort((a, b) => Number(a.SEQ_IN_INDEX) - Number(b.SEQ_IN_INDEX));
    if (
      actual.length !== expectedColumns.length
      || actual.some(
        (row, index) =>
          Number(row.NON_UNIQUE) !== 1
          || Number(row.SEQ_IN_INDEX) !== index + 1
          || row.COLUMN_NAME !== expectedColumns[index],
      )
    ) {
      throw new EvidenceComposerSchemaMismatchError();
    }
  }

  const [rawChecks] = await client.query(
    `SELECT tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
       FROM information_schema.TABLE_CONSTRAINTS tc
       JOIN information_schema.CHECK_CONSTRAINTS cc
         ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
        AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
        AND tc.TABLE_NAME = 'casting_evidence_candidate_attempts'
        AND tc.CONSTRAINT_TYPE = 'CHECK'`,
  );
  const checks = Array.isArray(rawChecks) ? rawChecks as CheckRow[] : [];
  const attemptCheck = checks.find(
    (row) => row.CONSTRAINT_NAME === "chk_evidence_candidate_attempt_number",
  );
  const normalizedClause = stripBalancedOuterParentheses(
    attemptCheck?.CHECK_CLAUSE
    .replace(/`casting_evidence_candidate_attempts`\./g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, "")
    .toLowerCase() ?? "",
  );
  if (checks.length !== 1 || normalizedClause !== "attemptnumberin(1,2)") {
    throw new EvidenceComposerSchemaMismatchError();
  }
}

export async function assertEvidenceComposerSchema(options: {
  attempts?: number;
  retryDelayMs?: number;
  getClient?: () => Promise<SchemaQueryClient>;
} = {}): Promise<void> {
  const attempts = options.attempts ?? 4;
  const retryDelayMs = options.retryDelayMs ?? 750;
  if (
    !Number.isSafeInteger(attempts)
    || attempts <= 0
    || !Number.isSafeInteger(retryDelayMs)
    || retryDelayMs < 0
  ) {
    throw new TypeError("Invalid evidence composer schema retry configuration");
  }
  const getClient = options.getClient ?? (async () => {
    const db = await getDb();
    if (!db) throw new Error("database unavailable");
    return promiseSchemaQueryClient(db.$client);
  });
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await assertEvidenceComposerSchemaWithClient(await getClient());
      return;
    } catch (error) {
      if (error instanceof EvidenceComposerSchemaMismatchError) throw error;
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
  }
  throw new EvidenceComposerSchemaUnavailableError(lastError);
}
