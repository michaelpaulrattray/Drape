/**
 * WHEN A REMOVAL LANDS SOMEWHERE NOTHING CAN SEE — the sentence, and the reading
 * that earns it (founder ruling, fable-398 §3: *"yes - why not"*).
 *
 * # The complaint this exists for
 *
 * She asks for the earrings to come off. The removal is real: the painter took
 * them off, the delivered frame is adjudicated against its own site, the slot is
 * retired and a vacancy is filed so every later render says the absence. And the
 * picture she gets back looks **identical to the one she had**, because her hair
 * was over her ears the whole time.
 *
 * Everything the product did was right and everything she can see says nothing
 * happened. That is the same crime D-181 names for a half-served ask — *a
 * product that quietly serves half an instruction and says nothing has decided
 * something on the user's behalf without telling them* — arriving from the other
 * direction: served in FULL, and invisible.
 *
 * # Two questions, asked in that order, because they are not the same question
 *
 * *Can anything see the site* and *what is in front of it* are separate, and
 * D-226 is the reason the obvious instrument answers neither: **a segmenter
 * asked for a covered ear returns nothing at all.** So the silence IS the first
 * reading, and the cause can never come from segmenting the ear — an instrument
 * whose passing state requires it to have read nothing.
 *
 *     IS IT VISIBLE    the site's own anatomy, segmented off the delivered
 *                      frame. Content of any size means she can see the place
 *                      the thing came off, so there is nothing to say and this
 *                      stops here — which is the common removal, at one read.
 *     WHAT IS OVER IT  only when the first came back empty: a landmark model
 *                      (which answers *where is the ear on this face* and still
 *                      answers when the ear is covered) against the hair matte
 *                      (segmentation, which by definition can see the thing in
 *                      front). That is D-226's shape exactly.
 *
 * `additionDestination` builds the corridor, scaled off the face's own span, and
 * `occludedShare` scores it alpha-weighted on both sides so a wisp at 30% hides
 * 30%. Both are ratified instruments with pinned floors and ceilings; neither is
 * written here.
 *
 * # Why the two sentences, and why the second one is not silence
 *
 * The hair test either names the cause or it does not, and the founder's ruled
 * sentence names it. A site hidden by something else — a hat, a hand, a
 * three-quarter turn — is rarer and MORE confusing, and silence there would
 * preserve the exact defect this was built for in its worst case (fable-407 §1).
 * So the fallback says only what was measured: the site could not be seen, the
 * thing is gone, and no claim about why.
 *
 * # The bar is INVISIBLE_AT, and it is inherited on purpose
 *
 * A second constant meaning "nothing would be visible" is the copy law 4
 * forbids, and the number is right for this claim for the same reason it is
 * right for the refusal it was set for: at 64% covered a third of the lobe is
 * showing, and *"you won't see this"* over a visible change is a lie on a
 * receipt. Near-total or the fallback.
 *
 * **DECLARED, because a bar that never fires reads as coverage.** D-226's own
 * set measured lobe occlusion at 0.0%–64.2% for studs and 0.0%–83.2% for drops,
 * and on `fresh-03` hair worn to the chest left the lobe only 17.9% covered.
 * None of those reach it. The faces this is for are the ones D-226 opens with —
 * an afro over the ear, where the segmenter returns nothing at all — and there
 * is no such specimen in the measured set, which is also why the ATTRIBUTION is
 * the half that can fall through to the fallback rather than the half that
 * decides whether anything is said. The score is logged on every removal that
 * reaches it, so the bar becomes a distribution rather than an anecdote.
 *
 * # Cost, and which frame
 *
 * One read on a landed removal; two more only when that read comes back empty.
 * Never a user's credits.
 *
 * **A read is not a call, and the difference is threefold here.** `ear` and
 * `eyes` are in `falRegionReader`'s bilateral set, so the reader cuts the frame
 * and asks three times — a face and two sides — to avoid answering about one of
 * a customer's ears. So the honest figures are ~3 provider calls on a landed
 * earring or glasses removal, ~1 on a nose stud, and 2 more (hair, landmark;
 * neither bilateral) when the site comes back empty. Flagged to the
 * latency-and-cost programme rather than rounded down.
 *
 * The frame is the DELIVERED one throughout, because the
 * question is *what will she see in the picture she now has* — an ask that
 * pinned her hair up and took the earrings off in one breath is perfectly
 * visible, and the master would call it hidden.
 */
import { LANDMARK_OF_ACCESSORY } from "./accessoryKinds";
import { capitalize, type CastPronouns } from "./castPronouns";
import { INVISIBLE_AT, binaryCoverage, occludedShare } from "./maskGeometry";
import { additionDestination, type RegionReader } from "./maskedRefine";

/** What the occluder is read as. One name, so the reading and the sentence agree. */
export const OCCLUDER = "hair";

/** What one landed removal's site measured, and how much of it was asked. */
export type SiteVisibility = {
  /** The kind whose site was read — `earring`, `glasses`, `nose stud`. */
  kind: string;
  /** False only when the site's own anatomy could not be found in the frame. */
  visible: boolean;
  /**
   * How much of the site her hair covers, 0..1 — `null` when it was never asked,
   * which is every visible site. Not a zero: *not measured* and *measured as
   * nothing in front* are the two answers this program keeps confusing.
   */
  hiddenShare: number | null;
  /** Named only when the hair is provably what is over it. */
  cause: "hair" | "unattributed" | null;
};

/**
 * WHETHER SHE WILL BE ABLE TO SEE THE PLACE THIS CAME OFF, and what is over it.
 *
 * Throws rather than returning a null for a kind it cannot place or a read it
 * cannot make — the caller is a delivered render and must swallow it, and a
 * silent null there would be indistinguishable from a measured "visible".
 */
export async function readSiteVisibility(input: {
  reader: RegionReader;
  /** The DELIVERED frame's bytes. See the header for why not the master. */
  frame: Buffer;
  /** The accessory kind id — the same key `vacantPhraseFor` is called with. */
  kind: string;
}): Promise<SiteVisibility> {
  const entry = LANDMARK_OF_ACCESSORY.find((candidate) => candidate.region === input.kind);
  if (!entry) throw new Error(`nothing in the placement table names "${input.kind}", so its site cannot be found`);
  /*
    THE FIRST QUESTION, AND USUALLY THE ONLY ONE. `absentIsAnswer` because an
    empty reply here is the finding rather than a failed question — D-226's own
    observation, and the reason the expensive half is never reached on an
    ordinary removal anyone can see.
  */
  const anatomy = await input.reader.region({
    image: input.frame,
    name: entry.site.question,
    absentIsAnswer: true,
  });
  if (binaryCoverage(anatomy) > 0) {
    return { kind: input.kind, visible: true, hiddenShare: null, cause: null };
  }
  /*
    TOGETHER, because they are two answers about one photograph and nothing in
    either depends on the other. One round trip rather than two on a path a
    customer is waiting on.
  */
  const [occluder, landmarks] = await Promise.all([
    input.reader.region({ image: input.frame, name: OCCLUDER, absentIsAnswer: true }),
    input.reader.landmark({ image: input.frame, name: entry.landmark }),
  ]);
  /*
    THE HAIR MATTE'S OWN PIXEL SPACE, never a size this module decided.

    `occludedShare` asserts the two masks are the same size, and the only space
    the caller can be sure of is the one the reader answered in. Building the
    corridor at a size read from the bytes separately would be a second opinion
    about the frame's dimensions, and the two would differ on the first reader
    that answers at its own resolution.
  */
  const site = additionDestination({
    landmarks,
    width: occluder.width,
    height: occluder.height,
    /* The SITE, not the jewellery. Whether a drop hangs below the lobe is a
       question about the object; this one is about the place it hangs from. */
  });
  const hiddenShare = occludedShare(site, occluder);
  return {
    kind: input.kind,
    visible: false,
    hiddenShare,
    cause: hiddenShare >= INVISIBLE_AT ? "hair" : "unattributed",
  };
}

/**
 * THE SENTENCE, in his words, with the person's own pronoun in it.
 *
 * *"Her ears are behind her hair, so you won't see this until her hair moves —
 * but she's no longer wearing earrings."* — the founder's own draft, offered in
 * chat and ruled as it stands (fable-398 §3). And when the cause is not proven,
 * the sentence that claims none (fable-407 §1):
 *
 *     "Her earrings weren't visible in this shot, so the picture looks the same
 *      — but she's no longer wearing them."
 *
 * Everything variable in either is DERIVED: the site and the worn phrases from
 * the placement table, the possessive and the subject from the cast's resolved
 * sex. A literal "her" would ship over a man's face.
 *
 * Neither says anything about money, like `partlyOutOfFrameNote` and unlike
 * every refusal in this service. Something WAS charged — this is a delivered
 * take — and borrowing a refusal's most reassuring clause for a paid outcome is
 * the reverse of the honesty it is here for.
 *
 * Null for a kind the table cannot speak for, so a caller cannot improvise one:
 * an absence sentence invented at a call site is the free-floating parallel
 * prose fable-195 ruled against. Null also for a VISIBLE site, so the decision
 * of whether to speak stays with the reading rather than with the caller.
 */
export function invisibleRemovalNote(input: {
  kind: string;
  pronouns: CastPronouns;
  /** What the reading concluded. `null` — a site she can see — says nothing. */
  cause: SiteVisibility["cause"];
}): string | null {
  if (input.cause === null) return null;
  const entry = LANDMARK_OF_ACCESSORY.find((candidate) => candidate.region === input.kind);
  if (!entry) return null;
  const { possessive, subject, plural } = input.pronouns;
  const gone = `but ${subject}${plural ? "'re" : "'s"} no longer wearing `;
  if (input.cause === "hair") {
    return `${capitalize(possessive)} ${entry.site.words} ${entry.site.plural ? "are" : "is"} behind `
      + `${possessive} ${OCCLUDER}, so you won't see this until ${possessive} ${OCCLUDER} moves — `
      + `${gone}${entry.worn.phrase}.`;
  }
  /* Everything this branch knows and nothing it does not: the site could not be
     seen and the thing is gone. It does not guess at a hat. */
  return `${capitalize(possessive)} ${entry.worn.possessed} ${entry.worn.plural ? "weren't" : "wasn't"} `
    + "visible in this shot, so the picture looks the same — "
    + `${gone}${entry.worn.plural ? "them" : "it"}.`;
}
