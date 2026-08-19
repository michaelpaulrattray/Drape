/**
 * THE PICTURE THIS ASK CAME WITH — resolving a `referenceId` into bytes we may
 * act on, and refusing free when we may not
 * (`UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §2).
 *
 * # Three questions, in an order that is not arbitrary
 *
 *   1. IS THIS ROAD OPEN TO HER?  A handle sent by an account outside the flag
 *      is refused with no database read at all — the cheapest refusal is the
 *      one that never asks.
 *   2. IS IT HERS?  Read in a statement carrying her user id, never resolved
 *      first and compared after (invariant 1).
 *   3. IS IT THIS CAST'S?  The row's candidate is compared to the candidate
 *      being refined (invariant 2). **This is the one that a careless version
 *      of this file would skip**, because the handle verifies fine: an
 *      attachment of hers on a DIFFERENT Cast passes both questions above and
 *      is still not this ask's reference.
 *
 * # WHY IT RETURNS NULL RATHER THAN THROWING
 *
 * All three failures are a customer's to read, not an exception to swallow.
 * The caller answers with a sentence and charges nothing — and it must be able
 * to tell "no reference on this ask" from "a reference that did not resolve",
 * because those are different answers and only one of them is an error.
 *
 * The sentence itself lives at the caller, beside every other free outcome,
 * rather than here: this module decides, and the refine road speaks.
 *
 * # AND THE STORAGE KEY IS WHAT COMES BACK, NEVER A URL
 *
 * An attachment's object sits at a permanently public address (`storage.ts`),
 * and the address is the only thing between a photograph of a person and a
 * stranger. Handing one out before something needs bytes would be a URL that
 * outlives every reason it was minted for — so the key travels and the server
 * fetches it itself, which is the same rule the attach procedure's projection
 * already keeps.
 */
import { readOwnedReferenceAttachment } from "../db/castingV2ReferenceAttachments";
import type { InkProvenance } from "../../shared/inkProvenance";
import { captureCastingHairReferenceEnabled } from "./castingV2Scope";

export type AskReference = {
  /** The row's own id, for anything minted from this picture later. */
  readonly id: number;
  /** OUR copy, under the candidate's purge path. Never a URL. */
  readonly storageKey: string;
  /** What was CLAIMED about the source when she attached it. Never inferred. */
  readonly provenance: InkProvenance;
  readonly digest: string;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
};

export type ResolveAskReferenceDependencies = {
  /** Whether this account is on the road at all. Server-owned, never asked of a client. */
  enabled: (userId: number) => boolean;
  read: typeof readOwnedReferenceAttachment;
};

const REAL: ResolveAskReferenceDependencies = {
  /*
    THE HAIR FLAG, and today it is the only reader of this lane.

    When a second take opens — a tattoo design, an eye colour — the gate here
    becomes the OR of the roads that can act on a picture, and it is written as
    a single injected predicate rather than as a chain of `||` so that the day
    it grows a second member is a day somebody edits one expression. What must
    never happen is a reference resolving for a user no road can serve: she
    would attach, be asked nothing, and pay for a render that ignored her
    picture.
  */
  enabled: captureCastingHairReferenceEnabled,
  read: readOwnedReferenceAttachment,
};

export async function resolveAskReference(
  input: { userId: number; referencePublicId: string; candidateId: number },
  dependencies: ResolveAskReferenceDependencies = REAL,
): Promise<AskReference | null> {
  if (!dependencies.enabled(input.userId)) return null;

  const row = await dependencies.read({
    userId: input.userId,
    attachmentPublicId: input.referencePublicId,
  });
  if (!row) return null;
  /* HERS, BUT ON ANOTHER CAST. The handle is valid and this is still not the
     reference for this ask — see the header. */
  if (row.candidateId !== input.candidateId) return null;

  return {
    id: row.id,
    storageKey: row.storageKey,
    provenance: row.provenance,
    digest: row.digest,
    mime: row.mime,
    width: row.width,
    height: row.height,
  };
}
