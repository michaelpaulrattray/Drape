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
 *
 * ⚠ **THAT LAST SENTENCE IS WRONG AND THE COUNTER-EXAMPLE IS ON THE RECORD —
 * THE TEST CANNOT FAIL THAT WAY** (opus-1112 §2c, from the Two Paths court,
 * 2026-08-23). It reads a PROMPT CONSTANT, and a wider frame shipped on two
 * paths **without that constant moving one byte**: the Wardrobe and Basics
 * sheets came back cropped at the hips with the hands in shot, against an
 * unpathed roll of the same day cropped at the chest
 * (`output/two-paths-court/FRAMING-STRIP.jpg`). The FRAMING sentences were
 * byte-identical across all three; what moved was the WARDROBE sentence beside
 * them, which on a pathed roll names legs and feet.
 *
 * **A test that pins what we SAY cannot see the picture disobeying it.** The
 * guard is kept — an instruction that changes still matters — and it now has a
 * second arm asserting its own blindness, so its green is not read as coverage.
 * The honest instrument is the per-frame read this header already calls the
 * honest one, and it is still not built.
 *
 * While no roll carries a path the table is exactly right for every roll in
 * production — read at the rows rather than at the flag, because ⚠ **this said
 * *"while the paths are flag-dark (`CASTING_TWO_PATHS_SCOPE` off everywhere)"*
 * until 2026-08-24 and the flag is `users:1` now** (the founder's own hand, on
 * his own account). Production held 208 rolls, 0 pathed, at the flip, so the
 * sentence's conclusion survived its premise. On a pathed cast its
 * `waist` entry refuses an edit the photograph could serve — the safe direction,
 * and a named prerequisite of the flip rather than a note here (founder card
 * FQ-a, 2026-08-23).
 *
 * ✅ **HE ANSWERED FQ-a: PULL IT BACK IN, and the prerequisite is now a
 * MEASUREMENT rather than a decision** (relayed fable-1460; build ruled
 * fable-1462). The wardrobe sentence keeps naming the whole outfit — a complete
 * line is what lets the sheet and the three full-length signed views agree — and
 * the FRAMING block now carries an explicit override saying the frame does not
 * widen for what the line describes below the crop.
 *
 * ⚠ **AND THAT CHANGES NOTHING ABOUT THIS FILE'S BLINDNESS.** The fix is another
 * INSTRUCTION, and this module's guard reads instructions; if the engine ignores
 * the new sentence exactly as it ignored the old ones, the test above stays green
 * and this table stays wrong on a pathed cast. **So the answer is not what makes
 * the premise true — the re-court at the pixels is** (one wardrobe roll, 160 dev
 * credits, authorised fable-1460), and if that frame comes back wide the
 * pre-agreed fallback is a decomposition scoped to the two lines we author. The
 * `waist` entry does not move on the strength of a sentence.
 */
import { REFINABLE_AXES, type RefineDelta } from "./refineDelta";
import { facetOfAxis, facetOfSubject, type Facet } from "./refineFacets";
import type { FreeSubject } from "./refineSubjects";

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
 * THE SAME ASK WITH WHAT THE PHOTOGRAPH DOES NOT CONTAIN TAKEN OUT OF IT.
 *
 * # Why the half that cannot be served must LEAVE the recipe, not just go unsaid
 *
 * *"A smaller waist and bigger arms"* is served for the arms — refusing a
 * sentence with a renderable half would take the arms away from her to be tidy
 * (fable-381 §A.1). But serving it is not the same as carrying it, and until
 * this function existed the waist rode along into everything downstream:
 *
 *   - the PROMPT, so the painter was told to change a waist it cannot see and
 *     answered by squeezing whatever torso is in shot;
 *   - the CAPTION, so the delivered face claimed a waist change as a fact
 *     about her (D-152's crime, from the other direction);
 *   - the VERIFICATION, which reads back a facet no frame can show;
 *   - and worst, the STORED RECIPE, which is base-anchored and composed into
 *     every later render on that branch — so one mixed sentence left a phantom
 *     instruction on her permanently, and no later ask could reach it to undo
 *     it, because the chain has no step that only says "waist".
 *
 * So the frame decides what is in the ask at all, once, here — before anything
 * is composed, claimed, painted, captioned, verified or stored. What the camera
 * did not take is not part of the edit; it is not a quiet failure of it.
 *
 * Both lanes are swept, and by FACET rather than by key, so a subject added to
 * either lane inherits the rule instead of needing to be remembered.
 */
export function withoutWhatIsOutOfFrame(delta: RefineDelta): { delta: RefineDelta; dropped: string[] } {
  const dropped: string[] = [];
  const record = (what: string) => {
    if (!dropped.includes(what)) dropped.push(what);
  };
  const kept: RefineDelta = { ...delta };

  for (const axis of REFINABLE_AXES) {
    if (kept[axis] === undefined) continue;
    const what = outOfFrame(facetOfAxis(axis));
    if (what === null) continue;
    record(what);
    delete kept[axis];
  }
  if (kept.free) {
    kept.free = { ...kept.free };
    for (const subject of Object.keys(kept.free) as FreeSubject[]) {
      const what = outOfFrame(facetOfSubject(subject));
      if (what === null) continue;
      record(what);
      delete kept.free[subject];
    }
    if (Object.keys(kept.free).length === 0) delete kept.free;
  }
  if (kept.absent) {
    kept.absent = { ...kept.absent };
    for (const subject of Object.keys(kept.absent) as FreeSubject[]) {
      const what = outOfFrame(facetOfSubject(subject));
      if (what === null) continue;
      record(what);
      delete kept.absent[subject];
    }
    if (Object.keys(kept.absent).length === 0) delete kept.absent;
  }
  return { delta: kept, dropped };
}

/** Everything the frame took out of one ask, in the customer's own terms. */
export function nameWhatIsMissing(dropped: readonly string[]): string {
  if (dropped.length <= 1) return dropped[0] ?? "";
  return `${dropped.slice(0, -1).join(", ")} and ${dropped[dropped.length - 1]}`;
}

/** The clause both sentences below share, so the two cannot drift apart. */
const FRAMED = "This photograph is framed from the mid-torso up, so";

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
  return `${FRAMED} ${what} is not in it — `
    + "that change would need a different photograph rather than an edit. Nothing was charged.";
}

/**
 * WHAT A HALF-SERVED ASK SAYS ABOUT THE HALF IT DID NOT SERVE (fable-386 §2).
 *
 * The delivered sibling of the sentence above, and it is the SAME LAW D-181
 * already settled for a dropped reference: *"a product that quietly serves half
 * an instruction and says nothing has decided something on the user's behalf
 * without telling them."* A paid ask silently half-served is that, from the
 * customer's side — they typed two things, paid once, and can see only one of
 * them in the picture.
 *
 * It deliberately does NOT say "nothing was charged", because something was:
 * this is a delivered take, and borrowing a refusal's most reassuring sentence
 * for a paid outcome would be the exact reverse of the honesty it is here for.
 */
export function partlyOutOfFrameNote(what: string): string {
  return `${FRAMED} ${what} is not in it — everything else you asked for was done, `
    + "and that part was left out of this take.";
}

/** The framing sentence this table is keyed to. Asserted, never assumed. */
export const FRAMING_PREMISE = "waist-up";
