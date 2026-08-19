/**
 * WHAT THE ANCHOR CANNOT SHOW RIDES INTO EVERY VIEW AS WORDS — arrow 6 of the
 * founder's own model of refine (2026-08-19, verbatim):
 *
 * > *"when signing a cast to make the angles the refined image is supplied as
 * > the reference and a description so that any features not visible are not
 * > lost."*
 *
 * Half of that already held: a Sign anchors on the SELECTED refined variant and
 * those bytes ride every view as reference #1. The other half did not exist —
 * `composePackageViewPrompt` carries an identity-keep sentence, the view
 * directive, the wardrobe line and four constant blocks, and **nothing about
 * this person**. So a tail, clawed feet or cybernetic hands rode on nothing at
 * all into the three full-body views the customer had just paid for.
 *
 * # THE BOUND THIS RUNS UNDER — founder, fable-876 §2, verbatim
 *
 * > *"i think yes i just dont know what to expect obviously the reference is
 * > still king."*
 *
 * So: the anchor is the identity authority; a clause may supply ONLY facts the
 * anchor cannot show; it never re-describes the person; and where words and
 * pixels could disagree, the pixels win. The last of those is written into the
 * composed sentence itself rather than trusted to the blocks below it.
 *
 * # HOW THE CODE KNOWS A FACT IS NOT SHOWN — derived, no model call
 *
 * `anchorPresentsIn(region, "master")`. The master framing is the frame every
 * paid edit is painted into and therefore the frame the Sign anchor IS; it
 * presents `head · neck · torso · arms · wholeBody` and does not present
 * `hands · belowWaist · feet`. A feature whose region presents is carried by the
 * PIXELS and rides nothing — re-describing it is exactly the drift the bound
 * forbids. A feature whose region does not present has no other carrier, so its
 * words ride.
 *
 * **Which features can even reach the second bucket is a fact about the
 * catalogue, not a hope.** Every entry in `referenceSlotCatalogue.ts` is a head,
 * face or whole-body feature, and the master presents all of those regions. So
 * the riding set is exactly the OPEN kinds anchored below the waist, at the
 * hands or at the feet, with the region read off `casting_open_kind_properties`
 * rather than guessed. The rule cannot grow into *describe the person* by
 * accident, because a face slot is structurally incapable of entering it —
 * `viewFeatureWords.test.ts` drives that as its own arm.
 *
 * # AND IT RIDES EVERY VIEW, including the ones that cannot show it
 *
 * The same asymmetry the founder already ruled for plates
 * (`inkViewReferences.ts`). A view that cannot show a tail does not show one.
 * Withholding has the quiet failure instead: a frame that happens to catch the
 * surface, rendered by an engine that was never told, comes back with ordinary
 * skin and the customer's feature has vanished from one frame of six with
 * nothing in the record saying why.
 */
import { anchorPresentsIn, type BodyAnchorRegion } from "../../shared/bodyAnchorRegions";
import { openKindOfSlot, parseSlot } from "./referenceSlots";

/**
 * One feature the anchor cannot show, as a view render is told about it.
 *
 * The slot travels so an outcome can NAME what did or did not ride — a fact
 * that silently failed to ride is the same defect as a control nobody invokes.
 */
export type CarriedFeatureWords = {
  readonly slot: string;
  /** How the feature is spoken about, bare and plain: `tail`, `wings`. */
  readonly noun: string;
  /** The slot's live declarative stack, oldest first. */
  readonly words: readonly string[];
  readonly region: BodyAnchorRegion;
};

/**
 * The caps, stated rather than discovered.
 *
 * Overflow is REPORTED by {@link selectCarriedFeatureWords} rather than dropped
 * quietly: a cap that silently truncates reads, from the outside, exactly like a
 * feature that was never there. No Cast in production is within reach of either
 * number.
 */
export const MAX_CARRIED_FEATURES = 5;
export const MAX_CLAUSE_CHARACTERS = 600;

/** What a library entry looks like to this module — the fields it reads. */
export type FeatureEntry = {
  readonly slot: string;
  readonly noun: string;
  readonly words: readonly string[];
  readonly vacant?: boolean;
  /**
   * Whether the branch holds a CROP of this feature — `deriveLibrary`'s own
   * `carry`. Present means a segmenter FOUND the thing in a delivered frame and
   * cut it, which is a read fact about a picture rather than an inference from
   * geometry. See {@link selectCarriedFeatureWords}.
   */
  readonly cropped?: boolean;
};

export type FeatureWordsSelection = {
  readonly carried: readonly CarriedFeatureWords[];
  /**
   * Every entry that did NOT ride, and why — one line per feature, the single
   * surface fable-1005 §2 ordered for the plate lane. `shown` is the ordinary
   * answer and is not a problem; `regionUnknown` and `capped` are.
   */
  readonly declined: readonly {
    readonly slot: string;
    readonly reason: "shown" | "cropped" | "vacant" | "noWords" | "regionUnknown" | "capped";
  }[];
};

/**
 * WHERE EACH CATALOGUED FEATURE LIVES ON THE BODY.
 *
 * A TOTAL RECORD over `referenceSlotCatalogue.ts`'s features, and the totality
 * is the point rather than the contents: every one of these regions presents in
 * the master framing, so no catalogued feature can ever ride words — and the day
 * somebody catalogues a feature that does NOT (nails, an ankle), the missing row
 * arrives as a failing test instead of as a silent `regionUnknown`.
 *
 * The catalogue's own `region` field is a CUTTING region — which patch of a face
 * a crop comes from — and is a different vocabulary answering a different
 * question. Reusing it here would be the unowned-axis collapse with two meanings
 * sharing one word.
 */
const CATALOGUE_FEATURE_REGION: Readonly<Record<string, BodyAnchorRegion>> = Object.freeze({
  hair: "head",
  "facial-hair": "head",
  eye: "head",
  brow: "head",
  lashes: "head",
  nose: "head",
  lips: "head",
  teeth: "head",
  cheekbone: "head",
  jaw: "head",
  chin: "head",
  ear: "head",
  horns: "head",
  earring: "head",
  glasses: "head",
  "nose-stud": "head",
  /* Not the head, and still shown: the master is a waist-up frame. */
  build: "wholeBody",
  skin: "wholeBody",
});

/**
 * WHERE THIS SLOT'S FEATURE LIVES — the one resolver, both vocabularies.
 *
 * A catalogued slot answers from the record above. An open kind answers from
 * the properties row the open lane minted for it (`casting_open_kind_properties`
 * — one text read per new noun ever, already bought at the acceptance door), and
 * `null` when nobody has answered. Null is not folded to a neighbour: an unknown
 * region riding would be a guess about a customer's body.
 */
export function regionForSlot(
  slot: string,
  regionOfKind: (kind: string) => BodyAnchorRegion | null,
): BodyAnchorRegion | null {
  const open = openKindOfSlot(slot);
  if (open !== null) return regionOfKind(open.kind);
  const parsed = parseSlot(slot);
  if (parsed === null) return null;
  return CATALOGUE_FEATURE_REGION[parsed.feature] ?? null;
}

/** The catalogued features this module has a region for — the totality control reads it. */
export function cataloguedFeaturesWithRegion(): readonly string[] {
  return Object.keys(CATALOGUE_FEATURE_REGION);
}

/**
 * WHICH OF THIS FACE'S FEATURES THE ANCHOR CANNOT SHOW.
 *
 * `regionOf` answers where a slot's feature lives, or `null` for *nobody has
 * answered* — a kind whose properties row was never written. **Null declines**,
 * on the same fail-closed side `readKindProperties` chose: an unknown region
 * riding would be a guess about a customer's body, and the cost of declining is
 * that the feature carries exactly as it does today, which is nothing.
 */
export function selectCarriedFeatureWords(input: {
  readonly entries: readonly FeatureEntry[];
  readonly regionOf: (slot: string) => BodyAnchorRegion | null;
}): FeatureWordsSelection {
  const carried: CarriedFeatureWords[] = [];
  const declined: Array<{
    slot: string;
    reason: "shown" | "cropped" | "vacant" | "noWords" | "regionUnknown" | "capped";
  }> = [];

  for (const entry of input.entries) {
    /* A feature she has taken off is not a feature the anchor is failing to
       show. The library keeps the row; this lane must not resurrect it. */
    if (entry.vacant === true) {
      declined.push({ slot: entry.slot, reason: "vacant" });
      continue;
    }
    const words = entry.words.map((word) => word.trim()).filter((word) => word !== "");
    if (words.length === 0) {
      declined.push({ slot: entry.slot, reason: "noWords" });
      continue;
    }
    const region = input.regionOf(entry.slot);
    if (region === null) {
      declined.push({ slot: entry.slot, reason: "regionUnknown" });
      continue;
    }
    if (anchorPresentsIn(region, "master")) {
      declined.push({ slot: entry.slot, reason: "shown" });
      continue;
    }
    /*
      THE SECOND CONDITION, and the probe is what bought it (fable-1058 §2).

      Geometry answers a PROSPECTIVE question — may this ask be served on this
      framing — and `anchorPresentsIn`'s own docblock says it does not answer
      whether the thing is VISIBLE in a delivered photograph, because that is a
      fact about a picture and this program READS such facts. The first version
      of this rule used it for exactly the question it disclaims, and the probe
      caught it at the frames: a tail anchored `belowWaist` was drawn curling up
      beside her shoulder, plainly IN the waist-up master, and would have been
      re-described in words the pixels were already carrying.

      A live CROP is that read fact, already bought: it exists because a
      segmenter found the thing in a delivered frame and cut it, with its own
      coverage guard. So a cropped feature is carried by the picture and rides
      nothing.
    */
    if (entry.cropped === true) {
      declined.push({ slot: entry.slot, reason: "cropped" });
      continue;
    }
    if (carried.length >= MAX_CARRIED_FEATURES) {
      declined.push({ slot: entry.slot, reason: "capped" });
      continue;
    }
    carried.push({ slot: entry.slot, noun: entry.noun, words, region });
  }

  return { carried, declined };
}

/**
 * The clause, or the empty string — and whatever the character cap pushed out.
 *
 * The empty string is load-bearing: the caller appends nothing at all for it, so
 * a Cast with nothing hidden sends the prompt this product has always sent,
 * byte for byte. That inertness is asserted at the wire, because a composer that
 * cannot produce NOTHING would be re-describing the person on every Sign.
 *
 * `dropped` is returned rather than swallowed for the reason the selection
 * reports its own declines: a cap that silently truncates reads, from the
 * outside, exactly like a feature that was never there.
 */
export function composeViewFeatureWordsClause(
  carried: readonly CarriedFeatureWords[],
): { clause: string; dropped: readonly CarriedFeatureWords[] } {
  if (carried.length === 0) return { clause: "", dropped: [] };
  /*
    THE CHARACTER CAP TRIMS FEATURES, NEVER A SENTENCE. A clause cut mid-word
    would hand the engine a fact with its end missing, which is worse than one
    fact fewer. So it drops whole features from the end until the composition
    fits, and hands back what it dropped.
  */
  let kept = carried;
  let clause = clauseFor(kept);
  while (clause.length > MAX_CLAUSE_CHARACTERS && kept.length > 1) {
    kept = kept.slice(0, -1);
    clause = clauseFor(kept);
  }
  return { clause, dropped: carried.slice(kept.length) };
}

function clauseFor(carried: readonly CarriedFeatureWords[]): string {
  return [
    "ALSO TRUE OF THIS PERSON, and not visible in the reference photograph:",
    ...carried.map((feature) => `- ${feature.noun}: ${feature.words.join("; ")}`),
    "Draw these where they belong on the body, in any view whose frame reaches that "
    + "part of them; a view that does not reach it simply does not show them. "
    + "Everything the reference photograph DOES show is authoritative — do not "
    + "re-imagine the face, hair, skin or build from these words.",
  ].join("\n");
}
