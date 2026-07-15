/**
 * exportEligibility — THE export-eligibility decision, shared by every
 * identity-pack export surface (Batch B review correction 1).
 *
 * Lifecycle read-state and export eligibility are SEPARATE contracts:
 *  - minted state comes from the shared lifecycle read model (status truth);
 *  - the identity pack additionally PRINTS the agency ID, so a status-minted
 *    row missing its ID is ineligible — an inconsistent record to repair,
 *    never a draft to route to the mint door, and never a reason to print a
 *    fake ID.
 *
 * Every export action must resolve this BEFORE any proxy, upscale, PDF, ZIP,
 * or credit-affecting call (ordering pinned by modelLifecycleGuard.test.ts).
 */
import { isModelMintedStatus } from "./modelLifecycle";

export type ExportEligibility =
  | { ok: true; agencyId: string }
  /** not_minted → refuse and route to the mint door (FR-2A).
   *  missing_agency_id → fail closed with repair copy; re-minting is not the fix. */
  | { ok: false; reason: "not_minted" | "missing_agency_id" };

export function resolveExportEligibility(
  model: { status?: unknown; agencyId?: string | null } | null | undefined,
): ExportEligibility {
  if (!model || !isModelMintedStatus(model.status)) {
    return { ok: false, reason: "not_minted" };
  }
  const agencyId = model.agencyId?.trim();
  if (!agencyId) {
    return { ok: false, reason: "missing_agency_id" };
  }
  return { ok: true, agencyId };
}

/** The one repair-copy string, so every surface says the same thing. */
export const MISSING_AGENCY_ID_COPY =
  "This model is missing its agency ID — export is unavailable until the record is repaired.";

export type ExportRefusal = Extract<ExportEligibility, { ok: false }>;

/**
 * The export ACTION BOUNDARY (final review round C): every export flow hands
 * its mutation functions and its body through here. On refusal the runner is
 * never entered and the mutations object is never touched — the behavior
 * tests execute this real boundary with spied mutations and prove zero
 * calls. On success the runner receives the verified, trimmed agency ID and
 * the same mutations object.
 */
export async function withExportEligibility<M, T>(
  model: { status?: unknown; agencyId?: string | null } | null | undefined,
  mutations: M,
  run: (agencyId: string, mutations: M) => Promise<T>,
): Promise<{ ok: true; value: T } | ExportRefusal> {
  const eligibility = resolveExportEligibility(model);
  if (!eligibility.ok) return eligibility;
  return { ok: true, value: await run(eligibility.agencyId, mutations) };
}
