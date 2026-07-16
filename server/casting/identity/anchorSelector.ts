/**
 * anchorSelector — identity-anchor authority and identity revisions
 * (IDENTITY_EDIT_INTERIM_POLICY §7, Batch C).
 *
 * The displayed headshot (newest FILLED frontClose — what the package UI
 * shows) and the identity anchor (newest ANCHOR-ELIGIBLE frontClose — what
 * every identity consumer generates from) are different concepts and may
 * legally diverge: an image-only headshot refinement is display-only and must
 * never silently become the identity reference.
 *
 * ONE selector, consumed by iterate authority, refresh, add-views, mint, and
 * restore. No consumer may fall back to a raw newest-filled lookup for
 * identity work (M21 source guard).
 */
import type { GenerationAuthorization } from "./identityTypes";

/** Sentinel for the genesis revision: models.identityRevisionId is NULL until
 *  the first identity-authorized anchor change (§7.4 — additive, forward-only). */
export const GENESIS_REVISION = "genesis";

export type IdentityRole = "anchor" | "display";

/** The provenance keys this module owns (server-written only — no tRPC input
 *  anywhere accepts `provenance`; M21 keeps that a tested invariant). */
export interface IdentityProvenance {
  identityRole?: IdentityRole;
  identityRevisionId?: string;
  /** D-12 legacy fingerprint half: the verbatim identity text the asset was
   *  generated against (mint/refresh rows carry it; iterate rows never did). */
  identityText?: string;
}

export interface AnchorAssetRow {
  id: number;
  viewType: string;
  storageUrl: string | null;
  pinned?: boolean | null;
  status?: unknown;
  provenance?: unknown;
  createdAt?: Date | string | null;
}

export function currentRevisionId(model: { identityRevisionId?: string | null }): string {
  return model.identityRevisionId ?? GENESIS_REVISION;
}

export function mintRevisionId(): string {
  return `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function identityProvenance(asset: AnchorAssetRow): IdentityProvenance {
  const p = asset.provenance;
  if (!p || typeof p !== "object" || Array.isArray(p)) return {};
  return p as IdentityProvenance;
}

/** §7.2: a row with no recorded role (pre-Batch-C legacy) counts as anchor. */
export function assetIdentityRole(asset: AnchorAssetRow): IdentityRole {
  return identityProvenance(asset).identityRole === "display" ? "display" : "anchor";
}

function isFailedMarker(asset: AnchorAssetRow): boolean {
  const status = asset.status as { state?: string } | null | undefined;
  return !asset.storageUrl || status?.state === "failed";
}

export function isStaleAsset(asset: AnchorAssetRow): boolean {
  const status = asset.status as { state?: string } | null | undefined;
  return status?.state === "stale";
}

/**
 * The §7 shared selector: newest FILLED `frontClose` with role `anchor`
 * (legacy no-role rows count as anchor). `assets` MUST be newest-first
 * (getModelAssets order). Display selection stays newest-filled and is NOT
 * this function.
 */
export function selectIdentityAnchor(assets: AnchorAssetRow[]): AnchorAssetRow | null {
  return (
    assets.find(
      (a) => a.viewType === "frontClose" && !!a.storageUrl && assetIdentityRole(a) === "anchor",
    ) ?? null
  );
}

/** The displayed headshot: newest filled frontClose, role ignored. */
export function selectDisplayedHeadshot(assets: AnchorAssetRow[]): AnchorAssetRow | null {
  return assets.find((a) => a.viewType === "frontClose" && !!a.storageUrl) ?? null;
}

export type RevisionMembership =
  /** Recorded revision matches the model's current revision. */
  | "current"
  /** No recorded revision, but the recorded D-12 fingerprint (verbatim
   *  identity text) demonstrably matches the current identity canon. */
  | "legacy-match"
  /** Recorded revision differs, or the legacy fingerprint mismatches. */
  | "mismatch"
  /** No recorded revision AND no fingerprint — uncertain provenance. */
  | "unknown";

/**
 * §7.4 membership: does this asset provably belong to the model's current
 * identity revision? `currentIdentityText` is the current canon fingerprint
 * (buildIdentityAnchor over the live document) for the legacy fallback.
 */
export function assetRevisionMembership(
  asset: AnchorAssetRow,
  model: { identityRevisionId?: string | null },
  currentIdentityText: string,
): RevisionMembership {
  const prov = identityProvenance(asset);
  if (typeof prov.identityRevisionId === "string" && prov.identityRevisionId.length > 0) {
    return prov.identityRevisionId === currentRevisionId(model) ? "current" : "mismatch";
  }
  if (typeof prov.identityText === "string" && prov.identityText.length > 0) {
    return prov.identityText === currentIdentityText ? "legacy-match" : "mismatch";
  }
  return "unknown";
}

/** Restore compatibility (§7.4): provable current-revision membership only.
 *  Missing or uncertain provenance refuses rather than guessing. */
export function isRestoreCompatible(membership: RevisionMembership): boolean {
  return membership === "current" || membership === "legacy-match";
}

/**
 * Stamp helper for every asset writer: the identity-role/revision provenance
 * a new row must carry. Anchor eligibility flows ONLY from a server-owned
 * GenerationAuthorization (or a server-side anchor operation like the
 * headshot re-roll) — a client can never mark its own asset anchor-eligible.
 */
export function identityStampFor(opts: {
  role: IdentityRole;
  revisionId: string;
  identityText?: string;
}): IdentityProvenance {
  return {
    identityRole: opts.role,
    identityRevisionId: opts.revisionId,
    ...(opts.identityText !== undefined ? { identityText: opts.identityText } : {}),
  };
}

/** Convenience: the role a frontClose result takes under an authorization
 *  (§7.2 table). Non-frontClose views are ordinary view outputs. */
export function roleForAuthorizedResult(authorization: GenerationAuthorization): IdentityRole {
  return authorization.anchorEligible ? "anchor" : "display";
}

/**
 * F6/D-53 stale selection, Batch C semantics: given the model's assets
 * NEWEST-FIRST and the view that just took an identity-changing anchor
 * operation, return the asset ids to stale-mark — each OTHER view's newest
 * filled row, **pinned included** (§14: pinning prevents automatic
 * replacement, not staleness; the D-21 exemption is superseded).
 */
export function selectStaleSiblingHeads(
  assets: Array<{ id: number; viewType: string; storageUrl?: string | null; pinned?: boolean | null }>,
  editedViewType: string,
): number[] {
  const heads = new Map<string, number>();
  for (const a of assets) {
    if (a.viewType !== editedViewType && a.storageUrl && !heads.has(a.viewType)) {
      heads.set(a.viewType, a.id);
    }
  }
  return Array.from(heads.values());
}
