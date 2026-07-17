/**
 * identityCommit — the §8.6 atomic identity commit (IDENTITY_EDIT_INTERIM_POLICY,
 * Batch C). Every allowed identity change — structured, text, or
 * reference-assisted — lands through this ONE commit, with every write built
 * by the field's typed handler from IDENTITY_FIELD_HANDLERS, never from LLM
 * output.
 *
 * Commit order (§8.6 step 8), all-or-nothing inside one transaction:
 *   1. the preference patch (buildPreferencePatch, closed writable keys);
 *   2. the schema write (buildSchemaWrite; null when no mirror exists);
 *   3. the updated master-description fragments (buildPromptFragment);
 *   4. the new anchor asset (role `anchor`, new identityText fingerprint);
 *   5. the new identityRevisionId on the model row;
 *   6. stale flags on every filled sibling — PINNED INCLUDED (§14);
 *   7. operation provenance carrying the strict typed edit list.
 *
 * If anything fails, the transaction rolls back — no partial identity state
 * survives (§8.6 step 9). Credit consequences belong to the caller (M20).
 */
import { eq, inArray } from "drizzle-orm";
import { models, modelAssets } from "../../../drizzle/schema";
import { withTransaction, type TransactionHandle } from "../../db/connection";
import { buildIdentityAnchor } from "../geminiClient";
import type { ModelPreferences } from "../geminiTypes";
import {
  type AuthorizableIdentityField,
  type AuthorizedIdentityEdit,
  type AuthorizedIdentityPatch,
  type TechnicalSchema,
} from "./identityTypes";
import { handlerFor } from "./identityFieldHandlers";
import {
  identityStampFor,
  mintRevisionId,
  selectStaleSiblingHeads,
} from "./anchorSelector";
import { createModuleLogger } from "../../logging/logger";
import { clearEngineChoiceForChanges } from "../engineChoiceMetadata";

const log = createModuleLogger("casting/identity/identityCommit");

export function editField(edit: AuthorizedIdentityEdit): AuthorizableIdentityField {
  return edit.kind === "leaf" ? edit.leaf : edit.edit.field;
}

function editValue(edit: AuthorizedIdentityEdit): unknown {
  return edit.kind === "leaf" ? edit.value : edit.edit.value;
}

/** The deterministic identity-fragment line this commit writes into the
 *  master description. Replacing the SAME field's earlier fragment (and only
 *  it) is what §8.6 step 6's "suppress old content only for the fields being
 *  changed" means at the prompt layer — protected mark/amendment language is
 *  untouched by construction. */
export function identityFragmentLine(field: AuthorizableIdentityField, fragment: string): string {
  return `IDENTITY UPDATE — ${field} (supersedes any earlier ${field.split(".").pop()} description): ${fragment}`;
}

const FRAGMENT_LINE_PATTERN = (field: AuthorizableIdentityField) =>
  new RegExp(`^IDENTITY UPDATE — ${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} .*$`, "gm");

/** Pure §8.6 document computation — exported for tests. Returns the complete
 *  post-commit document state without touching the database. */
export function computeIdentityCommit(
  model: {
    masterPrompt: string;
    technicalSchema: unknown;
    preferences: unknown;
  },
  patch: AuthorizedIdentityPatch,
): {
  masterPrompt: string;
  technicalSchema: TechnicalSchema;
  preferences: ModelPreferences;
  fragments: string[];
} {
  const currentPrefs = clearEngineChoiceForChanges(
    model.preferences,
    patch.edits.map(editField),
  ) as ModelPreferences;
  const currentSchema = ((model.technicalSchema ?? {}) as TechnicalSchema) || {};

  let preferences: ModelPreferences = { ...currentPrefs };
  const technicalSchema: TechnicalSchema = structuredClone(currentSchema);
  let masterPrompt = model.masterPrompt ?? "";
  const fragments: string[] = [];

  for (const edit of patch.edits) {
    const field = editField(edit);
    const handler = handlerFor(field);
    const value = editValue(edit);

    // 1. Preference patch — typed by the closed writable-key union
    const prefPatch = (handler.buildPreferencePatch as (v: unknown, c: ModelPreferences) => Record<string, unknown>)(
      value,
      preferences,
    );
    preferences = { ...preferences, ...prefPatch };

    // 2. Schema write — null when no mirror exists (never {})
    const schemaWrite = (handler.buildSchemaWrite as (v: unknown, c: TechnicalSchema) => { path: string; value: string } | null)(
      value,
      technicalSchema,
    );
    if (schemaWrite !== null) {
      const [section, key] = schemaWrite.path.split(".");
      const sectionObj =
        technicalSchema[section] && typeof technicalSchema[section] === "object"
          ? (technicalSchema[section] as Record<string, unknown>)
          : {};
      technicalSchema[section] = { ...sectionObj, [key]: schemaWrite.value };
    }

    // 3. Master-description fragment — replace this field's earlier fragment only
    const fragment = (handler.buildPromptFragment as (v: unknown) => string)(value);
    fragments.push(fragment);
    masterPrompt = masterPrompt.replace(FRAGMENT_LINE_PATTERN(field), "").replace(/\n{3,}/g, "\n\n");
    masterPrompt = `${masterPrompt.trimEnd()}\n\n${identityFragmentLine(field, fragment)}`;
  }

  return { masterPrompt, technicalSchema, preferences, fragments };
}

export interface IdentityCommitInput {
  model: {
    id: number;
    masterPrompt: string;
    technicalSchema: unknown;
    preferences: unknown;
    identityRevisionId?: string | null;
  };
  patch: AuthorizedIdentityPatch;
  /** The successfully generated new anchor image. */
  newAnchor: {
    storageUrl: string;
    pointsCost: number;
    resolution?: "1K" | "2K" | "4K";
    engine?: string;
    inputs?: unknown;
  };
  /** The model's assets NEWEST-FIRST (for sibling stale selection). */
  assets: Array<{ id: number; viewType: string; storageUrl?: string | null; pinned?: boolean | null }>;
  /** Optional same-database landing writes (board node stamp + version row +
   *  downstream stale statuses) executed INSIDE the commit transaction — the
   *  identity change and its required board state land together or not at
   *  all (final correction 3). Writes only; never an external call. */
  landing?: (tx: TransactionHandle) => Promise<void>;
}

export interface IdentityCommitResult {
  assetId: number;
  identityRevisionId: string;
  masterPrompt: string;
  technicalSchema: TechnicalSchema;
  preferences: ModelPreferences;
  staledAssetIds: number[];
}

/**
 * The R4 anchor RE-ROLL commit (ratified: a headshot re-roll is an
 * identity-changing anchor operation with NO document change): new anchor
 * row + new identityRevisionId + stale flags on every filled sibling —
 * pinned included — in one transaction. Shared by `castingImage` re-rolls
 * and the board's recast gesture (applyModelEdit `intent:'rerun'` with no
 * attribute changes). Throws on failure; the caller owns the refund.
 */
export async function commitAnchorReRoll(input: {
  modelId: number;
  storageUrl: string;
  pointsCost: number;
  resolution?: "1K" | "2K" | "4K";
  engine?: string;
  /** The CURRENT document fingerprint — a re-roll changes no documents. */
  identityText: string;
  /** The model's assets NEWEST-FIRST (for sibling stale selection). */
  assets: Array<{ id: number; viewType: string; storageUrl?: string | null; pinned?: boolean | null }>;
  /** Optional same-database landing writes (e.g. the board node stamp +
   *  version row + downstream stale statuses) executed INSIDE this commit's
   *  transaction — the identity change and its required board state land
   *  together or not at all (final correction 3). Must contain writes only,
   *  never an external call. */
  landing?: (tx: TransactionHandle) => Promise<void>;
}): Promise<{ assetId: number; identityRevisionId: string; staledAssetIds: number[] }> {
  const revisionId = mintRevisionId();
  const staleIds = selectStaleSiblingHeads(input.assets, "frontClose");
  const assetId = await withTransaction(async (tx) => {
    const [inserted] = await tx
      .insert(modelAssets)
      .values({
        modelId: input.modelId,
        viewType: "frontClose",
        resolution: input.resolution ?? "1K",
        storageUrl: input.storageUrl,
        pointsCost: input.pointsCost,
        provenance: {
          ...(input.engine ? { engine: input.engine } : {}),
          ...identityStampFor({ role: "anchor", revisionId, identityText: input.identityText }),
        },
      })
      .$returningId();
    if (!inserted?.id) throw new Error("Failed to persist the new headshot");
    await tx.update(models).set({ identityRevisionId: revisionId }).where(eq(models.id, input.modelId));
    if (staleIds.length > 0) {
      await tx
        .update(modelAssets)
        .set({ status: { state: "stale", at: new Date().toISOString() } })
        .where(inArray(modelAssets.id, staleIds));
    }
    if (input.landing) await input.landing(tx);
    return inserted.id;
  });
  log.info({ modelId: input.modelId, revisionId, assetId, staled: staleIds.length }, "[identityCommit] anchor re-roll committed");
  return { assetId, identityRevisionId: revisionId, staledAssetIds: staleIds };
}

/**
 * The transactional §8.6 commit. Throws on any failure — the transaction
 * rolls back and no partial identity state survives. Runs AFTER generation
 * succeeded; the caller owns credit consequences (refund on throw, M20).
 */
export async function commitIdentityEdit(input: IdentityCommitInput): Promise<IdentityCommitResult> {
  const computed = computeIdentityCommit(input.model, input.patch);
  const revisionId = mintRevisionId();
  const identityText = buildIdentityAnchor(computed.masterPrompt, computed.technicalSchema);
  // §14: every filled sibling stales, PINNED INCLUDED
  const staleIds = selectStaleSiblingHeads(input.assets, "frontClose");

  const assetId = await withTransaction(async (tx) => {
    await tx
      .update(models)
      .set({
        masterPrompt: computed.masterPrompt,
        technicalSchema: computed.technicalSchema,
        preferences: computed.preferences,
        identityRevisionId: revisionId,
      })
      .where(eq(models.id, input.model.id));

    const [inserted] = await tx
      .insert(modelAssets)
      .values({
        modelId: input.model.id,
        viewType: "frontClose",
        resolution: input.newAnchor.resolution ?? "1K",
        storageUrl: input.newAnchor.storageUrl,
        pointsCost: input.newAnchor.pointsCost,
        provenance: {
          ...(input.newAnchor.inputs ? { inputs: input.newAnchor.inputs } : {}),
          ...(input.newAnchor.engine ? { engine: input.newAnchor.engine } : {}),
          ...identityStampFor({ role: "anchor", revisionId, identityText }),
          // Operation provenance: the strict typed edit list that was
          // authorized and committed — never an arbitrary write map.
          identityEdits: input.patch.edits,
          identityEditSource: input.patch.source,
        },
      })
      .$returningId();
    if (!inserted?.id) {
      throw new Error("Identity commit failed to persist the new anchor asset");
    }

    if (staleIds.length > 0) {
      await tx
        .update(modelAssets)
        .set({ status: { state: "stale", at: new Date().toISOString() } })
        .where(inArray(modelAssets.id, staleIds));
    }

    if (input.landing) await input.landing(tx);

    return inserted.id;
  });

  log.info(
    { modelId: input.model.id, revisionId, assetId, staled: staleIds.length, source: input.patch.source },
    "[identityCommit] committed",
  );

  return {
    assetId,
    identityRevisionId: revisionId,
    masterPrompt: computed.masterPrompt,
    technicalSchema: computed.technicalSchema,
    preferences: computed.preferences,
    staledAssetIds: staleIds,
  };
}
