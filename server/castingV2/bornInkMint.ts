/**
 * A CAST BORN WITH TATTOOS, WRITTEN DOWN — 7b(a)'s roll-time row.
 *
 * The brief itself says so. Production roll 129's verbatim words are
 * *"Bare-chested, displaying extensive black-and-grey ornamental tattoos
 * covering most of his chest, shoulders, upper arms, and lower neck."* Nobody
 * uploaded a design and nobody typed a refine, so **the brief is the document**
 * — which is the only route to D-137's boundary that does not need a picture
 * (fable-1381).
 *
 * # THIS IS THE ONLY WRITER, and that is the boundary made structural
 *
 * fable-1381: *"the roll-time mint is the ONLY writer of the born row; no
 * refine path may create one."* A prefix nothing on the refine road spells is
 * that rule as a fact about the code rather than one somebody has to remember
 * — see `BORN_INK_SLOT_PREFIX`'s own consumer-walk table.
 *
 * # WHAT A ROW IS, AND WHAT IT IS NOT
 *
 * One words-only row per described REGION, keyed `bornInk:<region>` from the
 * closed eight, `variantId: null` because it is minted from the candidate's own
 * master and belongs to every branch — the same provenance the panel already
 * reads as *"she came with it"*, which is exactly what a cast born with tattoos
 * is.
 *
 * It is **recorded and disclosed; it is not pixels and it is not editable.**
 * 7b-ii — the sign-mint that would make it a picture — is not designed and not
 * started, and waits on the fable-1296 §3 court. The row's own lane says the
 * same in code: `selectCarriedFeatureWords` declines it `markingDiscloses`,
 * because a tattoo under fabric has zero visible consequence and carrying its
 * words would either do nothing or fight the view prompt's placement
 * discipline (fable-1396 §2, law 8's ontology — a body part is part of the
 * person; a marking is on a surface, and a covered surface shows nothing).
 *
 * # ⚠ HER CANDIDATE BEATS OUR RECORD (endorsed fable-1412 (b))
 *
 * She paid for a face and it landed. Refusing to deliver it because a
 * disclosure row did not write is the wrong trade, so every failure here is
 * caught and the candidate stands — the thumbnail courtesy's shape, one block
 * along in `rollService`.
 *
 * **The honest cost, and it is why the log is what it is**: the gap is silent
 * to her. If this writer starts failing routinely, born casts quietly stop
 * disclosing and nothing says so — the inert-control shape with a customer on
 * the other end. So the failure is COUNTABLE rather than anecdotal:
 * {@link BORN_INK_NOT_RECORDED} is one grep, and every line carries the roll,
 * the candidate and the regions that were lost.
 */
import { createModuleLogger } from "../logging/logger";
import { recordReferenceRows, type ReferenceRowToRecord } from "../db/castingV2ReferenceLibrary";
import type { StatedInk } from "./castingIntent";
import { bornInkSlotKey } from "./referenceSlots";

const log = createModuleLogger("castingV2/bornInkMint");

/**
 * THE REASON A BORN-INK ROW WAS NOT WRITTEN — one string, so the count is one
 * grep (condition of fable-1412 (b), the `sideUnread` shape).
 *
 *     grep bornInkNotRecorded <the service log>
 *
 * counts it, and each line carries the roll, the candidate and the regions. No
 * table: a row per non-event is a schema bought for a number, and the number is
 * already in the log the service writes.
 */
export const BORN_INK_NOT_RECORDED = "bornInkNotRecorded";

/**
 * A READING THAT FELL BACK — the other thing worth counting, and the reason
 * fable-1381 ruling 2 refused a SILENT fallback.
 *
 * `parseStatedInk` answers `wholeBody` with `readFailed: true` when the brief
 * named ink and no region survived. That is never WRONG about where the ink is,
 * only wider than the truth — and *"a silent fallback is how a bad reader hides
 * for six months"*.
 *
 * ⚠ **The provenance is not on the library row, because there is no column for
 * it and inventing one to hold a boolean the roll already stores would be the
 * mirror working law 4 forbids.** It is persisted with the READING, on the
 * roll's own `compiledBrief.intent.statedInk.readFailed`, reachable from any
 * row through candidate → roll — and it is counted here, at the moment it
 * decides a row, which is what the ruling was actually protecting:
 *
 *     grep bornInkRegionUnread <the service log>
 */
export const BORN_INK_REGION_UNREAD = "bornInkRegionUnread";

/**
 * HOW THE PRODUCT SPEAKS ABOUT A BORN-INK ROW — bare and plain, like every noun
 * in the library (`LibraryEntry.noun`).
 *
 * The same word on every region's row, deliberately. It is TRUE of all eight,
 * it takes the possessive that a marking on her should take (*"his tattoos"*,
 * never *"the tattoos"*), and it invents nothing. A per-region LABEL — whether
 * two rows read *"Chest tattoos"* and *"Arm tattoos"* on a panel — is a surface
 * decision with the founder's eye on it, and it belongs to 7b(b) rather than
 * being pre-empted by a table nobody has looked at.
 */
export const BORN_INK_NOUN = "tattoos";

/**
 * The rows a reading becomes — pure, so the shape is drivable without a
 * database (working law 3).
 *
 * `surface` is the tier, and it is the one the vocabulary was written for:
 * *"worn state on a slot … **words only, always**"*. Not `item` — the ink lane's
 * tier — because that one's own reason is *"she did not arrive with it, the
 * master does not hold it, and it arrives through an edit carrying its own
 * picture"*, and every clause of that is false here. Not `anatomy` either: a
 * tattoo is not the shape of her, and `anatomy` promises a crop that rides.
 *
 * Her words ride EVERY region's row rather than one of them: each row is a
 * record of what the brief said about ink at that place, and the brief said one
 * thing about all of them. Nothing downstream reads them today —
 * `markingDiscloses` declines the lot — so this is the honest shape rather than
 * a load-bearing choice, and it is stated so the day something does read them
 * nobody has to guess why they repeat.
 */
export function bornInkRows(statedInk: StatedInk | null): ReferenceRowToRecord[] {
  if (statedInk === null) return [];
  if (statedInk.words.length === 0) return [];
  return statedInk.regions.map((region) => ({
    role: "carry" as const,
    slot: bornInkSlotKey(region),
    tier: "surface" as const,
    noun: BORN_INK_NOUN,
    words: statedInk.words,
  }));
}

export type BornInkMintInput = {
  userId: number;
  candidateId: number;
  /** For the log line only — a count nobody can trace back is half a count. */
  rollPublicId: string;
  candidatePublicId: string;
  statedInk: StatedInk | null;
};

export type BornInkMintResult = {
  /** How many rows reached the library. Zero is the ordinary answer. */
  written: number;
  /** True when the write threw and the candidate stands without its record. */
  failed: boolean;
};

/**
 * Write this candidate's born-ink rows, and never let that failure reach her.
 *
 * Returns rather than throws, for the reason in the header: the caller has
 * already delivered a face she paid for.
 */
export async function mintBornInkRows(
  input: BornInkMintInput,
  dependencies?: { record?: typeof recordReferenceRows },
): Promise<BornInkMintResult> {
  const rows = bornInkRows(input.statedInk);
  if (rows.length === 0) return { written: 0, failed: false };

  const about = {
    roll: input.rollPublicId,
    candidate: input.candidatePublicId,
    regions: input.statedInk?.regions ?? [],
  };

  if (input.statedInk?.readFailed === true) {
    log.warn(
      { ...about, reason: BORN_INK_REGION_UNREAD },
      "[bornInkMint] bornInkRegionUnread — the brief named ink and no region survived, "
      + "so the row is filed at wholeBody: wider than the truth, never wrong about it",
    );
  }

  const record = dependencies?.record ?? recordReferenceRows;
  try {
    /* `variantId: null` with the candidate as the proved parent — a row minted
       from the candidate's own master, which is what a cast BORN with something
       has. No manifest: words-only rows write no objects. */
    const written = await record({
      userId: input.userId,
      variantId: null,
      candidateId: input.candidateId,
      rows,
    });
    log.info({ ...about, rows: written.length }, "[bornInkMint] this cast was born with tattoos, and now the product knows");
    return { written: written.length, failed: false };
  } catch (error) {
    log.error(
      { ...about, reason: BORN_INK_NOT_RECORDED, err: String(error).slice(0, 160) },
      "[bornInkMint] bornInkNotRecorded — the candidate stands and its described tattoos were not written down",
    );
    return { written: 0, failed: true };
  }
}
