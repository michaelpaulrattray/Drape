/**
 * THE GUARD ON EVERY EVIDENCE LIFECYCLE PATH, DRIVEN (#308).
 *
 * `assertOwnedEvidenceStorageKey` is called on three roads — permanent Cast
 * deletion, account deletion and the GDPR export — and until this file it had
 * no behavioural test at all. What existed was `r7-evidence-lifecycle-contract`,
 * which reads the three modules as TEXT and asserts the function's NAME appears
 * in them. That is a wiring check and it is worth having; it cannot see what the
 * guard decides, which is why a rule that refused 9 of 9 real production rows
 * shipped and stayed.
 *
 * Every key below is built by the PRODUCT'S OWN builders rather than typed as a
 * string, so an arm cannot pass against a shape the product does not mint.
 */
import { describe, expect, it } from "vitest";
import {
  CASTING_EVIDENCE_INGESTION_PURPOSES,
  MODEL_REFERENCE_PLATE_KINDS,
} from "../../../drizzle/schema";
import {
  buildEvidenceCandidateStorageKey,
  buildEvidenceCropStorageKey,
  buildReferencePlateStorageKey,
} from "./evidenceDelivery";
import {
  type EvidenceStoragePurpose,
  assertOwnedEvidenceStorageKey,
} from "./evidenceLifecycle";

const USER = 1;
const MODEL = 35;
const ENTITY = "1fdfaaa7-c553-4190-9db0-235cc18a5695";

const plateKey = buildReferencePlateStorageKey({ userId: USER, modelId: MODEL, plateId: ENTITY });
const candidateKey = buildEvidenceCandidateStorageKey({ userId: USER, modelId: MODEL, privatePlateId: ENTITY });
const cropKey = buildEvidenceCropStorageKey({ userId: USER, modelId: MODEL, cropId: ENTITY });

function assertKey(purpose: EvidenceStoragePurpose, storageKey: string, over: { userId?: number; modelId?: number } = {}) {
  assertOwnedEvidenceStorageKey({
    storageKey,
    userId: over.userId ?? USER,
    modelId: over.modelId ?? MODEL,
    purpose,
  });
}

describe("assertOwnedEvidenceStorageKey — the two shapes one provenance really has", () => {
  /*
    THE FAILING POPULATION, EXACTLY AS PRODUCTION HOLDS IT. Nine rows, all
    `accepted_candidate`, all under `candidates/`, written by
    `inkAcceptanceCommit.ts` promoting the candidate's existing object in place.
    Before #308 this threw, and with it his Cast would not delete.
  */
  it("accepts an accepted_candidate plate on the candidate object it promoted", () => {
    expect(() => assertKey("accepted_candidate", candidateKey)).not.toThrow();
  });

  /*
    THE OTHER LEGITIMATE SHAPE, and the reason no single mapping is right:
    `evidenceFork.ts` copies the bytes to a fresh plate key while carrying
    `kind: source.kind` unchanged.
  */
  it("accepts an accepted_candidate plate on a forked plate object", () => {
    expect(() => assertKey("accepted_candidate", plateKey)).not.toThrow();
  });

  it("accepts the shapes the other purposes have always had", () => {
    expect(() => assertKey("uploaded_reference", plateKey)).not.toThrow();
    expect(() => assertKey("reference_plate", plateKey)).not.toThrow();
    expect(() => assertKey("fork_copy", plateKey)).not.toThrow();
    expect(() => assertKey("evidence_crop", cropKey)).not.toThrow();
  });
});

describe("assertOwnedEvidenceStorageKey — what must still be refused", () => {
  /*
    THE NEGATIVE CONTROL THE CARD MADE MANDATORY. A guard on a permanent
    deletion path that has been widened is worth nothing unless the thing it
    was guarding against still fails — and it must fail on BOTH shapes, since
    the widening added one.
  */
  it("refuses another user's key on both shapes", () => {
    expect(() => assertKey("accepted_candidate", candidateKey, { userId: 2 }))
      .toThrow("Evidence key ownership is invalid");
    expect(() => assertKey("accepted_candidate", plateKey, { userId: 2 }))
      .toThrow("Evidence key ownership is invalid");
  });

  it("refuses another Cast's key on both shapes", () => {
    expect(() => assertKey("accepted_candidate", candidateKey, { modelId: 36 }))
      .toThrow("Evidence key ownership is invalid");
    expect(() => assertKey("accepted_candidate", plateKey, { modelId: 36 }))
      .toThrow("Evidence key ownership is invalid");
  });

  /*
    THE WIDENING IS NARROW, and these are what prove it. Exactly one purpose
    gained exactly one namespace; a guard that had simply stopped checking the
    namespace would pass every one of these.
  */
  it("refuses a namespace no writer produces for that row", () => {
    expect(() => assertKey("evidence_crop", candidateKey)).toThrow();
    expect(() => assertKey("evidence_crop", plateKey)).toThrow();
    expect(() => assertKey("uploaded_reference", candidateKey)).toThrow();
    expect(() => assertKey("reference_plate", candidateKey)).toThrow();
    expect(() => assertKey("fork_copy", candidateKey)).toThrow();
    expect(() => assertKey("reference_plate", cropKey)).toThrow();
    expect(() => assertKey("accepted_candidate", cropKey)).toThrow();
  });

  it("refuses a key that is not an evidence key at all", () => {
    expect(() => assertKey("accepted_candidate", "casting-v2/candidates/whatever.webp")).toThrow();
    expect(() => assertKey("accepted_candidate", `users/${USER}/models/${MODEL}/evidence/plates/../../../etc.webp`)).toThrow();
  });

  /*
    FAIL CLOSED. The rule this replaced was `evidence_crop ? crop : plate`, so a
    purpose added to either schema enum was silently handed a namespace nobody
    chose. An unrecognised purpose now gets none.
  */
  it("refuses a purpose nobody has declared a namespace for", () => {
    expect(() => assertKey("something_new" as EvidenceStoragePurpose, plateKey)).toThrow();
    expect(() => assertKey("something_new" as EvidenceStoragePurpose, candidateKey)).toThrow();
  });

  /*
    #308's diagnosis was spent inside the word "ownership" while the user and
    the model both matched. The two failures say different things now, and this
    arm is what stops them being merged back into one sentence.
  */
  it("says ownership and namespace differently", () => {
    let ownership = "";
    let namespace = "";
    try { assertKey("accepted_candidate", candidateKey, { userId: 2 }); } catch (error) { ownership = (error as Error).message; }
    try { assertKey("evidence_crop", candidateKey); } catch (error) { namespace = (error as Error).message; }
    expect(ownership).not.toBe("");
    expect(namespace).not.toBe("");
    expect(ownership).not.toBe(namespace);
  });
});

describe("the namespace table is a table, not a default", () => {
  /*
    LIST-STOPS-BEING-THE-LIST. The population is DERIVED from the schema enums
    rather than transcribed, so a purpose added there with no namespace decision
    reddens here — which is the whole reason the mapping became an exhaustive
    Record instead of an `else`.
  */
  it("has a decision for every purpose the schema can produce", () => {
    const purposes: EvidenceStoragePurpose[] = [
      ...CASTING_EVIDENCE_INGESTION_PURPOSES,
      ...MODEL_REFERENCE_PLATE_KINDS,
      "evidence_crop",
    ];
    for (const purpose of purposes) {
      const accepted = [plateKey, candidateKey, cropKey].filter((key) => {
        try { assertKey(purpose, key); return true; } catch { return false; }
      });
      expect(accepted.length, `${purpose} accepts no key shape at all`).toBeGreaterThan(0);
    }
  });
});
