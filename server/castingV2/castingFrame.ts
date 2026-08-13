/**
 * WHAT THE PHOTOGRAPH CONTAINS — the fifth refuse-before-dispatch door's fact.
 *
 * Four doors already refuse before anything is charged, and each of them is a
 * different sentence about why a render cannot be made:
 *
 *   absent        you cannot segment a thing that is not there   (D-213)
 *   silhouette    you cannot segment a shape not yet made        (D-218)
 *   occluded      you cannot edit what nothing can see           (D-226)
 *   already-true  there is nothing to do
 *   OUT OF FRAME  you cannot edit what the photograph does not contain
 *
 * **`occluded` is the near neighbour and it is not the same door** (fable-381
 * §A.1, and this sentence is the ruling's own): a waist under a t-shirt is
 * occluded; a waist below the crop line is not in the file. One could be
 * answered by a different garment, the other only by a different photograph.
 *
 * # Every row before this one was in frame by construction
 *
 * A casting portrait always contains the face, so eyes, brows, lips, skin and
 * hair never had to ask. The body row is the first that can name something the
 * camera did not take, which is why this module exists at all.
 *
 * # THE SHORTCUT, DECLARED, WITH THE TRIPWIRE THAT CATCHES IT
 *
 * The honest instrument is a per-frame test: read THIS photograph and say
 * whether her waist is in it. That is not built, and this is not it. What is
 * here is a table keyed to the ONE framing this product can currently produce —
 * `cohortPhotorealHuman`'s `FRAMING` constant asks every roll for *"waist-up"*
 * and *"from mid-torso up in a 2:3 portrait"*, and the delivered masters were
 * opened and looked at (the note's §0: cropped at roughly the lower ribs on
 * `2f00870e` and on anchor #178).
 *
 * So the shortcut is: **one framing, therefore one answer, therefore no read.**
 * It is legitimate only while the premise holds, so `castingFrame.test.ts`
 * asserts the premise against the prompt constant itself — the day a full-length
 * or three-quarter frame ships, that test fails and this table must become a
 * measurement rather than quietly declining a waist that is now in the picture.
 */
import type { Facet } from "./refineFacets";

/**
 * Whether the casting frame contains the thing this facet is about.
 *
 * Only the facets that can be OUT are listed: everything else in the vocabulary
 * is on the face or the upper body, which every frame contains by construction.
 * A facet with no entry is in frame — the default is the safe direction, because
 * a wrong `false` refuses an edit the customer could have had.
 */
const OUT_OF_FRAME: Partial<Record<Facet, string>> = {
  /*
    Her waist is below the crop. `hips` is not in the vocabulary at all (founder
    ruling, fable-382 §3: no piece rows), so it cannot be asked and does not need
    an entry — if it is ever added, it belongs here beside this one.
  */
  waist: "her waist",
};

/** What this facet is about, in the customer's own terms, when it is not in shot. */
export function outOfFrame(facet: Facet): string | null {
  return OUT_OF_FRAME[facet] ?? null;
}

/**
 * The one sentence the door says, and it makes no offer.
 *
 * The founder's ruling in fable-382 §3 is that an out-of-frame ask gets *"the
 * honest one-sentence decline, no recast offer"* — because an offer to re-cast
 * her at full length is a different product decision wearing a refusal's
 * clothes, and this frame is the one the sheet sells.
 *
 * It says NOTHING WAS CHARGED, because that is the fact the customer most needs
 * and the one a refusal is least trusted about.
 */
export function outOfFrameMessage(what: string): string {
  return `This photograph is framed from the mid-torso up, so ${what} is not in it — `
    + "that change would need a different photograph rather than an edit. Nothing was charged.";
}

/** The framing sentence this table is keyed to. Asserted, never assumed. */
export const FRAMING_PREMISE = "waist-up";
