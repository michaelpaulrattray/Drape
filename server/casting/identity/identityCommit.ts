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
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
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

function affectedRows(result: unknown): number {
  const header = result as { affectedRows?: number } | [{ affectedRows?: number }];
  return Array.isArray(header) ? header[0]?.affectedRows ?? 0 : header.affectedRows ?? 0;
}
import { handlerFor } from "./identityFieldHandlers";
import {
  identityStampFor,
  mintRevisionId,
  selectStaleSiblingHeads,
} from "./anchorSelector";
import { createModuleLogger } from "../../logging/logger";
import { clearEngineChoiceForChanges } from "../engineChoiceMetadata";
import {
  dependentFieldsForPatch,
  type HairGeometryDependentField,
} from "./identityDependencies";

const log = createModuleLogger("casting/identity/identityCommit");

export function editField(edit: AuthorizedIdentityEdit): AuthorizableIdentityField {
  return edit.kind === "leaf" ? edit.leaf : edit.edit.field;
}

function editValue(edit: AuthorizedIdentityEdit): unknown {
  return edit.kind === "leaf" ? edit.value : edit.edit.value;
}

/** Resetting handlers run before the fields they can reset, so every value
 * the user explicitly authorized wins regardless of incoming patch order. */
function editApplicationPriority(edit: AuthorizedIdentityEdit): number {
  const field = editField(edit);
  if (field === "person.gender") return 0;
  if (field === "person.hair.style") return 1;
  return 2;
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
/** A release does not invent a replacement value. It makes the newly accepted
 * anchor authoritative for that physically coupled detail and explicitly
 * supersedes older natural-language prose that cannot be safely rewritten. */
export function identityReleaseLine(field: HairGeometryDependentField): string {
  return `IDENTITY RELEASE — ${field} (supersedes every earlier ${field.split(".").pop()} description): unset; derive it only as required by the explicitly requested identity change, then treat the accepted anchor image as authority.`;
}

const RELEASE_LINE_PATTERN = (field: AuthorizableIdentityField) =>
  new RegExp(`^IDENTITY RELEASE — ${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} .*$`, "gm");

const RELEASE_PREFERENCE_KEYS: Record<HairGeometryDependentField, readonly (keyof ModelPreferences)[]> = {
  "person.hair.style": ["hairStyle", "hairStyleOverride"],
  "person.hair.length": ["hairLength"],
  "person.hair.fringe": ["hairFringe"],
  "person.hair.parting": ["hairParting"],
  "person.hair.volume": ["hairVolume"],
  "person.hair.fade": ["hairFade"],
  "person.hair.flyaways": ["hairFlyaways"],
  "person.hair.tuck": ["hairTuck"],
};

function releaseDependentField(
  field: HairGeometryDependentField,
  preferences: ModelPreferences,
  technicalSchema: TechnicalSchema,
): ModelPreferences {
  const released = { ...preferences };
  const writable = released as Record<string, unknown>;
  for (const key of RELEASE_PREFERENCE_KEYS[field]) writable[key] = "";
  if (field === "person.hair.style") {
    const subject = technicalSchema.subject;
    if (subject && typeof subject === "object") {
      const nextSubject = { ...(subject as Record<string, unknown>) };
      delete nextSubject.hair_style;
      technicalSchema.subject = nextSubject;
    }
  }
  return released;
}

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
  releasedDependents: HairGeometryDependentField[];
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
  const releasedDependents = dependentFieldsForPatch(patch);

  // Release only the reviewed, statically coupled leaves. The accepted image
  // becomes their authority; no LLM-generated value is written into canon.
  for (const field of releasedDependents) {
    preferences = releaseDependentField(field, preferences, technicalSchema);
    masterPrompt = masterPrompt
      .replace(FRAGMENT_LINE_PATTERN(field), "")
      .replace(RELEASE_LINE_PATTERN(field), "")
      .replace(/\n{3,}/g, "\n\n");
    masterPrompt = `${masterPrompt.trimEnd()}\n\n${identityReleaseLine(field)}`;
  }

  const orderedEdits = patch.edits
    .map((edit, index) => ({ edit, index }))
    .sort((a, b) => editApplicationPriority(a.edit) - editApplicationPriority(b.edit) || a.index - b.index)
    .map(({ edit }) => edit);

  for (const edit of orderedEdits) {
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
    masterPrompt = masterPrompt
      .replace(FRAGMENT_LINE_PATTERN(field), "")
      .replace(RELEASE_LINE_PATTERN(field), "")
      .replace(/\n{3,}/g, "\n\n");
    masterPrompt = `${masterPrompt.trimEnd()}\n\n${identityFragmentLine(field, fragment)}`;
  }

  return { masterPrompt, technicalSchema, preferences, fragments, releasedDependents };
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
  releasedDependents: HairGeometryDependentField[];
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
    const updated = await tx
      .update(models)
      .set({ identityRevisionId: revisionId })
      .where(and(eq(models.id, input.modelId), isNull(models.deletedAt), ne(models.status, "archived")));
    if (affectedRows(updated) !== 1) throw new Error("Model is no longer available");
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
    const updated = await tx
      .update(models)
      .set({
        masterPrompt: computed.masterPrompt,
        technicalSchema: computed.technicalSchema,
        preferences: computed.preferences,
        identityRevisionId: revisionId,
      })
      .where(and(eq(models.id, input.model.id), isNull(models.deletedAt), ne(models.status, "archived")));
    if (affectedRows(updated) !== 1) throw new Error("Model is no longer available");

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
          releasedIdentityDependents: computed.releasedDependents,
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
    {
      modelId: input.model.id,
      revisionId,
      assetId,
      staled: staleIds.length,
      source: input.patch.source,
      releasedDependents: computed.releasedDependents,
    },
    "[identityCommit] committed",
  );

  return {
    assetId,
    identityRevisionId: revisionId,
    masterPrompt: computed.masterPrompt,
    technicalSchema: computed.technicalSchema,
    preferences: computed.preferences,
    staledAssetIds: staleIds,
    releasedDependents: computed.releasedDependents,
  };
}
