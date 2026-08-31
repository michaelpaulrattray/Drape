import type {
  CastingEvidenceIngestionPurpose,
  ModelReferencePlateKind,
} from "../../../drizzle/schema";
import { type EvidenceStorageKind, parseEvidenceStorageKey } from "./evidenceDelivery";

export type EvidenceStoragePurpose =
  | CastingEvidenceIngestionPurpose
  | ModelReferencePlateKind
  | "evidence_crop";

/**
 * WHICH OBJECT NAMESPACE EACH ROW MAY POINT AT — and why one of them has two.
 *
 * A row's `purpose` names WHERE THE ROW CAME FROM. A key's segment
 * (`plates/`, `crops/`, `candidates/`) names WHICH OBJECT the bytes are.
 * Those are different facts, and the guard below used to treat them as one:
 * `evidence_crop` expected a crop key and EVERYTHING ELSE expected a plate
 * key. That is false of the product, and it had never once been true of a
 * real accepted plate.
 *
 * ⚠ **It cost the founder a Cast he could not delete** (#308). Every
 * `model_reference_plates` row in production — nine of them, all his, all on
 * model 35 — is `accepted_candidate` carrying a `candidates/` key, so all
 * nine threw and the deletion failed before its receipt was sealed. The same
 * conflation sits on two other roads with the same call: ACCOUNT DELETION and
 * the GDPR EXPORT both pass `purpose: plate.kind`, so his account could not
 * have been deleted or exported either.
 *
 * Each entry below is admitted because a NAMED WRITER in this repository
 * produces it, not because it makes a failing row pass:
 *
 * - `accepted_candidate` → `candidate`: `inkAcceptanceCommit.ts` promotes the
 *   candidate's EXISTING object in place — it inserts the plate row with
 *   `storageKey: input.prepared.privateStorageKey`, which
 *   `buildEvidenceCandidateStorageKey` minted under `candidates/`. No bytes
 *   are copied, which is why the key does not move. Measured on production:
 *   9 of 9 of those plate keys are also named by a candidate attempt row.
 * - `accepted_candidate` → `plate`: `evidenceFork.ts` copies the bytes to a
 *   fresh `buildReferencePlateStorageKey` while carrying `kind: source.kind`
 *   through unchanged. So ONE provenance legitimately reaches two namespaces,
 *   and no single expected-kind mapping is right for both.
 * - `uploaded_reference` → `plate` and `reference_plate` → `plate`: the mints
 *   in `evidenceOperations.ts` and `evidenceFork.ts`, unchanged.
 * - `fork_copy` → `plate`: unchanged from what this guard has always done.
 *   **No writer of a `fork_copy` ingestion receipt exists** (measured: zero
 *   rows, and no `purpose: "fork_copy"` insert anywhere), so there is no
 *   evidence for widening it and it is not widened. Whoever writes the first
 *   one declares its shape here.
 *
 * ⚠ **This is a Record and not a default**, which is the half that matters.
 * The old `else → "plate"` meant a purpose added to either schema enum was
 * silently given a shape nobody chose. An exhaustive Record makes the next
 * one a COMPILE ERROR until someone states which namespace it may name, and
 * an unrecognised purpose arriving at runtime FAILS CLOSED.
 *
 * ⚠ **Ownership is untouched.** `userId` and `modelId` are still re-proved on
 * every path, on both shapes, and neither of model 35's failing fields was
 * one of them — the user and the model always matched. Nothing here widens
 * who may reach an object; it widens only which namespace a given provenance
 * is allowed to name.
 */
const ALLOWED_KEY_KINDS: Record<EvidenceStoragePurpose, readonly EvidenceStorageKind[]> = {
  evidence_crop: ["crop"],
  reference_plate: ["plate"],
  fork_copy: ["plate"],
  uploaded_reference: ["plate"],
  accepted_candidate: ["plate", "candidate"],
};

/**
 * IS THIS NAMESPACE ONE THIS PROVENANCE IS DECLARED TO REACH?
 *
 * Exported so that the orphan audit asks the SAME table rather than keeping a
 * second copy of the rule. It kept one (`expectedKeyKind`, `reference_plate ?
 * plate : crop`) and inherited the identical defect — every accepted plate in
 * production would have been counted as a key-ownership mismatch, so an
 * instrument would have reported a healthy database as dirty. A second list
 * shadowing a source of truth always drifts from it (working law 4).
 */
export function evidenceKeyKindIsDeclared(
  purpose: EvidenceStoragePurpose,
  kind: EvidenceStorageKind,
): boolean {
  const allowedKinds = ALLOWED_KEY_KINDS[purpose] as readonly EvidenceStorageKind[] | undefined;
  return allowedKinds?.includes(kind) ?? false;
}

/**
 * Re-prove the complete ownership encoded by an evidence key before a
 * lifecycle path exports, manifests, or deletes the corresponding row.
 */
export function assertOwnedEvidenceStorageKey(input: {
  storageKey: string;
  userId: number;
  modelId: number;
  purpose: EvidenceStoragePurpose;
}): void {
  const parsed = parseEvidenceStorageKey(input.storageKey);
  if (parsed.userId !== input.userId || parsed.modelId !== input.modelId) {
    throw new Error("Evidence key ownership is invalid");
  }
  /* An unrecognised purpose has no declared namespace, so it gets none. */
  if (!evidenceKeyKindIsDeclared(input.purpose, parsed.kind)) {
    /*
      Said separately from the ownership failure on purpose. #308 spent its
      diagnosis inside the word "ownership" while the user and the model both
      matched and only the namespace disagreed. Both are server-side Errors
      behind `spokenError`, so the customer still sees the generic sentence.
    */
    throw new Error("Evidence key names the wrong object namespace for its row");
  }
}
