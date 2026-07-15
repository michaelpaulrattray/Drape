/**
 * modelLifecycle — THE model/cast lifecycle read-model, shared client/server.
 * (Batch B of the R6 execution plan; FR-4.)
 *
 * The lifecycle status domain is exactly:
 *   draft    — editable, unminted
 *   active   — minted
 *   locked   — legacy minted alias (reads exactly like active)
 *   archived — deleted/unavailable (FR-4) — never a draft, never an
 *              editable fallback, regardless of any other field
 *
 * Read-state law:
 *  - Status is the ONLY read-model discriminator. `agencyId` is detail and
 *    integrity data: a draft carrying a stray agencyId still reads as a
 *    draft; an archived row stays deleted even if it carries one. Operations
 *    that genuinely require the agency ID (registry/export integrity) keep
 *    their own separate fail-closed checks — the ID's presence never implies
 *    minted, and its absence never implies draft.
 *  - Unknown/unrecognized status fails CONSERVATIVELY: not a draft (no
 *    editability), not minted (no minted privileges), not available.
 *  - Authoritative server TRANSITION guards (the mint ceremony's clean-draft
 *    check, the D-43 iterate seal, drafts-only deletion) are mutation rules,
 *    not read models — they may inspect status directly and are outside this
 *    contract (see modelLifecycleGuard.test.ts for the pinned allowlist).
 *
 * This module must stay importable by both client and server: no server-only
 * imports, no DOM, constants and pure functions only.
 */

export const MODEL_LIFECYCLE_STATUSES = ["draft", "active", "locked", "archived"] as const;
export type ModelLifecycleStatus = (typeof MODEL_LIFECYCLE_STATUSES)[number];

/** The statuses that read as MINTED — exported for query filters (e.g. the
 *  minted-gallery source) so a DB read can never re-diverge from the
 *  predicate. `locked` is the legacy minted alias (FR-4). */
export const MODEL_MINTED_STATUSES = ["active", "locked"] as const satisfies readonly ModelLifecycleStatus[];

/** Narrow an arbitrary value to the closed status domain. Anything else —
 *  null, undefined, casing drift, a future unshipped status — is UNKNOWN and
 *  every predicate below treats it conservatively. */
export function isModelLifecycleStatus(status: unknown): status is ModelLifecycleStatus {
  return (MODEL_LIFECYCLE_STATUSES as readonly unknown[]).includes(status);
}

/** Exhaustiveness failure: if the status union ever grows, every switch below
 *  stops compiling instead of silently inheriting behavior. */
function assertNeverModelStatus(status: never): never {
  throw new Error(`Unhandled model lifecycle status: ${String(status)}`);
}

/** Editable, unminted. Unknown status is NOT a draft (no editable fallback). */
export function isModelDraftStatus(status: unknown): boolean {
  if (!isModelLifecycleStatus(status)) return false;
  switch (status) {
    case "draft":
      return true;
    case "active":
    case "locked":
    case "archived":
      return false;
    default:
      return assertNeverModelStatus(status);
  }
}

/** Minted identity — `active` or the legacy `locked` alias. Unknown status is
 *  NOT minted (no minted privileges by accident). */
export function isModelMintedStatus(status: unknown): boolean {
  if (!isModelLifecycleStatus(status)) return false;
  switch (status) {
    case "active":
    case "locked":
      return true;
    case "draft":
    case "archived":
      return false;
    default:
      return assertNeverModelStatus(status);
  }
}

/** Deleted-by-archive (FR-4). True ONLY for the literal archived status —
 *  for availability decisions use isModelAvailableStatus, which also treats
 *  unknown statuses as unavailable. */
export function isModelArchivedStatus(status: unknown): boolean {
  if (!isModelLifecycleStatus(status)) return false;
  switch (status) {
    case "archived":
      return true;
    case "draft":
    case "active":
    case "locked":
      return false;
    default:
      return assertNeverModelStatus(status);
  }
}

/** Usable in read surfaces (library, picker, session restore): draft, active,
 *  or legacy locked. Archived AND unknown statuses read unavailable — an
 *  unrecognized row must never surface as workable. */
export function isModelAvailableStatus(status: unknown): boolean {
  if (!isModelLifecycleStatus(status)) return false;
  switch (status) {
    case "draft":
    case "active":
    case "locked":
      return true;
    case "archived":
      return false;
    default:
      return assertNeverModelStatus(status);
  }
}
