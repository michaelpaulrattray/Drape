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
import { CAST_VIEW_ANGLES, type CastViewAngle } from "../../shared/boardTypes";
import { storagePublicUrl } from "../storage";
import type { CastLineage } from "../db/castingV2Sign";
import { CAST_PACKAGE_VIEWS, castPackageLabel } from "./castViewPackage";
import { castPronouns, type CastPronouns } from "./castPronouns";

/**
 * `pending` — nothing has started on this slot yet.
 * `building` — it is being generated or checked right now.
 * `ready` — it is here.
 * `failed-refunded` — it is not coming, and the credits went back.
 */
export type CastSlotState = "pending" | "building" | "ready" | "failed-refunded";

export type CastSlotProjection = {
  angle: CastViewAngle;
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
  /**
   * TRUE when this slot is showing the signed anchor because its own view never
   * arrived (D-97).
   *
   * The hero reads this: the MASTER is always the chest-up image she was signed
   * in, and a companion cell that fell back to that same image would show her
   * twice and call one of them a close-up. A stand-in is honest in the package
   * strip, where the sentence explains it, and dishonest in the hero, where
   * nothing does.
   */
  standIn?: true;
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
  /**
   * A room-level sentence, or null. Today it carries exactly one event — the
   * total loss — because that is the only fact about a Cast that the strip
   * cannot state slot by slot without repeating itself into noise.
   */
  notice: string | null;
  capabilities: Record<string, CastCapability>;
  /** "Cast from a sheet on 2 August" — provenance in one line. */
  provenance: string | null;
  /**
   * Her sheet is still a place you can go.
   *
   * FALSE once the session's own seven-day clock runs out — which happens
   * independently of the §G.6 exemption that keeps her siblings' faces alive.
   * Anything offering a link to that sheet must read this first, or it offers a
   * 404 to a customer who has done nothing wrong.
   */
  sheetOpen: boolean;
  /**
   * The three words the product uses to refer to her — or him, or them.
   *
   * DERIVED from `technicalSchema` and projected as words, never as the schema:
   * pronouns are not identity documents, the record they came from is (founder
   * ruling, 2026-07-25). `they` is the fallback for an unstated sex.
   */
  pronouns: CastPronouns;
  lineage: {
    fromRollPublicId: string | null;
    fromRollIndex: number | null;
    fromCandidatePublicId: string | null;
    fromSessionPublicId: string | null;
  };
  /**
   * The faces kept beside her on the same sheet — real images, not placeholders
   * (founder ruling, 2026-08-02).
   *
   * Retention protects exactly these while the Cast lives (§G.6), which is why
   * the card can promise them: an unkept candidate purges with its session, a
   * kept sibling of a signed Cast does not.
   */
  siblings: Array<{
    candidateId: string;
    imageUrl: string | null;
    personaLine: string | null;
    indexLabel: string;
    /**
     * Where this tile goes, decided by STATE (founder ruling, 2026-08-02).
     *
     *   `cast`   — she was signed too; open her room
     *   `sheet`  — still a face, on a sheet that is still open
     *   `viewer` — her sheet has expired; the face is all that is left
     *
     * Derived on the server because only the server knows the last one. A
     * client that assumed "unsigned means sheet" would hand out a dead link.
     */
    destination: "cast" | "sheet" | "viewer";
    /** Set only when `destination` is `cast`. */
    castId: string | null;
  }>;
  signedAt: string | null;
};

/** The founder's words, kept verbatim because they are the ruling. */
export const FAILED_SLOT_CONFESSION = "This view didn't arrive — refunded; repairs come with revisions";

/**
 * The signed face standing in for a close-up that never came.
 *
 * Its own sentence rather than the confession above, because the slot is not
 * empty: the customer is looking at the exact face they signed. What they are
 * owed an explanation for is the refund, not the picture.
 *
 * It names the FRAMING rather than the resolution (package v2). The stand-in
 * now differs from what was bought in both, and "shown at the resolution you
 * signed" was true about the smaller half while quietly omitting that the
 * close-up crop is missing entirely.
 */
export const ANCHOR_STANDIN_NOTE = "The face you signed, standing in — the close-up didn't arrive; refunded";

/**
 * ZERO OF N — said once, at the top of the room, not five times in a strip.
 *
 * A total loss is a different event from five unlucky views and it deserves a
 * different sentence. The customer is owed three facts in one line: nothing
 * arrived, ALL of the money came back including the base (founder ruling,
 * 2026-08-02), and the Cast they signed is still theirs and still repairable.
 *
 * Without it the room reads as an ordinary partial failure — which would be a
 * quiet lie about the base, the one number that behaves differently here.
 */
export const TOTAL_LOSS_CONFESSION =
  "The package didn't arrive — everything you paid has been refunded, "
  + "including the Sign itself. The face you chose is still yours; "
  + "the views can be rebuilt when repairs ship.";

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
function slotEvidence(assets: readonly ModelAsset[]): Map<CastViewAngle, SlotEvidence> {
  const evidence = new Map<CastViewAngle, SlotEvidence>();
  for (const asset of assets) {
    const angle = asset.viewType as CastViewAngle;
    if (!(CAST_VIEW_ANGLES as readonly string[]).includes(angle)) continue;
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
  /** Kept faces from the same sheet, minus herself. */
  siblings?: readonly {
    publicId: string;
    imageKey: string | null;
    thumbKey: string | null;
    personaLine: string | null;
    position: number;
    /** Her own room, when she has been signed too. Null while she is a face. */
    castId?: string | null;
  }[];
  /**
   * Whether the sheet these siblings came from is still open.
   *
   * §G.6's retention exemption protects a signed Cast's kept siblings — the
   * rows and the objects — for as long as she lives. It does NOT hold the
   * SESSION open, so the faces can outlive the page they lived on. Routing a
   * sibling to a sheet that has expired is a link that 404s, so the room needs
   * to know before it offers one.
   */
  sheetLive?: boolean;
  /**
   * The views this Cast's Sign promised, from its own durable audit rows.
   *
   * Not today's profile: a package is a historical record, and a Cast that
   * bought six views keeps showing six after the composition changes. It is
   * also what lets a slot that produced nothing at all still confess — an
   * asset can be missing, but the promise cannot.
   */
  promisedAngles?: readonly CastViewAngle[];
}): SignedCastProjection {
  const evidence = slotEvidence(input.assets);
  const building = input.model.status === "provisioning";
  const anchor = evidence.get("frontClose")?.anchor ?? null;

  /*
    THE SLOTS THIS CAST ACTUALLY HAS, not the slots today's profile sells.

    A package is a historical record. The composition changed with package v2 —
    the walk retired to Takes — and rendering every Cast against today's profile
    would silently delete the walk from the two Casts that own one: the asset
    exists, the slot vanishes, and the customer's paid view disappears from
    their room after a deploy they had nothing to do with.

    So a finished Cast is rendered from its own evidence, and one still being
    built is rendered from what is being built for it — today's profile, plus
    anything already on disk.
  */
  /*
    THE ANCHOR IS NOT EVIDENCE OF A PROMISED VIEW.

    A landed 2K view or a failure marker each prove a slot was bought: one
    delivered, the other confessed. The 1K anchor proves neither — it is the
    signed sheet image, stored under `frontClose` because that is the angle it
    is, and it exists for every Cast whatever her package promised.

    Package v3.1 retires `frontClose` from the profile, so counting the anchor
    here would conjure a "Portrait" tile out of the Master's own pixels and
    stand the two side by side — the same rung of the zoom ladder climbed twice,
    which is precisely what the ruling removed. Historical Casts are unaffected:
    every era that BOUGHT a frontClose has it in `promised`, so it renders from
    there.
  */
  const evidenceAngles = CAST_VIEW_ANGLES.filter((angle) => {
    const entry = evidence.get(angle);
    return Boolean(entry?.landed || entry?.failure);
  });
  const promised = input.promisedAngles && input.promisedAngles.length > 0
    ? input.promisedAngles
    // No promise on record: a Cast signed before the audit rows existed, or one
    // whose package has not opened yet. Today's profile is the honest guess for
    // something being built right now, and the evidence carries a finished one.
    : building ? CAST_PACKAGE_VIEWS : [];
  const renderedAngles = CAST_VIEW_ANGLES.filter(
    (angle) => promised.includes(angle) || evidenceAngles.includes(angle),
  );

  const slots: CastSlotProjection[] = renderedAngles.map((angle) => {
    const entry = evidence.get(angle) ?? {};
    // The label this CAST bought, not the one today's profile sells. Her
    // waist-up headshot is not retroactively a close-up because the profile
    // changed after she was signed.
    /*
      The PROMISE decides the era, not what happened to render.

      `renderedAngles` is promise ∪ evidence, so a Cast whose close-up produced
      neither a picture nor a marker would look like a Cast from before the
      close-up existed, and her portrait would be relabelled by an accident of
      delivery. The promise is the durable fact; evidence is what became of it.
    */
    const label = castPackageLabel(angle, promised.length > 0 ? promised : renderedAngles);

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
        standIn: true,
      };
    }
    if (angle === "frontClose" && anchor && building) {
      // Something is already there while the close-up is generated. The
      // customer is never looking at an empty room.
      return {
        angle, label, state: "building", url: anchor.storageUrl,
        note: null, refundedCredits: null, standIn: true,
      };
    }
    if (angle === "frontClose" && anchor) {
      return {
        angle, label, state: "ready", url: anchor.storageUrl,
        note: null, refundedCredits: null, standIn: true,
      };
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
      Derived from the slots themselves rather than stored on the Cast, for the
      same reason everything else here is: a finished room is rendered from its
      own evidence. A stand-in does not count as arrival — it is the anchor she
      already had, which is precisely the thing the base failed to add to.
    */
    notice: !building && slots.length > 0
      && slots.every((slot) => slot.state !== "ready" || slot.standIn)
      ? TOTAL_LOSS_CONFESSION
      : null,
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
    siblings: (input.siblings ?? []).map((sibling) => ({
      candidateId: sibling.publicId,
      destination: sibling.castId ? "cast" : input.sheetLive ? "sheet" : "viewer",
      castId: sibling.castId ?? null,
      imageUrl: sibling.thumbKey
        ? storagePublicUrl(sibling.thumbKey)
        : sibling.imageKey
          ? storagePublicUrl(sibling.imageKey)
          : null,
      personaLine: sibling.personaLine,
      indexLabel: String(sibling.position + 1).padStart(2, "0"),
    })),
    provenance: input.lineage.castFromAt
      ? `Cast from a sheet on ${formatCastDate(input.lineage.castFromAt)}`
      : null,
    sheetOpen: input.sheetLive ?? false,
    pronouns: castPronouns(input.model.technicalSchema),
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
