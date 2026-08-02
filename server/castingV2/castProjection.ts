/**
 * The Signed Cast projection (plan §J) — what the room is allowed to see.
 *
 * An explicit allowlist DTO, never a row spread (access-control invariant 8).
 * `masterPrompt`, `technicalSchema` and `preferences` are the complete recipe
 * for reproducing a Cast and are the single most sensitive field group in the
 * product (founder ruling, 2026-07-25): they are absent here by construction,
 * along with provider names, model ids, request ids, internal prompts and
 * storage keys.
 *
 * The other half of this module is the **failed-slot confession**, and it is a
 * gate condition rather than a piece of polish (D-92, founder ruling
 * 2026-08-02). A view that is never coming says so, in its own place on the
 * screen, with what happened to the money. A shimmer promises arrival and a
 * blank promises nothing; both leave someone waiting for something that will
 * never arrive, and both are worse than the sentence.
 */
import type { Model, ModelAsset } from "../../drizzle/schema";
import { CANONICAL_VIEW_ANGLES, VIEW_ANGLE_LABELS, type CanonicalViewAngle } from "../../shared/boardTypes";
import { storagePublicUrl } from "../storage";
import type { CastLineage } from "../db/castingV2Sign";
import { CAST_PACKAGE_VIEWS } from "./castViewPackage";

/**
 * `pending` — nothing has started on this slot yet.
 * `building` — it is being generated or checked right now.
 * `ready` — it is here.
 * `failed-refunded` — it is not coming, and the credits went back.
 */
export type CastSlotState = "pending" | "building" | "ready" | "failed-refunded";

export type CastSlotProjection = {
  angle: CanonicalViewAngle;
  label: string;
  state: CastSlotState;
  url: string | null;
  /**
   * The sentence the room shows in place of, or beneath, the picture. Written
   * server-side so every surface confesses the same way, and so no client can
   * invent a friendlier version of a refund.
   */
  note: string | null;
  /** What actually went back, when something did. Never a promise. */
  refundedCredits: number | null;
};

export type CastCapability = "full" | "calibrated" | "unsupported";

export type SignedCastProjection = {
  castId: string;
  name: string | null;
  personaLine: string | null;
  /** `building` while the package streams in; `ready` once it is terminal. */
  status: "building" | "ready";
  /** The face that was signed. Always present — it is the anchor. */
  anchorUrl: string | null;
  slots: CastSlotProjection[];
  identityLocked: true;
  capabilities: Record<string, CastCapability>;
  /** "Cast from a sheet on 2 August" — provenance in one line. */
  provenance: string | null;
  lineage: {
    fromRollPublicId: string | null;
    fromRollIndex: number | null;
    fromCandidatePublicId: string | null;
    fromSessionPublicId: string | null;
  };
  signedAt: string | null;
};

/** The founder's words, kept verbatim because they are the ruling. */
export const FAILED_SLOT_CONFESSION = "This view didn't arrive — refunded; repairs come with revisions";

/**
 * The headshot standing in for a 2K re-render that never came.
 *
 * Its own sentence rather than the confession above, because the slot is not
 * empty: the customer is looking at the exact face they signed. What they are
 * owed an explanation for is the refund, not the picture.
 */
export const ANCHOR_STANDIN_NOTE = "Shown at the resolution you signed — the larger version didn't arrive; refunded";

type SlotEvidence = {
  /** The newest filled 2K package render, if one landed. */
  landed?: ModelAsset;
  /** The 1K anchor, only ever present on `frontClose`. */
  anchor?: ModelAsset;
  /** The newest failure marker, if the slot was written off. */
  failure?: { reason: string; refunded: number };
};

function readFailureMarker(asset: ModelAsset): { reason: string; refunded: number } | null {
  const status = asset.status as
    | { state?: string; reason?: string; refunded?: number }
    | null;
  if (status?.state !== "failed") return null;
  return {
    reason: typeof status.reason === "string" ? status.reason : FAILED_SLOT_CONFESSION,
    refunded: Number.isSafeInteger(status.refunded) ? Number(status.refunded) : 0,
  };
}

/**
 * Reduce the asset ledger to one piece of evidence per slot.
 *
 * `assets` must be newest-first. Newest-filled wins, which is the repo's
 * settled selection law — and it is why the 1K anchor is looked for separately
 * rather than simply being "the oldest frontClose": the anchor is identified by
 * its recorded identity role, never by its position in a list.
 */
function slotEvidence(assets: readonly ModelAsset[]): Map<CanonicalViewAngle, SlotEvidence> {
  const evidence = new Map<CanonicalViewAngle, SlotEvidence>();
  for (const asset of assets) {
    const angle = asset.viewType as CanonicalViewAngle;
    if (!(CANONICAL_VIEW_ANGLES as readonly string[]).includes(angle)) continue;
    const entry = evidence.get(angle) ?? {};
    const failure = readFailureMarker(asset);
    if (failure) {
      if (!entry.failure) entry.failure = failure;
    } else if (asset.storageUrl) {
      const isAnchor = asset.resolution === "1K";
      if (isAnchor) {
        if (!entry.anchor) entry.anchor = asset;
      } else if (!entry.landed) {
        entry.landed = asset;
      }
    }
    evidence.set(angle, entry);
  }
  return evidence;
}

export function projectSignedCast(input: {
  model: Model;
  assets: readonly ModelAsset[];
  lineage: CastLineage;
}): SignedCastProjection {
  const evidence = slotEvidence(input.assets);
  const building = input.model.status === "provisioning";
  const anchor = evidence.get("frontClose")?.anchor ?? null;

  const slots: CastSlotProjection[] = CAST_PACKAGE_VIEWS.map((angle) => {
    const entry = evidence.get(angle) ?? {};
    const label = VIEW_ANGLE_LABELS[angle];

    if (entry.landed) {
      return {
        angle,
        label,
        state: "ready",
        url: entry.landed.storageUrl,
        note: null,
        refundedCredits: null,
      };
    }

    /*
      The headshot always has something to show — the anchor fills it, which is
      also what keeps the snapshot authority's "a package has a displayed
      headshot" invariant true through any provider failure. So it confesses to
      the refund rather than to an absence.
    */
    if (angle === "frontClose" && anchor && entry.failure) {
      return {
        angle,
        label,
        state: "ready",
        url: anchor.storageUrl,
        note: ANCHOR_STANDIN_NOTE,
        refundedCredits: entry.failure.refunded,
      };
    }
    if (angle === "frontClose" && anchor && building) {
      // Something is already there while the 2K version is generated. The
      // customer is never looking at an empty room.
      return { angle, label, state: "building", url: anchor.storageUrl, note: null, refundedCredits: null };
    }
    if (angle === "frontClose" && anchor) {
      return { angle, label, state: "ready", url: anchor.storageUrl, note: null, refundedCredits: null };
    }

    if (entry.failure) {
      return {
        angle,
        label,
        state: "failed-refunded",
        url: null,
        note: FAILED_SLOT_CONFESSION,
        refundedCredits: entry.failure.refunded,
      };
    }

    if (building) {
      return { angle, label, state: "building", url: null, note: null, refundedCredits: null };
    }

    /*
      The Cast is terminal and this slot has neither a picture nor a marker.
      That is a view that is not coming, and the room says so — the alternative
      is a permanently empty tile that reads as "still loading" forever. The
      credits for it are settled by the recovery sweep under the slot's own
      reference, so the sentence is true even when the marker write is what
      failed.
    */
    return {
      angle,
      label,
      state: "failed-refunded",
      url: null,
      note: FAILED_SLOT_CONFESSION,
      refundedCredits: null,
    };
  });

  return {
    castId: input.model.agencyId ?? "",
    name: input.model.name,
    personaLine: input.lineage.personaLine,
    status: building ? "building" : "ready",
    anchorUrl: anchor?.storageUrl ?? null,
    slots,
    identityLocked: true,
    /*
      Honest capability truth (§I), not a greyed-out wishlist — and honest
      means MEASURED, not assumed.

      `multiview` is `full` because this milestone builds it and validates every
      view against the signed anchor. Everything else is `unsupported`, which is
      a statement about today rather than a prediction: the room offers none of
      it, so claiming otherwise would be advertising a control the server does
      not have.

      Wardrobe/VTO and canvas are deliberately NOT claimed even though a V2 Cast
      is an ordinary `active` model that those surfaces will list. V2 writes its
      identity documents in a new shape, and legacy code that reads the old one
      (`facial_features`, `skin_tone`) has never been run against it. They move
      to `full` when a signed V2 Cast has actually been driven through them,
      which is a verification, not an edit to this line.
    */
    capabilities: {
      multiview: "full",
      wardrobeVto: "unsupported",
      canvas: "unsupported",
      revision: "unsupported",
      takes: "unsupported",
      voice: "unsupported",
    },
    provenance: input.lineage.castFromAt
      ? `Cast from a sheet on ${formatCastDate(input.lineage.castFromAt)}`
      : null,
    lineage: {
      fromRollPublicId: input.lineage.rollPublicId,
      fromRollIndex: input.lineage.rollIndex,
      fromCandidatePublicId: input.lineage.candidatePublicId,
      fromSessionPublicId: input.lineage.sessionPublicId,
    },
    signedAt: input.model.mintedAt ? input.model.mintedAt.toISOString() : null,
  };
}

function formatCastDate(value: Date): string {
  return value.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

/** Public URL for a stored key — the only place the room learns an image URL. */
export function castImageUrl(key: string): string {
  return storagePublicUrl(key);
}
