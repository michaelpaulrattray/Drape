/**
 * WHEN A CANDIDATE'S CHILD STORE IS ABSENT — one error reader, one arming
 * question per store, and now TWO consumers.
 *
 * Everything here lived inside `candidateRetention.ts` until #1935, when
 * account deletion became the second thing that has to purge a candidate's
 * whole tree. Two copies of *"is this the driver saying no such table"* and two
 * copies of *"is the door that writes this store open"* is working law 4
 * exactly — a second list shadowing a source of truth — and the drift would be
 * made of a customer's pictures left at permanently public URLs. So the
 * decisions moved here and the prose moved with them, paragraph for paragraph:
 * a summary that loses a correction re-opens the mistake it was written about.
 *
 * What a caller supplies is only its own name, for the log line. The DECISION —
 * tolerate or throw — is this module's, identically for every road.
 */
import { createModuleLogger } from "../logging/logger";
import {
  REFERENCE_INTENTS,
  referenceIntentIngestionForm,
  referenceIntentIsOpen,
} from "../../shared/referenceIntents";
import {
  castingInkDesignArmed,
  castingReferenceAttachArmed,
  castingReferenceLibraryArmed,
  castingScanTableArmed,
  castingInkDeliveryCropArmed,
} from "./castingV2Scope";

const log = createModuleLogger("castingV2/candidateStoreTolerance");

/**
 * IS THIS THE DRIVER SAYING "NO SUCH TABLE"? — asked of the whole chain.
 *
 * **Production taught this, within two minutes of the deploy.** The first
 * version read `error.code` off the top-level error, which is the shape a
 * hand-written test error has and NOT the shape the real path produces: Drizzle
 * wraps the driver's error in a `DrizzleQueryError` and hangs the original off
 * `cause`, so the tolerance never fired, the sweep threw, and 56 candidates
 * went uncollected on the first pass.
 *
 * A test that invents the error it expects is testing its own invention. The
 * chain walk is the fix; asserting BOTH shapes is what keeps it honest.
 */
export function isMissingTable(error: unknown): boolean {
  for (let link: unknown = error, depth = 0; link && depth < 5; depth += 1) {
    const { code, errno, cause } = link as { code?: string; errno?: number; cause?: unknown };
    if (code === "ER_NO_SUCH_TABLE" || errno === 1146) return true;
    link = cause;
  }
  return false;
}

/**
 * The reference CROP's arming condition is not a flag at all.
 *
 * There is no `CASTING_REFERENCE_CROP_SCOPE`. What decides whether a crop can
 * exist is the ingestion map itself: a crop-form feature whose `open` is false
 * cannot be acted on by any door, so no row can have been written. So the
 * tolerance is armed by the MAP, derived rather than listed (law 4) — the day
 * somebody flips `hair.open`, a missing table stops being an empty set and
 * becomes a fault said out loud, without anybody remembering to edit this.
 */
function cropStoreArmed(): boolean {
  return REFERENCE_INTENTS.some(
    (key) => referenceIntentIngestionForm(key) === "crop" && referenceIntentIsOpen(key),
  );
}

/**
 * Every child store a candidate owns, with the question that decides whether an
 * absent table is an empty set or a fault — and the sentence said out loud when
 * it is the former.
 *
 * ⚠ **`armed` IS A FUNCTION AND IS CALLED AT THE MOMENT OF THE ERROR, never
 * read once at import.** A flag's position is a runtime fact; a record of
 * booleans built at module load would answer the question the process started
 * with rather than the one it is in.
 */
export const CANDIDATE_CHILD_STORES = {
  /**
   * THE ONE TOLERATED FAILURE OF THE SEGMENT PURGE — now UNCONDITIONAL, and the
   * reason it stopped having a condition is the whole point of this comment.
   *
   * Its seven siblings below each read their own `*Armed()`: tolerate a missing
   * table only while the feature that writes it is off, because an armed feature
   * over a missing table is a fault a warning would bury. **The segment store has
   * no such flag any more.** #1160 retired it on his word of 2026-09-24 — *"Retire
   * both. The paste road is gone; nothing reads these"* — so
   * `CASTING_SEGMENTS_SCOPE`, `castingSegmentsArmed()` and everything that wrote a
   * segment are gone, and the condition this entry used to ask could only ever
   * answer false.
   *
   * ⚠ SO IT IS WRITTEN AS THE CONSTANT IT HAS BECOME, rather than left as a call
   * that looks like a live question. The store is permanently unarmed and
   * `casting_segments` is a table nobody writes, kept only until the founder drops
   * it — a destructive migration, and therefore his act and not a shift's. An
   * absent table is EXPECTED from here, in both directions: before his drop it
   * holds zero rows (measured, both worlds, all time), and after it there is no
   * table to read.
   *
   * ⚠ AND WHAT THAT COSTS, NAMED RATHER THAN QUIETLY DROPPED: the arm proving
   * *an armed store refuses to tolerate absence* dies with the flag, because
   * nothing arms the store. The half that was doing the real work is untouched —
   * every other error, a lock, a connection, a syntax mistake of ours, is still
   * rethrown, and that is the difference between a purge that is a fact and one
   * that is a claim.
   */
  segments: {
    armed: () => false,
    absence:
      "the segment store's table is absent — the store is retired (#1160) and nothing has ever written a row to it, so nothing is being left behind.",
  },
  /**
   * The same tolerance, on the same terms, for the reference library.
   *
   * Its table lands by ceremony too, so the window where the code knows about
   * `casting_reference_library` and the database does not is real — and empty,
   * because the flag that would write a row is off until after the ceremony. The
   * moment the library is armed, a missing table stops being an empty set and
   * starts being a fault the sweep says out loud.
   */
  referenceLibrary: {
    armed: castingReferenceLibraryArmed,
    absence:
      "the reference library's table is absent — nothing can have been written to it, so nothing is being left behind. This is expected only before the library migration lands.",
  },
  /**
   * The same tolerance, on the same terms, for the kept face scan (0032).
   *
   * Its table lands by ceremony too, and the window where this code knows about
   * `casting_face_scans` and the database does not is real and empty. Armed, a
   * missing table stops being an empty set and becomes a fault said out loud.
   *
   * ⚠ **THE REASON IT IS EMPTY CHANGED, AND THE CONCLUSION DID NOT** (2026-08-23,
   * fable-1445 §2). This paragraph used to say *the flag that would write a row
   * refuses to arm until after the ceremony*, and that stopped being the whole
   * truth the day the render began filing CARRIED GEOMETRY here ungated — the
   * scan was only ever this table's first writer, not its meaning.
   *
   * What keeps the tolerance honest is the other end: `reMintCarriedGeometry`
   * catches an absent table, counts it and stands the picture up, so a world
   * without migration 0032 still has nothing in this table to be left behind. And
   * the loud signal for a missing table moved rather than disappeared — it is now
   * that writer's own countable line, which fires on every render instead of once
   * a sweep.
   */
  faceScans: {
    armed: castingScanTableArmed,
    absence:
      "the kept-scan table is absent — nothing can have been written to it, so nothing is being left behind. This is expected only before the scan-table migration lands.",
  },
  /**
   * A DESIGN (0034), and its arming question is the OR of the two doors that mint
   * one — never the studio flag alone.
   *
   * ⚠ **IT WAS THE STUDIO FLAG ALONE UNTIL #1158 SLICE 4B, AND THAT WAS THE BUG
   * THE RETIREMENT WOULD HAVE SPRUNG.** The studio retires on his ruling; the
   * take from an attached picture does not, and `inkReferenceMint.ts` is
   * `recordInkDesign`'s only surviving non-test caller. Armed by the retiring
   * flag, this would have flipped from *throw* to *swallow* the moment that
   * variable came off the service — over a table the surviving road still writes,
   * with no failing test and no error. `castingInkDesignArmed` is that OR, derived
   * where the scopes live rather than spelled a second time here (law 4).
   */
  inkDesigns: {
    armed: castingInkDesignArmed,
    absence:
      "the ink design table is absent — neither the studio's upload nor the take from an attached picture is open, so nothing can have been written to it and nothing is being left behind.",
  },
  /**
   * And the same again for a PLATE (0037) — a different table with a different
   * migration, so a different tolerance rather than one that covers both.
   *
   * A plate cannot exist without a design, so it is armed by the DESIGN's own
   * question rather than by a third list of doors: whatever can mint a design can
   * reach a plate, and nothing else can. That is strictly wider than the plate's
   * own writer needs, because ⚠ **THERE IS NO WRITER AT ALL ANY MORE**:
   * `recordInkPlate` had no non-test caller (read 2026-09-24) and was DELETED in
   * #1158 slice 4e, so this table can no longer gain a row. Wider is still the
   * right direction for a tolerance, because every error on this side of the
   * question is a missing table said out loud rather than a row swallowed in
   * silence.
   *
   * ⚠ **THE FACT THAT USED TO STAND HERE WAS STALE AND SAID THE OPPOSITE OF THE
   * ROWS.** It read *"production has taken neither 0034 nor 0037"*; read at the
   * production rows on 2026-09-24, `casting_ink_designs`, `casting_ink_plates`
   * and `casting_ink_delivery_crops` are all PRESENT and all hold zero rows. So
   * this tolerance cannot fire on production at all today, and every word above
   * about it being the widest window was describing a database that has since
   * taken both migrations.
   */
  inkPlates: {
    armed: castingInkDesignArmed,
    absence:
      "the ink plate table is absent — no door that mints a design row is open, and a plate hangs off one, so nothing can have been written to it and nothing is being left behind.",
  },
  /**
   * And again for a reference CROP (0040) — a different table, a different
   * migration, and an arming condition that is not a flag at all
   * ({@link cropStoreArmed} carries why).
   */
  referenceCrops: {
    armed: cropStoreArmed,
    absence:
      "the reference crop table is absent — no crop-form feature is open, so nothing can have been written to it and nothing is being left behind. This is expected only before the 0040 migration lands.",
  },
  /**
   * And the same for an ATTACHMENT (0043).
   *
   * Its arming question is its own FLAG rather than the ingestion map, because an
   * attachment is not a form — any open intent can produce one, and the thing that
   * decides whether a row can exist is whether the attach door is open at all. The
   * moment it is, an absent table becomes a fault said out loud instead of a
   * tolerated warning, without anybody remembering to edit this.
   */
  referenceAttachments: {
    armed: castingReferenceAttachArmed,
    absence:
      "the reference attachment table is absent — the attach door is closed for everyone, so nothing can have been written to it and nothing is being left behind. This is expected only before the 0043 migration lands.",
  },
  /**
   * And the same again for a DELIVERED-TATTOO CROP (0049).
   *
   * Its arming question is neither a single flag nor the ingestion map: a crop
   * here cannot exist without a design row, and TWO doors mint one — the studio's
   * upload and the take from an attached picture. `castingInkDeliveryCropArmed`
   * is that OR, derived where the scopes live rather than spelled a second time
   * here (law 4).
   *
   * This clause lands with the migration and with the writer in one commit,
   * which is the ordering that matters most on this road: the object is a crop of
   * a real person's neck at a permanently public URL, and a row-driven sweep that
   * gained its clause afterwards would have missed every crop written in between.
   */
  inkDeliveryCrops: {
    armed: castingInkDeliveryCropArmed,
    absence:
      "the delivered-tattoo crop table is absent — no ink door is open, so nothing can have been written to it and nothing is being left behind. This is expected only before the 0049 migration lands.",
  },
} as const satisfies Record<string, { armed: () => boolean; absence: string }>;

export type CandidateChildStore = keyof typeof CANDIDATE_CHILD_STORES;

/**
 * The catch handler for one store's read, for one caller.
 *
 * Returns `[]` only when the table is genuinely absent AND the door that writes
 * it is shut. Every other error — a lock, a connection, a syntax mistake of
 * ours — is rethrown.
 */
export function tolerateAbsentCandidateStore(
  store: CandidateChildStore,
  context: string,
): (error: unknown) => never | [] {
  return (error: unknown) => {
    const { armed, absence } = CANDIDATE_CHILD_STORES[store];
    if (!isMissingTable(error) || armed()) throw error;
    log.warn(`[${context}] ${absence}`);
    return [];
  };
}
